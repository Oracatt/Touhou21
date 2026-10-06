import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {safeRelative,inside,inventoryDigest,inventoryTree,readEngineLock,verifyEngineLock,PROJECT_ROOT} from '../tools/verify-engine-lock.mjs';
import {auditSourceText,auditBoundaries} from '../tools/audit-boundaries.mjs';

test('lock paths cannot escape their root or address environment and user data',()=>{
  for(const invalid of ['', '../LICENSE','src/../LICENSE','/LICENSE','C:/LICENSE','src\\index.js','src//index.js','src/./index.js','.git/config','.GIT/config','userdata/progress.json','node_modules/lib.js','.env','.env.local','.ENV.local','src/a\0b','src/.. /file','src/file.','src/nul.txt'])assert.throws(()=>safeRelative(invalid));
  assert.equal(safeRelative('assets/touhou-common/NOTICE.md'),'assets/touhou-common/NOTICE.md');
  assert.equal(inside(PROJECT_ROOT,'src/content.js'),path.join(PROJECT_ROOT,'src/content.js'));
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
  const lock=readEngineLock();assert.ok(lock.thlibFiles.length>=329);assert.ok(lock.runtimeFiles.length>=149);
  assert.equal(lock.nativeBuild.binarySha256,lock.executableSha256);assert.equal(lock.nativeBuild.configuration,'Release');
  assert.ok(lock.runtimeFiles.some(file=>file.path==='PACKAGE.json'));
  if(lock.nativeBuild.derivedPackage){const sdk=lock.runtimeFiles.find(file=>file.path==='PACKAGE.json');
    assert.equal(sdk.sourceSha256,lock.nativeBuild.packageTemplateSha256);
    assert.equal(JSON.parse(sdk.generatedContent).binarySha256,lock.executableSha256);
    assert.ok(lock.nativeBuild.objects.length>=8);assert.ok(lock.nativeBuild.linkInputs.length>=3);}
  for(const module of ['boss-escape','phase-sequence','player-rules','world'])
    for(const extension of ['js','d.ts'])assert.ok(lock.thlibFiles.some(file=>file.path==='src/touhou/'+module+'.'+extension));
  const result=verifyEngineLock();assert.equal(result.passed,true);assert.equal(result.sourceVerified,false);
});

test('recorded source state and derived SDK metadata cannot be silently broadened or altered',()=>{
  const lock=readEngineLock(),build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const fixture=fs.mkdtempSync(path.join(build,'lock-policy-verification-')),file=path.join(fixture,'engine.lock.json');
  if(lock.sourceState?.changes.length){const invalid=structuredClone(lock);invalid.sourceState.changes[0].path='native/src/host.cpp';
    fs.writeFileSync(file,JSON.stringify(invalid));assert.throws(()=>readEngineLock(fixture));}
  if(lock.nativeBuild.derivedPackage){const invalid=structuredClone(lock);invalid.runtimeFiles.find(entry=>entry.path==='PACKAGE.json').generatedContent+=' ';
    fs.writeFileSync(file,JSON.stringify(invalid));assert.throws(()=>readEngineLock(fixture));}
});
test('runtime game source may import public owners but not private paths or duplicate them',()=>{
  assert.deepEqual(auditSourceText("import {TouhouGame} from '@ts-stg/thlib/touhou';\nexport class Campaign extends TouhouGame {}"),['@ts-stg/thlib/touhou']);
  assert.deepEqual(auditSourceText("export {GAME} from './content.js';"),['./content.js']);
  for(const source of ["import x from 'node:fs';","import x from '@ts-stg/thlib/src/touhou/player.js';","import x from '../packages/thlib/src/index.js';","class TouhouPlayer {}","const x=import('./content.js');","host.loadMusic('../TS-STG/music.ogg');","const engine='D:/AIWorkspace/TS-STG';"])assert.throws(()=>auditSourceText(source));
});
test('game media, public dependencies and Git publishing boundary audit passes',()=>{
  const result=auditBoundaries();assert.equal(result.passed,true);assert.equal(result.musicFiles,17);assert.equal(result.spells,34);assert.ok(result.artFiles>=24);
});
