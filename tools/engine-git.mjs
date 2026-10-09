/** Read the public library from one immutable Git commit. No checkout, index,
 * filesystem export, line-ending conversion or replacement refs are involved. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

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
export const PUBLIC_ASSET_DIRECTORIES=Object.freeze(['audio','reference-common','spell-common','touhou-common']);
const allowed=name=>['LICENSE','package.json','tsconfig.json','tsconfig.base.json'].includes(name)||name.startsWith('src/')||
  PUBLIC_ASSET_DIRECTORIES.some(pack=>name.startsWith('assets/'+pack+'/'))||/^assets\/[^/]+\.(?:json|md)$/.test(name);
const selected=name=>allowed(name)||name==='src'||PUBLIC_ASSET_DIRECTORIES.some(pack=>name==='assets/'+pack);
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
    const name=fullName.slice(PREFIX.length);assert.ok(!name.startsWith('dist/'),'Compiled thlib dist must not be committed');if(!selected(name))continue;
    if(name.startsWith('src/'))assert.ok(name.endsWith('.ts'),'Public thlib source must be TypeScript: '+name);
    safeName(name);
    assert.ok((header[1]==='100644'||header[1]==='100755')&&header[2]==='blob','Public thlib contains a nonregular Git entry: '+name);
    assert.ok(!seen.has(name)&&!folded.has(name.toLowerCase()),'Duplicate or case-colliding public thlib path: '+name);
    seen.add(name);folded.add(name.toLowerCase());entries.push({path:name,oid:header[3]});
  }
  for(const [group,present] of [
    ['LICENSE',seen.has('LICENSE')],['package.json',seen.has('package.json')],
    ['tsconfig.json',seen.has('tsconfig.json')],['tsconfig.base.json',seen.has('tsconfig.base.json')],
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

const require=createRequire(import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function inventoryBuffers(files){return [...files].map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:sha(bytes)})).sort((a,b)=>ordinal(a.path,b.path));}
function digestInventory(files){const hash=createHash('sha256');for(const file of files)hash.update(`${file.path}\0${file.bytes}\0${file.sha256}\n`);return hash.digest('hex');}
export function compilerCacheRoot(root,version){
  assert.match(version??'',/^\d+\.\d+\.\d+$/,'Compiler version must be exact');
  return path.join(root,'build','compiler-cache','typescript-'+version);
}
export function locateEngineCompiler(root,version){
  const local=path.join(root,'node_modules','typescript','lib','typescript.js');
  const cached=path.join(compilerCacheRoot(root,version),'node_modules','typescript','lib','typescript.js');
  for(const file of [local,cached])if(fs.existsSync(file))return file;
  throw new Error('Pinned TypeScript compiler is missing; run tools/setup-local.ps1 to bootstrap it.');
}
export function engineCompilerFingerprint(compilerFile){
  const compilerDirectory=path.dirname(compilerFile),compilerPackage=path.join(compilerDirectory,'../package.json');
  const packageBytes=fs.readFileSync(compilerPackage),packageData=JSON.parse(packageBytes.toString('utf8'));
  assert.equal(packageData.name,'typescript');assert.match(packageData.version,/^\d+\.\d+\.\d+$/);
  const standardLibrary=fs.readdirSync(compilerDirectory).filter(name=>/^lib\..*\.d\.ts$/.test(name)).sort(ordinal).map(name=>{
    const bytes=fs.readFileSync(path.join(compilerDirectory,name));return{path:name,bytes:bytes.length,sha256:sha(bytes)};
  });
  return{name:'typescript',version:packageData.version,implementationSha256:sha(fs.readFileSync(compilerFile)),
    packageSha256:sha(packageBytes),standardLibrarySha256:digestInventory(standardLibrary)};
}
/** Only the consumer's exactly pinned compiler executes. Source files and
 * configuration are immutable Git blobs; output remains in memory until the
 * complete inventory has been verified. No producer build is needed. */
