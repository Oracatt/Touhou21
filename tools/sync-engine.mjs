/** Upgrade the private SDK snapshot only after both the old copy and new
 * read-only engine inputs have been verified. Old trees are kept under build/.
 * No source-engine file or user-data path is ever written. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PROJECT_ROOT,inside,inventoryTree,inventoryDigest,readEngineLock,shaFile,shaText,inspectSourceState,verifyEngineLock} from './verify-engine-lock.mjs';

const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true}).trim();
const relative=file=>file.split(path.sep).join('/');
function assertNoLinks(target,root){
  const base=path.resolve(root);let probe=path.resolve(target);
  const fold=value=>process.platform==='win32'?value.toLowerCase():value;
  assert.ok(fold(probe)===fold(base)||fold(probe).startsWith(fold(base)+path.sep),'Checked path escapes its declared root.');
  while(true){const stat=fs.lstatSync(probe,{throwIfNoEntry:false});
    assert.ok(!stat?.isSymbolicLink(),'Engine copy path may not pass through a link or junction.');
    if(fold(probe)===fold(base))return;probe=path.dirname(probe);
  }
}
const fileEntry=(root,name)=>{const file=inside(root,name),stat=fs.lstatSync(file);
  assertNoLinks(file,root);
  assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Source must be a regular file: '+name);
  return {path:name,bytes:stat.size,sha256:shaFile(file)};};
const sourceInputs=root=>[
  fileEntry(root,'CMakeLists.txt'),fileEntry(root,'native/windows.manifest'),
  ...['native/src','native/include'].flatMap(directory=>inventoryTree(inside(root,directory)).map(entry=>({...entry,path:directory+'/'+entry.path}))),
].sort((a,b)=>a.path.localeCompare(b.path,'en'));
function separateRoots(root,source){
  const a=fs.realpathSync(root),b=fs.realpathSync(source),fold=value=>process.platform==='win32'?value.toLowerCase():value;
  assert.ok(fold(a)!==fold(b)&&!fold(a).startsWith(fold(b)+path.sep)&&!fold(b).startsWith(fold(a)+path.sep),'The game and source engine must be separate directories.');
  return {root:a,source:b};
}
function verifySource(source,commit,options={}){
  assert.equal(git(source,['rev-parse','HEAD']),commit,'Requested engine commit is not current HEAD');
  return inspectSourceState(source,options);
}
function assertBuild(source,binary,{commit,deriveSdkManifest=false}={}){
  const packageFile=inside(source,'dist/TS-STG/PACKAGE.json'),sdk=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  assert.equal(sdk.kind,'engine-sdk');assert.equal(sdk.referenceAssets,false);assert.equal(sdk.configuration,'Release');
  assert.equal(sdk.defaultBackend,'v8');assert.deepEqual(sdk.runtimes.map(value=>value.id).sort(),['quickjs','v8']);
  const executable=fileEntry(source,binary),distributed=fileEntry(source,'dist/TS-STG/ts-stg.exe'),inputs=sourceInputs(source);
  const derivedPackage=executable.sha256!==sdk.binarySha256||executable.sha256!==distributed.sha256;
  assert.equal(distributed.sha256,sdk.binarySha256,'Upstream SDK metadata does not describe its own packaged executable.');
  if(derivedPackage)assert.ok(deriveSdkManifest,'SDK is stale; explicitly pass --derive-sdk-manifest to derive local metadata after validating the latest build.');
  const outputTime=fs.statSync(inside(source,binary)).mtimeMs;
  for(const entry of inputs)assert.ok(fs.statSync(inside(source,entry.path)).mtimeMs<=outputTime,'Native binary is older than source input: '+entry.path);
  const object='build/ts-stg.dir/Release/host.obj',compileLog='build/ts-stg.dir/Release/ts-stg.tlog/CL.read.1.tlog';
  const dependencyText=fs.readFileSync(inside(source,compileLog),'utf16le').replace(/^\uFEFF/,'').toUpperCase();
  assert.ok(dependencyText.includes('MUSIC_STREAM.HPP'),'Build dependency log does not include the music transport fix.');
  const headerTime=fs.statSync(inside(source,'native/include/tsstg/music_stream.hpp')).mtimeMs;
  const objectTime=fs.statSync(inside(source,object)).mtimeMs;
  assert.ok(headerTime<=objectTime&&objectTime<=outputTime,'Music transport header/object/link times are inconsistent.');
  // Validate every native translation unit, its recorded source/header reads
  // and the actual link inputs. An old host.obj alone cannot attest a new V8
  // backend or the frame-stream transport added to the executable.
  const linkFile='build/ts-stg.dir/Release/ts-stg.tlog/link.read.1.tlog';
  const linkText=fs.readFileSync(inside(source,linkFile),'utf16le').toUpperCase();
  const blocks=dependencyText.split(/^\^/m).filter(Boolean),objects=[];
  for(const entry of inputs.filter(entry=>entry.path.startsWith('native/src/')&&entry.path.endsWith('.cpp'))){
    const sourcePath=inside(source,entry.path).toUpperCase(),stem=path.basename(entry.path,'.cpp');
    const objectName='build/ts-stg.dir/Release/'+stem+'.obj',objectPath=inside(source,objectName);
    assert.ok(linkText.includes(objectPath.toUpperCase()),'Native translation unit is absent from linker inputs: '+entry.path);
    const block=blocks.find(value=>value.split(/\r?\n/,1)[0]===sourcePath);assert.ok(block,'Compiler dependency block is missing: '+entry.path);
    const time=fs.statSync(objectPath).mtimeMs;assert.ok(time<=outputTime,'Linked object is newer than binary: '+objectName);
    for(const dependency of block.split(/\r?\n/).filter(value=>value.startsWith(source.toUpperCase()+path.sep)&&!value.startsWith('^'))){
      const dependencyPath=path.resolve(dependency),relativePath=relative(path.relative(source,dependencyPath));
      assertNoLinks(dependencyPath,source);
      assert.ok(fs.statSync(dependencyPath).mtimeMs<=time,'Object is older than compiler input: '+relativePath);
    }
    objects.push({source:objectName,sha256:shaFile(objectPath),sourcePath:entry.path,outputUtc:new Date(time).toISOString()});
  }
  const linkInputs=[];
  for(const line of linkText.split(/\r?\n/).filter(value=>value.startsWith(source.toUpperCase()+path.sep)&&value.endsWith('.LIB'))){
    const name=relative(path.relative(source,path.resolve(line))),entry=fileEntry(source,name);
    assert.ok(fs.statSync(inside(source,name)).mtimeMs<=outputTime,'Linked library is newer than binary: '+name);
    linkInputs.push({source:name,sha256:entry.sha256});
  }
  const v8=linkInputs.find(entry=>entry.source.toLowerCase()==='build/v8-sdk/v8-host.lib');
  assert.ok(v8,'Static V8 library is missing from linker inputs');assert.equal(v8.sha256,sdk.runtimes.find(entry=>entry.id==='v8').library.sha256,'SDK V8 metadata does not describe the linked library');
  let packageContent=null;
  if(derivedPackage){
    const metadata={...sdk,binarySha256:executable.sha256,createdUtc:new Date(outputTime).toISOString(),
      derivedFor:{commit,binarySource:binary,upstreamPackageSha256:shaFile(packageFile),upstreamBinarySha256:distributed.sha256,
        reason:'Local SDK metadata derived from the validated current native build; upstream dist remains unchanged and contains an older executable.'}};
    packageContent=JSON.stringify(metadata,null,2)+'\n';
  }
  const build={configuration:'Release',executableSource:binary,packageSource:'dist/TS-STG/PACKAGE.json',
    packageSha256:packageContent===null?shaFile(packageFile):shaText(packageContent),binarySha256:executable.sha256,
    sourceFiles:inputs,sourceSha256:inventoryDigest(inputs),
    dependencyLog:{source:compileLog,sha256:shaFile(inside(source,compileLog))},
    hostObject:{source:object,sha256:shaFile(inside(source,object))},
    outputUtc:new Date(outputTime).toISOString(),hostObjectUtc:new Date(objectTime).toISOString(),
    latestSourceUtc:new Date(Math.max(...inputs.map(entry=>fs.statSync(inside(source,entry.path)).mtimeMs))).toISOString(),
    objects,linkInputs,linkLog:{source:linkFile,sha256:shaFile(inside(source,linkFile))},derivedPackage,
    ...(derivedPackage?{packageTemplateSha256:shaFile(packageFile),packagedBinarySha256:distributed.sha256}:{}),
    evidence:'Byte-pinned native/public-library inputs, compiler dependency and all translation-unit object checks, linker input hashes and later link time. Any excluded editor-launcher modification and locally derived SDK metadata are separately recorded. This is local build evidence, not a reproducible-build attestation.'};
  return{nativeBuild:build,packageContent};
}
export function planEngineUpgrade({root=PROJECT_ROOT,source,commit,binary='build/Release/ts-stg.exe',allowSourceChanges=[],deriveSdkManifest=false}={}){
  assert.match(commit??'',/^[a-f0-9]{40}$/,'Pass the full intended source commit explicitly.');
  ({root,source}=separateRoots(root,source??readEngineLock(root).source));
  for(const directory of ['packages/thlib','runtime','build'])assertNoLinks(inside(root,directory),root);
  assertNoLinks(inside(source,'packages/thlib'),source);
  verifyEngineLock({root});const old=readEngineLock(root),sourceState=verifySource(source,commit,{allowChanges:allowSourceChanges});
  assert.equal(fs.realpathSync(path.join(root,'node_modules/@ts-stg/thlib')),fs.realpathSync(path.join(root,'packages/thlib')),'Upgrade requires the existing local thlib junction, not a separately installed Node copy.');
  const {nativeBuild,packageContent}=assertBuild(source,binary,{commit,deriveSdkManifest}),libraryRoot=inside(source,'packages/thlib');
  const publicCode=inventoryTree(inside(libraryRoot,'src')).map(entry=>({...entry,path:'src/'+entry.path}));
  const tracked=new Set(git(source,['ls-files','packages/thlib/src']).split(/\r?\n/));
  for(const entry of publicCode)assert.ok(tracked.has('packages/thlib/'+entry.path),'Public code is not tracked at the requested engine commit: '+entry.path);
  const common=old.thlibFiles.filter(entry=>entry.path.startsWith('assets/touhou-common/')).map(entry=>fileEntry(libraryRoot,entry.path));
  const thlibFiles=[fileEntry(libraryRoot,'LICENSE'),fileEntry(libraryRoot,'package.json'),...publicCode,...common].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const runtimeNames=new Map(old.runtimeFiles.map(entry=>[entry.path,entry.path==='ts-stg.exe'?binary:entry.source]));
  runtimeNames.set('PACKAGE.json','dist/TS-STG/PACKAGE.json');
  const runtimeFiles=[...runtimeNames].map(([name,origin])=>{
    const entry={...fileEntry(source,origin),path:name,source:origin};
    if(name==='PACKAGE.json'&&packageContent!==null)return{...entry,sourceSha256:entry.sha256,bytes:Buffer.byteLength(packageContent),sha256:shaText(packageContent),generatedContent:packageContent};
    return entry;
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  for(const change of sourceState.changes){
    const excluded=change.path;
    assert.ok(!nativeBuild.sourceFiles.some(entry=>entry.path===excluded)&&!runtimeFiles.some(entry=>entry.source===excluded)&&!thlibFiles.some(entry=>'packages/thlib/'+entry.path===excluded),'A source exception overlaps pinned SDK/native inputs');
    for(const entry of [nativeBuild.dependencyLog,nativeBuild.linkLog])assert.ok(!fs.readFileSync(inside(source,entry.source),'utf16le').toLowerCase().includes(excluded.toLowerCase()),'Excluded source path participates in compiler/link inputs');
  }
  const lock={...old,source:relative(source),commit,executableSha256:nativeBuild.binarySha256,
    sourceModified:!sourceState.gitClean,sourceState,
    thlibSha256:inventoryDigest(thlibFiles),runtimeSha256:inventoryDigest(runtimeFiles),thlibFiles,runtimeFiles,nativeBuild};
  return {root,source,old,lock,oldLockSha256:shaFile(path.join(root,'engine.lock.json')),
    summary:{from:old.commit,to:commit,thlibFiles:thlibFiles.length,runtimeFiles:runtimeFiles.length,
      executableSha256:nativeBuild.binarySha256,nativeBuildEvidence:nativeBuild.evidence,sourceState,derivedSdkMetadata:nativeBuild.derivedPackage}};
}
export function applyEngineUpgrade(plan){
  const {root,source,lock}=plan;
  assert.equal(shaFile(path.join(root,'engine.lock.json')),plan.oldLockSha256,'Engine lock changed during upgrade planning.');
  verifyEngineLock({root});assert.deepEqual(verifySource(source,lock.commit,{recorded:lock.sourceState}),lock.sourceState,'Source state changed during planning');
  const staging=inside(root,'build/engine-upgrade-'+randomUUID());
  assertNoLinks(staging,root);
  fs.mkdirSync(staging,{recursive:true});const groups=[
    {name:'thlib',target:inside(root,'packages/thlib'),entries:lock.thlibFiles,source:inside(source,'packages/thlib')},
    {name:'runtime',target:inside(root,'runtime'),entries:lock.runtimeFiles,source},
  ];
  for(const group of groups){
    const stage=inside(staging,group.name);fs.mkdirSync(stage);
    for(const entry of group.entries){
      const origin=inside(group.source,group.name==='runtime'?entry.source:entry.path),output=inside(stage,entry.path);
      assertNoLinks(origin,group.source);assertNoLinks(output,root);
      assert.equal(shaFile(origin),entry.sourceSha256??entry.sha256,'A source input changed during staging.');
      fs.mkdirSync(path.dirname(output),{recursive:true});
      if(entry.generatedContent!==undefined)fs.writeFileSync(output,entry.generatedContent,'utf8');else fs.copyFileSync(origin,output);
      assert.equal(shaFile(output),entry.sha256,'Staged file does not match planned content.');
    }
    group.stage=stage;group.backup=inside(staging,'backup-'+group.name);
  }
  const newLock=inside(staging,'engine.lock.next.json');fs.writeFileSync(newLock,JSON.stringify(lock,null,2)+'\n');
  // Recheck every target immediately before moving entire verified snapshots.
  verifyEngineLock({root});assert.equal(shaFile(path.join(root,'engine.lock.json')),plan.oldLockSha256);
  assert.deepEqual(verifySource(source,lock.commit,{recorded:lock.sourceState}),lock.sourceState);
  assert.deepEqual(assertBuild(source,lock.nativeBuild.executableSource,{commit:lock.commit,deriveSdkManifest:lock.nativeBuild.derivedPackage}).nativeBuild,lock.nativeBuild);
  fs.copyFileSync(path.join(root,'engine.lock.json'),inside(staging,'engine.lock.previous.json'));
  const moved=[];
  try{
    for(const group of groups){
      // Both absolute move paths were produced by inside(root,...) and inventories
      // reject links. No recursive delete or path outside this game is performed.
      assertNoLinks(group.target,root);assertNoLinks(group.backup,root);assertNoLinks(group.stage,root);
      fs.renameSync(group.target,group.backup);moved.push(group);
      fs.renameSync(group.stage,group.target);
    }
    fs.renameSync(newLock,path.join(root,'engine.lock.json'));
    verifyEngineLock({root,source});
  }catch(error){
    for(const group of moved.reverse()){
      if(fs.existsSync(group.target))fs.renameSync(group.target,inside(staging,'failed-'+group.name));
      fs.renameSync(group.backup,group.target);
    }
    fs.copyFileSync(inside(staging,'engine.lock.previous.json'),path.join(root,'engine.lock.json'));
    throw error;
  }
  return {...plan.summary,backup:relative(path.relative(root,staging)),sourceModified:!lock.sourceState.gitClean,sourceWritten:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};let apply=false;
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];if(arg==='--apply')apply=true;
    else if(arg==='--source')options.source=process.argv[++i];
    else if(arg==='--commit')options.commit=process.argv[++i];
    else if(arg==='--root')options.root=process.argv[++i];
    else if(arg==='--allow-source-change')(options.allowSourceChanges??=[]).push(process.argv[++i]);
    else if(arg==='--derive-sdk-manifest')options.deriveSdkManifest=true;
    else throw new Error('Unknown argument '+arg);
  }
  const plan=planEngineUpgrade(options);
  console.log(JSON.stringify(apply?applyEngineUpgrade(plan):{...plan.summary,dryRun:true},null,2));
}
