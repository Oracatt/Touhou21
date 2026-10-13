import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {windowsReleaseLauncher,windowsDisplayConfigurationLauncher} from '../tools/package-windows.mjs';
import {inspectWindowsRelease,inspectWindowsReleaseLaunchers} from '../tools/verify-windows-release.mjs';

const root=path.resolve(import.meta.dirname,'..');
function releaseFixture(run){
  const temporaryRoot=fs.realpathSync(os.tmpdir()),directory=fs.mkdtempSync(path.join(temporaryRoot,'guiming-display-launchers-'));
  try{
    fs.writeFileSync(path.join(directory,'Play.cmd'),windowsReleaseLauncher());
    fs.writeFileSync(path.join(directory,'Configure-Display.cmd'),windowsDisplayConfigurationLauncher());
    return run(directory);
  }finally{
    assert.equal(path.dirname(directory),temporaryRoot,'Cleanup remains inside the allocated temporary directory');
    assert.match(path.basename(directory),/^guiming-display-launchers-/);
    fs.rmSync(directory,{recursive:true,force:true});
  }
}

test('both development backends use one game display profile and the configure shortcut forwards arguments',()=>{
  for(const [name,backend]of [['Play.cmd','v8'],['Play-QuickJS.cmd','quickjs']]){
    const script=fs.readFileSync(path.join(root,name),'utf8');
    assert.ok(script.includes(`--backend ${backend} --display-config userdata/guiming-display.json %*`));
    assert.equal(script.match(/call npm run build/g)?.length,1);
  }
  const configure=fs.readFileSync(path.join(root,'Configure-Display.cmd'),'utf8');
  assert.match(configure,/call "%~dp0Play\.cmd" --configure-display %\*/);
  assert.doesNotMatch(configure,/npm|node|tsc/i,'The shortcut delegates the existing build and forwards the native option');
});

test('generated release launchers configure display through the native V8 player without Node',()=>releaseFixture(directory=>{
  inspectWindowsReleaseLaunchers(directory);
  const play=fs.readFileSync(path.join(directory,'Play.cmd'),'utf8');
  assert.match(play,/pushd "%~dp0"/,'Double-clicking from another directory keeps the game root');
  assert.match(play,/if not exist "userdata" mkdir "userdata"/);
}));

test('release inspection rejects missing display profile, missing configure flag and compiler launchers',()=>{
  for(const broken of [
    {file:'Play.cmd',replace:script=>script.replace(' --display-config "userdata/guiming-display.json"',''),error:/public native display configuration/},
    {file:'Configure-Display.cmd',replace:script=>script.replace(' --configure-display',''),error:/force the same player launcher/},
    {file:'Play.cmd',replace:script=>'call npm run build\r\n'+script,error:/requires a compiler/},
  ])releaseFixture(directory=>{
    const filename=path.join(directory,broken.file);fs.writeFileSync(filename,broken.replace(fs.readFileSync(filename,'utf8')));
    assert.throws(()=>inspectWindowsReleaseLaunchers(directory),broken.error);
  });
});

test('the release allowlist permits only its two audited command launchers',()=>releaseFixture(directory=>{
  fs.writeFileSync(path.join(directory,'Other.cmd'),'@echo off\r\n');
  assert.throws(()=>inspectWindowsRelease(directory),/Unexpected release launcher: Other\.cmd/);
}));
