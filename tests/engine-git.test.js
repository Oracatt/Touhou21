import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inventoryGitThlib,readGitThlib,readGitThlibFile} from '../tools/engine-git.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture({omit=null,format='sha1',indexText='export const before = 1;\n'}={}){
  const build=path.join(ROOT,'build');fs.mkdirSync(build,{recursive:true});
  const source=fs.mkdtempSync(path.join(build,'engine-git-test-'));
  const run=(args,input)=>execFileSync('git',['-C',source,...args],{windowsHide:true,encoding:'utf8',...(input===undefined?{}:{input})}).trim();
  const write=(name,bytes)=>{const file=path.join(source,...name.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return file;};
  const commit=message=>{run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m',message]);return run(['rev-parse','HEAD']);};
  run(['init','--quiet','--object-format='+format]);run(['config','core.autocrlf','false']);
  write('.gitattributes','* text=auto eol=lf\n');
  const files=new Map([
    ['LICENSE',Buffer.from('fixture license\n')],
    ['package.json',Buffer.from('{"type":"module"}\n')],
    ['src/index.js',Buffer.from(indexText)],
    ['src/含 空格.js',Buffer.from('export const label = "名字";\n')],
    ['assets/touhou-common/manifest.json',Buffer.from('{"fixture":true}\n')],
    ['assets/touhou-common/纹理图.bin',Buffer.from([0,255,13,10,10,0,128,1,2,3,10])],
  ]);
  for(const [name,bytes]of files)if(omit!==name&&!name.startsWith(omit+'/'))write('packages/thlib/'+name,bytes);
  write('packages/thlib/assets/private-demo/excluded.png',Buffer.from('private data\n'));
  write('packages/thlib/README.md','excluded package documentation\n');
  run(['add','.']);const first=commit('First library revision');
  return{source,run,write,commit,first,files};
}

test('inventory is the complete commit allowlist with exact binary/UTF-8 bytes and stable paths',()=>{
  const {source,first,files}=fixture(),map=readGitThlib(source,first),inventory=inventoryGitThlib(source,first);
  const expected=[...files].sort(([a],[b])=>a<b?-1:a>b?1:0);
  assert.deepEqual([...map.keys()],expected.map(([name])=>name));
  for(const[name,bytes]of expected){
    assert.ok(Buffer.isBuffer(map.get(name)),'public readers return raw Buffer data');
    assert.deepEqual(map.get(name),bytes);
    assert.deepEqual(readGitThlibFile(source,first,name),bytes);
  }
  assert.deepEqual(inventory,expected.map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:digest(bytes)})));
  assert.ok(!inventory.some(entry=>entry.path.includes('private-demo')||entry.path==='README.md'));
});

test('commit reads ignore later HEAD, changed index, missing checkout, and CRLF/mixed working bytes',()=>{
  const {source,run,write,commit,first,files}=fixture();
  write('packages/thlib/src/index.js','export const later = 2;\n');run(['add','.']);commit('Later HEAD');
  const staged=write('packages/thlib/src/index.js','export const staged = 3;\n');run(['add',staged]);
  write('packages/thlib/src/index.js','uncommitted\r\nworking\nbytes\r\n');
  write('packages/thlib/LICENSE','fixture license\r\n');
  fs.unlinkSync(path.join(source,'packages/thlib/assets/touhou-common/manifest.json'));
  write('packages/thlib/src/untracked.js','untracked must not be inventoried\n');
  const before={head:run(['rev-parse','HEAD']),index:fs.readFileSync(path.join(source,'.git/index')),
    working:fs.readFileSync(staged),status:run(['status','--porcelain'])};
  const map=readGitThlib(source,first);
  assert.deepEqual(map.get('src/index.js'),files.get('src/index.js'));
  assert.deepEqual(map.get('LICENSE'),Buffer.from('fixture license\n'));
  assert.deepEqual(map.get('assets/touhou-common/manifest.json'),files.get('assets/touhou-common/manifest.json'));
  assert.equal(map.has('src/untracked.js'),false);
  assert.equal(run(['rev-parse','HEAD']),before.head);
  assert.deepEqual(fs.readFileSync(path.join(source,'.git/index')),before.index,'reader must not refresh or rewrite the index');
  assert.deepEqual(fs.readFileSync(staged),before.working,'reader must not normalize source EOL');
  assert.equal(run(['status','--porcelain']),before.status);
});

test('only a complete 40-hex actual commit object is accepted',()=>{
  const {source,run,first}=fixture();
  for(const value of [undefined,'HEAD',first.slice(0,12),'f'.repeat(40),'0'.repeat(40)])assert.throws(()=>readGitThlib(source,value),/40-hex|missing|invalid batch header/);
  const tree=run(['rev-parse',first+'^{tree}']),blob=run(['rev-parse',first+':packages/thlib/LICENSE']);
  for(const value of [tree,blob])assert.throws(()=>readGitThlib(source,value),/must be a commit/);
  run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','tag','-a','fixture-tag','-m','Tag object',first]);
  assert.throws(()=>readGitThlib(source,run(['rev-parse','fixture-tag'])),/must be a commit/);
});