export function compileThlibBlobs(committed,{compilerRoot=path.resolve(import.meta.dirname,'..')}={}){
  const packageData=JSON.parse(committed.get('package.json')?.toString('utf8')??'null');
  const expected=packageData?.devDependencies?.typescript;
  assert.match(expected??'',/^\d+\.\d+\.\d+$/,'thlib must pin one exact TypeScript compiler version');
  // Node resolves package junctions before loading the compiler. Use the same
  // canonical directory for its standard-library allowlist and default paths.
  const compilerFile=fs.realpathSync(locateEngineCompiler(compilerRoot,expected));
  const compiler=engineCompilerFingerprint(compilerFile);
  assert.equal(compiler.version,expected,'Install the TypeScript version pinned by the engine commit before synchronizing');
  const ts=require(compilerFile),compilerDirectory=path.dirname(compilerFile);
  assert.equal(ts.version,compiler.version,'Loaded compiler implementation does not match its package');
  const root=path.resolve(path.parse(process.cwd()).root,'__tsstg_committed_build__','thlib');
  const normalize=name=>path.resolve(name).replaceAll('\\','/');
  const prefix=normalize(root)+'/',libraryPrefix=normalize(compilerDirectory)+'/';
  const virtual=new Map([...committed].map(([name,bytes])=>[prefix+name,bytes.toString('utf8')]));
  const directories=new Set([normalize(root)]);
  for(const name of virtual.keys()){let directory=path.posix.dirname(name);while(directory.startsWith(normalize(root))){directories.add(directory);const parent=path.posix.dirname(directory);if(parent===directory)break;directory=parent;}}
  const readFile=name=>{const key=normalize(name);if(virtual.has(key))return virtual.get(key);if(key.startsWith(libraryPrefix))return ts.sys.readFile(name);return undefined;};
  const fileExists=name=>{const key=normalize(name);return virtual.has(key)||key.startsWith(libraryPrefix)&&ts.sys.fileExists(name);};
  const directoryExists=name=>{const key=normalize(name);return directories.has(key)||key.startsWith(libraryPrefix)&&ts.sys.directoryExists(name);};
  const configPath=path.join(root,'tsconfig.json'),json=ts.readConfigFile(configPath,readFile);
  assert.ok(!json.error,'Committed tsconfig.json could not be read');
  assert.deepEqual(json.config.include,['src/**/*.ts'],'Public build includes must select the complete src TypeScript tree');
  assert.ok(!json.config.files,'Explicit files would hide parts of the source tree');
  assert.ok(!json.config.exclude||JSON.stringify(json.config.exclude)===JSON.stringify(['dist']),'Public build excludes must not omit TypeScript sources');
  const parsed=ts.parseJsonConfigFileContent(json.config,{useCaseSensitiveFileNames:true,readFile,fileExists,
    readDirectory:(directory,extensions)=>[...virtual.keys()].filter(name=>name.startsWith(normalize(directory)+'/src/')&&extensions.some(extension=>name.endsWith(extension)))},root,undefined,configPath);
  const options=parsed.options;
  assert.equal(normalize(options.rootDir),prefix+'src','Public TypeScript rootDir must be src');
  assert.equal(normalize(options.outDir),prefix+'dist','Public TypeScript outDir must be dist');
  assert.equal(options.strict,true,'Public TypeScript compilation must remain strict');
  assert.equal(options.noEmitOnError,true,'Public TypeScript errors must prevent emit');
  assert.notEqual(options.noCheck,true);assert.notEqual(options.allowJs,true);
  assert.equal(options.declaration,true);assert.equal(options.sourceMap,true);assert.equal(options.declarationMap,true);
  assert.deepEqual(options.types,[],'Public thlib cannot inherit consumer ambient packages');
  const outputs=new Map(),host=ts.createCompilerHost(options);
  Object.assign(host,{readFile,fileExists,directoryExists,getCurrentDirectory:()=>root,useCaseSensitiveFileNames:()=>true,getCanonicalFileName:name=>name,
    getDirectories:directory=>[...directories].filter(name=>path.posix.dirname(name)===normalize(directory)).map(name=>path.posix.basename(name)),
    getSourceFile:(name,languageVersion)=>{const text=readFile(name);return text===undefined?undefined:ts.createSourceFile(name,text,languageVersion,true);},
    writeFile:(name,text)=>{const key=normalize(name);assert.ok(key.startsWith(prefix+'dist/'),'Compiler attempted an output outside dist');const relative=key.slice(prefix.length);safeName(relative);outputs.set(relative,Buffer.from(text,'utf8'));},
    realpath:name=>name});
  const program=ts.createProgram(parsed.fileNames,options,host),diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
  if(diagnostics.length)throw new Error(ts.formatDiagnostics(diagnostics,{getCanonicalFileName:name=>name,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));
  const emitted=program.emit();assert.equal(emitted.emitSkipped,false,'TypeScript skipped the locked library build');
  assert.equal(emitted.diagnostics.length,0,'TypeScript emitted diagnostics');
  assert.ok(outputs.has('dist/index.js')&&outputs.has('dist/index.d.ts'),'Compiler did not produce the public entrypoints');
  const sourceFiles=inventoryBuffers(committed),outputFiles=inventoryBuffers(outputs);
  return{files:new Map([...committed,...outputs]),build:{compiler,sourceFiles,sourceSha256:digestInventory(sourceFiles),
    outputFiles,outputSha256:digestInventory(outputFiles)}};
}
export function buildGitThlib(source,commit,options){return compileThlibBlobs(readGitThlib(source,commit),options);}
