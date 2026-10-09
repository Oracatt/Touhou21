/** Restore the private thlib tree from committed TypeScript and its pinned compiler.
 * Runtime binaries and the lock remain unchanged. No producer build is needed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,inside,inventoryTree,inventoryDigest,readEngineLock,shaFile,verifyEngineLock} from './verify-engine-lock.mjs';
import {buildGitThlib,inventoryBuffers} from './engine-git.mjs';

const ordinal=(a,b)=>a<b?-1:a>b?1:0;
const fold=value=>process.platform==='win32'?value.toLowerCase():value;
const shaBytes=value=>createHash('sha256').update(value).digest('hex');
const relative=value=>value.split(path.sep).join('/');

function assertPlainPath(target){
  let probe=path.resolve(target);
  while(true){
    const stat=fs.lstatSync(probe,{throwIfNoEntry:false});
    assert.ok(!stat?.isSymbolicLink(),'Restore path may not pass through a link or junction: '+probe);
    const parent=path.dirname(probe);if(parent===probe)return;probe=parent;
  }
}
function separateRoots(root,source){
  assertPlainPath(root);assertPlainPath(source);
  const a=fs.realpathSync(root),b=fs.realpathSync(source);
  assert.ok(fs.statSync(a).isDirectory()&&fs.statSync(b).isDirectory(),'Game and source must be directories');
  assert.ok(fold(a)!==fold(b)&&!fold(a).startsWith(fold(b)+path.sep)&&!fold(b).startsWith(fold(a)+path.sep),
    'The game and source engine must be separate directories.');
  return{root:a,source:b};
}
function assertExactTree(directory,expected,label){
  assertPlainPath(directory);
  assert.deepEqual(inventoryTree(directory),expected.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>ordinal(a.path,b.path)),
    label+' differs from its complete locked inventory');
}
/** EOL conversion is the only permitted variation. Binary or invalid UTF-8
 * data, bare CR, NUL and other control characters are never normalized. */
