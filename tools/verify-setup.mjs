/** Verify the fresh-checkout path, including compiler bootstrap before npm ci.
 * Every mutation is confined to an ignored fixture; producer files are read only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,readEngineLock,verifyEngineLock,shaFile} from './verify-engine-lock.mjs';
import {compilerCacheRoot,engineCompilerFingerprint} from './engine-git.mjs';
import {exportEngineThlib} from './export-engine-thlib.mjs';

function copyInstaller(root){
  fs.mkdirSync(path.join(root,'tools'),{recursive:true});
  for(const name of ['setup-local.ps1','setup-engine.mjs','bootstrap-engine-compiler.mjs','export-engine-thlib.mjs','verify-engine-lock.mjs','engine-git.mjs'])
    fs.copyFileSync(path.join(PROJECT_ROOT,'tools',name),path.join(root,'tools',name));
}
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
  assert.equal(process.platform,'win32','Installer regression requires Windows PowerShell and junction support');
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'setup-verification-'));
  assert.ok(path.resolve(fixture).startsWith(path.resolve(build)+path.sep+'setup-verification-'));copyInstaller(fixture);
  const script=path.join(fixture,'tools/setup-local.ps1'),lockFile=path.join(fixture,'engine.lock.json');
  fs.copyFileSync(path.join(PROJECT_ROOT,'engine.lock.json'),lockFile);
  const lock=readEngineLock(),results=[];
  const run=(name,args=[],succeeds=true,contains='',installer=script)=>{
    const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-File',installer,...args],{encoding:'utf8',windowsHide:true,timeout:150000});
    assert.ifError(result.error);assert.equal(result.status===0,succeeds,`${name}: unexpected installer exit: ${(result.stdout+result.stderr).slice(0,3000)}`);
    if(contains)assert.ok((result.stdout+result.stderr).includes(contains),`${name}: diagnostic absent: ${result.stdout+result.stderr}`);
    results.push({name,passed:true});return result;
  };
  const beforeInstall=snapshot(fixture);
  run('incomplete VerifyOnly creates no compiler or staging files',['-VerifyOnly'],false,'incomplete');assert.deepEqual(snapshot(fixture),beforeInstall);
  run('fresh WhatIf creates no compiler or staging files',['-WhatIf']);assert.deepEqual(snapshot(fixture),beforeInstall);
  assert.equal(fs.existsSync(path.join(fixture,'node_modules')),false,'Fixture must have no inherited compiler installation');
  run('fresh bootstrap and complete dependency restore');assert.equal(verifyEngineLock({root:fixture}).passed,true);
  const compiler=path.join(compilerCacheRoot(fixture,lock.thlibBuild.compiler.version),'node_modules/typescript/lib/typescript.js');
  assert.deepEqual(engineCompilerFingerprint(compiler),lock.thlibBuild.compiler,'Fresh setup must bootstrap the compiler in the isolated cache');
  // npm ci now has the local package that its file: dependency requires. This
  // exercises the ordering that previously deadlocked a clean checkout.
  for(const name of ['package.json','package-lock.json'])fs.copyFileSync(path.join(PROJECT_ROOT,name),path.join(fixture,name));
  const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  execFileSync(process.execPath,[npmCli,'ci','--ignore-scripts','--no-audit','--no-fund'],{cwd:fixture,windowsHide:true,stdio:'pipe',timeout:120000});
  assert.equal(verifyEngineLock({root:fixture}).passed,true);results.push({name:'npm ci succeeds after isolated compiler bootstrap',passed:true});
  const afterInstall=snapshot(fixture);
  run('installed VerifyOnly is read only',['-VerifyOnly'],true,'No files changed');assert.deepEqual(snapshot(fixture),afterInstall);
  run('idempotent reinstall',[],true,'already installed');assert.deepEqual(snapshot(fixture),afterInstall);
  const license=path.join(fixture,'packages/thlib/LICENSE'),original=fs.readFileSync(license);
  fs.appendFileSync(license,'fixture local edit\n');const edited=shaFile(license);
  run('modified dependency is preserved',[],false,'Existing dependency size differs');assert.equal(shaFile(license),edited);fs.writeFileSync(license,original);
  fs.unlinkSync(license);run('missing committed input is recovered');assert.deepEqual(fs.readFileSync(license),original);
  const emitted=path.join(fixture,'packages/thlib/dist/index.js'),emittedBytes=fs.readFileSync(emitted);fs.unlinkSync(emitted);
  run('missing compiler output is rebuilt from committed TypeScript');assert.deepEqual(fs.readFileSync(emitted),emittedBytes);
  const externalTools=fs.mkdtempSync(path.join(build,'setup-verification-tools-'));copyInstaller(externalTools);
  assert.equal(fs.existsSync(path.join(externalTools,'node_modules')),false);fs.unlinkSync(emitted);
  execFileSync(process.execPath,[path.join(externalTools,'tools/setup-engine.mjs'),'--root',fixture],{windowsHide:true,stdio:'pipe',timeout:60000});
  assert.deepEqual(fs.readFileSync(emitted),emittedBytes);results.push({name:'explicit root uses that project compiler, not the tool location',passed:true});
  fs.appendFileSync(emitted,'\n// user edit\n');const editedOutput=shaFile(emitted);
  run('modified generated output is preserved',[],false,'Existing dependency size differs');assert.equal(shaFile(emitted),editedOutput);fs.writeFileSync(emitted,emittedBytes);
  const library=path.resolve(fixture,'packages/thlib'),preserved=path.resolve(fixture,'build/preserved-thlib');
  for(const target of [library,preserved])assert.ok(target.startsWith(path.resolve(fixture)+path.sep));
  fs.renameSync(library,preserved);
  run('dangling local Node junction survives full dependency recovery');assert.equal(verifyEngineLock({root:fixture}).passed,true);
  fs.unlinkSync(license);
  run('same-directory source is refused',['-EngineSource',fixture],false,'separate directories');
  const wrongCommit=structuredClone(lock);wrongCommit.commit='0'.repeat(40);fs.writeFileSync(lockFile,JSON.stringify(wrongCommit));
  run('missing pinned Git commit is refused',[],false,'missing');fs.writeFileSync(lockFile,JSON.stringify(lock));
  const badCompiler=structuredClone(lock);badCompiler.thlibBuild.compiler.implementationSha256='0'.repeat(64);fs.writeFileSync(lockFile,JSON.stringify(badCompiler));
  run('compiler implementation hash mismatch is refused',[],false,'Installed compiler differs');fs.writeFileSync(lockFile,JSON.stringify(lock));
  run('recovery after refused input leaves dependency intact');
  const unsafe=structuredClone(lock);unsafe.thlibFiles[0].path='../LICENSE';fs.writeFileSync(lockFile,JSON.stringify(unsafe));
  run('unsafe locked path is refused',[],false,'Unsafe locked path');fs.writeFileSync(lockFile,JSON.stringify(lock));
  const legacy=structuredClone(lock);legacy.format='touhou21-engine-lock-v1';fs.writeFileSync(lockFile,JSON.stringify(legacy));
  run('obsolete lock format is refused',[],false,'Only the committed TypeScript');fs.writeFileSync(lockFile,JSON.stringify(lock));
  const linked=fs.mkdtempSync(path.join(build,'setup-verification-link-'));copyInstaller(linked);fs.copyFileSync(lockFile,path.join(linked,'engine.lock.json'));
  fs.symlinkSync(path.join(PROJECT_ROOT,'runtime'),path.join(linked,'runtime'),'junction');
  run('target junction is refused',[],false,'link or junction',path.join(linked,'tools/setup-local.ps1'));
  const installed=snapshot(fixture);
  assert.throws(()=>exportEngineThlib({root:fixture,output:path.join(fixture,'outside-build')}),/build directory/);
  assert.deepEqual(snapshot(fixture),installed);results.push({name:'export refuses a destination outside game build',passed:true});
  assert.equal(verifyEngineLock().passed,true);assert.equal(verifyEngineLock({root:fixture}).passed,true);
  const report={passed:true,fixture:path.relative(PROJECT_ROOT,fixture).split(path.sep).join('/'),cases:results};
  fs.writeFileSync(path.join(fixture,'verification.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifySetup(),null,2));
