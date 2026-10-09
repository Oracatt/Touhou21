import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildGitThlib,inventoryBuffers} from './engine-git.mjs';

export const PROJECT_ROOT=path.resolve(import.meta.dirname,'..');
export const shaFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const shaText=value=>createHash('sha256').update(value,'utf8').digest('hex');
const ordinal=(a,b)=>a<b?-1:a>b?1:0;
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true});
export const ALLOWED_UNRELATED_SOURCE_CHANGES=Object.freeze(['start-spellcard-editor.cmd']);

/** Unstaged editor-launcher preferences do not enter any copied or compiled
 * input. Every other tracked/index/untracked change blocks an SDK upgrade. */
export function inspectSourceState(source,{recorded=null}={}){
  const changes=git(source,['status','--porcelain=v1','-z']).split('\0').filter(Boolean).map(line=>{
    const status=line.slice(0,2),name=line.slice(3);
    assert.ok(status===' M'&&ALLOWED_UNRELATED_SOURCE_CHANGES.includes(name),'Source engine has unapproved local modifications: '+line);
    const file=inside(source,name),stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Excluded source file must be a regular file');
    return{path:name,status,bytes:stat.size,sha256:shaFile(file),headBlob:git(source,['rev-parse','HEAD:'+name]).trim()};
  });
  const state={gitClean:changes.length===0,dependencyInputsClean:true,excludedChanges:changes,
    policy:'All dependency/build inputs come from the pinned commit. Unstaged editor-launcher preferences are unrelated and never copied.'};
  if(recorded)assert.deepEqual(state,recorded,'Source state changed since it was recorded');
  return state;
}

export function safeRelative(value){
  assert.equal(typeof value,'string','Locked path must be a string');
  assert.ok(value.length>0&&!path.isAbsolute(value)&&!value.includes('\\')&&!value.includes(':')&&!value.includes('\0'),'Unsafe locked path');
  assert.ok(value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[.\s]$|[\x00-\x1f]/.test(part)&&!['.git','userdata','node_modules'].includes(part.toLowerCase())&&!/^\.env($|\.)/i.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),'Unsafe locked path');
  return value;
}
export function inside(root,relative){
  safeRelative(relative);const target=path.resolve(root,...relative.split('/')),prefix=path.resolve(root)+path.sep;
  assert.ok(target.startsWith(prefix),'Locked path escapes its root');return target;
}
export function inventoryTree(root){
  const files=[];
  function visit(directory){
    assert.ok(!fs.lstatSync(directory).isSymbolicLink(),'Dependency directory may not be a link');
    for(const name of fs.readdirSync(directory).sort(ordinal)){
      const file=path.join(directory,name),stat=fs.lstatSync(file);
      assert.ok(!stat.isSymbolicLink(),'Dependency inventory may not traverse links');
      if(stat.isDirectory())visit(file);
      else{assert.ok(stat.isFile(),'Dependency contains an unsupported filesystem object');
        files.push({path:path.relative(root,file).split(path.sep).join('/'),bytes:stat.size,sha256:shaFile(file)});}
    }
  }
  visit(root);return files.sort((a,b)=>ordinal(a.path,b.path));
}
/** Complete public subtree, never an old lock's remembered subset. Both the
 * filesystem and Git index must describe regular files without link traversal. */
