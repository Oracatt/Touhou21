import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inventoryGitThlib} from './engine-git.mjs';

export const PROJECT_ROOT=path.resolve(import.meta.dirname,'..');
export const shaFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export const shaText=value=>createHash('sha256').update(value,'utf8').digest('hex');
const ordinal=(a,b)=>a<b?-1:a>b?1:0;
const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true});
export const ALLOWED_UNRELATED_SOURCE_CHANGES=Object.freeze(['start-spellcard-editor.cmd']);

/** Only the reviewed editor launcher can be excluded from a source check.
 * Its exact status and bytes are recorded; tracked SDK/native changes, staged
 * edits, untracked files, deletions, renames and additional paths are refused. */
export function inspectSourceState(source,{allowChanges=[],recorded=null}={}){
  const allowed=recorded?.changes.map(entry=>entry.path)??allowChanges;
  for(const name of allowed)assert.ok(ALLOWED_UNRELATED_SOURCE_CHANGES.includes(name),'Unreviewed source-change exception: '+name);
  const changes=git(source,['status','--porcelain=v1','-z']).split('\0').filter(Boolean).map(line=>{
    const status=line.slice(0,2),name=line.slice(3);
    assert.ok(status===' M'&&allowed.includes(name),'Source engine has unapproved local modifications: '+line);
    const file=inside(source,name),stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Excluded source file must be a regular file');
    return{path:name,status,bytes:stat.size,sha256:shaFile(file),headBlob:git(source,['rev-parse','HEAD:'+name]).trim()};
  });
  if(recorded&&changes.length)assert.deepEqual(changes,recorded.changes,'Excluded source modification changed since it was recorded');
  return{gitClean:changes.length===0,changes,policy:'Only the unstaged editor launcher is excluded; SDK, native inputs and copied files remain byte-pinned.'};
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
export function readEngineLock(root=PROJECT_ROOT){
  const lock=JSON.parse(fs.readFileSync(path.join(root,'engine.lock.json'),'utf8'));
  assert.equal(lock.format,'touhou21-engine-lock-v1');assert.equal(lock.engine,'TS-STG');assert.equal(lock.library,'@ts-stg/thlib');
  assert.match(lock.commit,/^[a-f0-9]{40}$/);assert.match(lock.executableSha256,/^[a-f0-9]{64}$/i);
  if(lock.thlibContent!==undefined)assert.equal(lock.thlibContent,'git-blob','Unknown thlib content representation');
  assert.deepEqual(lock.supportedBackends,['v8','quickjs']);assert.equal(lock.backend,'v8');assert.equal(typeof lock.sourceModified,'boolean');
  if(lock.sourceState){
    assert.equal(lock.sourceModified,!lock.sourceState.gitClean);assert.ok(Array.isArray(lock.sourceState.changes));
    assert.equal(lock.sourceState.gitClean,lock.sourceState.changes.length===0);
    for(const entry of lock.sourceState.changes){assert.ok(ALLOWED_UNRELATED_SOURCE_CHANGES.includes(entry.path));assert.equal(entry.status,' M');
      assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.match(entry.headBlob,/^[a-f0-9]{40}$/);assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>=0);}
  }else assert.equal(lock.sourceModified,false,'Modified source must carry its reviewed exception record');
  for(const files of [lock.thlibFiles,lock.runtimeFiles]){
    assert.ok(Array.isArray(files)&&files.length>0);const seen=new Set();
    for(const file of files){safeRelative(file.path);if(file.source)safeRelative(file.source);
      assert.ok(!seen.has(file.path),'Duplicate locked file');seen.add(file.path);
      assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
  }
  assert.equal(inventoryDigest(lock.thlibFiles),lock.thlibSha256,'Invalid library inventory digest');
  assert.equal(inventoryDigest(lock.runtimeFiles),lock.runtimeSha256,'Invalid runtime inventory digest');
  for(const file of lock.runtimeFiles){safeRelative(file.source);
    if(file.generatedContent!==undefined){assert.equal(file.path,'PACKAGE.json','Only SDK metadata may be generated locally');
      assert.equal(typeof file.generatedContent,'string');assert.equal(Buffer.byteLength(file.generatedContent),file.bytes);assert.equal(shaText(file.generatedContent),file.sha256);
      assert.match(file.sourceSha256,/^[a-f0-9]{64}$/);const sdk=JSON.parse(file.generatedContent);
      assert.equal(sdk.binarySha256,lock.executableSha256);assert.equal(sdk.derivedFor.commit,lock.commit);assert.equal(sdk.derivedFor.upstreamPackageSha256,file.sourceSha256);}}
  const binary=lock.runtimeFiles.find(file=>file.path==='ts-stg.exe');assert.ok(binary);
  assert.equal(binary.sha256,lock.executableSha256.toLowerCase());
  if(lock.nativeBuild){
    const build=lock.nativeBuild;assert.equal(build.configuration,'Release');
    assert.equal(build.executableSource,binary.source);assert.equal(build.binarySha256,binary.sha256);
    safeRelative(build.packageSource);assert.match(build.packageSha256,/^[a-f0-9]{64}$/);
    assert.ok(Array.isArray(build.sourceFiles)&&build.sourceFiles.length>0);
    const seen=new Set();for(const file of build.sourceFiles){safeRelative(file.path);assert.ok(!seen.has(file.path));seen.add(file.path);
      assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
    assert.equal(inventoryDigest(build.sourceFiles),build.sourceSha256,'Invalid native source inventory digest');
    for(const entry of [build.hostObject,build.dependencyLog]){safeRelative(entry.source);assert.match(entry.sha256,/^[a-f0-9]{64}$/);}
    const sdk=lock.runtimeFiles.find(file=>file.path==='PACKAGE.json');assert.ok(sdk,'Native build provenance must be retained');
    assert.equal(sdk.source,build.packageSource);assert.equal(sdk.sha256,build.packageSha256);
    if(build.derivedPackage){assert.ok(sdk.generatedContent);assert.equal(sdk.sourceSha256,build.packageTemplateSha256);}
    for(const entry of [...(build.objects??[]),...(build.linkInputs??[]),...(build.linkLog?[build.linkLog]:[])]){safeRelative(entry.source);assert.match(entry.sha256,/^[a-f0-9]{64}$/);}
  }
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
    const location=fs.realpathSync(source??lock.source);
    if(lock.thlibContent==='git-blob'){
      assert.deepEqual(inventoryGitThlib(location,lock.commit),lock.thlibFiles,'Snapshot differs from the complete public thlib Git commit');
      sourceVerified=true;
    }
    // Portable source verification reads immutable Git objects. Rechecking the
    // producer's compiler outputs is separate and needs its original build tree.
    // Legacy locks retain their previous working-tree verification behavior.
    if(lock.thlibContent!=='git-blob'||checkBuild){
      const commit=execFileSync('git',['-C',location,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
      assert.equal(commit,lock.commit,'Engine source commit differs from lock');
      inspectSourceState(location,{recorded:lock.sourceState});
      // The public code and selected common pack are complete subtrees. Other
      // asset packs remain excluded from this private consumer snapshot.
      for(const directory of ['src','assets/touhou-common']){
        const files=inventoryTrackedThlibTree(location,directory);
        const expected=lock.thlibFiles.filter(file=>file.path.startsWith(directory+'/'));
        if(lock.thlibContent==='git-blob')assert.deepEqual(files.map(file=>file.path),expected.map(file=>file.path),'Source public tree inventory differs: '+directory);
        else assert.equal(inventoryDigest(files),inventoryDigest(expected),'Snapshot does not contain the complete public thlib tree: '+directory);
      }
      if(lock.thlibContent!=='git-blob')for(const file of lock.thlibFiles){const sourceFile=inside(path.join(location,'packages/thlib'),file.path);
        assert.ok(!fs.lstatSync(sourceFile).isSymbolicLink(),'Source library file may not be a link');
        assert.equal(fs.statSync(sourceFile).size,file.bytes,'Source library file size differs');
        assert.equal(shaFile(sourceFile),file.sha256,'Source library file hash differs');}
      for(const file of lock.runtimeFiles){const sourceFile=inside(location,file.source);
        if(file.generatedContent!==undefined)assert.equal(shaFile(sourceFile),file.sourceSha256,'Source SDK metadata template hash differs');
        else{assert.equal(fs.statSync(sourceFile).size,file.bytes,'Source runtime file size differs');
          assert.equal(shaFile(sourceFile),file.sha256,'Source runtime file hash differs');}}
      if(lock.nativeBuild){
        for(const file of lock.nativeBuild.sourceFiles){const sourceFile=inside(location,file.path);
          assert.equal(fs.statSync(sourceFile).size,file.bytes,'Native build source size differs');
          assert.equal(shaFile(sourceFile),file.sha256,'Native build source hash differs');}
        for(const entry of [lock.nativeBuild.hostObject,lock.nativeBuild.dependencyLog,...(lock.nativeBuild.objects??[]),...(lock.nativeBuild.linkInputs??[]),...(lock.nativeBuild.linkLog?[lock.nativeBuild.linkLog]:[])])
          assert.equal(shaFile(inside(location,entry.source)),entry.sha256,'Native compiler evidence hash differs');
      }
      sourceVerified=true;buildEvidenceVerified=true;
    }
  }
  return{passed:true,commit:lock.commit,backend:lock.backend,supportedBackends:lock.supportedBackends,
    executableSha256:lock.executableSha256,thlibFiles:lock.thlibFiles.length,runtimeFiles:lock.runtimeFiles.length,
    thlibSha256:lock.thlibSha256,runtimeSha256:lock.runtimeSha256,thlibContent:lock.thlibContent??'legacy-working-tree',sourceVerified,buildEvidenceVerified,nativeBuildRecorded:!!lock.nativeBuild,
    recordedSourceGitClean:lock.sourceState?.gitClean??true,recordedSourceChanges:lock.sourceState?.changes??[]};
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
