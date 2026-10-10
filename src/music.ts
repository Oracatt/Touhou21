import type {NativeHost} from '@ts-stg/thlib';

import type {Settings} from './storage.js';

import {TouhouMusicFade} from '@ts-stg/thlib/touhou';
import {MUSIC_TRACKS} from './music-data.js';

interface PendingTrack{id:string;remainingFrames:number;onStart:(()=>void)|null;}
interface SavedTrack{id:string|null;time:number;paused:boolean;pending:PendingTrack|null;}
export class MusicController {
 declare host:NativeHost;declare settings:Settings;declare handles:Map<string,number>;declare current:{id:string;handle:number}|null;declare paused:boolean;declare fade:TouhouMusicFade|null;declare pending:PendingTrack|null;declare interruption:{saved:SavedTrack}|null;
  constructor(host:NativeHost,settings:Settings){this.host=host;this.settings=settings;this.handles=new Map();this.current=null;this.paused=false;this.fade=null;this.interruption=null;this.pending=null;}
  /** A new explicit track also abandons any pending temporary-screen restore. */
  play(trackId:string,restart=true,{silenceFrames=0,onStart=null}:{silenceFrames?:number;onStart?:(()=>void)|null}={}){if(!MUSIC_TRACKS.some(value=>value.id===trackId))throw new Error(`Unknown music ${trackId}`);
    if(!Number.isSafeInteger(silenceFrames)||silenceFrames<0)throw new RangeError('Music silence must be nonnegative integer frames');
    if(onStart!==null&&typeof onStart!=='function')throw new TypeError('Music onStart must be a function');
    if(!restart&&(this.current?.id===trackId||this.pending?.id===trackId))return;this.interruption=null;
    if(silenceFrames){this.stop();this.pending={id:trackId,remainingFrames:silenceFrames,onStart};return;}
    this.start(trackId);onStart?.();}
  start(trackId:string,time=0){const track=MUSIC_TRACKS.find(value=>value.id===trackId)!;this.pending=null;this.fade?.destroy();this.fade=null;
    if(this.current)this.host.stopMusic(this.current.handle);
    if(!this.handles.has(trackId)){const handle=this.host.loadMusic(track.file);this.host.setMusicLoop(handle,track.loopStartFrame/track.sampleRate,track.loopEndFrame/track.sampleRate);this.handles.set(trackId,handle);}
    const handle=this.handles.get(trackId)!;this.current={id:trackId,handle};this.host.seekMusic(handle,time);this.host.playMusic(handle,this.settings.musicVolume/100);this.paused=false;
  }
  /** thlib game-over contract: play a temporary track, then either restore
   * the interrupted one at its saved position or discard it. */
  interrupt(trackId:string){if(!MUSIC_TRACKS.some(value=>value.id===trackId))throw new Error(`Unknown music ${trackId}`);
    const saved=this.interruption?.saved??{id:this.current?.id??null,time:this.current?this.host.getMusicTime?.(this.current.handle)??0:0,paused:this.paused,
      pending:this.pending?{...this.pending}:null};
    this.start(trackId);const session={saved};this.interruption=session;
    return{
      restore:()=>{if(this.interruption!==session)return;this.interruption=null;
        if(saved.pending){this.stop();this.pending=saved.pending;this.paused=saved.paused;return;}
        if(saved.id===null){this.stop();return;}this.start(saved.id,saved.time);if(saved.paused)this.pause();},
      discard:()=>{if(this.interruption!==session)return;this.interruption=null;this.stop();},
    };
  }
  stop(){this.pending=null;this.interruption=null;this.fade?.destroy();this.fade=null;if(this.current)this.host.stopMusic(this.current.handle);this.current=null;this.paused=false;}
  fadeOut(seconds=2){this.pending=null;if(!this.current)return;const handle=this.current.handle;this.fade?.destroy();this.fade=new TouhouMusicFade({seconds,volume:this.settings.musicVolume,setVolume:volume=>this.host.setMusicVolume(handle,volume),stop:()=>this.host.stopMusic(handle)});}
  update(){if(this.paused)return;
    if(this.pending){if(--this.pending.remainingFrames<=0){const next=this.pending;this.start(next.id);next.onStart?.();}return;}
    this.fade?.update();}
  volume(){if(!this.current)return;if(this.fade?.alive)this.fade.setVolume(this.settings.musicVolume);else this.host.setMusicVolume(this.current.handle,this.settings.musicVolume/100);}
  pause(){if(this.paused)return;this.paused=true;if(this.current)this.host.pauseMusic(this.current.handle);}
  resume(){if(!this.paused)return;this.paused=false;if(this.current)this.host.resumeMusic(this.current.handle);}
  destroy(){this.pending=null;this.fade?.destroy();for(const handle of this.handles.values())this.host.unloadMusic(handle);this.handles.clear();this.current=null;this.interruption=null;}
}
