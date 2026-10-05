/** Upgrade the private SDK snapshot only after both the old copy and new
 * read-only engine inputs have been verified. Old trees are kept under build/.
 * No source-engine file or user-data path is ever written. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {PROJECT_ROOT,inside,inventoryTree,inventoryDigest,readEngineLock,shaFile,verifyEngineLock} from './verify-engine-lock.mjs';

const git=(root,args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',windowsHide:true}).trim();
const relative=file=>file.split(path.sep).join('/');
function assertNoLinks(target,root){
  const base=path.resolve(root);let probe=path.resolve(target);
  assert.ok(probe===base||probe.startsWith(base+path.sep),'Checked path escapes its declared root.');
  while(true){const stat=fs.lstatSync(probe,{throwIfNoEntry:false});
    assert.ok(!stat?.isSymbolicLink(),'Engine copy path may not pass through a link or junction.');
    if(probe===base)return;probe=path.dirname(probe);
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
function verifyCleanSource(source,commit){
  assert.equal(git(source,['rev-parse','HEAD']),commit,'Requested engine commit is not current HEAD');
  assert.equal(git(source,['status','--porcelain']), '', 'Source engine has local modifications; preserve them before synchronizing.');
}
function assertBuild(source,binary){
  const packageFile=inside(source,'dist/TS-STG/PACKAGE.json'),sdk=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  assert.equal(sdk.kind,'engine-sdk');assert.equal(sdk.referenceAssets,false);assert.equal(sdk.configuration,'Release');
  assert.equal(sdk.defaultBackend,'v8');assert.deepEqual(sdk.runtimes.map(value=>value.id).sort(),['quickjs','v8']);
  const executable=fileEntry(source,binary),distributed=fileEntry(source,'dist/TS-STG/ts-stg.exe'),inputs=sourceInputs(source);
  assert.equal(executable.sha256,sdk.binarySha256,'SDK manifest does not describe the selected native build.');
  assert.equal(executable.sha256,distributed.sha256,'Packaged and built native executables differ.');
  const outputTime=fs.statSync(inside(source,binary)).mtimeMs;
  for(const entry of inputs)assert.ok(fs.statSync(inside(source,entry.path)).mtimeMs<=outputTime,'Native binary is older than source input: '+entry.path);
  const object='build/ts-stg.dir/Release/host.obj',compileLog='build/ts-stg.dir/Release/ts-stg.tlog/CL.read.1.tlog';
  const dependencyText=fs.readFileSync(inside(source,compileLog),'utf16le').toUpperCase();
  assert.ok(dependencyText.includes('MUSIC_STREAM.HPP'),'Build dependency log does not include the music transport fix.');
  const headerTime=fs.statSync(inside(source,'native/include/tsstg/music_stream.hpp')).mtimeMs;
  const objectTime=fs.statSync(inside(source,object)).mtimeMs;
  assert.ok(headerTime<=objectTime&&objectTime<=outputTime,'Music transport header/object/link times are inconsistent.');
  return {configuration:'Release',executableSource:binary,packageSource:'dist/TS-STG/PACKAGE.json',
    packageSha256:shaFile(packageFile),binarySha256:executable.sha256,
    sourceFiles:inputs,sourceSha256:inventoryDigest(inputs),
    dependencyLog:{source:compileLog,sha256:shaFile(inside(source,compileLog))},
    hostObject:{source:object,sha256:shaFile(inside(source,object))},
    outputUtc:new Date(outputTime).toISOString(),hostObjectUtc:new Date(objectTime).toISOString(),
    latestSourceUtc:new Date(Math.max(...inputs.map(entry=>fs.statSync(inside(source,entry.path)).mtimeMs))).toISOString(),
    evidence:'Clean tracked source, complete native input hashes, later compile/link times, music-header compiler dependency, identical built/package binary and package manifest. This is local build evidence, not a reproducible-build attestation.'};
}
export function planEngineUpgrade({root=PROJECT_ROOT,source,commit,binary='build/Release/ts-stg.exe'}={}){
  assert.match(commit??'',/^[a-f0-9]{40}$/,'Pass the full intended source commit explicitly.');
  ({root,source}=separateRoots(root,source??readEngineLock(root).source));
  for(const directory of ['packages/thlib','runtime','build'])assertNoLinks(inside(root,directory),root);
  assertNoLinks(inside(source,'packages/thlib'),source);
  verifyEngineLock({root});const old=readEngineLock(root);verifyCleanSource(source,commit);
  assert.equal(fs.realpathSync(path.join(root,'node_modules/@ts-stg/thlib')),fs.realpathSync(path.join(root,'packages/thlib')),'Upgrade requires the existing local thlib junction, not a separately installed Node copy.');
  const nativeBuild=assertBuild(source,binary),libraryRoot=inside(source,'packages/thlib');
  const publicCode=inventoryTree(inside(libraryRoot,'src')).map(entry=>({...entry,path:'src/'+entry.path}));
  const tracked=new Set(git(source,['ls-files','packages/thlib/src']).split(/\r?\n/));
  for(const entry of publicCode)assert.ok(tracked.has('packages/thlib/'+entry.path),'Public code is not tracked at the requested engine commit: '+entry.path);
  const common=old.thlibFiles.filter(entry=>entry.path.startsWith('assets/touhou-common/')).map(entry=>fileEntry(libraryRoot,entry.path));
  const thlibFiles=[fileEntry(libraryRoot,'LICENSE'),fileEntry(libraryRoot,'package.json'),...publicCode,...common].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const runtimeNames=new Map(old.runtimeFiles.map(entry=>[entry.path,entry.path==='ts-stg.exe'?binary:entry.source]));
  runtimeNames.set('PACKAGE.json','dist/TS-STG/PACKAGE.json');
  const runtimeFiles=[...runtimeNames].map(([name,origin])=>({...fileEntry(source,origin),path:name,source:origin})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const lock={...old,source:relative(source),commit,executableSha256:nativeBuild.binarySha256,
    thlibSha256:inventoryDigest(thlibFiles),runtimeSha256:inventoryDigest(runtimeFiles),thlibFiles,runtimeFiles,nativeBuild};
  return {root,source,old,lock,oldLockSha256:shaFile(path.join(root,'engine.lock.json')),
    summary:{from:old.commit,to:commit,thlibFiles:thlibFiles.length,runtimeFiles:runtimeFiles.length,
      executableSha256:nativeBuild.binarySha256,nativeBuildEvidence:nativeBuild.evidence}};
}
export function applyEngineUpgrade(plan){
  const {root,source,lock}=plan;
  assert.equal(shaFile(path.join(root,'engine.lock.json')),plan.oldLockSha256,'Engine lock changed during upgrade planning.');
  verifyEngineLock({root});verifyCleanSource(source,lock.commit);
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
      assert.equal(shaFile(origin),entry.sha256,'A source input changed during staging.');
      fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(origin,output);
      assert.equal(shaFile(output),entry.sha256,'Staged file does not match planned content.');
    }
    group.stage=stage;group.backup=inside(staging,'backup-'+group.name);
  }
  const newLock=inside(staging,'engine.lock.next.json');fs.writeFileSync(newLock,JSON.stringify(lock,null,2)+'\n');
  // Recheck every target immediately before moving entire verified snapshots.
  verifyEngineLock({root});assert.equal(shaFile(path.join(root,'engine.lock.json')),plan.oldLockSha256);
  verifyCleanSource(source,lock.commit);assert.deepEqual(assertBuild(source,lock.nativeBuild.executableSource),lock.nativeBuild);
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
  return {...plan.summary,backup:relative(path.relative(root,staging)),sourceModified:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};let apply=false;
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];if(arg==='--apply')apply=true;
    else if(arg==='--source')options.source=process.argv[++i];
    else if(arg==='--commit')options.commit=process.argv[++i];
    else if(arg==='--root')options.root=process.argv[++i];
    else throw new Error('Unknown argument '+arg);
  }
  const plan=planEngineUpgrade(options);
  console.log(JSON.stringify(apply?applyEngineUpgrade(plan):{...plan.summary,dryRun:true},null,2));
}
