/** Exercise installation inside an isolated, ignored build directory.
 * The shared source engine is read only; the real game dependencies are untouched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,readEngineLock,verifyEngineLock,shaFile} from './verify-engine-lock.mjs';

export function verifySetup(){
  if(process.platform!=='win32')throw new Error('The local dependency installer fixture requires Windows PowerShell and junction support.');
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'setup-verification-'));
  assert.ok(path.resolve(fixture).startsWith(path.resolve(build)+path.sep+'setup-verification-'));
  fs.mkdirSync(path.join(fixture,'tools'));
  const script=path.join(fixture,'tools/setup-local.ps1'),lockFile=path.join(fixture,'engine.lock.json');
  fs.copyFileSync(path.join(PROJECT_ROOT,'tools/setup-local.ps1'),script);fs.copyFileSync(path.join(PROJECT_ROOT,'engine.lock.json'),lockFile);
  const lock=readEngineLock(),results=[];
  const run=(name,args=[],succeeds=true,contains='')=>{
    const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',script,...args],{encoding:'utf8',windowsHide:true,timeout:60000});
    assert.ifError(result.error);assert.equal(result.status===0,succeeds,`${name}: unexpected installer exit: ${(result.stdout+result.stderr).slice(0,2000)}`);
    if(contains)assert.ok((result.stdout+result.stderr).includes(contains),`${name}: expected diagnostic is absent`);
    results.push({name,passed:true});return result;
  };
  run('fresh dependency restore');assert.equal(verifyEngineLock({root:fixture}).passed,true);
  run('read-only verification',['-VerifyOnly'],true,'No files changed');
  run('idempotent reinstall',[],true,'already installed');
  const license=path.join(fixture,'packages/thlib/LICENSE'),original=fs.readFileSync(license),originalHash=shaFile(license);
  fs.writeFileSync(license,Buffer.concat([original,Buffer.from('\nfixture local edit\n')]));const changedHash=shaFile(license);
  run('modified dependency is preserved',[],false,'Existing dependency size differs');assert.equal(shaFile(license),changedHash);
  fs.writeFileSync(license,original);assert.equal(shaFile(license),originalHash);
  fs.unlinkSync(license);run('missing pinned file is recovered');assert.equal(shaFile(license),originalHash);
  const library=path.resolve(fixture,'packages/thlib'),preserved=path.resolve(fixture,'build/preserved-thlib');
  for(const target of [library,preserved])assert.ok(target.startsWith(path.resolve(fixture)+path.sep),'Test move must remain inside its own fixture');
  fs.mkdirSync(path.dirname(preserved),{recursive:true});fs.renameSync(library,preserved);
  run('dangling local Node junction survives dependency recovery');assert.equal(verifyEngineLock({root:fixture}).passed,true);
  run('same-directory source is refused',['-EngineSource',fixture],false,'separate directories');
  const wrongCommit=structuredClone(lock);wrongCommit.commit='0'.repeat(40);fs.writeFileSync(lockFile,JSON.stringify(wrongCommit));
  run('wrong source commit is refused',[],false,'commit differs');fs.writeFileSync(lockFile,JSON.stringify(lock));
  const unsafe=structuredClone(lock);unsafe.thlibFiles[0].path='../LICENSE';fs.writeFileSync(lockFile,JSON.stringify(unsafe));
  run('tampered inventory is refused',[],false,'digest is invalid');fs.writeFileSync(lockFile,JSON.stringify(lock));
  // All fixture moves are confined above. No installed game or source directory
  // has been moved, and the existing local dependency link is kept intact.
  const linkedFixture=fs.mkdtempSync(path.join(build,'setup-verification-link-'));
  assert.ok(path.resolve(linkedFixture).startsWith(path.resolve(build)+path.sep+'setup-verification-link-'));
  fs.mkdirSync(path.join(linkedFixture,'tools'));fs.copyFileSync(script,path.join(linkedFixture,'tools/setup-local.ps1'));
  fs.copyFileSync(lockFile,path.join(linkedFixture,'engine.lock.json'));fs.symlinkSync(path.join(PROJECT_ROOT,'runtime'),path.join(linkedFixture,'runtime'),'junction');
  const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(linkedFixture,'tools/setup-local.ps1')],{encoding:'utf8',windowsHide:true,timeout:60000});
  assert.ifError(result.error);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/link or junction/);results.push({name:'target junction is refused',passed:true});
  assert.equal(verifyEngineLock().passed,true);assert.equal(verifyEngineLock({root:fixture}).passed,true);
  // Leave fixtures under ignored build for inspection; no recursive cleanup or
  // deletion crosses dependency junctions and no user data are involved.
  const report={passed:true,fixture:path.relative(PROJECT_ROOT,fixture).split(path.sep).join('/'),cases:results};
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifySetup(),null,2));
