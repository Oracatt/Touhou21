/** Bounded static checks for this game's public-library and resource boundary.
 * This is not a JavaScript security parser or a copyright authorization check. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {GAME,PLAYERS,CHARACTERS,STAGES,ALL_SPELLS,MIDBOSS_SPELLS} from '../src/content.js';
import {MUSIC_TRACKS} from '../src/music-data.js';
import {PROJECT_ROOT,inside,readEngineLock,shaFile,verifyEngineLock} from './verify-engine-lock.mjs';

const PUBLIC_ENTRIES=new Set(['@ts-stg/thlib','@ts-stg/thlib/touhou']);
const COMMON_OWNERS=['TouhouApplication','TouhouGame','TouhouPlayer','TouhouBulletField','TouhouLaserField','TouhouSpell','TouhouItems','TouhouEnemy','TouhouHealth','TouhouBossPresentation','TouhouBossHud','TouhouGameOver'];
const PRIVATE_PREFIXES=['packages/','runtime/','node_modules/','userdata/','reports/','build/'];
const imports=source=>[...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"]([^'"\r\n]+)['"]/g)].map(match=>match[1]);

export function auditSourceText(source,file='src/fixture.js',root=PROJECT_ROOT){
  assert.equal(typeof source,'string');
  const entries=imports(source);
  for(const entry of entries){
    if(PUBLIC_ENTRIES.has(entry))continue;
    assert.ok(entry.startsWith('./')||entry.startsWith('../'),`${file}: import must use a public thlib entry or this game's relative source`);
    const target=path.resolve(root,path.dirname(file),entry);
    const allowed=target===path.join(root,'main.js')||target.startsWith(path.join(root,'src')+path.sep);
    assert.ok(allowed,`${file}: import escapes game source`);
    assert.ok(fs.existsSync(target)&&fs.statSync(target).isFile(),`${file}: relative source import is missing`);
  }
  assert.ok(!/\b(?:require\s*\(|import\s*\(|eval\s*\(|new\s+Function\s*\()/.test(source),`${file}: runtime dynamic code or module loading is not part of this game's boundary`);
  assert.ok(!/\b(?:Touhou20Reconstruction|TouhouRushBoss|TouhouRushBoss-main)\b|[A-Za-z]:[\\/]|(?:\.\.\/)+(?:TS-STG|packages|runtime)\b/.test(source),`${file}: game source refers to an external implementation path`);
  assert.ok(!/\b(?:host|this\.host)\.(?:loadTexture|loadMusic|loadSound|readText)\s*\(\s*['"](?:packages|runtime|\.\.)[\\/]/.test(source),`${file}: resource access bypasses public dependency ownership`);
  for(const owner of COMMON_OWNERS)assert.ok(!new RegExp(`\\bclass\\s+${owner}\\b`).test(source),`${file}: copied public implementation owner ${owner}`);
  return entries;
}
function sourceFiles(root){
  assert.ok(fs.lstatSync(path.join(root,'main.js')).isFile(),'Game entry must be a regular, owned file');
  const result=['main.js'];
  const visit=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const full=path.join(directory,entry.name);assert.ok(!entry.isSymbolicLink(),'Game source may not traverse links');
    if(entry.isDirectory())visit(full);else if(entry.isFile()&&entry.name.endsWith('.js'))result.push(path.relative(root,full).split(path.sep).join('/'));
  }};visit(path.join(root,'src'));return result.sort();
}
function mediaFiles(root,relative){
  const result=[];for(const name of fs.readdirSync(inside(root,relative),{withFileTypes:true})){
    assert.ok(name.isFile(),`${relative}: nested or linked game media is outside the current manifest`);
    if(/\.(?:png|wav)$/i.test(name.name))result.push(`${relative}/${name.name}`);
  }return result;
}
export function auditBoundaries({root=PROJECT_ROOT,verifyDependencies=true}={}){
  const lock=readEngineLock(root),sources=sourceFiles(root),dependency=verifyDependencies?verifyEngineLock({root}):null;
  const publicImports=new Set();
  for(const file of sources)for(const entry of auditSourceText(fs.readFileSync(inside(root,file),'utf8'),file,root))if(entry.startsWith('@'))publicImports.add(entry);
  // Game media are all independently catalogued here, rather than added to thlib.
  const art=JSON.parse(fs.readFileSync(inside(root,'assets/art-manifest.json'),'utf8'));
  assert.equal(art.format,'guiming-art-v1');const artPaths=Object.keys(art.assets).sort();
  const artFolders=['art','portraits','sprites',...['scenery','spells'].filter(folder=>fs.existsSync(inside(root,'assets/'+folder)))];
  assert.deepEqual(artFolders.flatMap(folder=>mediaFiles(root,`assets/${folder}`)).sort(),artPaths,'Art manifest is not the exact game-image inventory');
  for(const file of artPaths){assert.match(file,/^assets\/(art|portraits|sprites|scenery|spells)\/[^/]+\.png$/);assert.equal(shaFile(inside(root,file)),art.assets[file].sha256,`Game art hash changed: ${file}`);}
  for(const character of [...PLAYERS,...CHARACTERS])assert.ok(art.assets[`assets/portraits/${character.id}.png`],'Character portrait is missing');
  for(const character of CHARACTERS)assert.ok(art.assets[`assets/sprites/${character.id}.png`],'Boss animation atlas is missing');
  for(const character of CHARACTERS){
    const pattern=art.assets[`assets/spells/${character.id}.png`],base=art.assets[`assets/spells/${character.id}-base.png`];
    assert.ok(pattern&&base,'Boss spell requires a separate base and pattern image');
    assert.notEqual(base.sha256,pattern.sha256,'Boss spell base cannot duplicate its pattern image');
  }
  for(const stage of STAGES)assert.ok(art.assets[`assets/art/stage${String(stage.id).padStart(2,'0')}.png`],'Stage far landscape is missing');
  const expectedMusic=['title',...Array.from({length:6},(_,index)=>[`stage0${index+1}`,`boss0${index+1}`]).flat(),'extra','bossExtra','ending','staff','playersScore'];
  assert.deepEqual(MUSIC_TRACKS.map(track=>track.id),expectedMusic,'Music is not this game\'s 18-track programme');
  const musicPaths=MUSIC_TRACKS.map(track=>track.file).sort();assert.deepEqual(mediaFiles(root,'assets/music').sort(),musicPaths,'Music inventory differs');
  for(const track of MUSIC_TRACKS){assert.equal(track.file,`assets/music/${track.id}.wav`);assert.equal(shaFile(inside(root,track.file)),track.sha256,`Original music hash changed: ${track.id}`);}
  const lockedNames=new Set(lock.thlibFiles.map(file=>file.path));
  assert.ok(lockedNames.has('LICENSE')&&lockedNames.has('assets/touhou-common/NOTICE.md'),'Private library notices must be retained');
  assert.ok(lock.thlibFiles.every(file=>file.path==='LICENSE'||file.path==='package.json'||file.path.startsWith('src/')||file.path.startsWith('assets/touhou-common/')),'Private library includes an unapproved resource scope');
  assert.ok(!lock.thlibFiles.some(file=>/\.(?:wav|ogg|mp3)$/i.test(file.path)&&/\/(?:bgm|music)\//i.test(file.path)),'Game BGM may not be taken from the private library');
  const ignore=fs.readFileSync(inside(root,'.gitignore'),'utf8').split(/\r?\n/).filter(Boolean);
  for(const prefix of PRIVATE_PREFIXES)assert.ok(ignore.includes('/'+prefix),`Git must ignore ${prefix}`);
  assert.ok(ignore.includes('.env')&&ignore.includes('.env.*'),'Environment files must be excluded');
  const tracked=execFileSync('git',['-C',root,'ls-files','-z'],{encoding:'utf8',windowsHide:true}).split('\0').filter(Boolean);
  for(const file of tracked)assert.ok(!PRIVATE_PREFIXES.some(prefix=>file.startsWith(prefix))&&!/(?:^|\/)\.env(?:\.|$)|\.log$|__pycache__\//.test(file),`Git contains private/generated/user data: ${file}`);
  assert.equal(GAME.fanWork,true);assert.equal(STAGES.length,7);assert.equal(ALL_SPELLS.length,39);assert.equal(MIDBOSS_SPELLS.length,8);
  const result={passed:true,scope:'Static import/resource/Git boundary checks; not a resource-rights grant or complete behaviour proof',
    sourceFiles:sources.length,publicImports:[...publicImports].sort(),artFiles:artPaths.length,musicFiles:MUSIC_TRACKS.length,
    stages:STAGES.length,spells:ALL_SPELLS.length,trackedFiles:tracked.length,dependencyCommit:dependency?.commit??lock.commit,
    privateLibraryFiles:lock.thlibFiles.length,privateRuntimeFiles:lock.runtimeFiles.length};
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditBoundaries(),null,2));
