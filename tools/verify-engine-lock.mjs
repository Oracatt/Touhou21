import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const PROJECT_ROOT=path.resolve(import.meta.dirname,'..');
export const shaFile=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ordinal=(a,b)=>a<b?-1:a>b?1:0;

export function safeRelative(value){
  assert.equal(typeof value,'string','Locked path must be a string');
  assert.ok(value.length>0&&!path.isAbsolute(value)&&!value.includes('\\')&&!value.includes(':')&&!value.includes('\0'),'Unsafe locked path');
  assert.ok(value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!/[.\s]$|[\x00-\x1f]/.test(part)&&!['.git','userdata','node_modules'].includes(part.toLowerCase())&&!/^\.env($|\.)/i.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),'Unsafe locked path');
  return value;
}
export function inside(root,relative){
  safeRelative(relative);const target=path.resolve(root,...relative.split('/')),prefix=path.resolve(root)+path.sep;
  assert.ok(target.startsWith(prefix),'Locked path escapes its root');return target;
}
export function inventoryTree(root){
  const files=[];
  function visit(directory){
    assert.ok(!fs.lstatSync(directory).isSymbolicLink(),'Dependency directory may not be a link');
    for(const name of fs.readdirSync(directory).sort(ordinal)){
      const file=path.join(directory,name),stat=fs.lstatSync(file);
      assert.ok(!stat.isSymbolicLink(),'Dependency inventory may not traverse links');
      if(stat.isDirectory())visit(file);
      else{assert.ok(stat.isFile(),'Dependency contains an unsupported filesystem object');
        files.push({path:path.relative(root,file).split(path.sep).join('/'),bytes:stat.size,sha256:shaFile(file)});}
    }
  }
  visit(root);return files.sort((a,b)=>ordinal(a.path,b.path));
}
export function inventoryDigest(files){
  const hash=createHash('sha256');
  for(const file of [...files].sort((a,b)=>ordinal(a.path,b.path)))hash.update(`${file.path}\0${file.bytes}\0${file.sha256.toLowerCase()}\n`,'utf8');
  return hash.digest('hex');
}
export function readEngineLock(root=PROJECT_ROOT){
  const lock=JSON.parse(fs.readFileSync(path.join(root,'engine.lock.json'),'utf8'));
  assert.equal(lock.format,'touhou21-engine-lock-v1');assert.equal(lock.engine,'TS-STG');assert.equal(lock.library,'@ts-stg/thlib');
  assert.match(lock.commit,/^[a-f0-9]{40}$/);assert.match(lock.executableSha256,/^[a-f0-9]{64}$/i);
  assert.deepEqual(lock.supportedBackends,['v8','quickjs']);assert.equal(lock.backend,'v8');assert.equal(lock.sourceModified,false);
  for(const files of [lock.thlibFiles,lock.runtimeFiles]){
    assert.ok(Array.isArray(files)&&files.length>0);const seen=new Set();
    for(const file of files){safeRelative(file.path);if(file.source)safeRelative(file.source);
      assert.ok(!seen.has(file.path),'Duplicate locked file');seen.add(file.path);
      assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>=0);assert.match(file.sha256,/^[a-f0-9]{64}$/);}
  }
  assert.equal(inventoryDigest(lock.thlibFiles),lock.thlibSha256,'Invalid library inventory digest');
  assert.equal(inventoryDigest(lock.runtimeFiles),lock.runtimeSha256,'Invalid runtime inventory digest');
  for(const file of lock.runtimeFiles)safeRelative(file.source);
  const binary=lock.runtimeFiles.find(file=>file.path==='ts-stg.exe');assert.ok(binary);
  assert.equal(binary.sha256,lock.executableSha256.toLowerCase());return lock;
}
function compareTree(directory,expected,label){
  const actual=inventoryTree(directory);
  const byPath=new Map(actual.map(file=>[file.path,file]));
  assert.equal(actual.length,expected.length,`${label}: file inventory differs`);
  for(const file of expected){const found=byPath.get(file.path);assert.ok(found,`${label}: missing ${file.path}`);
    assert.equal(found.bytes,file.bytes,`${label}: size changed for ${file.path}`);
    assert.equal(found.sha256,file.sha256,`${label}: hash changed for ${file.path}`);}
}
export function verifyEngineLock({root=PROJECT_ROOT,source=null,checkSource=false,checkNode=true}={}){
  const lock=readEngineLock(root),library=path.join(root,'packages/thlib'),runtime=path.join(root,'runtime');
  compareTree(library,lock.thlibFiles,'Private thlib snapshot');compareTree(runtime,lock.runtimeFiles,'Private runtime snapshot');
  if(checkNode){
    const module=path.join(root,'node_modules/@ts-stg/thlib'),resolved=fs.realpathSync(module);
    assert.ok(resolved===fs.realpathSync(library)||resolved.startsWith(fs.realpathSync(root)+path.sep),'Node dependency resolves outside this game');
    if(resolved!==fs.realpathSync(library))compareTree(resolved,lock.thlibFiles,'Installed Node dependency');
  }
  let sourceVerified=false;
  if(checkSource||source){
    const location=fs.realpathSync(source??lock.source);
    const commit=execFileSync('git',['-C',location,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
    assert.equal(commit,lock.commit,'Engine source commit differs from lock');
    // The local snapshot is an explicit subset of the public package. Only the
    // pinned entries are copied; unrelated source files are never swept in.
    for(const file of lock.thlibFiles){const sourceFile=inside(path.join(location,'packages/thlib'),file.path);
      assert.ok(!fs.lstatSync(sourceFile).isSymbolicLink(),'Source library file may not be a link');
      assert.equal(fs.statSync(sourceFile).size,file.bytes,'Source library file size differs');
      assert.equal(shaFile(sourceFile),file.sha256,'Source library file hash differs');}
    for(const file of lock.runtimeFiles){const sourceFile=inside(location,file.source);
      assert.equal(fs.statSync(sourceFile).size,file.bytes,'Source runtime file size differs');
      assert.equal(shaFile(sourceFile),file.sha256,'Source runtime file hash differs');}
    sourceVerified=true;
  }
  return{passed:true,commit:lock.commit,backend:lock.backend,supportedBackends:lock.supportedBackends,
    executableSha256:lock.executableSha256,thlibFiles:lock.thlibFiles.length,runtimeFiles:lock.runtimeFiles.length,
    thlibSha256:lock.thlibSha256,runtimeSha256:lock.runtimeSha256,sourceVerified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let checkSource=false,source=null;
  for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--check-source')checkSource=true;
    else if(process.argv[i]==='--source')source=process.argv[++i];
    else throw new Error(`Unknown argument ${process.argv[i]}`);
  }
  console.log(JSON.stringify(verifyEngineLock({checkSource,source}),null,2));
}
