import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {PROJECT_ROOT,inside,inventoryTree,inventoryDigest,readEngineLock,shaFile,safeRelative} from './verify-engine-lock.mjs';

const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const git=args=>execFileSync('git',['-C',PROJECT_ROOT,...args],{encoding:'utf8',windowsHide:true}).trim();
const repositoryUrl=()=>{const remote=git(['remote','get-url','origin']),url=new URL(remote.startsWith('git@')?remote.replace(/^git@([^:]+):/,'https://$1/'):remote);assert.ok(['https:','http:'].includes(url.protocol),'Release repository must be a web URL');url.username='';url.password='';url.search='';url.hash='';return url.href;};
const ps=value=>"'"+value.replaceAll("'","''")+"'";
function shell(script){return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});}
function build(){
  const emitted=execFileSync(process.execPath,[path.join(PROJECT_ROOT,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json','--listEmittedFiles','--sourceMap','false'],{cwd:PROJECT_ROOT,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});
  const files=emitted.split(/\r?\n/).filter(line=>line.startsWith('TSFILE: ')).map(line=>path.resolve(line.slice(8))).filter(file=>file.endsWith('.js'));
  assert.ok(files.length>0,'Compiler emitted no JavaScript');
  return files.map(file=>{const relative=path.relative(PROJECT_ROOT,file).split(path.sep).join('/');safeRelative(relative);assert.ok(relative.startsWith('dist/'),'Compiler output escapes dist');return relative;}).sort();
}

// The release launchers never run a compiler or read a development checkout.
export function windowsReleaseLauncher(backend='v8'){return [
  '@echo off','setlocal','pushd "%~dp0" || exit /b 1',
  'if not exist "userdata" mkdir "userdata"',
  `"runtime\\ts-stg.exe" "dist/main.js" --root . --backend ${backend} --display-config "userdata/guiming-display.json" %*`,
  'set "gameExit=%errorlevel%"','popd',
  'if not "%gameExit%"=="0" if "%~1"=="" pause',
  'exit /b %gameExit%','',
].join('\r\n');}
export function windowsDisplayConfigurationLauncher(){return [
  '@echo off','call "%~dp0Play.cmd" --configure-display %*','exit /b %errorlevel%','',
].join('\r\n');}

function verifyLibrary(lock){
  const actual=inventoryTree(inside(PROJECT_ROOT,'packages/thlib'));
  assert.deepEqual(actual,lock.thlibFiles,'Installed thlib must exactly match the committed engine lock');
  return actual;
}
function nativePayload(lock,allowlistFile){
  assert.ok(allowlistFile,'Windows releases require an audited V8-only native build; pass --native-allowlist');
  const allowlist=json(path.resolve(allowlistFile)),receipt=json(inside(PROJECT_ROOT,allowlist.receipt.source));
  assert.equal(shaFile(inside(PROJECT_ROOT,allowlist.receipt.source)),allowlist.receipt.sha256,'Native receipt has changed');
  assert.equal(receipt.format,'touhou21-windows-native-receipt-v1');
  assert.equal(receipt.sourceCommit,lock.commit);assert.equal(receipt.configuration,'Release');assert.equal(receipt.platform,'windows-x64');
  assert.deepEqual(receipt.backends,['v8'],'The release engine must contain only V8');assert.equal(receipt.lockedExecutableSha256,lock.executableSha256);
  const sources=receipt.sourceVerification;
  assert.equal(sources.pinnedBaseVerified,true);assert.deepEqual(sources.baseFiles,lock.nativeBuild.sourceFiles,'Native base differs from pinned sources');
  assert.deepEqual(sources.files.map(file=>file.path),sources.baseFiles.map(file=>file.path),'Actual native source inventory differs');
  const patches=new Map(sources.patches.map(patch=>[patch.path,patch]));assert.equal(patches.size,sources.patches.length);
  const allowedPatches=new Set(['CMakeLists.txt','native/include/tsstg/backend.hpp','native/src/main.cpp','native/src/host.cpp']);
  for(let i=0;i<sources.files.length;i++){
    const base=sources.baseFiles[i],actual=sources.files[i],patch=patches.get(actual.path);
    assert.ok(Number.isSafeInteger(actual.bytes)&&actual.bytes>=0);assert.match(actual.sha256,/^[a-f0-9]{64}$/);
    if(patch){
      assert.ok(allowedPatches.has(patch.path),'Unexpected release source patch');assert.equal(patch.beforeSha256,base.sha256);assert.equal(patch.afterSha256,actual.sha256);
      assert.ok(typeof patch.diff==='string'&&patch.diff.includes('@@'),'Missing actual native patch diff');assert.notEqual(actual.sha256,base.sha256);
    }else assert.deepEqual(actual,base,'Unrecorded release source change: '+actual.path);
  }
  assert.equal(patches.size,4,'Record all four changes that remove the QuickJS build and dispatcher');
  assert.equal(receipt.originalBuildVerification.passed,true);assert.equal(receipt.originalBuildVerification.backend,'v8');
  assert.equal(receipt.loader.nonSystemDllPayload.length,0,'This packager requires a self-contained native build');
  assert.deepEqual(receipt.loader.staticLibraries,['raylib','V8'],'Unexpected native backend library');
  assert.equal(receipt.executable.sha256,allowlist.executable.sha256);
  assert.equal(receipt.executable.path,'runtime/ts-stg.exe');assert.equal(allowlist.executable.destination,receipt.executable.path);
  assert.equal(receipt.exactLockedBinary,receipt.executable.sha256===lock.executableSha256);
  const notices=new Map(allowlist.notices.map(file=>[file.destination,file]));
  assert.equal(notices.size,allowlist.notices.length,'Duplicate native notices');
  for(const file of allowlist.notices)assert.ok(!/quickjs|(?:^|[\/_.-])qjs(?:[\/_.-]|$)/i.test(file.destination),'QuickJS notice must not enter the V8-only release');
  for(const notice of receipt.bundledNotices){
    const file=notices.get('runtime/'+notice.path);assert.ok(file,'Missing native notice: '+notice.path);assert.equal(file.sha256,notice.sha256);
  }
  assert.equal(receipt.bundledNotices.length,notices.size);
  return {files:[allowlist.executable,...allowlist.notices],receipt};
}

export async function packageWindows({nativeAllowlist=null}={}){
  assert.equal(process.platform,'win32','Windows packaging/verification requires Windows');
  const lock=readEngineLock();
  assert.equal(git(['status','--porcelain','--','main.ts','native-globals.d.ts','src','assets','tsconfig.json','tsconfig.base.json','package-lock.json']),'','Commit game inputs before packaging');
  const library=verifyLibrary(lock),native=nativePayload(lock,nativeAllowlist);
  assert.equal(json(path.join(PROJECT_ROOT,'node_modules/typescript/package.json')).version,lock.thlibBuild.compiler.version,'Use the pinned TypeScript compiler');
  assert.equal(shaFile(path.join(PROJECT_ROOT,'node_modules/typescript/lib/typescript.js')),lock.thlibBuild.compiler.implementationSha256);
  const compiled=build();
  const {GAME}=await import('../dist/src/content.js'),{GAME_REVISION}=await import('../dist/src/storage.js');
  assert.equal(GAME.contentRevision,GAME_REVISION);assert.equal(GAME.version,json(inside(PROJECT_ROOT,'package.json')).version);
  const {auditBoundaries}=await import('./audit-boundaries.mjs');const audit=auditBoundaries({verifyDependencies:false});
  const run=inside(PROJECT_ROOT,'build/releases/'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
  const stage=path.join(run,'staging','Touhou-Guiminglu');fs.mkdirSync(stage,{recursive:true});
  const copied=new Set();
  function copy(source,destination,hash=null){
    safeRelative(source);safeRelative(destination);assert.ok(!copied.has(destination.toLowerCase()),'Duplicate payload path: '+destination);
    const input=inside(PROJECT_ROOT,source),stat=fs.lstatSync(input);assert.ok(stat.isFile()&&!stat.isSymbolicLink(),'Payload must be a regular file');
    if(hash)assert.equal(shaFile(input),hash,'Changed packaging input: '+source);
    const target=inside(stage,destination);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(input,target);copied.add(destination.toLowerCase());
  }
  function write(destination,contents){safeRelative(destination);assert.ok(!copied.has(destination.toLowerCase()));const target=inside(stage,destination);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,contents);copied.add(destination.toLowerCase());}
  function writeJSON(destination,value){write(destination,JSON.stringify(value,null,2)+'\n');}
  // tsc leaves old outputs behind when a source is removed. Only this invocation's
  // emitted modules may enter a release, never the entire development dist tree.
  for(const file of compiled)copy(file,file,shaFile(inside(PROJECT_ROOT,file)));
  for(const file of library.filter(file=>file.path==='LICENSE'||file.path==='package.json'||file.path.startsWith('dist/')&&file.path.endsWith('.js')||file.path.startsWith('assets/touhou-common/')||file.path.startsWith('assets/spell-common/')))
    copy('packages/thlib/'+file.path,'packages/thlib/'+file.path,file.sha256);
  const art=json(inside(PROJECT_ROOT,'assets/art-manifest.json'));
  copy('assets/art-manifest.json','assets/art-manifest.json');
  for(const [file,entry] of Object.entries(art.assets))copy(file,file,entry.sha256);
  const {MUSIC_TRACKS}=await import('../dist/src/music-data.js');
  for(const track of MUSIC_TRACKS)copy(track.file,track.file,track.sha256);
  copy('assets/music/studio.json','assets/music/studio.json');copy('LICENSE','LICENSE');
  for(const file of native.files)copy(file.source,file.destination,file.sha256);
  assert.equal(fs.statSync(inside(stage,'runtime/ts-stg.exe')).size,native.receipt.executable.bytes);
  writeJSON('runtime/NATIVE-BUILD.json',native.receipt);
  write('Play.cmd',windowsReleaseLauncher());
  write('Configure-Display.cmd',windowsDisplayConfigurationLauncher());
  write('README.txt',`东方归名录 ～ Names Beyond the Boundary.\r\nWindows x64 Release / ${GAME.version} / 回放修订 ${GAME_REVISION}\r\n\r\n将整个压缩包解压到可写的目录，再双击 Play.cmd。不要在压缩包内直接运行。\r\n本发行版只包含 V8 后端，支持 V8 录制的回放。\r\n不需要安装 Node.js、npm 或编译器。请使用 Windows 10/11 的 64 位系统和支持 OpenGL 3.3 的显卡驱动。\r\n\r\n首次启动可选择 640×480～2560×1920 的4:3分辨率，以及窗口或无边框全屏，并选择记住设置或每次启动询问。\r\n双击 Configure-Display.cmd，或启动时按住 Shift / Ctrl，可重新配置显示。Alt+Enter 切换窗口与无边框全屏。\r\n显示设置保存在 userdata/guiming-display.json；物理显示按4:3等比缩放，空余区域留黑。逻辑画面仍为960×720，不改变弹幕、自机判定、固定60帧模拟或回放。\r\n\r\n方向键：移动；Z：射击/确定；X：Bomb/取消；Shift：低速；Esc：暂停；Ctrl：回放快进。\r\n存档、设置和回放保存在本目录的 userdata 文件夹。首次运行会自动创建。\r\n升级时请单独保留 userdata；旧回放会根据内容修订判断兼容性。\r\n\r\n本作是东方 Project 同人游戏，并非上海爱丽丝幻乐团的官方作品。\r\n原作：上海爱丽丝幻乐团 / ZUN。素材和依赖的归属见 CREDITS.txt、LICENSE、runtime/ 和公共素材包 NOTICE.md。\r\n本包引擎的实际来源和哈希见 runtime/NATIVE-BUILD.json；全部文件校验值见 RELEASE-MANIFEST.json。\r\n`);
  write('CREDITS.txt',`东方归名录 ～ Names Beyond the Boundary.\n\n东方 Project、博丽灵梦、雾雨魔理沙及所引用的原作公共素材：上海爱丽丝幻乐团 / ZUN。\n本作剧情、Boss、弹幕设计和18首配乐为本项目原创；立绘、场景和纹样使用 imagegen 辅助创作。\n公共中文UI图像：喵玉×THB《东方天空璋》汉化补丁；部分标签来自 LuaSTG THlib-Evo。详细原始来源与裁切记录保留在 packages/thlib/assets/touhou-common/NOTICE.md 及 manifest.json。\n符卡公共纹样来源记录：packages/thlib/assets/spell-common/NOTICE.md。\n根 LICENSE 的 MIT 仅覆盖本作原创代码与文档，不改变图像、音频和原作角色的权利。\n\n配乐：15首以授权乐器采样离线渲染，3首由本项目合成器生成；旋律、和声与编曲为原创。\nVSCO 2 Community Edition — Versilian Studios，CC0 1.0，管弦乐与打击乐音色。https://vis.versilstudios.com/vsco-community.html\nSalamander Grand Piano V3 — Alexander Holm，CC BY 3.0，钢琴音色。https://creativecommons.org/licenses/by/3.0/\nMuldjordKit — Lars Muldjord，CC BY 4.0，架子鼓音色。https://creativecommons.org/licenses/by/4.0/\n音色经离线编排和渲染组成WAV配乐，不包含采样库本体；各曲校验值、引子和循环点见 assets/music/studio.json 及游戏内音乐室。\n\nTS-STG：runtime/LICENSE.TS-STG。thlib：packages/thlib/LICENSE，含 Microsoft DirectXMath 归属。\nraylib、V8 及其依赖：runtime/THIRD_PARTY.md 和 runtime/licenses/，保留原始声明。实际构建信息见 runtime/NATIVE-BUILD.json。\n`);
  const compiler=json(path.join(PROJECT_ROOT,'node_modules/typescript/package.json'));
  const files=inventoryTree(stage);
  const manifest={format:'touhou21-windows-release-v1',platform:'windows-x64',createdAt:new Date().toISOString(),
    game:{title:GAME.fullTitle,version:GAME.version,revision:GAME_REVISION,commit:git(['rev-parse','HEAD']),sourceRepository:repositoryUrl()},
    engine:{commit:lock.commit,sourceRepository:native.receipt.sourceRepository??'https://github.com/Oracatt/TS-STG',executableSha256:native.receipt.executable.sha256,lockedExecutableSha256:lock.executableSha256,exactLockedBinary:native.receipt.exactLockedBinary,thlibSha256:lock.thlibSha256,sourceLockSha256:shaFile(inside(PROJECT_ROOT,'engine.lock.json')),backends:native.receipt.backends},
    compiler:{name:'typescript',version:compiler.version},content:{artFiles:audit.artFiles,musicFiles:audit.musicFiles,stages:audit.stages,spells:audit.spells},
    inventorySha256:inventoryDigest(files),files};
  writeJSON('RELEASE-MANIFEST.json',manifest);
  console.log(JSON.stringify({phase:'staged',packageRoot:stage,files:files.length+1,game:manifest.game,engine:manifest.engine},null,2));
  const {verifyWindowsRelease}=await import('./verify-windows-release.mjs');
  const verification=await verifyWindowsRelease({packageRoot:stage,reportDirectory:path.join(run,'verification')});
  assert.equal(verification.passed,true,'Release verification failed');
  const filename=`Touhou-Guiminglu-${GAME.version}-r${GAME_REVISION}-windows-x64-v8.zip`,archive=path.join(run,filename);
  shell(`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory(${ps(path.dirname(stage))},${ps(archive)},[System.IO.Compression.CompressionLevel]::Optimal,$false)`);
  // Verify the final compressed artifact separately; the tested copy acquired QA
  // data and is never used as an archive source.
  const extracted=path.join(run,'zip-integrity');
  shell(`Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory(${ps(archive)},${ps(extracted)})`);
  assert.deepEqual(inventoryTree(path.join(extracted,'Touhou-Guiminglu')),inventoryTree(stage),'Final ZIP does not reproduce the verified payload');
  const digest=shaFile(archive),checksum=archive+'.sha256';fs.writeFileSync(checksum,`${digest}  ${filename}\r\n`);
  const result={passed:true,archive,checksum,bytes:fs.statSync(archive).size,sha256:digest,packageRoot:stage,verificationReport:path.join(verification.runDirectory,'summary.json'),game:manifest.game,engine:manifest.engine};
  fs.writeFileSync(path.join(run,'release-result.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let nativeAllowlist=null;
  for(let i=2;i<process.argv.length;i++){if(process.argv[i]==='--native-allowlist'){nativeAllowlist=process.argv[++i];assert.ok(nativeAllowlist,'Missing --native-allowlist path');}else throw new Error('Unknown argument: '+process.argv[i]);}
  await packageWindows({nativeAllowlist});
}
