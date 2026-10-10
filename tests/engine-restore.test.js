import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {planEngineRestore,applyEngineRestore,sameTextExceptEol} from '../tools/restore-engine.mjs';
import {buildGitThlib,inventoryBuffers} from '../tools/engine-git.mjs';
import {PROJECT_ROOT,inventoryTree,inventoryDigest,shaFile,verifyEngineLock} from '../tools/verify-engine-lock.mjs';

function fixture({install=true}={}){
  const build=path.join(PROJECT_ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const directory=fs.mkdtempSync(path.join(build,'engine-restore-test-'));
  const source=path.join(directory,'relocated-source'),root=path.join(directory,'consumer');fs.mkdirSync(source);fs.mkdirSync(root);
  fs.mkdirSync(path.join(root,'node_modules'));
  fs.symlinkSync(path.join(PROJECT_ROOT,'node_modules/typescript'),path.join(root,'node_modules/typescript'),process.platform==='win32'?'junction':'dir');
  const git=args=>execFileSync('git',['-C',source,...args],{encoding:'utf8',windowsHide:true}).trim();
  const write=(base,name,content)=>{const output=path.join(base,...name.split('/'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,content);return output;};
  git(['init','--quiet']);git(['config','core.autocrlf','false']);git(['config','core.fsmonitor','false']);git(['config','core.untrackedCache','false']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
  write(source,'.gitignore','ignored/\npackages/thlib/src/ignored.ts\n');
  write(source,'packages/thlib/LICENSE','fixture license\n');
  write(source,'packages/thlib/package.json',"{\"name\":\"@ts-stg/thlib\",\"type\":\"module\",\"devDependencies\":{\"typescript\":\"5.9.3\"}}\n");
  write(source,'packages/thlib/tsconfig.base.json',"{\"compilerOptions\":{\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\",\"strict\":true,\"noEmitOnError\":true,\"declaration\":true,\"sourceMap\":true,\"declarationMap\":true,\"types\":[],\"lib\":[\"ES2022\"]}}\n");
  write(source,'packages/thlib/tsconfig.json',"{\"extends\":\"./tsconfig.base.json\",\"compilerOptions\":{\"rootDir\":\"src\",\"outDir\":\"dist\"},\"include\":[\"src/**/*.ts\"]}\n");
  write(source,'packages/thlib/src/index.ts','export const fixture = true;\nexport const count = 2;\n');
  write(source,'packages/thlib/src/nested/types.ts','export const count: number = 2;\n');
  write(source,'packages/thlib/assets/touhou-common/manifest.json','{"fixture":true}\n');
  write(source,'packages/thlib/assets/touhou-common/textures/binary.png',Buffer.from([137,80,78,71,13,10,0,255,13,10]));
  write(source,'packages/thlib/assets/private-demo/private.txt','must not be copied\n');
  git(['add','.']);git(['commit','--quiet','-m','Canonical fixture']);const commit=git(['rev-parse','HEAD']);
  const compiled=buildGitThlib(source,commit,{compilerRoot:root}),blobs=compiled.files;
  const thlibFiles=inventoryBuffers(blobs);
  if(install)for(const[name,bytes]of blobs)write(root,'packages/thlib/'+name,bytes);
  write(root,'runtime/ts-stg.exe',Buffer.from([77,90,0,13,10,255]));write(root,'runtime/readme.txt','existing runtime\r\n');
  const runtimeFiles=inventoryTree(path.join(root,'runtime')).map(entry=>({...entry,source:'unavailable-producer-build/'+entry.path}));
  const lock={format:'touhou21-engine-lock-v2',engine:'TS-STG',library:'@ts-stg/thlib',source:'X:/absent-original-machine/TS-STG',
    commit,thlibContent:'git-typescript-build',thlibBuild:compiled.build,sourceModified:false,backend:'v8',supportedBackends:['v8','quickjs'],
    executableSha256:runtimeFiles.find(entry=>entry.path==='ts-stg.exe').sha256,
    thlibFiles,thlibSha256:inventoryDigest(thlibFiles),runtimeFiles,runtimeSha256:inventoryDigest(runtimeFiles)};
  const saveLock=()=>write(root,'engine.lock.json',JSON.stringify(lock,null,2)+'\n');saveLock();
  return{directory,root,source,commit,blobs,lock,git,write,saveLock};
}
const installed=fixture=>inventoryTree(path.join(fixture.root,'packages/thlib'));
const protectedState=fixture=>({lock:shaFile(path.join(fixture.root,'engine.lock.json')),runtime:inventoryTree(path.join(fixture.root,'runtime'))});

test('EOL allowance accepts only lossless UTF-8 LF/CRLF changes and preserves BOM and binary bytes',()=>{
  const bytes=text=>Buffer.from(text,'utf8');
  assert.equal(sameTextExceptEol(bytes('中文\r\nline\r\n'),bytes('中文\nline\n')),true);
  assert.equal(sameTextExceptEol(bytes('\ufeffa\r\n'),bytes('\ufeffa\n')),true);
  for(const[actual,expected]of [
    [bytes('\ufeffa\r\n'),bytes('a\n')],[bytes('a\r'),bytes('a\n')],[bytes('a \r\n'),bytes('a\n')],
    [Buffer.from([0,13,10]),Buffer.from([0,10])],[Buffer.from([255,13,10]),Buffer.from([255,10])],
    [Buffer.from([0xe4,0xb8,13,10]),Buffer.from([0xe4,0xb8,10])],
  ])assert.equal(sameTextExceptEol(actual,expected),false);
});

test('dry-run uses pinned Git blobs from a relocated, newer and dirty checkout without producer build files',()=>{
  const f=fixture({install:false}),before=protectedState(f);
  f.write(f.source,'packages/thlib/src/index.ts','newer committed implementation\n');f.git(['add','.']);f.git(['commit','--quiet','-m','Newer HEAD']);
  f.write(f.source,'packages/thlib/src/index.ts','unstaged local implementation\r\n');
  f.write(f.source,'packages/thlib/src/nested/types.ts','staged local implementation\n');f.git(['add','packages/thlib/src/nested/types.ts']);
  f.write(f.source,'packages/thlib/src/untracked.ts','untracked local code\n');f.write(f.source,'packages/thlib/src/ignored.ts','ignored local code\n');
  const status=f.git(['status','--porcelain']),plan=planEngineRestore({root:f.root,source:f.source});
  assert.equal(plan.commit,f.commit);assert.equal(plan.summary.missingFiles,f.blobs.size);assert.equal(plan.summary.eolFiles,0);
  assert.equal(fs.existsSync(path.join(f.root,'packages')),false);assert.equal(fs.existsSync(path.join(f.root,'build')),false);
  assert.deepEqual(protectedState(f),before);assert.equal(f.git(['status','--porcelain']),status);
  const result=applyEngineRestore(plan);
  assert.equal(result.passed,true);assert.equal(verifyEngineLock({root:f.root,checkNode:false}).passed,true);
  assert.deepEqual(protectedState(f),before);assert.equal(f.git(['status','--porcelain']),status);
  assert.equal(fs.readFileSync(path.join(f.root,'packages/thlib/src/index.ts'),'utf8'),f.blobs.get('src/index.ts').toString('utf8'));
  assert.equal(fs.existsSync(path.join(f.root,'packages/thlib/src/untracked.ts')),false);
  assert.equal(fs.existsSync(path.join(f.root,'packages/thlib/src/ignored.ts')),false);
  assert.equal(fs.existsSync(path.join(f.root,'packages/thlib/assets/private-demo')),false);
});

test('partial and EOL restore preserves runtime, lock, user data and a dangling local Node junction',()=>{
  const f=fixture(),before=protectedState(f),index=path.join(f.root,'packages/thlib/src/index.ts');
  const crlf=f.blobs.get('src/index.ts').toString('utf8').replace(/\n/g,'\r\n');fs.writeFileSync(index,crlf);
  fs.unlinkSync(path.join(f.root,'packages/thlib/dist/nested/types.d.ts'));
  f.write(f.root,'userdata/save.json','owned save data\n');fs.mkdirSync(path.join(f.root,'node_modules/@ts-stg'),{recursive:true});
  const module=path.join(f.root,'node_modules/@ts-stg/thlib');fs.symlinkSync(path.join(f.root,'packages/thlib'),module,process.platform==='win32'?'junction':'dir');
  const link=fs.readlinkSync(module),original=installed(f),plan=planEngineRestore({root:f.root,source:f.source});
  assert.equal(plan.summary.missingFiles,1);assert.equal(plan.summary.eolFiles,1);
  const result=applyEngineRestore(plan),backup=path.join(f.root,result.backup,'backup-thlib');
  assert.deepEqual(inventoryTree(backup),original);assert.equal(fs.readFileSync(path.join(backup,'src/index.ts'),'utf8'),crlf);
  assert.deepEqual(protectedState(f),before);assert.equal(fs.readFileSync(path.join(f.root,'userdata/save.json'),'utf8'),'owned save data\n');
  assert.equal(fs.readlinkSync(module),link);assert.equal(verifyEngineLock({root:f.root}).passed,true);
  // An entirely absent tree can be restored without changing the same junction.
  fs.renameSync(path.join(f.root,'packages/thlib'),path.join(f.root,'saved-thlib'));assert.equal(fs.existsSync(module),false);
  applyEngineRestore(planEngineRestore({root:f.root,source:f.source}));
  assert.equal(fs.readlinkSync(module),link);assert.equal(verifyEngineLock({root:f.root}).passed,true);
});

test('restore rejects real edits, extra files/directories and binary EOL changes without overwriting them',()=>{
  for(const mutation of [
    f=>f.write(f.root,'packages/thlib/src/index.ts','actual edited implementation\n'),
    f=>f.write(f.root,'packages/thlib/src/unknown.js','owned local code\n'),
    f=>fs.mkdirSync(path.join(f.root,'packages/thlib/unknown-empty')),
    f=>f.write(f.root,'packages/thlib/assets/touhou-common/textures/binary.png',Buffer.from([137,80,78,71,10,0,255,10])),
  ]){
    const f=fixture();mutation(f);const before=installed(f),protectedBefore=protectedState(f);
    assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/local content modification|extra file|extra directory/);
    assert.deepEqual(installed(f),before);assert.deepEqual(protectedState(f),protectedBefore);
  }
});

test('restore refuses legacy locks, altered canonical inventories and absent or different pinned commits',()=>{
  const f=fixture();f.lock.format='touhou21-engine-lock-v1';f.saveLock();
  assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Only the committed TypeScript engine lock format/);
  f.lock.format='touhou21-engine-lock-v2';f.saveLock();
  assert.throws(()=>planEngineRestore({root:f.root,source:f.source,commit:'0'.repeat(40)}),/must equal the pinned/);
  f.lock.thlibFiles[0].sha256='0'.repeat(64);f.lock.thlibSha256=inventoryDigest(f.lock.thlibFiles);
  f.lock.thlibBuild.sourceFiles.find(entry=>entry.path===f.lock.thlibFiles[0].path).sha256='0'.repeat(64);
  f.lock.thlibBuild.sourceSha256=inventoryDigest(f.lock.thlibBuild.sourceFiles);f.saveLock();
  assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Pinned compiler or TypeScript build differs|inventory differs from the pinned Git commit/);
  f.lock.commit='0'.repeat(40);f.saveLock();assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/commit|object|revision/i);
});

