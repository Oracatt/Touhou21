import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {planEngineUpgrade,applyEngineUpgrade} from '../tools/sync-engine.mjs';
import {PROJECT_ROOT,readEngineLock,shaFile,inspectSourceState,verifyEngineLock,inventoryTree,inventoryDigest,inventoryTrackedThlibTree} from '../tools/verify-engine-lock.mjs';
import {buildGitThlib,inventoryBuffers} from '../tools/engine-git.mjs';

function installCompiler(root){
  fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});
  fs.symlinkSync(path.join(PROJECT_ROOT,'node_modules/typescript'),path.join(root,'node_modules/typescript'),process.platform==='win32'?'junction':'dir');
}

function inventoryFixture(){
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const directory=fs.mkdtempSync(path.join(build,'engine-inventory-verification-')),source=path.join(directory,'source');fs.mkdirSync(source);
  const run=args=>execFileSync('git',['-C',source,...args],{encoding:'utf8',windowsHide:true}).trim();
  const write=(name,content)=>{const target=path.join(source,...name.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);return target;};
  run(['init','--quiet']);run(['config','core.autocrlf','false']);run(['config','core.fsmonitor','false']);run(['config','core.untrackedCache','false']);
  for(const[name,content]of Object.entries({
    'packages/thlib/LICENSE':'fixture license\n','packages/thlib/package.json':"{\"name\":\"@ts-stg/thlib\",\"type\":\"module\",\"devDependencies\":{\"typescript\":\"5.9.3\"}}\n",
    'packages/thlib/tsconfig.base.json':"{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\",\"strict\":true,\"noEmitOnError\":true,\"declaration\":true,\"sourceMap\":true,\"declarationMap\":true,\"types\":[],\"lib\":[\"ES2022\"]}}\n",
    'packages/thlib/tsconfig.json':"{\"extends\":\"./tsconfig.base.json\",\"compilerOptions\":{\"rootDir\":\"src\",\"outDir\":\"dist\"},\"include\":[\"src/**/*.ts\"]}\n",
    'packages/thlib/src/index.ts':'export const fixture = true;\n',
    'packages/thlib/assets/touhou-common/manifest.json':'{"fixture":true}\n',
    'packages/thlib/assets/touhou-common/hud-labels.json':'{"labels":[378,379]}\n',
    'packages/thlib/assets/touhou-common/locales/zh-CN/anm/front.json':'{"language":"zh-CN"}\n',
    'packages/thlib/assets/touhou-common/locales/zh-CN/textures/front.png':'fixture texture bytes\n',
    'packages/thlib/assets/private-demo/excluded.png':'not a selected public common asset\n',
    'ts-stg.exe':'fixture executable bytes\n',
  }))write(name,content);
  run(['add','.']);run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Fixture public trees']);
  return{directory,source,run,write};
}

test('complete tracked common inventory discovers new locale and HUD files independently of an old snapshot list',()=>{
  const{source}=inventoryFixture(),common=inventoryTrackedThlibTree(source,'assets/touhou-common');
  assert.deepEqual(common.map(entry=>entry.path),[
    'assets/touhou-common/hud-labels.json',
    'assets/touhou-common/locales/zh-CN/anm/front.json',
    'assets/touhou-common/locales/zh-CN/textures/front.png',
    'assets/touhou-common/manifest.json',
  ]);
  const oldSubset=common.filter(entry=>entry.path==='assets/touhou-common/manifest.json');
  assert.notEqual(inventoryDigest(common),inventoryDigest(oldSubset),'new common resources cannot disappear behind an older lock inventory');
  assert.deepEqual(inventoryTrackedThlibTree(source,'src').map(entry=>entry.path),['src/index.ts']);
  assert.ok(!common.some(entry=>entry.path.includes('private-demo')),'other asset packs are not swept into the common snapshot');
});