export function sameTextExceptEol(actual,committed){
  const decode=bytes=>{
    try{
      const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
      if(!Buffer.from(text,'utf8').equals(bytes)||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]|\r(?!\n)/.test(text))return null;
      return text.replace(/\r\n/g,'\n');
    }catch{return null;}
  };
  const a=decode(actual),b=decode(committed);return a!==null&&b!==null&&a===b;
}
function installedLibrary(root,committed){
  const directory=inside(root,'packages/thlib');assertPlainPath(directory);
  const stat=fs.lstatSync(directory,{throwIfNoEntry:false});
  if(!stat)return{exists:false,files:[],missing:committed.size,eolFiles:[]};
  assert.ok(stat.isDirectory(),'Private thlib must be a directory');
  const files=inventoryTree(directory),eolFiles=[];
  for(const entry of files){
    assert.ok(committed.has(entry.path),'Private thlib contains an extra file: '+entry.path);
    const actual=fs.readFileSync(inside(directory,entry.path)),expected=committed.get(entry.path);
    if(!actual.equals(expected)){
      assert.ok(sameTextExceptEol(actual,expected),'Private thlib has a local content modification: '+entry.path);
      eolFiles.push(entry.path);
    }
  }
  // Unknown empty directories also belong to the user, rather than this restore.
  const allowedDirectories=new Set(['']);
  for(const name of committed.keys()){
    let parent=path.posix.dirname(name);
    while(parent!=='.'){allowedDirectories.add(parent);parent=path.posix.dirname(parent);}
  }
  function visit(current){
    for(const name of fs.readdirSync(current)){
      const target=path.join(current,name);if(!fs.lstatSync(target).isDirectory())continue;
      const nameInTree=relative(path.relative(directory,target));
      assert.ok(allowedDirectories.has(nameInTree),'Private thlib contains an extra directory: '+nameInTree);visit(target);
    }
  }
  visit(directory);
  return{exists:true,files,missing:committed.size-files.length,eolFiles};
}
function installedNode(root,expected){
  const module=path.join(root,'node_modules/@ts-stg/thlib');assertPlainPath(path.dirname(module));
  const stat=fs.lstatSync(module,{throwIfNoEntry:false});
  if(!stat)return{kind:'missing'};
  if(stat.isSymbolicLink()){
    const target=path.resolve(path.dirname(module),fs.readlinkSync(module));
    assert.equal(fold(target),fold(inside(root,'packages/thlib')),'Node thlib link must resolve to this game\'s private packages/thlib; it will not be changed.');
    return{kind:'local-link',target};
  }
  assert.ok(stat.isDirectory(),'Installed Node thlib must be a directory or a local thlib link');
  assertExactTree(module,expected,'Installed Node thlib copy (not changed by restore)');
  return{kind:'verified-copy',sha256:inventoryDigest(inventoryTree(module))};
}
export function planEngineRestore({root=PROJECT_ROOT,source=null,commit=null}={}){
  root=path.resolve(root);assertPlainPath(path.join(root,'engine.lock.json'));
  const lock=readEngineLock(root);
  if(commit!==null)assert.equal(commit,lock.commit,'Restore commit must equal the pinned engine commit');
  ({root,source}=separateRoots(root,path.resolve(source??lock.source)));
  for(const name of ['packages/thlib','runtime','build'])assertPlainPath(inside(root,name));
  assertExactTree(inside(root,'runtime'),lock.runtimeFiles,'Private runtime');
  const rebuilt=buildGitThlib(source,lock.commit,{compilerRoot:root}),committed=rebuilt.files,thlibFiles=inventoryBuffers(committed);
  assert.deepEqual(rebuilt.build,lock.thlibBuild,'Pinned compiler or TypeScript build differs from the lock');
  assert.deepEqual(thlibFiles,lock.thlibFiles.map(({path,bytes,sha256})=>({path,bytes,sha256})).sort((a,b)=>ordinal(a.path,b.path)),
    'Locked thlib inventory differs from the pinned Git commit');
  assert.equal(inventoryDigest(thlibFiles),lock.thlibSha256,'Pinned Git thlib digest differs from the lock');
  const before=installedLibrary(root,committed),node=installedNode(root,thlibFiles);
  return{root,source,commit:lock.commit,lockSha256:shaFile(path.join(root,'engine.lock.json')),thlibFiles,
    runtimeSha256:lock.runtimeSha256,before,node,
    summary:{commit:lock.commit,thlibContent:lock.thlibContent,thlibFiles:thlibFiles.length,runtimeFiles:lock.runtimeFiles.length,
      missingFiles:before.missing,eolFiles:before.eolFiles.length,runtimePreserved:true,lockPreserved:true,
      nodeInstallation:node.kind==='missing'?'Not installed or modified. After restore, run npm install --ignore-scripts.':'Verified local dependency; not modified.'}};
}
function assertSamePlan(plan,current){
  for(const name of ['root','source','commit','lockSha256','runtimeSha256'])assert.equal(current[name],plan[name],'Restore inputs changed since planning: '+name);
  assert.deepEqual(current.thlibFiles,plan.thlibFiles,'Pinned thlib inventory changed since planning');
  assert.deepEqual(current.before,plan.before,'Private thlib changed since planning');
  assert.deepEqual(current.node,plan.node,'Installed Node thlib changed since planning');
}
export function applyEngineRestore(plan){
  const fresh=planEngineRestore({root:plan.root,source:plan.source,commit:plan.commit});assertSamePlan(plan,fresh);
  const{root,source,commit}=fresh,target=inside(root,'packages/thlib');
  if(fresh.before.exists&&fresh.before.missing===0&&fresh.before.eolFiles.length===0){
    verifyEngineLock({root,checkNode:false});
    return{...fresh.summary,passed:true,filesTouched:0,backup:null,sourceWritten:false};
  }
  const staging=inside(root,'build/engine-restore-'+randomUUID());assertPlainPath(staging);
  fs.mkdirSync(staging,{recursive:true});
  const next=inside(staging,'thlib'),backup=inside(staging,'backup-thlib'),failed=inside(staging,'failed-thlib');
  fs.mkdirSync(next);
  const rebuilt=buildGitThlib(source,commit,{compilerRoot:root}),committed=rebuilt.files;
  assert.deepEqual(rebuilt.build,readEngineLock(root).thlibBuild,'Pinned compiler or TypeScript build changed during staging');
  for(const entry of fresh.thlibFiles){
    const bytes=committed.get(entry.path);assert.ok(bytes&&bytes.length===entry.bytes&&shaBytes(bytes)===entry.sha256,'Committed bytes changed during restore staging');
    const output=inside(next,entry.path);assertPlainPath(output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
  }
  assertExactTree(next,fresh.thlibFiles,'Staged thlib');
  assertSamePlan(fresh,planEngineRestore({root,source,commit}));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  let oldMoved=false,newMoved=false;
  try{
    for(const name of [target,next,backup,failed])assertPlainPath(name);
    if(fresh.before.exists){fs.renameSync(target,backup);oldMoved=true;}
    fs.renameSync(next,target);newMoved=true;
    assert.equal(shaFile(path.join(root,'engine.lock.json')),fresh.lockSha256,'Engine lock changed during restore');
    verifyEngineLock({root,checkNode:false});
  }catch(error){
    // Rename only checked absolute paths inside this game; never recursively delete.
    if(newMoved)fs.renameSync(target,failed);
    if(oldMoved)fs.renameSync(backup,target);
    throw error;
  }
  return{...fresh.summary,passed:true,filesTouched:fresh.thlibFiles.length,backup:relative(path.relative(root,staging)),sourceWritten:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};let apply=false;
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];
    if(arg==='--apply')apply=true;
    else if(arg==='--source'||arg==='--root'||arg==='--commit'){
      assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing value for '+arg);
      options[arg.slice(2)]=process.argv[++i];
    }else throw new Error('Unknown argument '+arg);
  }
  const plan=planEngineRestore(options);
  console.log(JSON.stringify(apply?applyEngineRestore(plan):{...plan.summary,dryRun:true},null,2));
}
