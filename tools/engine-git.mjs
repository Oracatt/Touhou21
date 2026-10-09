/** Read the public library from one immutable Git commit. No checkout, index,
 * filesystem export, line-ending conversion or replacement refs are involved. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const PREFIX='packages/thlib/';
const MAX_BUFFER=256*1024*1024;
const ordinal=(a,b)=>a<b?-1:a>b?1:0;
const utf8=new TextDecoder('utf-8',{fatal:true});
function git(source,args,input){
  // A caller's GIT_DIR / object-directory / config environment must not silently
  // redirect -C to another repository. Reading objects never requires a write.
  const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!name.toUpperCase().startsWith('GIT_')));
  env.GIT_NO_REPLACE_OBJECTS='1';env.GIT_OPTIONAL_LOCKS='0';
  return execFileSync('git',['--no-replace-objects','-C',source,...args],
    {windowsHide:true,maxBuffer:MAX_BUFFER,env,...(input===undefined?{}:{input})});
}
function safeName(name){
  assert.equal(typeof name,'string','Public thlib path must be a string');
  assert.ok(name.length>0&&!name.startsWith('/')&&!name.includes('\\'), 'Unsafe public thlib path: '+name);
  assert.ok(name.split('/').every(part=>part&&part!=='.'&&part!=='..'&&
    !/[<>:"|?*\x00-\x1f\x7f]|[.\s]$/.test(part)&&
    !['.git','userdata','node_modules'].includes(part.toLowerCase())&&
    !/^\.env($|\.)/i.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),
    'Unsafe public thlib path: '+name);
  return name;
}
const allowed=name=>name==='LICENSE'||name==='package.json'||name.startsWith('src/')||name.startsWith('assets/touhou-common/');
const selected=name=>allowed(name)||name==='src'||name==='assets/touhou-common';
function verifyObject(oid,type,bytes){
  const actual=createHash('sha1').update(`${type} ${bytes.length}\0`,'utf8').update(bytes).digest('hex');
  assert.equal(actual,oid,'Git object bytes do not match their immutable object ID: '+oid);
}
/** --batch output is length-delimited; file bytes may contain any newline/NUL. */
function readObjects(source,oids,expectedType){
  const unique=[...new Set(oids)],result=new Map();if(unique.length===0)return result;
  const output=git(source,['cat-file','--batch'],Buffer.from(unique.join('\n')+'\n','ascii'));
  let offset=0;
  for(const oid of unique){
    const end=output.indexOf(10,offset);assert.ok(end>=offset,'Truncated Git batch object header');
    const header=output.subarray(offset,end).toString('ascii');
    const match=/^([a-f0-9]{40}) ([a-z]+) ([0-9]+)$/.exec(header);
    assert.ok(match,'Git object is missing or has an invalid batch header: '+header);
    assert.equal(match[1],oid,'Git batch returned an unexpected object');
    assert.equal(match[2],expectedType,'Requested Git object must be a '+expectedType+': '+oid);
    const length=Number(match[3]);assert.ok(Number.isSafeInteger(length)&&length>=0,'Invalid Git object length');
    const start=end+1,stop=start+length;assert.ok(stop<output.length&&output[stop]===10,'Truncated Git batch object body');
    const bytes=output.subarray(start,stop);verifyObject(oid,expectedType,bytes);result.set(oid,bytes);offset=stop+1;
  }
  assert.equal(offset,output.length,'Unexpected bytes after Git batch objects');return result;
}
function entriesAt(source,commit){
  assert.equal(typeof source,'string','Source Git repository path must be a string');
  assert.ok(source.length>0&&!source.includes('\0'),'Source Git repository path is invalid');
  assert.match(commit??'',/^[a-f0-9]{40}$/,'Pass a full 40-hex immutable engine commit');
  assert.equal(git(source,['rev-parse','--show-object-format']).toString('ascii').trim(),'sha1','Only SHA-1 Git repositories are supported by the 40-hex commit contract');
  readObjects(source,[commit],'commit');
  const tree=git(source,['ls-tree','-r','-z','--full-tree',commit,'--','packages/thlib']);
  const entries=[],seen=new Set(),folded=new Set();let start=0;
  while(start<tree.length){
    const end=tree.indexOf(0,start);assert.ok(end>=start,'Truncated NUL-delimited Git tree');
    const record=tree.subarray(start,end),tab=record.indexOf(9);
    assert.ok(tab>0,'Invalid Git tree entry');
    const header=/^([0-9]{6}) ([a-z]+) ([a-f0-9]{40})$/.exec(record.subarray(0,tab).toString('ascii'));
    assert.ok(header,'Invalid Git tree entry header');
    const fullName=utf8.decode(record.subarray(tab+1));start=end+1;
    assert.ok(fullName.startsWith(PREFIX),'Git tree path is outside the public library');
    const name=fullName.slice(PREFIX.length);if(!selected(name))continue;
    safeName(name);
    assert.ok((header[1]==='100644'||header[1]==='100755')&&header[2]==='blob','Public thlib contains a nonregular Git entry: '+name);
    assert.ok(!seen.has(name)&&!folded.has(name.toLowerCase()),'Duplicate or case-colliding public thlib path: '+name);
    seen.add(name);folded.add(name.toLowerCase());entries.push({path:name,oid:header[3]});
  }
  for(const [group,present] of [
    ['LICENSE',seen.has('LICENSE')],['package.json',seen.has('package.json')],
    ['src/',entries.some(entry=>entry.path.startsWith('src/'))],
    ['assets/touhou-common/',entries.some(entry=>entry.path.startsWith('assets/touhou-common/'))],
  ])assert.ok(present,'Public thlib Git commit is missing required group: '+group);
  return entries.sort((a,b)=>ordinal(a.path,b.path));
}

/** Complete allowlist in stable relative-path order, with exact raw blob bytes. */
export function readGitThlib(source,commit){
  const entries=entriesAt(source,commit),objects=readObjects(source,entries.map(entry=>entry.oid),'blob');
  return new Map(entries.map(entry=>[entry.path,objects.get(entry.oid)]));
}
export function inventoryGitThlib(source,commit){
  return [...readGitThlib(source,commit)].map(([name,bytes])=>({path:name,bytes:bytes.length,
    sha256:createHash('sha256').update(bytes).digest('hex')}));
}
export function readGitThlibFile(source,commit,name){
  safeName(name);assert.ok(allowed(name),'Path is not in the public thlib allowlist: '+name);
  const entry=entriesAt(source,commit).find(entry=>entry.path===name);
  assert.ok(entry,'Public thlib file is absent from the requested Git commit: '+name);
  return readObjects(source,[entry.oid],'blob').get(entry.oid);
}
