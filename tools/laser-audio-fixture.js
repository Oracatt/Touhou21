import {ProjectApplication} from '../src/application.js';
import {CampaignScene} from '../src/scene.js';

/** Observe real authored beams through App updates and the public audio
 * adapter. Only the final host playback boundary is muted; no audible test. */
export function createLaserAudioFixture(scenarioPath){
  const native=globalThis.tsstg,scenario=JSON.parse(native.readText(scenarioPath));
  const assert=(value,message)=>{if(!value)throw new Error(`${scenario.id}: ${message}`);};
  const normalize=value=>String(value).replaceAll('\\','/'),memory=new Map(),soundFiles=new Map(),host=Object.create(native);
  let app=null,game=null,tick=0,memoryWrites=0,ready=false,creation=null,adapterEvent=null;
  const requests=[],adapterPlays=[],hostPlays=[],beams=[],waves=[],transitions=[],tracked=[];
  const stamp=()=>({tick,gameFrame:game?.frame??0,phaseFrame:game?.director.phaseFrame??0});
  Object.defineProperties(host,{
    readText:{value:file=>normalize(file).startsWith('userdata/')?memory.get(normalize(file))??'':native.readText(file)},
    writeText:{value:(file,text)=>{const name=normalize(file);assert(!name.includes('..')&&!name.startsWith('/')&&!name.includes(':'),'QA userdata stays in memory');memory.set(`userdata/${name}`,text);memoryWrites++;}},
    loadSound:{value:file=>{const id=native.loadSound(file);soundFiles.set(id,normalize(file));return id;}},
    playSound:{value:(handle,volume,pan,loop)=>{hostPlays.push({...stamp(),file:soundFiles.get(handle),volume,pan,loop,viaPublicAdapter:adapterEvent!==null});}},
    // Music remains a real application/resource owner, but never starts a
    // speaker stream. No fabricated sound handles or alternative mixer.
    playMusic:{value:()=>{}},resumeMusic:{value:()=>{}},resumeSound:{value:()=>{}},
  });
  app=new ProjectApplication(host,{testing:true,fixedClock:true,seed:210911,autostart:true,invincible:true,
    mode:'spell-practice',character:0,stageId:scenario.stageId,spellId:scenario.spellId,difficulty:1});
  game=app.core.game;assert(game instanceof CampaignScene,'Production App owns the real CampaignScene');
  const audio=app.resources.audio;assert(audio,'Public resources create the actual audio owner');
  const request=audio.request.bind(audio),play=audio.adapter.play;
  audio.request=(id,x=0)=>{requests.push({...stamp(),id,x,beamCall:creation});return request(id,x);};
  audio.adapter.play=(handle,options)=>{
    const event={...stamp(),file:soundFiles.get(handle),...options};adapterPlays.push(event);adapterEvent=event;
    try{return play(handle,options);}finally{adapterEvent=null;}
  };
  const spawn=game.lasers.spawnInfinite.bind(game.lasers);
  game.lasers.spawnInfinite=parameters=>{
    creation=beams.length;let laser;
    try{laser=spawn(parameters);}finally{creation=null;}
    assert(laser,'Authored beam reaches the real public laser owner');
    const beam={...stamp(),id:laser.id,sound:laser.p.sound,delay:laser.p.delay,grow:laser.p.grow,
      initialState:laser.state,initialAge:laser.age.current,initialWidth:laser.width};
    beams.push(beam);tracked.push({laser,beam,state:laser.state});
    let wave=waves.at(-1);if(!wave||wave.tick!==tick){wave={tick,phaseFrame:beam.phaseFrame,ids:[]};waves.push(wave);}wave.ids.push(laser.id);
    return laser;
  };
  function advance(){
    tick++;app.update(0);
    for(const item of tracked){const {laser,beam}=item;if(laser.state===item.state)continue;
      const transition={...stamp(),id:laser.id,from:item.state,to:laser.state,age:laser.age.current,width:laser.width,bornTick:beam.tick};
      transitions.push(transition);item.state=laser.state;
      if(transition.to===4||transition.to===2){
        assert(!beams.some(value=>value.tick===tick),'This fixture observes activation outside a new emission wave');
        assert(!requests.some(value=>value.tick===tick&&value.id===18)&&!hostPlays.some(value=>value.tick===tick&&value.file.endsWith('/se_lazer00.wav')),
          'Growing or sustaining an existing beam does not request/play the creation cue again');
      }
    }
    if(waves.length>=3&&waves[2].ids.every(id=>transitions.some(value=>value.id===id&&value.to===2)))ready=true;
    assert(tick<=2000,'The real spell reaches three laser waves within its expected clock budget');
  }
  function verify(){
    assert(ready&&waves.length===3,'Three authored waves reached full activation');
    assert(game.director.state==='combat'&&game.director.phase.spec.id===scenario.spellId,'Observed the requested actual spell, not synthetic emissions');
    assert(memoryWrites===0,'Audio verification never writes persistent userdata');
    const laserRequests=requests.filter(value=>value.id===18),laserAdapters=adapterPlays.filter(value=>value.file.endsWith('/se_lazer00.wav')),
      laserHosts=hostPlays.filter(value=>value.file.endsWith('/se_lazer00.wav'));
    assert(laserRequests.length===3&&laserAdapters.length===3&&laserHosts.length===3,'Every wave has one request, one resources adapter play and one final host play');
    assert(!requests.some(value=>value.id===26),'No old ordinary-bullet ID26 substitutes for the laser cue');
    for(const wave of waves){
      const spawned=beams.filter(value=>value.tick===wave.tick);
      assert(spawned.length===scenario.beamsPerWave&&spawned.filter(value=>value.sound===18).length===1&&spawned.filter(value=>value.sound===-1).length===spawned.length-1,
        'The real authored simultaneous beam group keeps one cue and its deliberate silent siblings');
      assert(spawned.every(value=>value.initialState===3&&value.initialAge===0&&value.initialWidth===2&&value.delay===scenario.delay&&value.grow===scenario.grow),
        'Creation cue coincides with the original thin warning state before growth');
      const req=laserRequests.filter(value=>value.tick===wave.tick),adapt=laserAdapters.filter(value=>value.tick===wave.tick),plays=laserHosts.filter(value=>value.tick===wave.tick);
      assert(req.length===1&&adapt.length===1&&plays.length===1&&req[0].beamCall!==null,'The actual App flush coalesces each authored multi-beam wave into one host play');
      assert(adapt[0].loop===false&&plays[0].loop===false&&plays[0].viaPublicAdapter&&plays[0].volume>0&&plays[0].volume<=1&&Number.isFinite(plays[0].pan),
        'Public resources translate the real common wav to a positive-volume, nonlooping host command');
      assert(spawned.every(value=>transitions.some(t=>t.id===value.id&&t.from===3&&t.to===4)&&transitions.some(t=>t.id===value.id&&t.from===4&&t.to===2)),
        'Each emitted beam follows the real warning, growth and active states');
    }
    return{passed:true,id:scenario.id,backend:native.backend,spellId:scenario.spellId,tick,memoryWrites,waves,beams,transitions,
      laserRequests,laserAdapters,laserHosts,allRequestedIds:[...new Set(requests.map(value=>value.id))],
      director:game.director.snapshot(),scope:'Real ProjectApplication and authored spell updates; public audio request → resources adapter → observed host.playSound. Final sound/music playback muted; event verification only, not an audible or waveform test.'};
  }
  return{update(){for(let index=0;index<24&&!ready;index++)advance();},render(){return[];},snapshot:verify,destroy(){app.destroy();}};
}
