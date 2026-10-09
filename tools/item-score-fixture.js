import {ProjectApplication} from '../src/application.js';
import {CampaignScene} from '../src/scene.js';

// Only setup values are prescribed. Every award and popup enters through the
// actual App update and the public item collection path, never popup.spawn().
const pickups={
  'point-normal':{type:2,state:1,power:100,stored:476,afterPower:100,amount:4760,color:0xffffffff},
  'point-full':{type:2,state:3,power:100,stored:1000,afterPower:100,amount:10000,color:0xffffff00},
  'power-up':{type:1,state:1,power:199,stored:10,afterPower:200,amount:-1,color:0xffffff40},
  'power-full':{type:1,state:3,power:400,stored:1000,afterPower:400,amount:10000,color:0xffffffff},
  'power-small':{type:1,state:1,power:150,stored:10,afterPower:151,amount:null,color:null},
};
const samples=[0,30,60,61],copy=value=>JSON.parse(JSON.stringify(value));
const close=(a,b)=>Math.abs(a-b)<1e-5;

export function createItemScoreFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath)),memory=new Map(),texturePaths=new Map();
  const assert=(value,message)=>{if(!value)throw new Error(`${scenario.id}: ${message}`);};
  const host=Object.create(native),normalPath=value=>String(value).replaceAll('\\','/');let memoryWrites=0;
  Object.defineProperties(host,{
    readText:{value:file=>normalPath(file).startsWith('userdata/')?memory.get(normalPath(file))??'':native.readText(file)},
    writeText:{value:(file,text)=>{const name=normalPath(file);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA userdata remains in memory');memory.set(`userdata/${name}`,text);memoryWrites++;}},
    loadTexture:{value:(file,...args)=>{const id=native.loadTexture(file,...args);texturePaths.set(id,normalPath(file));return id;}},
  });
  let app=null,game=null,owner=null,ready=false,preview=false,observing=false,nativeFrames=0,updates=0,painted=false;
  const proofs=[],drawCalls=[];let result=null,activePriority=null;
  const advance=()=>{app.update(0);updates++;};
  const observedState=()=>({frame:game.frame,score:game.player.score,power:game.player.power,pointItems:game.player.pointItems,
    playerX:game.player.x,playerY:game.player.y,rng:game.rng.state,visualRng:game.visualRng.state,floating:owner.snapshot()});
  function begin(kind){
    app?.destroy();app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210910,autostart:true,invincible:true,mode:'normal',character:0,stageId:1,difficulty:1});
    game=app.core.game;assert(game instanceof CampaignScene,'The production application owns a real CampaignScene');
    owner=game.items.floatingScores;assert(owner&&typeof owner.snapshot==='function','Sync the public floating-score owner before verification');
    assert(owner.font===app.resources.font&&owner.font.data===app.resources.data.ascii_960,'The public owner borrows the original ASCII960 bitmap font');
    assert(owner.drawPriority===51&&owner.capacity===10&&owner.lifetime===60,'Original item-score scheduling and lifetime defaults');
    return{kind,setup:{playerX:0,playerY:340,power:pickups[kind].power,pointValue:10000,itemState:pickups[kind].state},timeline:[]};
  }
  function collect(proof){
    const expected=pickups[proof.kind],p=game.player;
    assert(p.collectLine===128&&p.maxPower===400&&p.powerPerLevel===100,'Fixture expects the public default collection and power rules');
    p.setPosition(0,340);p.power=expected.power;p.refreshPower();
    assert(p.pointValue===10000,'A fresh no-shoot run keeps the initial point value');
    const before={score:p.score,power:p.power,pointItems:p.pointItems},events=[],notifications=[];
    const onEvent=game.onEvent,notify=game.context.floatingScore;
    game.onEvent=(name,data)=>{if(name==='itemCollect')events.push({id:data.item.id,type:data.item.type,amount:data.amount,x:data.item.x,y:data.item.y,state:data.item.state});onEvent?.(name,data);};
    game.context.floatingScore=entry=>{notifications.push({x:entry.x,y:entry.y,amount:entry.amount,color:entry.color});notify?.(entry);};
    const item=game.items.spawn({type:expected.type,state:expected.state,x:p.x,y:p.y,speed:0});
    assert(item,'Public items.spawn produced a real collectible');advance();
    assert(item.state===0&&!game.items.items.includes(item)&&events.length===1&&events[0].id===item.id,'App update collected and retired the actual item');
    assert(p.score-before.score===expected.stored&&p.power===expected.afterPower,'Stored score and power match the actual public pickup reward');
    assert(p.pointItems-before.pointItems===(expected.type===2?1:0),'Only point items increment the public point-item counter');
    const entries=owner.snapshot().entries.filter(entry=>entry.active);
    assert(entries.length===(expected.amount===null?0:1),'Pickup creates only its expected public presentation entry');
    assert(notifications.length===entries.length,'Existing floatingScore notification still occurs exactly once per popup');
    if(expected.amount!==null){
      const entry=entries[0];assert(entry.age===0&&entry.time===0&&entry.speed===1,'Collection begins at the original zero-age popup frame');
      assert(entry.amount===expected.amount&&entry.color===expected.color,'Presentation amount and ARGB color reflect this pickup path');
      assert(entry.x===item.x&&entry.y===item.y,'Presentation originates at the actual collected item position');
    }
    Object.assign(proof,{item:events[0],before,after:{score:p.score,power:p.power,pointItems:p.pointItems},storedScoreDelta:p.score-before.score,
      displayedScoreDelta:(p.score-before.score)*10,notifications,initialEntry:entries[0]??null});
    game.onEvent=onEvent;game.context.floatingScore=notify;
  }
  function sample(proof,age){
    const snapshot=owner.snapshot(),entries=snapshot.entries.filter(entry=>entry.active),hasPopup=pickups[proof.kind].amount!==null;
    assert(entries.length===(hasPopup&&age<=60?1:0),'Popup stays active through60 and retires at61');
    if(entries.length){const entry=entries[0];assert(entry.age===age&&entry.time===age,'Only successful App simulation updates advance popup time');
      let y=proof.item.y,speed=1;for(let frame=0;frame<age;frame++){y=Math.fround(y-speed);speed=Math.fround(speed*Math.fround(.95));}
      assert(entry.y===y&&entry.speed===speed,'Actual App updates retain source float32 upward drift and drag without an extra presentation tick');}
    assert(game.player.score===proof.after.score&&game.player.power===proof.after.power,'Popup animation never repeats the reward');
    proof.timeline.push({age,score:game.player.score,power:game.player.power,floating:snapshot});
  }
  function* prepare(){
    for(const kind of scenario.headless?Object.keys(pickups):[scenario.kind]){
      const proof=begin(kind);
      for(let age=0;age<120;age++){advance();if(age%24===23)yield;}
      collect(proof);sample(proof,0);
      const finish=scenario.headless?61:scenario.age;
      for(let age=1;age<=finish;age++){advance();if(samples.includes(age)||age===finish)sample(proof,age);if(age%24===0)yield;}
      if(!scenario.headless&&finish===0)assert(proof.timeline.length===1,'Initial-frame sample is not advanced for capture');
      proofs.push(proof);
    }
    if(!scenario.headless){
      // Let the actual public render synchronize embedded ANM positions before
      // checking repeated drawing. Neither this warmup nor capture ticks time.
      preview=true;yield;preview=false;
      const enqueue=game.renderQueue.enqueuePriority.bind(game.renderQueue);
      game.renderQueue.enqueuePriority=(priority,callback,options)=>enqueue(priority,(...args)=>{
        const previous=activePriority;activePriority=priority;try{return callback(...args);}finally{activePriority=previous;}
      },options);
      const draw=owner.draw;
      owner.draw=function(target,view){const actual=observing&&!target.enqueuePriority,start=actual?target.commands.length:0;
        const answer=draw.call(this,target,view);if(actual)drawCalls.push({view:{...view},priority:activePriority,commands:target.commands.slice(start)});return answer;};
    }
    assert(memoryWrites===0,'Collection verification never writes persistent userdata');
    result={passed:true,id:scenario.id,backend:native.backend,headless:!!scenario.headless,updates,memoryWrites,
      proofs,actualScene:{frame:game.frame,director:game.director.snapshot(),player:game.player.snapshot()},
      visible:[],drawCalls:0,renderDidNotUpdate:false,
      scope:'Real ProjectApplication/CampaignScene and public collectible pickup. Position/power presets only select reward branches; no direct popup spawning or alternative font renderer.'};
    ready=true;
  }
  const runner=prepare();
  function verifyPaint(commands){
    assert(drawCalls.length===1,'One actual original-priority popup draw reaches the compositor');
    const call=drawCalls[0],font=app.resources.font,entries=owner.snapshot().entries.filter(entry=>entry.active);
    assert(call.priority===51,'The actual compositor executes pickup glyphs at the original owner priority51');
    assert(call.view.x===336&&call.view.y===24&&call.view.scale===1.5,'Source item coordinates use the public playfield transform');
    assert(!call.commands.some(command=>command[0]==='text'),'No system or virtual text replaces the original bitmap glyphs');
    const paints=call.commands.filter(command=>command[0]==='spriteRegion'),expected=[];
    for(const entry of entries){
      if(entry.age===0)continue; // Original 8/0 has no finite drawable quad.
      assert(entry.age===30||entry.age===60,'Selected visible capture ages have the settled source spacing');
      let x=entry.x-entry.digits.length*4;
      for(let remaining=entry.digits.length;remaining>0;remaining--){
        const digit=entry.digits[remaining-1];
        // At30 all digits are the intact row; at60 only POWER UP remains.
        if(entry.age===30||digit===10)expected.push({index:289+digit,x:336+Math.fround(x*1.5),y:24+Math.fround(entry.y*1.5),color:((entry.color&0xffffff)<<8|128)>>>0});
        x+=8;
      }
    }
    assert(paints.length===expected.length,'The exact number of original glyphs reaches the final native command list');
    for(let index=0;index<expected.length;index++){
      const e=expected[index],command=paints[index],sprite=font.data.sprites[e.index],entry=font.data.entries[sprite.entry],at=commands.indexOf(command);
      assert(at>=0,'Observed pickup glyph command is actually submitted by the production application');
      assert(command[1]===font.texture(entry)&&texturePaths.get(command[1])===normalPath(entry.texture.path),'Pickup glyph uses the actual common ASCII960 texture handle');
      assert(command[2]===sprite.x&&command[3]===sprite.y&&command[4]===sprite.width&&command[5]===sprite.height,'Pickup glyph samples the exact original sprite region');
      assert(close(command[6],e.x)&&close(command[7],e.y)&&command[8]===sprite.width&&command[9]===10&&command[10]===0&&command[11]===e.color,'Source position, glyph pixel size, near-player opacity and pickup tint are retained');
      result.visible.push({glyph:e.index,texturePath:entry.texture.path,sourceRect:{x:sprite.x,y:sprite.y,width:sprite.width,height:sprite.height},
        screen:{x:command[6],y:command[7],width:command[8],height:command[9]},rgba:command[11],commandIndex:at});
    }
    result.drawCalls=drawCalls.length;result.drawPriority=call.priority;result.commandCount=commands.length;
    assert(paints.length===(scenario.age===0||scenario.age===61?0:scenario.kind==='power-up'?1:String(pickups[scenario.kind].amount).length),'Initial suppression and complete retirement correspond to rendered pixels');
  }
  return{
    update(){nativeFrames++;if(!ready)runner.next();},
    render(){
      if(scenario.headless)return[];
      if(preview)return app.render();
      if(!ready||nativeFrames!==scenario.captureFrame)return[];
      const before=JSON.stringify(observedState());observing=true;let commands;
      try{commands=app.render();}finally{observing=false;}
      assert(JSON.stringify(observedState())===before,'Final rendering changes neither popup time nor player score/power/position/RNG');
      verifyPaint(commands);result.renderDidNotUpdate=true;painted=true;return commands;
    },
    snapshot(){assert(ready&&(scenario.headless||painted),'Native budget reaches the requested actual pickup capture');return result;},
    destroy(){app?.destroy();},
  };
}
