import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const root=fileURLToPath(new URL('../',import.meta.url)),build=resolve(root,'build/integration'),reports=resolve(root,'reports/integration');
mkdirSync(build,{recursive:true});mkdirSync(reports,{recursive:true});
const started=performance.now(),cases=[];
const binary=resolve(root,'runtime/ts-stg.exe'),binaryHash=createHash('sha256').update(readFileSync(binary)).digest('hex');
const hashTree=(directory,base=root)=>Object.fromEntries(readdirSync(resolve(base,directory),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?Object.entries(hashTree(`${directory}/${entry.name}`,base)):[[`${directory}/${entry.name}`,createHash('sha256').update(readFileSync(resolve(base,directory,entry.name))).digest('hex')]]));
const libraryHashes=hashTree('packages/thlib/src');
const referenceRoot=JSON.parse(readFileSync(resolve(root,'engine.lock.json'),'utf8')).source;
const referenceHashes=existsSync(resolve(referenceRoot,'packages/thlib/src'))?hashTree('packages/thlib/src',referenceRoot):null;
if(referenceHashes)assert.deepEqual(libraryHashes,referenceHashes,'The game dependency remains the unmodified public thlib source snapshot');
const sourceHashes=hashTree('src'),execute=promisify(execFile),errors=[],pairs=new Map();
// BossSpriteCatalog only submits business draw commands; it never advances
// actors, RNG, collision, HP or inputs. Keep its revision visible separately.
const simulationHashes=all=>Object.fromEntries(Object.entries(all).filter(([path])=>path!=='src/boss-sprites.js'));
const ruleHashes=simulationHashes(sourceHashes);
const fixtureHashes=Object.fromEntries(['tools/verify-game.mjs','tools/integration-fixture.js'].map(path=>[path,createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')]));
const signature={simulationSource:createHash('sha256').update(JSON.stringify(ruleHashes)).digest('hex'),library:createHash('sha256').update(JSON.stringify(libraryHashes)).digest('hex'),engine:binaryHash,fixture:createHash('sha256').update(JSON.stringify(fixtureHashes)).digest('hex')};
const reportName=process.env.TOUHOU21_REPORT??'summary.json';
assert.ok(/^summary(?:-[a-z0-9-]+)?\.json$/.test(reportName),'Report name must be a summary JSON filename');
const previousPath=resolve(reports,reportName),previous=process.env.TOUHOU21_RESUME==='1'&&existsSync(previousPath)?JSON.parse(readFileSync(previousPath,'utf8')):null;
const canReuse=previous&&JSON.stringify(previous.verificationFixtureSha256)===JSON.stringify(fixtureHashes)&&JSON.stringify(previous.simulationSourceSha256??simulationHashes(previous.gameSourceSha256))===JSON.stringify(ruleHashes)&&JSON.stringify(previous.librarySha256)===JSON.stringify(libraryHashes)&&previous.executableSha256===binaryHash;
const baselineName=process.env.TOUHOU21_BASELINE,baselinePath=baselineName?resolve(reports,`baseline-${baselineName}.json`):null;
const baseline=baselinePath&&existsSync(baselinePath)?JSON.parse(readFileSync(baselinePath,'utf8')):null;
const authoredMechanics=['src/director.js','src/patterns.js','src/content.js'];
const baselineCompatible=baseline&&authoredMechanics.every(path=>baseline.gameSourceSha256[path]===sourceHashes[path])&&JSON.stringify(baseline.librarySha256)===JSON.stringify(libraryHashes)&&baseline.executableSha256===binaryHash;
const backends=process.env.TOUHOU21_BACKENDS?.split(',')??['v8','quickjs'];
const scenarios=[...Array.from({length:4},(_,difficulty)=>({id:`normal-reimu-${difficulty}`,kind:'campaign',options:{mode:'normal',character:0,difficulty}})),
  {id:'normal-marisa-1',kind:'campaign',options:{mode:'normal',character:1,difficulty:1}},
  ...[0,1].map(character=>({id:`extra-${character}`,kind:'campaign',options:{mode:'extra',character,difficulty:4}})),
  {id:'stage-practice-3',kind:'campaign',options:{mode:'stage-practice',stageId:3,character:1,difficulty:1}},
  {id:'replay-input',kind:'replay'}, {id:'continuation-replay',kind:'continuation-replay'}, {id:'ui-input',kind:'ui'},
  {id:'pause-external-pages',kind:'pause-external-pages'}, {id:'pause-page-replay',kind:'pause-page-replay'}, {id:'replay-controls',kind:'replay-controls'},
  {id:'gameover-external-pages',kind:'gameover-external-pages'}, {id:'manual-save',kind:'manual-save'}, {id:'replay-termination',kind:'replay-termination'}];
const wanted=process.env.TOUHOU21_CASES?.split(',');
function compare(a,b,path='$'){
  if(typeof a==='number'&&typeof b==='number'){
    const tolerance=Number.isInteger(a)&&Number.isInteger(b)?0:1e-7*Math.max(1,Math.abs(a),Math.abs(b));
    assert.ok(Math.abs(a-b)<=tolerance,`${path}: v8=${a}, quickjs=${b}`);
  }else if(a&&b&&typeof a==='object'&&typeof b==='object'){
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),`Keys differ at ${path}`);
    for(const key of Object.keys(a))compare(a[key],b[key],`${path}.${key}`);
  }else assert.equal(a,b,path);
}
// Graphics MVPs are covered separately by native GPU validation. Everything
// below remains actual simulation, input, RNG, common animation and lifecycle.
function normalise(value){
  if(Array.isArray(value))return value.map(normalise);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!['backend','elapsedMs','checkedFinalHash','replayFinalHash','verification','rendered'].includes(key)).map(([key,item])=>[key,normalise(item)]));
}
const tasks=scenarios.filter(value=>!wanted||wanted.includes(value.id)).sort((a,b)=>Number(a.kind==='campaign')-Number(b.kind==='campaign')).flatMap(scenario=>backends.map(backend=>({scenario,backend})));
let cursor=0;
async function worker(){
  while(cursor<tasks.length){
    const {scenario,backend}=tasks[cursor++];
    assert.ok(['v8','quickjs'].includes(backend),'Backend must be v8 or quickjs');
    const id=`${scenario.id}-${backend}`,scenarioPath=`build/integration/${id}.json`,entryPath=`build/integration/${id}.js`;
    writeFileSync(resolve(root,scenarioPath),JSON.stringify(scenario));
    writeFileSync(resolve(root,entryPath),`import {createIntegrationFixture} from '../../tools/integration-fixture.js';\nglobalThis.__tsstg_game=createIntegrationFixture('${scenarioPath}');\n`);
    const out=resolve(reports,`${scenario.id}-${backend}.json`),begin=performance.now();
    try{
      const sameSource=canReuse&&scenario.kind==='campaign'?previous.results.find(value=>value.id===scenario.id&&value.backend===backend&&value.passed):null;
      // An explicitly selected baseline keeps already completed campaign
      // cases after UI-only revisions. Latest short controls/Continue/replay
      // cases always run again; the report states each campaign's revision.
      const campaignBaseline=!sameSource&&baselineCompatible&&scenario.kind==='campaign'?baseline.results.find(value=>value.id===scenario.id&&value.backend===backend&&value.passed):null;
      const saved=sameSource??campaignBaseline;
      if(!saved)await execute(binary,[entryPath,'--root',root,'--backend',backend,'--headless','--frames','1000','--snapshot',out],{cwd:root,encoding:'utf8',timeout:1800000,maxBuffer:4*1024*1024});
      const report=JSON.parse(readFileSync(out,'utf8')),nativeMs=saved?saved.nativeMs:Math.round(performance.now()-begin);
      if(saved&&scenario.kind==='campaign'){report.sceneUpdateCalls??=report.frames;report.applicationUpdateCalls??=report.frames;}
      report.verification=saved?report.verification??{simulationSource:createHash('sha256').update(JSON.stringify(simulationHashes((campaignBaseline?baseline:previous).gameSourceSha256))).digest('hex'),library:signature.library,engine:signature.engine}:signature;
      writeFileSync(out,JSON.stringify(report)+'\n');
      cases.push({id:scenario.id,backend,nativeMs,passed:report.passed,frames:report.frames??null,report:out,reused:!!saved,
        sceneUpdateCalls:report.sceneUpdateCalls??(scenario.kind==='campaign'?report.frames:0),
        applicationUpdateCalls:report.applicationUpdateCalls??report.frames??0,
        sourceBaseline:campaignBaseline?baselineName:sameSource?.sourceBaseline??null,
        bossPresentationSourceSha256:saved?saved.bossPresentationSourceSha256??(campaignBaseline?baseline:previous).gameSourceSha256['src/boss-sprites.js']:sourceHashes['src/boss-sprites.js']});
      console.log(`${report.passed?'PASS':'FAIL'}${saved?' retained':''} ${scenario.id}/${backend}: ${report.frames??'?'} application frames, ${nativeMs}ms`);
      if(!report.passed)throw new Error(`${scenario.id}/${backend}: ${report.error}`);
      const matching=pairs.get(scenario.id)??[];matching.push(report);pairs.set(scenario.id,matching);
    }catch(error){errors.push(`${scenario.id}/${backend}: ${error.killed?'native verification time limit exceeded; ':''}${error.message}`);console.error(errors.at(-1));if(!cases.some(value=>value.id===scenario.id&&value.backend===backend))cases.push({id:scenario.id,backend,passed:false,nativeMs:Math.round(performance.now()-begin),error:error.message,timeout:!!error.killed});}
  }
}
const workers=Math.min(tasks.length,Math.max(1,Math.min(4,Number(process.env.TOUHOU21_WORKERS??1))));
const results=await Promise.allSettled(Array.from({length:workers},()=>worker()));
for(const item of results)if(item.status==='rejected')errors.push(String(item.reason?.stack??item.reason));
for(const [id,matching]of pairs){if(matching.length===2){try{compare(normalise(matching[0]),normalise(matching[1]));for(const entry of cases.filter(value=>value.id===id))entry.backendParity=true;}catch(error){errors.push(`${id} backend parity: ${error.message}`);}}}
function writeSummary(){const libraryStable=JSON.stringify(hashTree('packages/thlib/src'))===JSON.stringify(libraryHashes),currentSource=hashTree('src'),gameStable=JSON.stringify(currentSource)===JSON.stringify(sourceHashes),rulesStable=JSON.stringify(simulationHashes(currentSource))===JSON.stringify(ruleHashes),referenceStable=referenceHashes?JSON.stringify(hashTree('packages/thlib/src',referenceRoot))===JSON.stringify(referenceHashes):null;
  const report={passed:libraryStable&&rulesStable&&referenceStable!==false&&errors.length===0&&cases.length===tasks.length&&cases.every(value=>value.passed),backends,workers,executableSha256:binaryHash,
  librarySha256:libraryHashes,libraryUnmodifiedDuringVerification:libraryStable,libraryMatchesReference:referenceHashes?JSON.stringify(referenceHashes)===JSON.stringify(libraryHashes):null,referenceSourceUnmodifiedDuringVerification:referenceStable,
  gameSourceSha256:sourceHashes,gameSourceUnmodifiedDuringVerification:gameStable,simulationSourceSha256:ruleHashes,simulationSourceUnmodifiedDuringVerification:rulesStable,verificationFixtureSha256:fixtureHashes,errors,
  retainedCampaignBaseline:baselineCompatible?{name:baselineName,scope:'Explicit baseline retention after human review of the intervening application/presentation revisions. Automated compatibility verifies director, patterns, content, public library and engine identity; it does not certify arbitrary Scene/storage revisions. Latest Continue, replay and UI controls are rerun.',gameSourceSha256:baseline.gameSourceSha256}:null,
  elapsedMs:Math.round(performance.now()-started),cases:cases.length,simulationUpdates:cases.reduce((sum,value)=>sum+(value.sceneUpdateCalls??0),0),applicationUpdates:cases.reduce((sum,value)=>sum+(value.applicationUpdateCalls??0),0),
  executedCases:cases.filter(value=>!value.reused).length,retainedCases:cases.filter(value=>value.reused).length,
  executedSceneUpdateCalls:cases.filter(value=>!value.reused).reduce((sum,value)=>sum+(value.sceneUpdateCalls??0),0),retainedSceneUpdateCalls:cases.filter(value=>value.reused).reduce((sum,value)=>sum+(value.sceneUpdateCalls??0),0),
  executedApplicationUpdateCalls:cases.filter(value=>!value.reused).reduce((sum,value)=>sum+(value.applicationUpdateCalls??0),0),retainedApplicationUpdateCalls:cases.filter(value=>value.reused).reduce((sum,value)=>sum+(value.applicationUpdateCalls??0),0),
  scope:`Native headless actual ProjectApplication / CampaignScene; ${tasks.some(value=>value.scenario.kind==='campaign')?'selected campaigns run full original road lengths':'selected UI and replay cases only; previous campaign coverage remains in its separate archived report'}; memory-only game saves plus dedicated native userdata/integration host round-trip files; public gameplay ownership, UI input and recorded replay checkpoints.`,
  excluded:'GPU pixels, music audio quality and human difficulty/playability balancing have separate validation.',results:cases};
  writeFileSync(resolve(reports,reportName),JSON.stringify(report,null,2)+'\n');return report;}
const report=writeSummary();console.log(`${report.passed?'PASS':'FAIL'} ${report.cases} native cases; ${report.simulationUpdates} scene update calls including retained cases; ${report.elapsedMs}ms; reports/integration/${reportName}`);
if(!report.passed)process.exitCode=1;
