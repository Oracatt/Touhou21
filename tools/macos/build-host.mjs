/** Build the macOS TS-STG host from the native sources pinned by engine.lock.json.
 * The engine checkout stays read-only: the locked commit is fetched into build/macos,
 * and only the platform text services come from this directory. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,inside,readEngineLock,shaFile} from '../verify-engine-lock.mjs';

const TOOL=path.dirname(fileURLToPath(import.meta.url));
const OUTPUT=inside(PROJECT_ROOT,'build/macos'),SOURCE=path.join(OUTPUT,'engine-src'),CMAKE=path.join(OUTPUT,'cmake'),STAMP=path.join(OUTPUT,'ts-stg.json');
export const MAC_HOST=path.join(OUTPUT,'ts-stg');
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
function inputDigest(lock){
  const hash=createHash('sha256').update(lock.commit+'\n'+lock.nativeBuild.sourceSha256+'\n');
  for(const name of fs.readdirSync(TOOL).filter(name=>/\.(?:cpp|hpp)$|^CMakeLists\.txt$/.test(name)).sort())hash.update(name+'\n').update(fs.readFileSync(path.join(TOOL,name)));
  return hash.digest('hex');
}
function readStamp(){try{return JSON.parse(fs.readFileSync(STAMP,'utf8'));}catch{return null;}}
export function verifyMacHost(){
  for(const [name,frames,...extra] of FIXTURES)
    execFileSync(MAC_HOST,[`native/tests/${name}.js`,'--root',SOURCE,'--headless','--frames',String(frames),'--backend','quickjs',...extra,
      '--snapshot',path.join(OUTPUT,'fixtures',name+'.json')],{stdio:['ignore','pipe','pipe']});
  return FIXTURES.map(([name])=>name);
}
export function buildMacHost({source=null,verify=false,force=false}={}){
  assert.equal(process.platform,'darwin','The macOS host build requires macOS');
  const lock=readEngineLock(PROJECT_ROOT);assert.ok(lock.nativeBuild,'engine.lock.json records no native build sources');
  const inputs=inputDigest(lock),stamp=readStamp();
  const current=!force&&fs.existsSync(MAC_HOST)&&stamp?.inputs===inputs&&stamp?.sha256===shaFile(MAC_HOST);
  if(!current||verify)checkoutLockedEngine({source});
  if(!current){
    execFileSync('cmake',['-S',TOOL,'-B',CMAKE,'-DTSSTG_SOURCE_DIR='+SOURCE,'-DCMAKE_BUILD_TYPE=Release'],progress);
    execFileSync('cmake',['--build',CMAKE,'--target','ts-stg','--parallel',String(os.availableParallelism())],progress);
    fs.copyFileSync(path.join(CMAKE,'engine/ts-stg'),MAC_HOST);fs.chmodSync(MAC_HOST,0o755);
    fs.writeFileSync(STAMP,JSON.stringify({commit:lock.commit,inputs,sha256:shaFile(MAC_HOST)},null,2)+'\n');
  }
  return{host:path.relative(PROJECT_ROOT,MAC_HOST),commit:lock.commit,backend:'quickjs',built:!current,sha256:shaFile(MAC_HOST),
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
