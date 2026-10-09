/** Build the macOS TS-STG host from the native sources pinned by engine.lock.json.
 * The engine checkout stays read-only: the locked commit is fetched into build/macos,
 * and only the platform text services and the rusty_v8 link stubs come from this directory. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import zlib from 'node:zlib';
import {PROJECT_ROOT,inside,readEngineLock,shaFile} from '../verify-engine-lock.mjs';

const TOOL=path.dirname(fileURLToPath(import.meta.url));
const OUTPUT=inside(PROJECT_ROOT,'build/macos'),SOURCE=path.join(OUTPUT,'engine-src'),CMAKE=path.join(OUTPUT,'cmake'),STAMP=path.join(OUTPUT,'ts-stg.json');
const V8_SDK=path.join(OUTPUT,'v8-sdk');
export const MAC_HOST=path.join(OUTPUT,'ts-stg');
export const BACKENDS=['v8','quickjs'];
// The engine's Windows SDK pins V8 12.3.219.9 from rusty_v8 0.89.0; macOS links the same release.
const RUSTY_V8='https://github.com/denoland/rusty_v8/releases/download/v0.89.0/';
const V8_HEADERS={revision:'db2b8439ec4d3ae972330cc2e9830ccd517d7235',sha256:'c0117ad65843deffb7363ef7feb6cd6198d4c0d965c85f135f41e7e0ffe504a8'};
const V8_LICENSE={url:'https://raw.githubusercontent.com/denoland/rusty_v8/v0.89.0/LICENSE',sha256:'1c6356fb751d45f0c53093ebf8a7f5e580e802f51999178e19d60f3ec39e147d'};
const V8_LIBRARIES={
  x86_64:{asset:'librusty_v8_release_x86_64-apple-darwin.a.gz',archive:'034e3b6952f6292356a1f3cad9e1f7f798863dc74cf858d2c6ee46916f702672',library:'30d32932e73d98a185abf856725126763a905a2314f8b02bfc0bc2f5714b6ccc'},
  arm64:{asset:'librusty_v8_release_aarch64-apple-darwin.a.gz',archive:'5cdd8914bf11b3d8724eab95c7a6eb8d6d791f9e26855207ab391d132f6c9aa3',library:'fba839d23a2ade52cad9fbb3669218deab90a5a6768cd7a12a5faf2eec7094b6'}};
// The engine media fixtures load one original WAV from the thlib audio assets.
const SPARSE=['/CMakeLists.txt','/LICENSE','/THIRD_PARTY.md','/native/','/packages/thlib/assets/audio/'];
const FIXTURES=[['system-text',2],['bitmap-text',2],['smoke',4,'--input','16'],['media',4],['audio-pause',15],['audio-volume',6],['pixels',2],
  ['texture-region',2],['quad',2],['shader',2],['alpha-test',2],['mesh3d',2]];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(args,cwd=SOURCE)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const progress={stdio:['ignore',2,2]};

function engineRemotes(lock,source){
  const remotes=[];
  for(const candidate of [source,lock.source,path.resolve(PROJECT_ROOT,'../TS-STG')].filter(Boolean)){
    if(fs.existsSync(path.join(candidate,'.git'))){
      remotes.push(path.resolve(candidate));
      try{remotes.push(git(['remote','get-url','origin'],candidate));}catch{}
    }else if(candidate===source)remotes.push(source);
  }
  return [...new Set(remotes)];
}
function revision(){try{return git(['rev-parse','HEAD']);}catch{return null;}}
export function checkoutLockedEngine({source=null}={}){
  const lock=readEngineLock(PROJECT_ROOT);
  assert.ok(lock.nativeBuild,'engine.lock.json records no native build sources');
  if(!fs.existsSync(path.join(SOURCE,'.git'))){fs.mkdirSync(SOURCE,{recursive:true});git(['init','-q']);}
  git(['sparse-checkout','set','--no-cone',...SPARSE]);
  if(revision()!==lock.commit){
    const failures=[];let fetched=false;
    for(const remote of engineRemotes(lock,source)){
      try{git(['fetch','-q','--depth','1','--filter=blob:none',remote,lock.commit]);fetched=true;break;}
      catch(error){failures.push(remote+': '+String(error.stderr||error.message).trim().split('\n').pop());}
    }
    assert.ok(fetched,['Cannot fetch locked engine commit '+lock.commit+'; pass --source <TS-STG checkout or Git URL>.',...failures].join('\n  '));
    git(['-c','advice.detachedHead=false','checkout','-q','--force',lock.commit]);
  }
  assert.equal(revision(),lock.commit,'Engine sources are not at the locked commit');
  for(const file of lock.nativeBuild.sourceFiles){
    const bytes=fs.readFileSync(path.join(SOURCE,file.path));
    assert.ok(bytes.length===file.bytes&&sha(bytes)===file.sha256,'Native source differs from engine.lock.json: '+file.path);
  }
  return lock;
}
function pinnedDownload(name,url,sha256){
  const file=path.join(V8_SDK,'downloads',name);
  if(fs.existsSync(file)&&shaFile(file)===sha256)return file;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  execFileSync('curl',['-fsSL','--retry','3','--retry-all-errors','--connect-timeout','30','-o',file+'.part',url],progress);
  assert.equal(shaFile(file+'.part'),sha256,'Pinned V8 download hash mismatch: '+name);
  fs.renameSync(file+'.part',file);
  return file;
}
export function prepareV8Sdk(arch=os.machine()){
  const pin=V8_LIBRARIES[arch];assert.ok(pin,'No pinned V8 library for macOS '+arch);
  const library=path.join(V8_SDK,arch,'librusty_v8.a'),include=path.join(V8_SDK,'include'),marker=path.join(V8_SDK,'include.revision');
  if(!fs.existsSync(library)||shaFile(library)!==pin.library){
    const bytes=zlib.gunzipSync(fs.readFileSync(pinnedDownload(pin.asset,RUSTY_V8+pin.asset,pin.archive)));
    assert.equal(sha(bytes),pin.library,'Uncompressed V8 library hash mismatch: '+pin.asset);
    fs.mkdirSync(path.dirname(library),{recursive:true});fs.writeFileSync(library,bytes);
  }
  if(!fs.existsSync(path.join(include,'v8.h'))||!fs.existsSync(marker)||fs.readFileSync(marker,'utf8')!==V8_HEADERS.revision){
    const tarball=pinnedDownload('v8-headers.tar.gz','https://codeload.github.com/denoland/v8/tar.gz/'+V8_HEADERS.revision,V8_HEADERS.sha256);
    const root=path.join(V8_SDK,'v8-'+V8_HEADERS.revision);
    for(const stale of [include,root,marker])fs.rmSync(stale,{recursive:true,force:true});
    execFileSync('tar',['-xzf',tarball,'-C',V8_SDK,path.basename(root)+'/include',path.basename(root)+'/LICENSE'],progress);
    fs.renameSync(path.join(root,'include'),include);fs.renameSync(path.join(root,'LICENSE'),path.join(V8_SDK,'V8-LICENSE'));
    fs.rmSync(root,{recursive:true,force:true});fs.writeFileSync(marker,V8_HEADERS.revision);
  }
  fs.copyFileSync(pinnedDownload('rusty_v8-LICENSE',V8_LICENSE.url,V8_LICENSE.sha256),path.join(V8_SDK,'rusty_v8-LICENSE'));
  return{arch,include,library};
}
function inputDigest(lock,arch){
  const hash=createHash('sha256').update(lock.commit+'\n'+lock.nativeBuild.sourceSha256+'\n'+arch+'\n'+V8_LIBRARIES[arch]?.library+'\n'+V8_HEADERS.revision+'\n');
  for(const name of fs.readdirSync(TOOL).filter(name=>/\.(?:cpp|hpp)$|^CMakeLists\.txt$/.test(name)).sort())hash.update(name+'\n').update(fs.readFileSync(path.join(TOOL,name)));
  return hash.digest('hex');
}
function readStamp(){try{return JSON.parse(fs.readFileSync(STAMP,'utf8'));}catch{return null;}}
export function verifyMacHost(){
  const run=(script,frames,backend,extra=[])=>execFileSync(MAC_HOST,[script,'--root',SOURCE,'--headless','--frames',String(frames),'--backend',backend,...extra],{stdio:['ignore','pipe','pipe']});
  const snapshot=(name,backend)=>path.join(OUTPUT,'fixtures',`${name}.${backend}.json`);
  for(const backend of BACKENDS)for(const [name,frames,...extra] of FIXTURES)run(`native/tests/${name}.js`,frames,backend,[...extra,'--snapshot',snapshot(name,backend)]);
  for(const [name] of FIXTURES)assert.equal(fs.readFileSync(snapshot(name,'v8'),'utf8'),fs.readFileSync(snapshot(name,'quickjs'),'utf8'),'Backends disagree on fixture '+name);
  run('native/tests/backend-v8.js',1,'v8');
  return FIXTURES.map(([name])=>name).concat('backend-v8');
}
export function buildMacHost({source=null,verify=false,force=false}={}){
  assert.equal(process.platform,'darwin','The macOS host build requires macOS');
  const lock=readEngineLock(PROJECT_ROOT);assert.ok(lock.nativeBuild,'engine.lock.json records no native build sources');
  const arch=os.machine(),inputs=inputDigest(lock,arch),stamp=readStamp();
  const current=!force&&fs.existsSync(MAC_HOST)&&stamp?.inputs===inputs&&stamp?.sha256===shaFile(MAC_HOST);
  if(!current||verify)checkoutLockedEngine({source});
  if(!current){
    const v8=prepareV8Sdk(arch);
    execFileSync('cmake',['-S',TOOL,'-B',CMAKE,'-DTSSTG_SOURCE_DIR='+SOURCE,'-DCMAKE_BUILD_TYPE=Release','-DCMAKE_OSX_ARCHITECTURES='+arch,
      '-DTOUHOU21_V8_INCLUDE_DIR='+v8.include,'-DTOUHOU21_V8_LIBRARY='+v8.library],progress);
    execFileSync('cmake',['--build',CMAKE,'--target','ts-stg','--parallel',String(os.availableParallelism())],progress);
    fs.copyFileSync(path.join(CMAKE,'engine/ts-stg'),MAC_HOST+'.part');fs.chmodSync(MAC_HOST+'.part',0o755);fs.renameSync(MAC_HOST+'.part',MAC_HOST);
    fs.writeFileSync(STAMP,JSON.stringify({commit:lock.commit,arch,backends:BACKENDS,inputs,sha256:shaFile(MAC_HOST)},null,2)+'\n');
  }
  return{host:path.relative(PROJECT_ROOT,MAC_HOST),commit:lock.commit,arch,backends:BACKENDS,built:!current,sha256:shaFile(MAC_HOST),
    fixtures:verify?verifyMacHost():null};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];
    if(arg==='--verify')options.verify=true;
    else if(arg==='--force')options.force=true;
    else if(arg==='--source'){assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing value for --source');options.source=process.argv[++i];}
    else throw new Error('Unknown argument '+arg);
  }
  console.log(JSON.stringify(buildMacHost(options),null,2));
}
