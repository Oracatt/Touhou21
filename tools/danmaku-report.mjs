/** Write reports/danmaku/summary.md: lab bullet counts for every attack on
 * every difficulty, plus pilot results on Normal (and Extra). Counts come
 * from the real thlib field; nobody shoots, so road guards live their full
 * routes and road numbers are upper bounds. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runAttack,standInBoss} from './danmaku-lab.js';
import {attackCatalog} from './danmaku-catalog.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),rows=[];
for(const entry of attackCatalog()){
  const difficulties=entry.stageId===7?[4]:[0,1,2,3],cells=[];let pilot='';
  for(const difficulty of difficulties){
    const piloted=difficulty===1||difficulty===4;
    const r=runAttack({update:entry.create({difficulty,seed:73,boss:standInBoss()}),frames:entry.frames,difficulty,pilot:piloted});
    cells.push(`${r.peak} / ${Math.round(r.emitted/(entry.frames/60))}`);if(piloted)pilot=String(r.hits);
  }
  rows.push(`| ${entry.key} | ${entry.name} | ${Math.round(entry.frames/60)}s | ${cells.join(' | ')}${entry.stageId===7?' | | |':''} | ${pilot} |`);
}
const out=path.join(ROOT,'reports','danmaku','summary.md');fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,['| 攻击 | 名称 | 时长 | E 峰值 / 每秒发射 | N | H | L | 机器人中弹 (N 或 Ex) |','| --- | --- | --- | --- | --- | --- | --- | --- |',...rows].join('\n')+'\n');
console.log(out);