test('all four required public groups must exist at the selected commit',()=>{
  for(const group of ['LICENSE','package.json','src','assets/touhou-common']){
    const {source,first}=fixture({omit:group});
    assert.throws(()=>readGitThlib(source,first),/missing required group/,'missing '+group+' cannot produce a partial library');
  }
});

test('regular executable Git blobs are allowed; symlink and gitlink entries are rejected without following checkout bytes',()=>{
  const executable=fixture(),entry='packages/thlib/src/index.js';
  executable.run(['update-index','--chmod=+x',entry]);const regular=executable.commit('Executable regular blob');
  assert.deepEqual(readGitThlibFile(executable.source,regular,'src/index.js'),executable.files.get('src/index.js'));
  for(const mode of ['120000','160000']){
    const {source,run,write,commit,first}=fixture(),name='packages/thlib/src/nonregular.js';
    const file=write(name,'index.js\n'),oid=mode==='160000'?first:run(['hash-object','-w',file]);
    run(['update-index','--add','--cacheinfo',mode,oid,name]);const revision=commit('Nonregular '+mode);
    assert.equal(fs.lstatSync(file).isFile(),true,'fixture models Windows regular checkout bytes for an unsafe Git mode');
    assert.throws(()=>readGitThlib(source,revision),/nonregular Git entry/);
  }
});

test('unsafe or out-of-allowlist file names are refused instead of becoming revision expressions or output paths',()=>{
  const {source,first}=fixture();
  for(const name of ['../LICENSE','/src/index.js','C:/src/index.js','src\\index.js','src/../index.js','src//index.js','src/.git/config',
    'src/CON.js','src/trailing.','src/tab\t.js','src/nul\0.js','src/a:b','src/*.js','assets/private-demo/excluded.png','README.md']){
    assert.throws(()=>readGitThlibFile(source,first,name),/Unsafe public thlib path|public thlib allowlist/,'unsafe name '+JSON.stringify(name));
  }
  assert.throws(()=>readGitThlibFile(source,first,'src/absent.js'),/absent from the requested Git commit/);
  // Construct the unsafe tree as Git objects: Windows cannot create CON.js in
  // a real checkout, but a downloaded commit can still contain that path.
  const {source:bad,run,first:base}=fixture(),blob=run(['rev-parse',base+':packages/thlib/src/index.js']);
  const src=run(['mktree'],`100644 blob ${blob}\tCON.js\n`);
  const license=run(['rev-parse',base+':packages/thlib/LICENSE']),pkg=run(['rev-parse',base+':packages/thlib/package.json']);
  const assets=run(['rev-parse',base+':packages/thlib/assets']);
  const library=run(['mktree'],`100644 blob ${license}\tLICENSE\n100644 blob ${pkg}\tpackage.json\n040000 tree ${src}\tsrc\n040000 tree ${assets}\tassets\n`);
  const packages=run(['mktree'],`040000 tree ${library}\tthlib\n`),tree=run(['mktree'],`040000 tree ${packages}\tpackages\n`);
  const unsafe=run(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit-tree',tree,'-p',base,'-m','Unsafe tracked path']);
  assert.throws(()=>readGitThlib(bad,unsafe),/Unsafe public thlib path/);
});

test('replacement refs cannot redirect the pinned commit or replace its blob bytes',()=>{
  const {source,run,write,commit,first,files}=fixture();
  const original=run(['rev-parse',first+':packages/thlib/src/index.js']);
  write('packages/thlib/src/index.js','replacement content\n');run(['add','.']);const second=commit('Different commit');
  const replacement=run(['rev-parse',second+':packages/thlib/src/index.js']);
  run(['replace',original,replacement]);run(['replace',first,second]);
  assert.deepEqual(readGitThlibFile(source,first,'src/index.js'),files.get('src/index.js'));
  assert.deepEqual(readGitThlib(source,first).get('src/index.js'),files.get('src/index.js'));
});

test('inherited Git repository overrides cannot redirect the explicit source repository',()=>{
  const original=fixture(),other=fixture({indexText:'other repository content\n'}),names=['GIT_DIR','GIT_WORK_TREE','GIT_OBJECT_DIRECTORY'],previous=names.map(name=>process.env[name]);
  assert.notEqual(original.first,other.first,'redirected repository cannot contain the requested original commit by fixture coincidence');
  try{
    process.env.GIT_DIR=path.join(other.source,'.git');process.env.GIT_WORK_TREE=other.source;
    process.env.GIT_OBJECT_DIRECTORY=path.join(other.source,'.git/objects');
    assert.deepEqual(readGitThlibFile(original.source,original.first,'src/index.js'),original.files.get('src/index.js'));
  }finally{for(let i=0;i<names.length;i++)if(previous[i]===undefined)delete process.env[names[i]];else process.env[names[i]]=previous[i];}
});

test('SHA-256 repositories are explicitly outside the full-40-hex lock contract',()=>{
  const {source}=fixture({format:'sha256'});
  assert.throws(()=>readGitThlib(source,'0'.repeat(40)),/Only SHA-1 Git repositories/);
});
