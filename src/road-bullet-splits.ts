import type {TouhouBullet} from '@ts-stg/thlib/touhou';
import {AttackKit} from './danmaku.js';
import type {AttackGame} from './danmaku.js';

type SplitTask=ReturnType<AttackGame['tasks']['add']>;
const pending=new WeakMap<AttackGame,Set<SplitTask>>();
const flying=(bullet:TouhouBullet)=>bullet.state===1||bullet.state===2;

/** A fired road projectile outlives its emitter. The public scene scheduler
 * advances its split before projectile movement, including after fairy death.
 * Callbacks receive their own kit rather than the rebound authoring singleton. */
export function scheduleRoadSplit(kit:AttackKit,delay:number,parents:TouhouBullet[],
  spawn:(bullet:TouhouBullet,kit:AttackKit)=>unknown,onEmit?:(count:number)=>void){
  if(!parents.some(flying))return;
  const game=kit.game,at=game.bullets.age+delay;
  const context=new AttackKit().bind({game,difficulty:kit.difficulty,rng:kit.rng,
    frame:kit.t+delay,origin:{x:kit.ox,y:kit.oy}});
  let group=pending.get(game);if(!group){group=new Set();pending.set(game,group);}
  const tasks=group;
  let handle:SplitTask;
  function* split(){
    try{
      // The emitter runs after tasks in TouhouGame.update. An absolute field
      // clock avoids starting a second delay on the task's first update.
      while(game.bullets.age<at){if(!parents.some(flying))return;yield 1;}
      const before=game.bullets.nextId;
      for(const bullet of parents)if(flying(bullet))spawn(bullet,context);
      const emitted=game.bullets.nextId-before;if(emitted)onEmit?.(emitted);
    }finally{tasks.delete(handle);}
  }
  handle=game.tasks.add(split(),null);tasks.add(handle);
}

/** Explicit road/scene teardown also cancels parents outside the clear radius. */
export function clearRoadSplits(game:AttackGame){
  const tasks=pending.get(game);if(!tasks)return;
  for(const task of tasks)game.tasks.cancel(task);
  tasks.clear();pending.delete(game);
}
