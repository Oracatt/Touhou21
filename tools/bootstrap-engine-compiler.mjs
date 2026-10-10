/** Bootstrap an isolated compiler before the file:packages/thlib dependency
 * exists. Installation never runs package scripts; locked compiler hashes are
 * verified before any committed TypeScript is compiled. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compilerCacheRoot,locateEngineCompiler,engineCompilerFingerprint} from './engine-git.mjs';
import {PROJECT_ROOT,readEngineLock,inside} from './verify-engine-lock.mjs';

export function assertPlainPath(target){
  let probe=path.resolve(target);
  while(true){const stat=fs.lstatSync(probe,{throwIfNoEntry:false});
    assert.ok(!stat?.isSymbolicLink(),'Dependency path may not pass through a link or junction: '+probe);
    const parent=path.dirname(probe);if(parent===probe)return;probe=parent;}
}
export function bootstrapEngineCompiler({root=PROJECT_ROOT,apply=false}={}){
  root=path.resolve(root);const expected=readEngineLock(root).thlibBuild.compiler;
  let compilerFile;try{compilerFile=locateEngineCompiler(root,expected.version);}catch(error){
    if(!String(error.message).includes('compiler is missing'))throw error;
  }
  if(compilerFile){assert.deepEqual(engineCompilerFingerprint(compilerFile),expected,'Installed compiler differs from the locked compiler');
    return{passed:true,installed:false,compilerFile,compiler:expected};}
  const cache=compilerCacheRoot(root,expected.version);
  assert.ok(cache.startsWith(inside(root,'build')+path.sep));assertPlainPath(cache);
  if(!apply)return{passed:false,missing:true,compiler:expected,cache};
  const npmCli=path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
  assert.ok(fs.existsSync(npmCli),'Node installation must provide npm to bootstrap the pinned compiler');
  fs.mkdirSync(cache,{recursive:true});
  execFileSync(process.execPath,[npmCli,'install','--prefix',cache,'--ignore-scripts','--no-save','--package-lock=false','--no-audit','--no-fund','typescript@'+expected.version],
    {windowsHide:true,stdio:'inherit',timeout:120000});
  compilerFile=locateEngineCompiler(root,expected.version);
  assert.deepEqual(engineCompilerFingerprint(compilerFile),expected,'Downloaded compiler differs from the locked compiler');
  return{passed:true,installed:true,compilerFile,compiler:expected};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};for(let i=2;i<process.argv.length;i++){
    if(process.argv[i]==='--apply')options.apply=true;
    else if(process.argv[i]==='--root')options.root=process.argv[++i];
    else throw new Error('Unknown compiler-bootstrap argument '+process.argv[i]);}
  console.log(JSON.stringify(bootstrapEngineCompiler(options),null,2));
}
