import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {planEngineUpgrade,applyEngineUpgrade} from '../tools/sync-engine.mjs';
import {PROJECT_ROOT,readEngineLock,shaFile,inspectSourceState,verifyEngineLock} from '../tools/verify-engine-lock.mjs';

test('a source exception is limited to the recorded unstaged editor launcher',()=>{
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'source-state-verification-'));
  const run=args=>execFileSync('git',['-C',fixture,...args],{encoding:'utf8',windowsHide:true});
  run(['init','--quiet']);fs.writeFileSync(path.join(fixture,'start-spellcard-editor.cmd'),'original launcher\n');
  fs.writeFileSync(path.join(fixture,'native-input.cpp'),'original input\n');run(['add','.']);
  run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','Fixture baseline']);
  const launcher=path.join(fixture,'start-spellcard-editor.cmd');fs.writeFileSync(launcher,'local editor launch settings\n');
  assert.throws(()=>inspectSourceState(fixture),/unapproved local modifications/);
  assert.throws(()=>inspectSourceState(fixture,{allowChanges:['native-input.cpp']}),/Unreviewed source-change exception/);
  const recorded=inspectSourceState(fixture,{allowChanges:['start-spellcard-editor.cmd']});
  assert.equal(recorded.gitClean,false);assert.equal(recorded.changes[0].sha256,shaFile(launcher));
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
test('engine synchronization preserves local edits and user data while retaining the old snapshot',
 {skip:process.platform!=='win32'||!fs.existsSync(readEngineLock().source)},()=>{
  verifyEngineLock();
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'engine-sync-verification-'));
  assert.ok(path.resolve(fixture).startsWith(path.resolve(build)+path.sep+'engine-sync-verification-'));
  fs.mkdirSync(path.join(fixture,'packages'));
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
  const options={root:fixture,source:lock.source,commit:lock.commit,
    allowSourceChanges:lock.sourceState?.changes.map(entry=>entry.path)??[],deriveSdkManifest:!!lock.nativeBuild.derivedPackage};
  if(options.allowSourceChanges.length)assert.throws(()=>planEngineUpgrade({...options,allowSourceChanges:[]}),/unapproved local modifications/);
  if(options.deriveSdkManifest)assert.throws(()=>planEngineUpgrade({...options,deriveSdkManifest:false}),/SDK is stale/);
  const sourceBefore=inspectSourceState(lock.source,{recorded:lock.sourceState});
  const plan=planEngineUpgrade(options),applied=applyEngineUpgrade(plan);
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
  if(lock.nativeBuild.derivedPackage){
    assert.equal(fs.readFileSync(path.join(fixture,'runtime/PACKAGE.json'),'utf8'),lock.runtimeFiles.find(entry=>entry.path==='PACKAGE.json').generatedContent);
  }
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify({passed:true,oldEditsPreserved:true,userDataPreserved:true,backup:applied.backup,sourceWritten:false,sourceGitClean:sourceBefore.gitClean},null,2)+'\n');
});
