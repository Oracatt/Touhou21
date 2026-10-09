import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {safeRelative,inside,inventoryDigest,inventoryTree,readEngineLock,verifyEngineLock,PROJECT_ROOT} from '../tools/verify-engine-lock.mjs';
import {auditSourceText,auditBoundaries} from '../tools/audit-boundaries.mjs';

test('lock paths cannot escape their root or address environment and user data',()=>{
  for(const invalid of ['', '../LICENSE','src/../LICENSE','/LICENSE','C:/LICENSE','src\\index.js','src//index.ts','src/./index.js','.git/config','.GIT/config','userdata/progress.json','node_modules/lib.js','.env','.env.local','.ENV.local','src/a\0b','src/.. /file','src/file.','src/nul.txt'])assert.throws(()=>safeRelative(invalid));
  assert.equal(safeRelative('assets/touhou-common/NOTICE.md'),'assets/touhou-common/NOTICE.md');
  assert.equal(inside(PROJECT_ROOT,'src/content.ts'),path.join(PROJECT_ROOT,'src/content.ts'));
});
test('inventory digests are order independent and detect names, lengths and byte hash changes',()=>{
  const files=[{path:'z',bytes:2,sha256:'ab'.repeat(32)},{path:'a',bytes:3,sha256:'cd'.repeat(32)}],digest=inventoryDigest(files);
  assert.equal(inventoryDigest([...files].reverse()),digest);
  for(const field of ['path','bytes','sha256']){const changed=structuredClone(files);changed[0][field]=field==='bytes'?4:field==='path'?'y':'ef'.repeat(32);assert.notEqual(inventoryDigest(changed),digest);}
});
test('file inventory rejects links rather than hashing material outside the root',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'guiming-lock-'));
  try{fs.mkdirSync(path.join(root,'external'));fs.writeFileSync(path.join(root,'external','a'),'safe');fs.mkdirSync(path.join(root,'inventory'));
    fs.symlinkSync(path.join(root,'external'),path.join(root,'inventory','junction'),process.platform==='win32'?'junction':'dir');
    assert.throws(()=>inventoryTree(path.join(root,'inventory')),/link/);
  }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'guiming-lock-'));fs.rmSync(root,{recursive:true,force:true});}
});
test('exact private library/runtime snapshot and local Node resolution remain pinned',()=>{
  const lock=readEngineLock();assert.ok(lock.thlibFiles.length>=738);assert.ok(lock.runtimeFiles.length>=150);
  assert.equal(lock.format,'touhou21-engine-lock-v2');assert.equal(lock.thlibContent,'git-typescript-build');assert.equal(lock.sourceModified,false);
  assert.equal(lock.thlibBuild.compiler.version,'5.9.3');
  assert.ok(lock.thlibBuild.sourceFiles.filter(file=>file.path.startsWith('src/')).every(file=>file.path.endsWith('.ts')));
  assert.ok(lock.thlibBuild.outputFiles.every(file=>file.path.startsWith('dist/')));
  assert.equal(lock.thlibFiles.some(file=>file.path.startsWith('src/')&&file.path.endsWith('.js')),false);
  assert.equal(lock.nativeBuild.binarySha256,lock.executableSha256);assert.equal(lock.nativeBuild.configuration,'Release');
  assert.ok(lock.runtimeFiles.some(file=>file.path==='PACKAGE.json'));
  const sdk=lock.runtimeFiles.find(file=>file.path==='PACKAGE.json');
  assert.equal(sdk.sha256,lock.nativeBuild.packageSha256);
  assert.ok(lock.nativeBuild.objects.length>=8);assert.ok(lock.nativeBuild.linkInputs.length>=3);
  for(const module of ['boss-escape','phase-sequence','player-rules','world']){
    assert.ok(lock.thlibFiles.some(file=>file.path==='src/touhou/'+module+'.ts'));
    for(const extension of ['js','js.map','d.ts','d.ts.map'])assert.ok(lock.thlibFiles.some(file=>file.path==='dist/touhou/'+module+'.'+extension));
  }
  const result=verifyEngineLock();assert.equal(result.passed,true);assert.equal(result.sourceVerified,false);
});

test('lock validation rejects legacy formats, mutable dependency inputs and inconsistent provenance',()=>{
  const lock=readEngineLock(),build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'lock-policy-verification-')),file=path.join(fixture,'engine.lock.json');
  for(const mutate of [
    value=>{value.format='touhou21-engine-lock-v1';},
    value=>{value.thlibContent='git-blob';},
    value=>{value.sourceModified=true;},
    value=>{value.sourceState.dependencyInputsClean=false;},
    value=>{value.sourceState={dependencyInputsClean:true,gitClean:false,excludedChanges:[{path:'native/src/host.cpp',status:' M',sha256:'0'.repeat(64),headBlob:'0'.repeat(40)}]};},
    value=>{value.thlibBuild.outputFiles.pop();value.thlibBuild.outputSha256=inventoryDigest(value.thlibBuild.outputFiles);},
    value=>{value.thlibBuild.sourceFiles[0].sha256='0'.repeat(64);},
    value=>{value.nativeBuild.packageSha256='0'.repeat(64);},
  ]){const invalid=structuredClone(lock);mutate(invalid);fs.writeFileSync(file,JSON.stringify(invalid));assert.throws(()=>readEngineLock(fixture));}
});

test('runtime game source may import public owners but not private paths or duplicate them',()=>{
  assert.deepEqual(auditSourceText("import {TouhouGame} from '@ts-stg/thlib/touhou';\nexport class Campaign extends TouhouGame {}"),['@ts-stg/thlib/touhou']);
  assert.deepEqual(auditSourceText("export {GAME} from './content.js';"),['./content.js']);
  for(const source of ["import x from 'node:fs';","import x from '@ts-stg/thlib/src/touhou/player.js';","import x from '../packages/thlib/dist/index.js';","class TouhouPlayer {}","const x=import('./content.js');","host.loadMusic('../TS-STG/music.ogg');","const engine='D:/AIWorkspace/TS-STG';"])assert.throws(()=>auditSourceText(source));
});
test('game media, public dependencies and Git publishing boundary audit passes',()=>{
  const result=auditBoundaries();assert.equal(result.passed,true);assert.equal(result.musicFiles,18);assert.equal(result.spells,39);assert.ok(result.artFiles>=24);
});
