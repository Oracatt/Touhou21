/** Exercise installation inside an isolated, ignored build directory.
 * The shared source engine is read only; the real game dependencies are untouched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,readEngineLock,verifyEngineLock,shaFile,inventoryTree,inventoryDigest} from './verify-engine-lock.mjs';
import {inventoryGitThlib} from './engine-git.mjs';
import {exportEngineThlib} from './export-engine-thlib.mjs';

function copyInstaller(root){
  fs.mkdirSync(path.join(root,'tools'),{recursive:true});
  for(const name of ['setup-local.ps1','export-engine-thlib.mjs','verify-engine-lock.mjs','engine-git.mjs'])
    fs.copyFileSync(path.join(PROJECT_ROOT,'tools',name),path.join(root,'tools',name));
}
// Observe links without following them; verification must not create even an
// empty staging directory, or change an existing dependency's bytes.
function snapshot(root){
  const entries=[];
  function visit(directory){for(const name of fs.readdirSync(directory).sort()){
    const file=path.join(directory,name),stat=fs.lstatSync(file),relative=path.relative(root,file);
    if(stat.isSymbolicLink())entries.push([relative,'link',fs.readlinkSync(file)]);
    else if(stat.isDirectory()){entries.push([relative,'directory']);visit(file);}
    else entries.push([relative,shaFile(file)]);
  }}
  visit(root);return entries;
}

export function verifySetup(){
  if(process.platform!=='win32')throw new Error('The local dependency installer fixture requires Windows PowerShell and junction support.');
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'setup-verification-'));
  assert.ok(path.resolve(fixture).startsWith(path.resolve(build)+path.sep+'setup-verification-'));
  copyInstaller(fixture);
  const script=path.join(fixture,'tools/setup-local.ps1'),lockFile=path.join(fixture,'engine.lock.json');
  fs.copyFileSync(path.join(PROJECT_ROOT,'engine.lock.json'),lockFile);
  const lock=readEngineLock(),results=[];
  const run=(name,args=[],succeeds=true,contains='',installer=script)=>{
    const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',installer,...args],{encoding:'utf8',windowsHide:true,timeout:60000});
    assert.ifError(result.error);assert.equal(result.status===0,succeeds,`${name}: unexpected installer exit: ${(result.stdout+result.stderr).slice(0,2000)}`);
    if(contains)assert.ok((result.stdout+result.stderr).includes(contains),`${name}: expected diagnostic is absent`);
    results.push({name,passed:true});return result;
  };
  const beforeInstall=snapshot(fixture);
  run('missing dependency read-only verification',['-VerifyOnly'],false,'incomplete');assert.deepEqual(snapshot(fixture),beforeInstall);
  run('fresh WhatIf does not stage files',['-WhatIf']);assert.deepEqual(snapshot(fixture),beforeInstall);
  run('fresh dependency restore');assert.equal(verifyEngineLock({root:fixture}).passed,true);
  const afterInstall=snapshot(fixture);
  run('read-only verification',['-VerifyOnly'],true,'No files changed');assert.deepEqual(snapshot(fixture),afterInstall);
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
  copyInstaller(linkedFixture);
  fs.copyFileSync(lockFile,path.join(linkedFixture,'engine.lock.json'));fs.symlinkSync(path.join(PROJECT_ROOT,'runtime'),path.join(linkedFixture,'runtime'),'junction');
  const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',path.join(linkedFixture,'tools/setup-local.ps1')],{encoding:'utf8',windowsHide:true,timeout:60000});
  assert.ifError(result.error);assert.notEqual(result.status,0);assert.match(result.stdout+result.stderr,/link or junction/);results.push({name:'target junction is refused',passed:true});

  // A real committed LF blob with a clean CRLF checkout reproduces the original
  // cross-machine mismatch independently of this developer's Git configuration.
  const smallSource=fs.mkdtempSync(path.join(build,'setup-source-'));
  const git=(...args)=>execFileSync('git',['-C',smallSource,...args],{encoding:'utf8',windowsHide:true});
  const write=(name,value)=>{const target=path.join(smallSource,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,value);};
  write('.gitattributes','* text=auto eol=lf\n*.png binary\n');
  write('packages/thlib/LICENSE','Fixture license\r\n');
  write('packages/thlib/package.json','{"name":"@ts-stg/thlib","type":"module"}\r\n');
  write('packages/thlib/src/index.js','export const fixture = true;\r\n');
  write('packages/thlib/assets/touhou-common/manifest.json','{}\r\n');
  write('packages/thlib/assets/touhou-common/fixture.png',Buffer.from([0,255,13,10,128,0]));
  write('ts-stg.exe',Buffer.from([77,90,0,1,2]));
  git('init','--quiet');git('config','core.autocrlf','false');git('add','.');git('-c','user.name=Installer Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture');
  assert.equal(git('status','--porcelain'),'');
  const commit=git('rev-parse','HEAD').trim(),sourceBefore=snapshot(smallSource);
  const canonicalFiles=inventoryGitThlib(smallSource,commit),checkoutFiles=inventoryTree(path.join(smallSource,'packages/thlib'));
  assert.notEqual(inventoryDigest(canonicalFiles),inventoryDigest(checkoutFiles),'Fixture checkout must differ from committed LF bytes');
  const runtimeFiles=[{path:'ts-stg.exe',source:'ts-stg.exe',bytes:5,sha256:shaFile(path.join(smallSource,'ts-stg.exe'))}];
  const minimal={format:'touhou21-engine-lock-v1',engine:'TS-STG',library:'@ts-stg/thlib',source:smallSource,commit,sourceModified:false,
    backend:'v8',supportedBackends:['v8','quickjs'],executableSha256:runtimeFiles[0].sha256,runtimeFiles,runtimeSha256:inventoryDigest(runtimeFiles)};
  for(const [content,files] of [['git-blob',canonicalFiles],['legacy',checkoutFiles]]){
    const smallFixture=fs.mkdtempSync(path.join(build,'setup-'+content+'-'));copyInstaller(smallFixture);
    const smallLock={...minimal,thlibFiles:files,thlibSha256:inventoryDigest(files),...(content==='git-blob'?{thlibContent:content}:{})};
    fs.writeFileSync(path.join(smallFixture,'engine.lock.json'),JSON.stringify(smallLock));
    const smallScript=path.join(smallFixture,'tools/setup-local.ps1'),before=snapshot(smallFixture);
    run(content+' WhatIf is read only',['-WhatIf'],true,'',smallScript);assert.deepEqual(snapshot(smallFixture),before);
    run(content+' installs the exact declared bytes',[],true,'Restored',smallScript);assert.equal(verifyEngineLock({root:smallFixture}).passed,true);
    assert.deepEqual(inventoryTree(path.join(smallFixture,'packages/thlib')),files);
    assert.equal(shaFile(path.join(smallFixture,'packages/thlib/assets/touhou-common/fixture.png')),shaFile(path.join(smallSource,'packages/thlib/assets/touhou-common/fixture.png')));
    if(content==='git-blob'){
      const installed=snapshot(smallFixture);
      assert.throws(()=>exportEngineThlib({root:smallFixture,output:path.join(smallFixture,'outside-build')}),/build directory/);
      assert.deepEqual(snapshot(smallFixture),installed);results.push({name:'Git exporter refuses an output outside game build',passed:true});
    }
  }
  assert.deepEqual(snapshot(smallSource),sourceBefore,'Neither canonical nor legacy installation may write the source engine');
  results.push({name:'CRLF source and binary bytes remain untouched',passed:true});
  assert.equal(verifyEngineLock().passed,true);assert.equal(verifyEngineLock({root:fixture}).passed,true);
  // Leave fixtures under ignored build for inspection; no recursive cleanup or
  // deletion crosses dependency junctions and no user data are involved.
  const report={passed:true,fixture:path.relative(PROJECT_ROOT,fixture).split(path.sep).join('/'),cases:results};
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifySetup(),null,2));
