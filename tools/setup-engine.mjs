/** Install a v2 pinned dependency without a pre-existing npm dependency graph.
 * Existing modified files are never replaced. Git source, native runtime and
 * generated compiler outputs are staged and verified before installation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {bootstrapEngineCompiler,assertPlainPath} from './bootstrap-engine-compiler.mjs';
import {buildGitThlib,inventoryBuffers} from './engine-git.mjs';
import {PROJECT_ROOT,readEngineLock,inside,inventoryTree,shaFile,verifyEngineLock} from './verify-engine-lock.mjs';

function missingFiles(directory,expected){
  assertPlainPath(directory);const byPath=new Map(expected.map(file=>[file.path,file]));
  if(!fs.existsSync(directory))return expected;
  for(const actual of inventoryTree(directory)){
    const file=byPath.get(actual.path);assert.ok(file,'Existing dependency has an extra file: '+actual.path);
    assert.equal(actual.bytes,file.bytes,'Existing dependency size differs: '+actual.path);
    assert.equal(actual.sha256,file.sha256,'Existing dependency hash differs: '+actual.path);byPath.delete(actual.path);
  }
  return [...byPath.values()];
}
function nodeState(root,expected){
  const module=path.join(root,'node_modules/@ts-stg/thlib');assertPlainPath(path.dirname(module));
  const stat=fs.lstatSync(module,{throwIfNoEntry:false});if(!stat)return false;
  if(stat.isSymbolicLink()){
    const target=path.resolve(path.dirname(module),fs.readlinkSync(module));
    assert.equal(target.toLowerCase(),inside(root,'packages/thlib').toLowerCase(),'Node dependency link points outside this game library');
  }else assert.equal(missingFiles(module,expected).length,0,'Existing Node dependency copy is incomplete');
  return true;
}
export function setupEngine({root=PROJECT_ROOT,source=null,verifyOnly=false,plan=false}={}){
  root=path.resolve(root);assertPlainPath(root);const lock=readEngineLock(root),lockHash=shaFile(path.join(root,'engine.lock.json'));
  const library=inside(root,'packages/thlib'),runtime=inside(root,'runtime');
  const missingLibrary=missingFiles(library,lock.thlibFiles),missingRuntime=missingFiles(runtime,lock.runtimeFiles),nodeExists=nodeState(root,lock.thlibFiles);
  const incomplete=missingLibrary.length>0||missingRuntime.length>0||!nodeExists;
  if(verifyOnly){assert.ok(!incomplete,'Local dependencies are incomplete');verifyEngineLock({root});
    return{passed:true,message:'Verified pinned local dependencies. No files changed.'};}
  if(!incomplete)return{passed:true,message:'Pinned local dependencies are already installed. No files changed.'};
  const compiler=bootstrapEngineCompiler({root});
  if(plan)return{dryRun:true,missingLibrary:missingLibrary.length,missingRuntime:missingRuntime.length,compilerBootstrap:!compiler.passed};
  source=fs.realpathSync(source??lock.source);assertPlainPath(source);
  const a=root.toLowerCase(),b=source.toLowerCase();
  assert.ok(a!==b&&!a.startsWith(b+path.sep)&&!b.startsWith(a+path.sep),'The game and engine source must be separate directories');
  // Verify all requested native bytes before installing the compiler or staging.
  for(const entry of missingRuntime){const origin=inside(source,entry.source);assertPlainPath(origin);
    assert.equal(fs.statSync(origin).size,entry.bytes,'Source runtime size differs: '+entry.path);
    assert.equal(shaFile(origin),entry.sha256,'Source runtime hash differs: '+entry.path);}
  if(!compiler.passed)bootstrapEngineCompiler({root,apply:true});
  const rebuilt=buildGitThlib(source,lock.commit,{compilerRoot:root});
  assert.deepEqual(rebuilt.build,lock.thlibBuild,'Pinned TypeScript build differs from the lock');
  assert.deepEqual(inventoryBuffers(rebuilt.files),lock.thlibFiles,'Rebuilt library inventory differs from lock');
  const staging=inside(root,'build/dependency-staging-'+randomUUID());assertPlainPath(staging);fs.mkdirSync(staging,{recursive:true});
  const pending=[];
  for(const group of [{name:'thlib',entries:missingLibrary,target:library},{name:'runtime',entries:missingRuntime,target:runtime}]){
    for(const entry of group.entries){const file=inside(staging,group.name+'/'+entry.path);assertPlainPath(file);fs.mkdirSync(path.dirname(file),{recursive:true});
      if(group.name==='thlib')fs.writeFileSync(file,rebuilt.files.get(entry.path),{flag:'wx'});
      else{const origin=inside(source,entry.source);assertPlainPath(origin);fs.copyFileSync(origin,file,fs.constants.COPYFILE_EXCL);}
      assert.equal(shaFile(file),entry.sha256,'Staged file differs from the pinned bytes');pending.push({file,target:inside(group.target,entry.path)});}
  }
  assert.equal(shaFile(path.join(root,'engine.lock.json')),lockHash,'Engine lock changed while staging');
  assert.deepEqual(missingFiles(library,lock.thlibFiles),missingLibrary,'Library changed during installation');
  assert.deepEqual(missingFiles(runtime,lock.runtimeFiles),missingRuntime,'Runtime changed during installation');
  assert.equal(nodeState(root,lock.thlibFiles),nodeExists,'Node dependency changed during installation');
  for(const entry of pending){assertPlainPath(entry.target);assert.ok(!fs.existsSync(entry.target),'A dependency target appeared during installation');
    fs.mkdirSync(path.dirname(entry.target),{recursive:true});fs.renameSync(entry.file,entry.target);}
  if(!nodeExists){const module=path.join(root,'node_modules/@ts-stg/thlib');assertPlainPath(path.dirname(module));
    fs.mkdirSync(path.dirname(module),{recursive:true});fs.symlinkSync(library,module,process.platform==='win32'?'junction':'dir');}
  verifyEngineLock({root});
  return{passed:true,filesRestored:pending.length,sourceWritten:false,message:'Restored pinned TypeScript, generated dist, runtime and local dependency resolution.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--verify-only')options.verifyOnly=true;
    else if(process.argv[i]==='--plan')options.plan=true;
    else if(['--root','--source'].includes(process.argv[i]))options[process.argv[i].slice(2)]=process.argv[++i];
    else throw new Error('Unknown setup argument '+process.argv[i]);}
  console.log(JSON.stringify(setupEngine(options),null,2));
}