test('source verification rejects a self-consistent subset until all committed common resources are pinned',()=>{
  const{directory,source,run}=inventoryFixture(),root=path.join(directory,'consumer');
  fs.mkdirSync(path.join(root,'runtime'),{recursive:true});installCompiler(root);
  fs.copyFileSync(path.join(source,'ts-stg.exe'),path.join(root,'runtime/ts-stg.exe'));
  const runtimeFiles=inventoryTree(path.join(root,'runtime')).map(entry=>({...entry,source:entry.path}));
  const commit=run(['rev-parse','HEAD']),compiled=buildGitThlib(source,commit,{compilerRoot:root});
  const omitted=name=>name.startsWith('assets/touhou-common/')&&name!=='assets/touhou-common/manifest.json';
  const partial=new Map([...compiled.files].filter(([name])=>!omitted(name)));
  for(const[name,bytes]of partial){const file=path.join(root,'packages/thlib',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  const sourceFiles=compiled.build.sourceFiles.filter(entry=>!omitted(entry.path));
  const lock={format:'touhou21-engine-lock-v2',engine:'TS-STG',library:'@ts-stg/thlib',source,commit,
    executableSha256:runtimeFiles[0].sha256,sourceModified:false,supportedBackends:['v8','quickjs'],backend:'v8',runtimeFiles,runtimeSha256:inventoryDigest(runtimeFiles),
    thlibContent:'git-typescript-build',thlibBuild:{...compiled.build,sourceFiles,sourceSha256:inventoryDigest(sourceFiles)},
    thlibFiles:inventoryBuffers(partial),thlibSha256:inventoryDigest(inventoryBuffers(partial))};
  const save=()=>fs.writeFileSync(path.join(root,'engine.lock.json'),JSON.stringify(lock));save();
  assert.equal(verifyEngineLock({root,checkNode:false}).passed,true,'a local snapshot alone cannot attest complete Git provenance');
  assert.throws(()=>verifyEngineLock({root,source,checkNode:false}),/Pinned TypeScript inputs, compiler, or generated output differ/);
  for(const[name,bytes]of compiled.files){const file=path.join(root,'packages/thlib',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  lock.thlibFiles=inventoryBuffers(compiled.files);lock.thlibSha256=inventoryDigest(lock.thlibFiles);lock.thlibBuild=compiled.build;save();
  assert.equal(verifyEngineLock({root,source,checkNode:false}).sourceVerified,true);
  assert.equal(run(['status','--porcelain']),'','verification never modifies the source fixture');
});

test('public inventory rejects untracked files, missing tracked files and Git symlink entries even when checkout bytes are regular',()=>{
  const untracked=inventoryFixture();untracked.write('packages/thlib/assets/touhou-common/untracked.png','unreviewed bytes');
  assert.throws(()=>inventoryTrackedThlibTree(untracked.source,'assets/touhou-common'),/not tracked/);
  const missing=inventoryFixture();fs.unlinkSync(path.join(missing.source,'packages/thlib/assets/touhou-common/manifest.json'));
  assert.throws(()=>inventoryTrackedThlibTree(missing.source,'assets/touhou-common'),/complete Git file inventory/);
  const symlink=inventoryFixture(),name='packages/thlib/assets/touhou-common/git-symlink.txt',file=symlink.write(name,'manifest.json\n');
  const blob=symlink.run(['hash-object','-w',file]);symlink.run(['update-index','--add','--cacheinfo','120000',blob,name]);
  assert.equal(fs.lstatSync(file).isFile(),true,'fixture reproduces a regular Windows checkout of a Git symlink');
  assert.throws(()=>inventoryTrackedThlibTree(symlink.source,'assets/touhou-common'),/nonregular Git entry/);
});

test('Git source verification is portable but installed snapshot and producer build checks remain strict',()=>{
  const{directory,source,run,write}=inventoryFixture(),root=path.join(directory,'portable-consumer');
  fs.mkdirSync(path.join(root,'runtime'),{recursive:true});installCompiler(root);
  fs.copyFileSync(path.join(source,'ts-stg.exe'),path.join(root,'runtime/ts-stg.exe'));
  const runtimeFiles=inventoryTree(path.join(root,'runtime')).map(entry=>({...entry,source:'absent-build/'+entry.path}));
  const commit=run(['rev-parse','HEAD']),compiled=buildGitThlib(source,commit,{compilerRoot:root}),thlibFiles=inventoryBuffers(compiled.files);
  for(const[name,bytes]of compiled.files){
    const file=path.join(root,'packages/thlib',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
  }
  const lock={format:'touhou21-engine-lock-v2',engine:'TS-STG',library:'@ts-stg/thlib',source:'Z:/unavailable-producer',commit,
    executableSha256:runtimeFiles[0].sha256,sourceModified:false,supportedBackends:['v8','quickjs'],backend:'v8',
    thlibContent:'git-typescript-build',thlibBuild:compiled.build,thlibFiles,thlibSha256:inventoryDigest(thlibFiles),runtimeFiles,runtimeSha256:inventoryDigest(runtimeFiles)};
  const save=()=>fs.writeFileSync(path.join(root,'engine.lock.json'),JSON.stringify(lock));save();
  const verified=verifyEngineLock({root,source,checkNode:false});
  assert.equal(verified.sourceVerified,true);assert.equal(verified.buildEvidenceVerified,false);
  assert.throws(()=>verifyEngineLock({root,source,checkBuild:true,checkNode:false}),/ENOENT/,'compiler evidence is still checked explicitly');
  // HEAD and mutable checkout are not the pinned revision. A portable verifier
  // must read the requested objects without resetting another user's worktree.
  write('packages/thlib/src/index.ts','export const fixture = false;\n');run(['add','.']);
  run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Later revision']);
  write('packages/thlib/src/index.ts','uncommitted later work\n');
  assert.equal(verifyEngineLock({root,source,checkNode:false}).passed,true);
  assert.throws(()=>verifyEngineLock({root,source,checkBuild:true,checkNode:false}),/commit differs/);
  const script=path.join(root,'packages/thlib/src/index.ts'),original=fs.readFileSync(script);
  fs.writeFileSync(script,original.toString().replaceAll('\n','\r\n'));
  assert.throws(()=>verifyEngineLock({root,source,checkNode:false}),/size changed/,'verification must not silently normalize a changed installed file');
  fs.writeFileSync(script,original);
  const removed=lock.thlibFiles.pop();fs.unlinkSync(path.join(root,'packages/thlib',removed.path));
  lock.thlibSha256=inventoryDigest(lock.thlibFiles);
  lock.thlibBuild.sourceFiles=lock.thlibBuild.sourceFiles.filter(entry=>entry.path!==removed.path);
  lock.thlibBuild.sourceSha256=inventoryDigest(lock.thlibBuild.sourceFiles);save();
  assert.throws(()=>verifyEngineLock({root,source,checkNode:false}),/Pinned TypeScript inputs, compiler, or generated output differ/,'a self-consistent subset lock cannot pass source verification');
});

test('public inventory rejects both nested junctions and links in a selected directory ancestor',()=>{
  const{directory,source}=inventoryFixture(),external=path.join(directory,'external');fs.mkdirSync(external);fs.writeFileSync(path.join(external,'secret'),'outside bytes');
  fs.symlinkSync(external,path.join(source,'packages/thlib/assets/touhou-common/link'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>inventoryTrackedThlibTree(source,'assets/touhou-common'),/link/);
  const linkedSource=path.join(directory,'linked-source'),assets=path.join(directory,'external-assets');
  fs.mkdirSync(path.join(linkedSource,'packages/thlib'),{recursive:true});fs.mkdirSync(path.join(assets,'touhou-common'),{recursive:true});
  fs.symlinkSync(assets,path.join(linkedSource,'packages/thlib/assets'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>inventoryTrackedThlibTree(linkedSource,'assets/touhou-common'),/link or junction/);
});

test('a source exception is limited to the recorded unstaged editor launcher',()=>{
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'source-state-verification-'));
  const run=args=>execFileSync('git',['-C',fixture,...args],{encoding:'utf8',windowsHide:true});
  run(['init','--quiet']);run(['config','core.fsmonitor','false']);run(['config','core.untrackedCache','false']);
  fs.writeFileSync(path.join(fixture,'start-spellcard-editor.cmd'),'original launcher\n');
  fs.writeFileSync(path.join(fixture,'native-input.cpp'),'original input\n');run(['add','.']);
  run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Fixture baseline']);
  const launcher=path.join(fixture,'start-spellcard-editor.cmd');fs.writeFileSync(launcher,'local editor launch settings\n');
  const recorded=inspectSourceState(fixture);
  assert.equal(recorded.gitClean,false);assert.equal(recorded.dependencyInputsClean,true);
  assert.equal(recorded.excludedChanges[0].sha256,shaFile(launcher));
  assert.deepEqual(recorded.excludedChanges.map(entry=>entry.path),['start-spellcard-editor.cmd']);
  assert.deepEqual(inspectSourceState(fixture,{recorded}),recorded);
  fs.writeFileSync(path.join(fixture,'native-input.cpp'),'changed native input\n');
  assert.throws(()=>inspectSourceState(fixture,{recorded}),/unapproved local modifications/);
  fs.writeFileSync(path.join(fixture,'native-input.cpp'),'original input\n');fs.writeFileSync(launcher,'different local launch settings\n');
  assert.throws(()=>inspectSourceState(fixture,{recorded}),/changed since it was recorded/);
  run(['add','start-spellcard-editor.cmd']);assert.throws(()=>inspectSourceState(fixture,{recorded}),/unapproved local modifications/);
});

test('engine synchronization requires an explicit commit and a separate source tree',()=>{
  assert.throws(()=>planEngineUpgrade({commit:null}),/full intended source commit/);
  assert.throws(()=>planEngineUpgrade({source:PROJECT_ROOT,commit:readEngineLock().commit}),/separate directories/);
});
const liveSdkSource=readEngineLock().source;
const canonicalSdkInputs=['build/Release/ts-stg.exe','build/v8-sdk/v8-host.lib',
  'build/ts-stg.dir/Release/ts-stg.tlog/CL.read.1.tlog','build/ts-stg.dir/Release/ts-stg.tlog/link.read.1.tlog'];
const missingCanonicalSdkInputs=canonicalSdkInputs.filter(file=>!fs.existsSync(path.join(liveSdkSource,file)));
const liveSdkSkip=process.platform!=='win32'?'Live SDK synchronization requires Windows':
  !fs.existsSync(liveSdkSource)?'Live SDK source checkout is unavailable':
  missingCanonicalSdkInputs.length?'Canonical SDK build fixture unavailable: '+missingCanonicalSdkInputs.join(', '):false;

test('engine synchronization preserves local edits and user data while retaining the old snapshot',
 {skip:liveSdkSkip},()=>{
  verifyEngineLock();
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'engine-sync-verification-'));
  assert.ok(path.resolve(fixture).startsWith(path.resolve(build)+path.sep+'engine-sync-verification-'));
  fs.mkdirSync(path.join(fixture,'packages'));installCompiler(fixture);
  fs.cpSync(path.join(PROJECT_ROOT,'packages/thlib'),path.join(fixture,'packages/thlib'),{recursive:true});
  fs.cpSync(path.join(PROJECT_ROOT,'runtime'),path.join(fixture,'runtime'),{recursive:true});
  fs.copyFileSync(path.join(PROJECT_ROOT,'engine.lock.json'),path.join(fixture,'engine.lock.json'));
  fs.mkdirSync(path.join(fixture,'node_modules/@ts-stg'),{recursive:true});
  fs.symlinkSync(path.join(fixture,'packages/thlib'),path.join(fixture,'node_modules/@ts-stg/thlib'),'junction');
  const lock=readEngineLock(fixture),license=path.join(fixture,'packages/thlib/LICENSE'),original=fs.readFileSync(license);
  fs.writeFileSync(license,Buffer.concat([original,Buffer.from('\nlocal alteration that must survive\n')]));
  const edited=shaFile(license),lockHash=shaFile(path.join(fixture,'engine.lock.json'));
  assert.throws(()=>planEngineUpgrade({root:fixture,source:lock.source,commit:lock.commit}),/size changed|hash changed/);
  assert.equal(shaFile(license),edited);assert.equal(shaFile(path.join(fixture,'engine.lock.json')),lockHash);
  fs.writeFileSync(license,original);
  fs.mkdirSync(path.join(fixture,'userdata'));const save=path.join(fixture,'userdata/preserved.txt');
  fs.writeFileSync(save,'owned save content; never an engine dependency');
  const options={root:fixture,source:lock.source,commit:lock.commit};
  const sourceBefore=inspectSourceState(lock.source,{recorded:lock.sourceState});
  const plan=planEngineUpgrade(options),applied=applyEngineUpgrade(plan);
  assert.equal(plan.lock.thlibContent,'git-typescript-build');
  const rebuilt=buildGitThlib(lock.source,lock.commit,{compilerRoot:fixture});
  assert.deepEqual(plan.lock.thlibFiles,inventoryBuffers(rebuilt.files),'upgrade pins committed TypeScript and exact generated JS/declarations');
  assert.deepEqual(plan.lock.thlibBuild,rebuilt.build);
  assert.equal(verifyEngineLock({root:fixture,checkSource:true}).passed,true);
  assert.equal(fs.readFileSync(save,'utf8'),'owned save content; never an engine dependency');
  const backup=path.resolve(fixture,applied.backup);
  assert.ok(backup.startsWith(path.resolve(fixture,'build')+path.sep));
  assert.equal(shaFile(path.join(backup,'backup-thlib/LICENSE')),shaFile(license));
  assert.equal(shaFile(path.join(backup,'engine.lock.previous.json')),lockHash);
  assert.equal(fs.realpathSync(path.join(fixture,'node_modules/@ts-stg/thlib')),fs.realpathSync(path.join(fixture,'packages/thlib')));
  verifyEngineLock();
  assert.deepEqual(inspectSourceState(lock.source,{recorded:lock.sourceState}),sourceBefore);
  assert.equal(applied.sourceWritten,false);
  assert.equal(shaFile(path.join(fixture,'runtime/PACKAGE.json')),lock.nativeBuild.packageSha256);
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify({passed:true,oldEditsPreserved:true,userDataPreserved:true,backup:applied.backup,sourceWritten:false,sourceGitClean:sourceBefore.gitClean},null,2)+'\n');
});