test('restore rejects altered compiler implementation, package and standard-library fingerprints before writing',()=>{
  const f=fixture(),original=installed(f);
  for(const field of ['implementationSha256','packageSha256','standardLibrarySha256']){
    const saved=f.lock.thlibBuild.compiler[field];f.lock.thlibBuild.compiler[field]='0'.repeat(64);f.saveLock();
    const before=protectedState(f);
    assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Pinned compiler or TypeScript build differs/);
    assert.deepEqual(installed(f),original);assert.deepEqual(protectedState(f),before);
    assert.equal(fs.existsSync(path.join(f.root,'build')),false);
    f.lock.thlibBuild.compiler[field]=saved;f.saveLock();
  }
});

test('restore requires the selected consumer compiler and cannot fall back to an ancestor installation',()=>{
  const f=fixture(),compiler=path.join(f.root,'node_modules/typescript'),saved=path.join(f.root,'node_modules/typescript-unavailable');
  fs.renameSync(compiler,saved);
  const before=protectedState(f),original=installed(f);
  try{
    assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Pinned TypeScript compiler is missing/);
    assert.deepEqual(installed(f),original);assert.deepEqual(protectedState(f),before);
    assert.equal(fs.existsSync(path.join(f.root,'build')),false);
  }finally{fs.renameSync(saved,compiler);}
});

