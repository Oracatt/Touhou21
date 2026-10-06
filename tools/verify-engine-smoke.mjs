import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {PROJECT_ROOT,readEngineLock,inspectSourceState,verifyEngineLock} from './verify-engine-lock.mjs';
const reports=path.join(PROJECT_ROOT,'reports/engine-upgrade');fs.mkdirSync(reports,{recursive:true});
const lock=readEngineLock(),before=inspectSourceState(lock.source,{recorded:lock.sourceState});
const dependency=verifyEngineLock({checkSource:true}),results=[];
for(const backend of ['v8','quickjs']){
 const output=path.join(reports,'smoke-'+backend+'.json');
 execFileSync(path.join(PROJECT_ROOT,'runtime/ts-stg.exe'),['tools/engine-smoke-fixture.js','--root',PROJECT_ROOT,'--backend',backend,'--headless','--frames','4','--input','16','--snapshot',output],
  {cwd:PROJECT_ROOT,windowsHide:true,encoding:'utf8',timeout:60000});
 const report=JSON.parse(fs.readFileSync(output,'utf8'));assert.equal(report.passed,true);assert.equal(report.backend,backend);results.push(report);
}
assert.equal(results[0].hash,results[1].hash,'Native public smoke state differs by backend');
const after=inspectSourceState(lock.source,{recorded:lock.sourceState});assert.deepEqual(after,before,'Read-only source engine changed');
const report={passed:true,dependency,backends:results.map(({backend,hash,nativeFrames,gameplayFrames})=>({backend,hash,nativeFrames,gameplayFrames})),backendParity:true,sourceGitClean:after.gitClean,sourceUnchanged:true,recordedSourceChanges:after.changes,
 scope:'Native headless public thlib/world/original Reimu+Marisa weapons/explicit Boss hold-resume/input/texture-region/mesh command validation; no GPU pixel or real audio quality claim.'};
fs.writeFileSync(path.join(reports,'summary.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
