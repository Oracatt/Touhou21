/** Verify a staged Windows release without a Node installation in the player environment.
 * Every native run is serial and uses a disposable copy, never the distributable tree. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';

const projectRoot=path.resolve(import.meta.dirname,'..');
const manifestName='RELEASE-MANIFEST.json';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ordinal=(a,b)=>a<b?-1:a>b?1:0;
const json=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const isWithin=(root,target)=>{const rel=path.relative(root,target);return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));};
const requiredNotices=[
  'LICENSE','CREDITS.txt','packages/thlib/LICENSE',
  'packages/thlib/assets/touhou-common/NOTICE.md','packages/thlib/assets/spell-common/NOTICE.md',
  'runtime/LICENSE.TS-STG','runtime/THIRD_PARTY.md','runtime/licenses/raylib-LICENSE',
  'runtime/licenses/raylib-external/glfw/LICENSE.md','runtime/licenses/v8/V8-LICENSE','runtime/licenses/v8/rusty_v8-LICENSE',
];
function inventoryDigest(files){
  const digest=createHash('sha256');
  for(const file of [...files].sort((a,b)=>ordinal(a.path,b.path)))digest.update(`${file.path}\0${file.bytes}\0${file.sha256.toLowerCase()}\n`,'utf8');
  return digest.digest('hex');
}

function plainPath(file){
  for(let probe=path.resolve(file);;){
    assert.ok(!fs.lstatSync(probe,{throwIfNoEntry:false})?.isSymbolicLink(),`Links or junctions are forbidden: ${probe}`);
    const parent=path.dirname(probe);if(parent===probe)break;probe=parent;
  }
}
function relativeName(name){
  assert.ok(typeof name==='string'&&name.length>0&&!/[\\\x00-\x1f\x7f:]/.test(name)&&!name.startsWith('/'),'Invalid release path: '+name);
  const parts=name.split('/');
  for(const part of parts){
    assert.ok(part&&part!=='.'&&part!=='..'&&!/[ .]$/.test(part),`Invalid release path component: ${name}`);
    assert.ok(!/[<>"|?*]/.test(part)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part),`Invalid Windows filename: ${name}`);
  }
  return name;
}
function permitted(name,isDirectory=false){
  const parts=name.toLowerCase().split('/'),base=parts.at(-1);
  assert.ok(name.toLowerCase()!=='play-quickjs.cmd'&&!(parts[0]==='runtime'&&parts.some(part=>/quickjs|qjs/.test(part))),`QuickJS payload is forbidden in the V8-only release: ${name}`);
  for(let i=0;i<parts.length;i++){
    const part=parts[i];
    assert.ok(!['node_modules','userdata','.git','.hg','.svn','test','tests','tools','build','reports','.qa'].includes(part),`Development or personal path in release: ${name}`);
    assert.ok(part!=='src'||parts[i-1]==='dist',`TypeScript source tree in release: ${name}`);
  }
  if(isDirectory)return;
  // Some upstream notices retain their original .h/.c filenames and complete texts.
  const originalNotice=/^runtime\/licenses\/.+\.[hc]$/i.test(name);
  assert.ok(originalNotice||!(/\.(?:ts|tsx|map|cpp|cc|cxx|h|hpp|c|py|ps1|mjs|pdb|obj|lib)$/i.test(base)),`Source or build artifact in release: ${name}`);
  assert.ok(!/^\.env(?:\.|$)/i.test(base)&&!['package-lock.json','npm-shrinkwrap.json'].includes(base),`Development configuration in release: ${name}`);
}
function inventory(root,{checkAllowed=true}={}){
  plainPath(root);assert.ok(fs.statSync(root).isDirectory(),'Release root must be a directory');
  const files=[],folded=new Set();
  function visit(directory,prefix=''){
    for(const name of fs.readdirSync(directory).sort(ordinal)){
      const relative=relativeName(prefix+name),full=path.join(directory,name),stat=fs.lstatSync(full);
      assert.ok(!stat.isSymbolicLink(),`Link or junction in release: ${relative}`);
      const key=relative.toLowerCase();assert.ok(!folded.has(key),`Case collision in release: ${relative}`);folded.add(key);
      assert.ok(stat.isDirectory()||stat.isFile(),`Unsupported filesystem entry: ${relative}`);
      if(checkAllowed)permitted(relative,stat.isDirectory());
      if(stat.isDirectory())visit(full,relative+'/');
      else files.push({path:relative,bytes:stat.size,sha256:hash(full)});
    }
  }
  visit(root);return files.sort((a,b)=>ordinal(a.path,b.path));
}
export function inspectWindowsRelease(packageRoot){
  const root=path.resolve(packageRoot),actual=inventory(root),manifestFile=path.join(root,manifestName);
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  assert.equal(manifest.format,'touhou21-windows-release-v1');assert.equal(manifest.platform,'windows-x64');
  assert.ok(typeof manifest.game?.version==='string'&&manifest.game.version.length>0,'Missing game version');
  assert.ok(Number.isInteger(manifest.game?.revision)&&manifest.game.revision>=0,'Invalid game revision');
  assert.match(manifest.game?.commit??'',/^[0-9a-f]{40}$/i,'Invalid game commit');
  assert.match(manifest.engine?.commit??'',/^[0-9a-f]{40}$/i,'Invalid engine commit');
  assert.match(manifest.engine?.executableSha256??'',/^[0-9a-f]{64}$/i,'Invalid executable hash');
  assert.match(manifest.engine?.lockedExecutableSha256??'',/^[0-9a-f]{64}$/i,'Invalid locked executable hash');
  assert.deepEqual(manifest.engine?.backends,['v8'],'Windows release must contain only the V8 native backend');
  assert.equal(typeof manifest.engine.exactLockedBinary,'boolean');assert.ok(Array.isArray(manifest.files),'Missing release inventory');
  const folded=new Set(),expected=manifest.files.map(entry=>{
    const name=relativeName(entry.path);assert.notEqual(name.toLowerCase(),manifestName.toLowerCase(),'Manifest must not inventory itself');
    permitted(name);assert.ok(!folded.has(name.toLowerCase()),`Case collision in manifest: ${name}`);folded.add(name.toLowerCase());
    assert.ok(Number.isSafeInteger(entry.bytes)&&entry.bytes>=0,`Invalid file size: ${name}`);
    assert.match(entry.sha256??'',/^[0-9a-f]{64}$/i,`Invalid file hash: ${name}`);
    return{path:name,bytes:entry.bytes,sha256:entry.sha256.toLowerCase()};
  }).sort((a,b)=>ordinal(a.path,b.path));
  const actualPayload=actual.filter(entry=>entry.path!==manifestName);
  assert.deepEqual(actualPayload,expected,'Release contents differ from their complete manifest');
  assert.match(manifest.inventorySha256??'',/^[0-9a-f]{64}$/i,'Invalid release inventory digest');
  assert.equal(inventoryDigest(actualPayload),manifest.inventorySha256.toLowerCase(),'Release inventory digest does not match the actual sorted files');
  const names=new Set(expected.map(entry=>entry.path));
  for(const name of ['Play.cmd','dist/main.js','packages/thlib/dist/index.js','runtime/ts-stg.exe','runtime/NATIVE-BUILD.json'])assert.ok(names.has(name),`Missing required release file: ${name}`);
  const byName=new Map(actualPayload.map(entry=>[entry.path,entry]));
  for(const name of requiredNotices)assert.ok(byName.get(name)?.bytes>0,`Missing or empty required attribution: ${name}`);
  const binaryFile=path.join(root,'runtime/ts-stg.exe'),binary=fs.readFileSync(binaryFile);
  assert.equal(hash(binaryFile),manifest.engine.executableSha256.toLowerCase());
  assert.ok(binary.length>=64&&binary.toString('ascii',0,2)==='MZ','Runtime is not a Windows executable');
  const pe=binary.readUInt32LE(60);assert.ok(pe+6<=binary.length&&binary.toString('ascii',pe,pe+4)==='PE\0\0','Runtime PE header is invalid');
  assert.equal(binary.readUInt16LE(pe+4),0x8664,'Runtime is not Windows x64');
  const receipt=JSON.parse(fs.readFileSync(path.join(root,'runtime/NATIVE-BUILD.json'),'utf8'));
  assert.ok(receipt&&typeof receipt==='object'&&!Array.isArray(receipt),'Invalid native build receipt');
  assert.equal(receipt.format,'touhou21-windows-native-receipt-v1','Invalid native receipt format');
  assert.equal(receipt.sourceCommit,manifest.engine.commit,'Native receipt source commit differs from the manifest');
  assert.equal(receipt.configuration,'Release','Native executable must have a Release receipt');
  assert.equal(receipt.platform,manifest.platform,'Native receipt platform differs from the release');
  assert.deepEqual(receipt.backends,manifest.engine.backends,'Native receipt backends differ from the release');
  assert.equal(receipt.executable?.path,'runtime/ts-stg.exe','Native receipt executable path differs from the shipped runtime');
  assert.equal(receipt.executable?.bytes,binary.length,'Native receipt executable size differs from the actual file');
  assert.match(receipt.executable?.sha256??'',/^[0-9a-f]{64}$/i,'Invalid native receipt executable hash');
  assert.equal(receipt.executable.sha256.toLowerCase(),byName.get('runtime/ts-stg.exe').sha256,'Native receipt executable hash differs from the actual file');
  assert.match(receipt.lockedExecutableSha256??'',/^[0-9a-f]{64}$/i,'Invalid native receipt locked executable hash');
  assert.equal(receipt.lockedExecutableSha256.toLowerCase(),manifest.engine.lockedExecutableSha256.toLowerCase(),'Native receipt locked executable hash differs from the manifest');
  assert.equal(receipt.exactLockedBinary,manifest.engine.exactLockedBinary,'Native receipt exact-binary declaration differs from the manifest');
  assert.equal(receipt.exactLockedBinary,receipt.executable.sha256.toLowerCase()===receipt.lockedExecutableSha256.toLowerCase(),'Native receipt exact-binary declaration disagrees with executable hashes');
  if(receipt.bundledNotices!==undefined){
    assert.ok(Array.isArray(receipt.bundledNotices),'Invalid native receipt notice inventory');
    const seenNotices=new Set();
    for(const notice of receipt.bundledNotices){
      const name='runtime/'+relativeName(notice.path),key=name.toLowerCase();
      assert.ok(!seenNotices.has(key),'Duplicate native receipt notice: '+name);seenNotices.add(key);
      assert.ok(byName.has(name),'Missing notice listed in native receipt: '+name);
      assert.ok(Number.isSafeInteger(notice.bytes)&&notice.bytes>0,'Invalid native notice size: '+name);
      assert.match(notice.sha256??'',/^[0-9a-f]{64}$/i,'Invalid native notice hash: '+name);
      assert.equal(byName.get(name).bytes,notice.bytes,'Native notice size differs from its receipt: '+name);
      assert.equal(byName.get(name).sha256,notice.sha256.toLowerCase(),'Native notice hash differs from its receipt: '+name);
    }
  }
  return{root,manifest,manifestSha256:hash(manifestFile),files:actual,receipt};
}
function screenshotInfo(file){
  const data=fs.readFileSync(file);assert.ok(data.length>4096,'Screenshot is unexpectedly small');
  assert.ok(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'Screenshot is not PNG');
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);assert.equal(width,960);assert.equal(height,720);
  return{path:file,width,height,bytes:data.length,sha256:hash(file)};
}
function playerEnvironment(){
  const windowsRoot=process.env.SystemRoot??process.env.WINDIR??'C:\\Windows';
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!['path','node_path','node_options'].includes(key.toLowerCase())));
  env.PATH=[path.join(windowsRoot,'System32'),windowsRoot].join(path.delimiter);
  return{env,cmd:path.join(windowsRoot,'System32/cmd.exe')};
}
function shellQuote(value){
  assert.ok(!/[\x00\r\n"%!?&|<>^]/.test(value),'Unsafe character in CMD argument: '+value);
  return '"'+value+'"';
}
function execute(file,args,options){
  return new Promise(resolve=>execFile(file,args,{encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:8*1024*1024,...options},(error,stdout,stderr)=>resolve({
    exitCode:error?(typeof error.code==='number'?error.code:null):0,signal:error?.signal??null,killed:!!error?.killed,error:error?.message??null,stdout:stdout??'',stderr:stderr??'',
  })));
}
const resourceFailure=/TS-STG error:|File not found:|Missing or empty resource:|Cannot (?:decode|load) (?:texture|sound|music)|Cannot resolve @ts-stg\/thlib|Unsupported module import:|WARNING:.*(?:Failed to load|Could not open|not found)/i;

export async function verifyWindowsRelease({packageRoot,reportDirectory=path.join(projectRoot,'reports/windows-release')}={}){
  assert.ok(packageRoot,'packageRoot is required');assert.equal(process.platform,'win32','Native release verification requires Windows');
  const started=performance.now(),sourceRoot=path.resolve(packageRoot),reports=path.resolve(reportDirectory);
  plainPath(reports);assert.ok(!isWithin(sourceRoot,reports),'Reports must remain outside the staged release');
  fs.mkdirSync(reports,{recursive:true});
  const runDirectory=fs.mkdtempSync(path.join(reports,'run-')),sandboxRoot=path.join(runDirectory,'归名录 Windows Release','Touhou-Guiminglu');
  const caseDirectory=path.join(runDirectory,'cases');fs.mkdirSync(caseDirectory,{recursive:true});
  const report={format:'touhou21-windows-release-verification-v1',passed:false,sourceRoot,sandboxRoot,runDirectory,
    environment:{nodeOnPath:false,workingDirectoryOutsidePackage:true,gpuConcurrency:1},cases:[],errors:[],
    scope:'Exact V8-only package manifest; isolated Chinese/space path; player launcher; native rendered seven-stage backgrounds, both characters and one spell; actual V8 replay and UI input fixtures; native QuickJS selection must fail explicitly. Screenshots require separate human visual review; no full campaign or listening-quality claim.'};
  let inspected;
  const writeReport=()=>{report.elapsedMs=Math.round(performance.now()-started);json(path.join(runDirectory,'summary.json'),report);};
  try{
    inspected=inspectWindowsRelease(sourceRoot);report.manifestSha256=inspected.manifestSha256;
    report.game=inspected.manifest.game;report.engine=inspected.manifest.engine;report.fileCount=inspected.files.length;
    for(const entry of inspected.files){const target=path.join(sandboxRoot,...entry.path.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(sourceRoot,...entry.path.split('/')),target,fs.constants.COPYFILE_EXCL);}
    inspectWindowsRelease(sandboxRoot);
    report.freshPackage={noUserdata:!fs.existsSync(path.join(sandboxRoot,'userdata')),noNodeModules:!fs.existsSync(path.join(sandboxRoot,'node_modules'))};
    const {env,cmd}=playerEnvironment(),binary=path.join(sandboxRoot,'runtime/ts-stg.exe');report.environment.PATH=env.PATH;
    async function runCase({id,launcher=false,entry,frames=90,graphical=true,check}){
      const backend='v8';
      const caseId=id+'-'+backend,prefix=path.join(caseDirectory,caseId),snapshot=prefix+'.json',screenshot=graphical?prefix+'.png':null;
      const nativeArgs=['--frames',String(frames),'--benchmark','--snapshot',snapshot,...(graphical?['--screenshot',screenshot]:['--headless'])];
      const file=launcher?cmd:binary,args=launcher?['/d','/s','/c','"'+[path.join(sandboxRoot,'Play.cmd'),...nativeArgs].map(shellQuote).join(' ')+'"']:[entry,'--root',sandboxRoot,'--backend',backend,...nativeArgs];
      const begin=performance.now(),result=await execute(file,args,{cwd:runDirectory,env,...(launcher?{windowsVerbatimArguments:true}:{})});
      fs.writeFileSync(prefix+'.stdout.log',result.stdout);fs.writeFileSync(prefix+'.stderr.log',result.stderr);
      const record={id,backend,passed:false,graphical,launcher,exitCode:result.exitCode,signal:result.signal,elapsedMs:Math.round(performance.now()-begin),
        stdout:prefix+'.stdout.log',stderr:prefix+'.stderr.log',snapshot,screenshot};
      try{
        assert.equal(result.exitCode,0,result.error??result.stderr);assert.ok(!resourceFailure.test(result.stdout+'\n'+result.stderr),'Native log reports a missing or invalid resource');
        const state=JSON.parse(fs.readFileSync(snapshot,'utf8'));check?.(state);
        if(graphical)record.image=screenshotInfo(screenshot);
        if(id==='replay-input')record.singleV8ReplayValidated=true;
        record.passed=true;
      }catch(error){record.error=error.message;report.errors.push(caseId+': '+error.message);}
      report.cases.push(record);writeReport();console.log(`${record.passed?'PASS':'FAIL'} release ${caseId}`);
      return record;
    }
    await runCase({id:'launcher-title',launcher:true,check:state=>{
      assert.equal(state.backend,'v8');assert.equal(state.mode,'title');assert.equal(state.revision,inspected.manifest.game.revision);assert.ok(state.frame>=90);
    }});
    // QA fixtures are copied only after validating and launching the pristine player package.
    const qa=path.join(sandboxRoot,'.qa'),build=path.join(sandboxRoot,'build');fs.mkdirSync(qa);fs.mkdirSync(build);
    for(const name of ['native-fixture.js','integration-fixture.js'])fs.copyFileSync(path.join(projectRoot,'tools',name),path.join(qa,name),fs.constants.COPYFILE_EXCL);
    const fixtureHashes=Object.fromEntries(['native-fixture.js','integration-fixture.js'].map(name=>[name,hash(path.join(qa,name))]));report.fixtureSha256=fixtureHashes;
    const {GAME,STAGES}=await import(pathToFileURL(path.join(sandboxRoot,'dist/src/content.js')).href);
    assert.equal(GAME.version,inspected.manifest.game.version);assert.equal(STAGES.length,7);
    const visuals=[...STAGES.map(stage=>({id:'road-'+stage.id,preRoll:1200,options:{autostart:true,invincible:true,mode:'stage-practice',stageId:stage.id,character:(stage.id-1)%2,difficulty:stage.id===7?4:1}})),
      {id:'spell-practice',until:{state:'combat'},phaseRoll:420,options:{autostart:true,invincible:true,mode:'spell-practice',stageId:1,spellId:STAGES[0].spells[0].id,character:1,difficulty:1}}];
    for(const scenario of visuals){
      json(path.join(build,'scenario.json'),{...scenario,captureFrame:220});
      await runCase({id:scenario.id,entry:'.qa/native-fixture.js',frames:220,check:state=>{
        assert.equal(state.backend,'v8');assert.equal(state.mode,'game');assert.equal(state.scene.director.stageId,scenario.options.stageId);
        assert.equal(state.scene.player.character,scenario.options.character);
        if(scenario.until)assert.equal(state.scene.director.state,scenario.until.state);
        else assert.ok(state.frame>=1200);
      }});
    }
    for(const scenario of [{id:'replay-input',kind:'replay'},{id:'ui-input',kind:'ui'}]){
      const scenarioPath='build/'+scenario.id+'.json',entry='.qa/'+scenario.id+'.js';json(path.join(sandboxRoot,scenarioPath),scenario);
      fs.writeFileSync(path.join(sandboxRoot,entry),`import {createIntegrationFixture} from './integration-fixture.js';\nglobalThis.__tsstg_game=createIntegrationFixture('${scenarioPath}');\n`);
      await runCase({id:scenario.id,entry,frames:1000,graphical:false,check:state=>{
        assert.equal(state.passed,true,state.error);assert.equal(state.kind,scenario.kind);assert.equal(state.nativeUserDataRoundTrip,true);
        if(scenario.kind==='replay'){
          assert.equal(state.config?.backend,'v8','Replay must have been recorded by V8');
          assert.ok(state.checkedFinalHash!==undefined&&state.checkedFinalHash!==null,'Missing recorded replay state hash');
          assert.equal(state.checkedFinalHash,state.replayFinalHash,'Recorded and replayed V8 simulation hashes differ');
        }
      }});
    }
    // This must exercise the native selector, not a launcher or a JS fixture.
    // Resource failures or timeouts cannot stand in for an unavailable backend.
    const rejectionPrefix=path.join(caseDirectory,'quickjs-rejected'),rejectionStart=performance.now();
    const rejection=await execute(binary,['dist/main.js','--root',sandboxRoot,'--backend','quickjs','--headless','--frames','1'],{cwd:runDirectory,env,timeout:10000});
    fs.writeFileSync(rejectionPrefix+'.stdout.log',rejection.stdout);fs.writeFileSync(rejectionPrefix+'.stderr.log',rejection.stderr);
    const rejectionRecord={id:'quickjs-rejected',backend:'quickjs',expectedFailure:true,graphical:false,launcher:false,passed:false,
      exitCode:rejection.exitCode,signal:rejection.signal,elapsedMs:Math.round(performance.now()-rejectionStart),
      stdout:rejectionPrefix+'.stdout.log',stderr:rejectionPrefix+'.stderr.log',snapshot:null,screenshot:null};
    try{
      assert.ok(Number.isInteger(rejection.exitCode)&&rejection.exitCode!==0&&!rejection.killed&&!rejection.signal,'QuickJS selection must exit with an ordinary nonzero error');
      const diagnostic=(rejection.stdout+'\n'+rejection.stderr).split(/\r?\n/).find(line=>
        /quickjs|backend|only\s+v8|v8.only/i.test(line)&&
        /unsupported|unknown|unavailable|not\s+(?:available|compiled|built|enabled|supported)|disabled|requires.*v8|supports?\s+only\s+v8/i.test(line)&&
        !/module import|resource|texture|sound|music|file not found|missing or empty/i.test(line));
      assert.ok(diagnostic,'Native selector did not explicitly reject the unavailable QuickJS backend');
      rejectionRecord.diagnostic=diagnostic;rejectionRecord.passed=true;report.quickjsBackendRejected=true;
    }catch(error){rejectionRecord.error=error.message;report.errors.push('quickjs-rejected: '+error.message);}
    report.cases.push(rejectionRecord);writeReport();console.log(`${rejectionRecord.passed?'PASS':'FAIL'} release quickjs-rejected`);
    for(const entry of inspected.files){const target=path.join(sandboxRoot,...entry.path.split('/'));plainPath(target);assert.equal(hash(target),entry.sha256,'Verification modified a shipped file: '+entry.path);}
    report.packagedFilesUnchanged=true;
  }catch(error){report.errors.push(error.stack??String(error));}
  try{if(inspected){assert.deepEqual(inspectWindowsRelease(sourceRoot).files,inspected.files,'The actual staged package changed during verification');report.sourcePackageUnchanged=true;}}
  catch(error){report.errors.push(error.message);}
  report.passed=report.errors.length===0&&report.cases.length===12&&report.cases.every(value=>value.passed);
  writeReport();return report;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const options={};
  for(let i=2;i<process.argv.length;i++){
    const arg=process.argv[i];assert.ok(['--package','--report'].includes(arg),'Unknown argument: '+arg);
    assert.ok(process.argv[i+1]&&!process.argv[i+1].startsWith('--'),'Missing value for '+arg);
    options[arg==='--package'?'packageRoot':'reportDirectory']=process.argv[++i];
  }
  const report=await verifyWindowsRelease(options);console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,errors:report.errors,report:path.join(report.runDirectory,'summary.json')},null,2));
  if(!report.passed)process.exitCode=1;
}
