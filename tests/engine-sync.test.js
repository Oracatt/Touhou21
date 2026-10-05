import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {planEngineUpgrade,applyEngineUpgrade} from '../tools/sync-engine.mjs';
import {PROJECT_ROOT,readEngineLock,shaFile,verifyEngineLock} from '../tools/verify-engine-lock.mjs';

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
  const plan=planEngineUpgrade({root:fixture,source:lock.source,commit:lock.commit}),applied=applyEngineUpgrade(plan);
  assert.equal(verifyEngineLock({root:fixture,checkSource:true}).passed,true);
  assert.equal(fs.readFileSync(save,'utf8'),'owned save content; never an engine dependency');
  const backup=path.resolve(fixture,applied.backup);
  assert.ok(backup.startsWith(path.resolve(fixture,'build')+path.sep));
  assert.equal(shaFile(path.join(backup,'backup-thlib/LICENSE')),shaFile(license));
  assert.equal(shaFile(path.join(backup,'engine.lock.previous.json')),lockHash);
  assert.equal(fs.realpathSync(path.join(fixture,'node_modules/@ts-stg/thlib')),fs.realpathSync(path.join(fixture,'packages/thlib')));
  verifyEngineLock();
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify({passed:true,oldEditsPreserved:true,userDataPreserved:true,backup:applied.backup,sourceModified:false},null,2)+'\n');
});