test('runtime must exactly match the lock even for an entirely missing thlib tree',()=>{
  for(const mutate of [
    f=>f.write(f.root,'runtime/ts-stg.exe','modified executable'),
    f=>f.write(f.root,'runtime/foreign.dll','unlocked binary'),
    f=>fs.unlinkSync(path.join(f.root,'runtime/readme.txt')),
  ]){
    const f=fixture({install:false});mutate(f);const before=protectedState(f);
    assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Private runtime differs/);
    assert.deepEqual(protectedState(f),before);assert.equal(fs.existsSync(path.join(f.root,'packages')),false);
  }
});

test('restore rejects nested links, ancestor junctions, broken links and linked source roots',()=>{
  for(const mode of ['nested','packages','build','source']){
    const f=fixture({install:mode==='nested'}),external=path.join(f.directory,'external');fs.mkdirSync(external);
    let link;if(mode==='nested')link=path.join(f.root,'packages/thlib/src/linked');
    else if(mode==='source')link=path.join(f.directory,'source-link');else link=path.join(f.root,mode);
    fs.symlinkSync(mode==='source'?f.source:external,link,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>planEngineRestore({root:f.root,source:mode==='source'?link:f.source}),/link or junction|traverse links/);
  }
  const f=fixture({install:false});fs.mkdirSync(path.join(f.root,'packages'));
  fs.symlinkSync(path.join(f.directory,'missing-target'),path.join(f.root,'packages/thlib'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/link or junction/);
});

test('plan/apply rejects changed lock, runtime and installed files before moving a target',()=>{
  for(const mutate of [
    f=>fs.appendFileSync(path.join(f.root,'engine.lock.json'),'\n'),
    f=>f.write(f.root,'runtime/readme.txt','changed runtime\n'),
    f=>f.write(f.root,'packages/thlib/src/index.ts',f.blobs.get('src/index.ts').toString('utf8').replace(/\n/g,'\r\n')),
    f=>{fs.unlinkSync(path.join(f.root,'packages/thlib/src/index.ts'));},
  ]){
    const f=fixture(),plan=planEngineRestore({root:f.root,source:f.source});mutate(f);const before=installed(f),protectedBefore=protectedState(f);
    assert.throws(()=>applyEngineRestore(plan),/changed since planning|Private runtime differs/);
    assert.deepEqual(installed(f),before);assert.deepEqual(protectedState(f),protectedBefore);
  }
});

test('already canonical restore is a true no-op and independently installed Node copies must also be exact',()=>{
  const f=fixture(),before=protectedState(f),original=installed(f),plan=planEngineRestore({root:f.root,source:f.source});
  const result=applyEngineRestore(plan);assert.equal(result.filesTouched,0);assert.equal(result.backup,null);
  assert.equal(fs.existsSync(path.join(f.root,'build')),false);assert.deepEqual(installed(f),original);assert.deepEqual(protectedState(f),before);
  const module=path.join(f.root,'node_modules/@ts-stg/thlib');fs.mkdirSync(path.dirname(module),{recursive:true});
  fs.cpSync(path.join(f.root,'packages/thlib'),module,{recursive:true});
  assert.equal(planEngineRestore({root:f.root,source:f.source}).node.kind,'verified-copy');
  fs.appendFileSync(path.join(module,'LICENSE'),'changed separate Node copy\n');
  assert.throws(()=>planEngineRestore({root:f.root,source:f.source}),/Installed Node thlib copy.*differs/);
  assert.deepEqual(installed(f),original);assert.deepEqual(protectedState(f),before);
});

test('post-install verification failure rolls back the exact prior tree and missing-tree state',()=>{
  for(const install of [true,false]){
    const f=fixture({install}),target=path.join(f.root,'packages/thlib');
    if(install)fs.writeFileSync(path.join(target,'src/index.ts'),f.blobs.get('src/index.ts').toString('utf8').replace(/\n/g,'\r\n'));
    const before=install?installed(f):null,protectedBefore=protectedState(f);
    const plan=planEngineRestore({root:f.root,source:f.source}),rename=fs.renameSync;
    fs.renameSync=(from,to)=>{
      rename(from,to);if(to===target&&path.basename(from)==='thlib')f.write(f.root,'packages/thlib/verification-failure.txt','injected verification failure\n');
    };
    try{assert.throws(()=>applyEngineRestore(plan),/file inventory differs/);}finally{fs.renameSync=rename;}
    if(install)assert.deepEqual(installed(f),before);else assert.equal(fs.existsSync(target),false);
    assert.deepEqual(protectedState(f),protectedBefore);
  }
});