export function inventoryTrackedThlibTree(source,directory){
  safeRelative(directory);
  const prefix='packages/thlib/'+directory,root=inside(source,prefix),base=path.resolve(source);
  let probe=root;
  while(true){assert.ok(!fs.lstatSync(probe).isSymbolicLink(),'Source public tree may not pass through a link or junction');
    if(probe===base)break;probe=path.dirname(probe);}
  const tracked=new Map();
  for(const record of git(source,['ls-files','--stage','-z','--',prefix]).split('\0').filter(Boolean)){
    const separator=record.indexOf('\t'),header=record.slice(0,separator).split(' '),name=record.slice(separator+1);
    assert.ok(separator>0&&header[2]==='0','Source public tree has an unresolved Git index entry');
    assert.ok(header[0]==='100644'||header[0]==='100755','Source public tree contains a nonregular Git entry: '+name);
    tracked.set(name,header[0]);
  }
  const files=inventoryTree(root).map(entry=>({...entry,path:directory+'/'+entry.path}));
  for(const entry of files)assert.ok(tracked.has('packages/thlib/'+entry.path),'Public thlib file is not tracked at the requested engine commit: '+entry.path);
  assert.equal(files.length,tracked.size,'Source public tree differs from its complete Git file inventory: '+directory);
  return files;
}
export function inventoryDigest(files){
  const hash=createHash('sha256');
  for(const file of [...files].sort((a,b)=>ordinal(a.path,b.path)))hash.update(`${file.path}\0${file.bytes}\0${file.sha256.toLowerCase()}\n`,'utf8');
  return hash.digest('hex');
}
function validateInventory(files,label){
  assert.ok(Array.isArray(files)&&files.length>0,label+' inventory must not be empty');const seen=new Set();
  for(const file of files){safeRelative(file.path);if(file.source)safeRelative(file.source);
    const name=file.path.toLowerCase();assert.ok(!seen.has(name),label+' has a duplicate/case-colliding path');seen.add(name);
    assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
}
export function readEngineLock(root=PROJECT_ROOT){
  const lock=JSON.parse(fs.readFileSync(path.join(root,'engine.lock.json'),'utf8'));
  assert.equal(lock.format,'touhou21-engine-lock-v2','Only the committed TypeScript engine lock format is supported');
  assert.equal(lock.engine,'TS-STG');assert.equal(lock.library,'@ts-stg/thlib');assert.equal(lock.thlibContent,'git-typescript-build');
  assert.match(lock.commit,/^[a-f0-9]{40}$/);assert.match(lock.executableSha256,/^[a-f0-9]{64}$/);
  assert.equal(lock.sourceModified,false,'Dependency inputs must be committed; dirty snapshots are unsupported');
  assert.deepEqual(lock.supportedBackends,['v8','quickjs']);assert.equal(lock.backend,'v8');
  if(lock.sourceState){assert.equal(lock.sourceState.dependencyInputsClean,true);assert.ok(Array.isArray(lock.sourceState.excludedChanges));
    assert.equal(lock.sourceState.gitClean,lock.sourceState.excludedChanges.length===0);
    for(const entry of lock.sourceState.excludedChanges){assert.ok(ALLOWED_UNRELATED_SOURCE_CHANGES.includes(entry.path));assert.equal(entry.status,' M');assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.match(entry.headBlob,/^[a-f0-9]{40}$/);}}
  validateInventory(lock.thlibFiles,'Library');validateInventory(lock.runtimeFiles,'Runtime');
  assert.equal(inventoryDigest(lock.thlibFiles),lock.thlibSha256,'Invalid library inventory digest');
  assert.equal(inventoryDigest(lock.runtimeFiles),lock.runtimeSha256,'Invalid runtime inventory digest');
  const build=lock.thlibBuild;assert.ok(build,'Committed TypeScript build provenance is required');
  assert.equal(build.compiler.name,'typescript');assert.match(build.compiler.version,/^\d+\.\d+\.\d+$/);
  for(const name of ['implementationSha256','packageSha256','standardLibrarySha256'])assert.match(build.compiler[name],/^[a-f0-9]{64}$/);
  validateInventory(build.sourceFiles,'Library source');validateInventory(build.outputFiles,'Library output');
  assert.equal(inventoryDigest(build.sourceFiles),build.sourceSha256,'Invalid TypeScript source inventory digest');
  assert.equal(inventoryDigest(build.outputFiles),build.outputSha256,'Invalid TypeScript output inventory digest');
  assert.ok(build.sourceFiles.every(file=>!file.path.startsWith('dist/')),'Compiled files cannot be source inputs');
  assert.ok(build.sourceFiles.filter(file=>file.path.startsWith('src/')).every(file=>file.path.endsWith('.ts')),'Library source must be TypeScript');
  assert.ok(build.outputFiles.every(file=>file.path.startsWith('dist/')),'Build products must stay under dist');
  assert.deepEqual([...build.sourceFiles,...build.outputFiles].sort((a,b)=>ordinal(a.path,b.path)),lock.thlibFiles,'Library snapshot must exactly combine committed sources and generated output');
  const binary=lock.runtimeFiles.find(file=>file.path==='ts-stg.exe');assert.ok(binary);assert.equal(binary.sha256,lock.executableSha256);
  for(const file of lock.runtimeFiles)safeRelative(file.source);
  if(lock.nativeBuild){const native=lock.nativeBuild;assert.equal(native.configuration,'Release');assert.equal(native.binarySha256,binary.sha256);assert.equal(native.executableSource,binary.source);
    validateInventory(native.sourceFiles,'Native source');assert.equal(inventoryDigest(native.sourceFiles),native.sourceSha256,'Invalid native source inventory digest');
    const sdk=lock.runtimeFiles.find(file=>file.path==='PACKAGE.json');assert.ok(sdk);assert.equal(sdk.source,native.packageSource);assert.equal(sdk.sha256,native.packageSha256);
    for(const entry of [native.hostObject,native.dependencyLog,...native.objects,...native.linkInputs,native.linkLog]){safeRelative(entry.source);assert.match(entry.sha256,/^[a-f0-9]{64}$/);}}
  return lock;
}
function compareTree(directory,expected,label){
  const actual=inventoryTree(directory);
  const byPath=new Map(actual.map(file=>[file.path,file]));
  assert.equal(actual.length,expected.length,`${label}: file inventory differs`);
  for(const file of expected){const found=byPath.get(file.path);assert.ok(found,`${label}: missing ${file.path}`);
    assert.equal(found.bytes,file.bytes,`${label}: size changed for ${file.path}`);
    assert.equal(found.sha256,file.sha256,`${label}: hash changed for ${file.path}`);}
}
export function verifyEngineLock({root=PROJECT_ROOT,source=null,checkSource=false,checkBuild=false,checkNode=true}={}){
  const lock=readEngineLock(root),library=path.join(root,'packages/thlib'),runtime=path.join(root,'runtime');
  compareTree(library,lock.thlibFiles,'Private thlib snapshot');compareTree(runtime,lock.runtimeFiles,'Private runtime snapshot');
  if(checkNode){
    const module=path.join(root,'node_modules/@ts-stg/thlib'),resolved=fs.realpathSync(module);
    assert.ok(resolved===fs.realpathSync(library)||resolved.startsWith(fs.realpathSync(root)+path.sep),'Node dependency resolves outside this game');
    if(resolved!==fs.realpathSync(library))compareTree(resolved,lock.thlibFiles,'Installed Node dependency');
  }
  let sourceVerified=false,buildEvidenceVerified=false;
  if(checkSource||checkBuild||source){
    const location=fs.realpathSync(source??lock.source),rebuilt=buildGitThlib(location,lock.commit,{compilerRoot:root});
    assert.deepEqual(rebuilt.build,lock.thlibBuild,'Pinned TypeScript inputs, compiler, or generated output differ from the lock');
    assert.deepEqual(inventoryBuffers(rebuilt.files),lock.thlibFiles,'Snapshot differs from the complete committed TypeScript build');sourceVerified=true;
    if(checkBuild){
      assert.equal(git(location,['rev-parse','HEAD']).trim(),lock.commit,'Engine source commit differs from lock');inspectSourceState(location,{recorded:lock.sourceState});
      for(const file of lock.runtimeFiles){const sourceFile=inside(location,file.source);assert.equal(fs.statSync(sourceFile).size,file.bytes,'Source runtime file size differs');assert.equal(shaFile(sourceFile),file.sha256,'Source runtime file hash differs');}
      assert.ok(lock.nativeBuild,'Native compiler evidence is missing');
      for(const file of lock.nativeBuild.sourceFiles){const sourceFile=inside(location,file.path);assert.equal(fs.statSync(sourceFile).size,file.bytes,'Native build source size differs');assert.equal(shaFile(sourceFile),file.sha256,'Native build source hash differs');}
      for(const entry of [lock.nativeBuild.hostObject,lock.nativeBuild.dependencyLog,...lock.nativeBuild.objects,...lock.nativeBuild.linkInputs,lock.nativeBuild.linkLog])
        assert.equal(shaFile(inside(location,entry.source)),entry.sha256,'Native compiler evidence hash differs');
      buildEvidenceVerified=true;
    }
  }
  return{passed:true,commit:lock.commit,backend:lock.backend,supportedBackends:lock.supportedBackends,sourceModified:false,
    executableSha256:lock.executableSha256,thlibFiles:lock.thlibFiles.length,runtimeFiles:lock.runtimeFiles.length,
    thlibSha256:lock.thlibSha256,runtimeSha256:lock.runtimeSha256,thlibContent:lock.thlibContent,compiler:lock.thlibBuild.compiler,
    sourceVerified,buildEvidenceVerified,nativeBuildRecorded:!!lock.nativeBuild,
    recordedSourceGitClean:lock.sourceState?.gitClean??true,excludedSourceChanges:lock.sourceState?.excludedChanges??[]};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let checkSource=false,checkBuild=false,source=null;
  for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--check-source')checkSource=true;
    else if(process.argv[i]==='--check-build')checkBuild=true;
    else if(process.argv[i]==='--source')source=process.argv[++i];
    else throw new Error(`Unknown argument ${process.argv[i]}`);
  }
  console.log(JSON.stringify(verifyEngineLock({checkSource,checkBuild,source}),null,2));
}
