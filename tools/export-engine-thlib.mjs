/** Export exactly the locked Git blobs for the PowerShell dependency installer.
 * No output directory is created until the complete commit inventory matches. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readGitThlib} from './engine-git.mjs';
import {PROJECT_ROOT,readEngineLock,inside,inventoryDigest,inventoryTree} from './verify-engine-lock.mjs';

const ordinal=(a,b)=>a<b?-1:a>b?1:0;
function noLinks(target,root){
  let probe=target;
  while(true){
    let stat;try{stat=fs.lstatSync(probe);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(stat)assert.ok(!stat.isSymbolicLink(),'Installer staging may not pass through a link or junction');
    if(probe===root)break;
    const parent=path.dirname(probe);assert.notEqual(parent,probe,'Installer staging escapes its game root');probe=parent;
  }
}

export function exportEngineThlib({root=PROJECT_ROOT,source=null,output=null}={}){
  root=path.resolve(root);const lock=readEngineLock(root);
  assert.equal(lock.thlibContent,'git-blob','Git export requires a canonical thlib lock');
  const files=readGitThlib(source??lock.source,lock.commit);
  const entries=[...files].map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')})).sort((a,b)=>ordinal(a.path,b.path));
  assert.deepEqual(entries,[...lock.thlibFiles].sort((a,b)=>ordinal(a.path,b.path)),'Pinned Git thlib differs from the locked inventory');
  assert.equal(inventoryDigest(entries),lock.thlibSha256);
  if(output){
    output=path.resolve(output);const build=inside(root,'build');
    assert.ok(output.startsWith(build+path.sep),'Installer export must remain inside this game build directory');
    noLinks(output,root);assert.ok(!fs.existsSync(output),'Installer export requires a new staging directory');
    // Validate every destination before creating any staging output.
    for(const [name] of files)inside(output,name);
    fs.mkdirSync(output,{recursive:true});
    for(const [name,bytes] of files){const target=inside(output,name);noLinks(target,root);
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
    assert.deepEqual(inventoryTree(output),entries,'Exported thlib bytes differ from the pinned Git blobs');
  }
  return{passed:true,commit:lock.commit,files:entries.length,thlibSha256:lock.thlibSha256,written:!!output};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};
  for(let index=2;index<process.argv.length;index++){
    const argument=process.argv[index];assert.ok(['--source','--root','--output'].includes(argument),'Unknown Git-export argument: '+argument);
    const value=process.argv[++index];assert.ok(value&&!value.startsWith('--'),'Missing Git-export argument value');options[argument.slice(2)]=value;
  }
  console.log(JSON.stringify(exportEngineThlib(options)));
}
