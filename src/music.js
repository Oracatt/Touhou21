import {TouhouMusicFade} from '@ts-stg/thlib/touhou';
import {MUSIC_TRACKS} from './music-data.js';

export class MusicController {
  constructor(host,settings){this.host=host;this.settings=settings;this.handles=new Map();this.current=null;this.paused=false;this.fade=null;this.interruption=null;}
  /** A new explicit track also abandons any pending temporary-screen restore. */
  play(trackId,restart=true){if(!MUSIC_TRACKS.some(value=>value.id===trackId))throw new Error(`Unknown music ${trackId}`);
    if(this.current?.id===trackId&&!restart)return;this.interruption=null;this.start(trackId);}
  start(trackId,time=0){const track=MUSIC_TRACKS.find(value=>value.id===trackId);this.fade?.destroy();this.fade=null;
    if(this.current)this.host.stopMusic(this.current.handle);
    if(!this.handles.has(trackId)){const handle=this.host.loadMusic(track.file);this.host.setMusicLoop(handle,track.loopStartFrame/track.sampleRate,track.loopEndFrame/track.sampleRate);this.handles.set(trackId,handle);}
    const handle=this.handles.get(trackId);this.current={id:trackId,handle};this.host.seekMusic(handle,time);this.host.playMusic(handle,this.settings.musicVolume/100);this.paused=false;
  }
  /** thlib game-over contract: play a temporary track, then either restore
   * the interrupted one at its saved position or discard it. */
  interrupt(trackId){if(!MUSIC_TRACKS.some(value=>value.id===trackId))throw new Error(`Unknown music ${trackId}`);
    const saved=this.interruption?.saved??{id:this.current?.id??null,time:this.current?this.host.getMusicTime?.(this.current.handle)??0:0,paused:this.paused};
    this.start(trackId);const session={saved};this.interruption=session;
    return{
      restore:()=>{if(this.interruption!==session)return;this.interruption=null;
        if(saved.id===null){this.stop();return;}this.start(saved.id,saved.time);if(saved.paused)this.pause();},
      discard:()=>{if(this.interruption!==session)return;this.interruption=null;this.stop();},
    };
  }
  stop(){this.fade?.destroy();this.fade=null;if(this.current)this.host.stopMusic(this.current.handle);this.current=null;this.paused=false;}
  fadeOut(seconds=2){if(!this.current)return;const handle=this.current.handle;this.fade?.destroy();this.fade=new TouhouMusicFade({seconds,volume:this.settings.musicVolume,setVolume:volume=>this.host.setMusicVolume(handle,volume),stop:()=>this.host.stopMusic(handle)});}
  update(){if(!this.paused)this.fade?.update();}
  volume(){if(!this.current)return;if(this.fade?.alive)this.fade.setVolume(this.settings.musicVolume);else this.host.setMusicVolume(this.current.handle,this.settings.musicVolume/100);}
  pause(){if(this.paused)return;this.paused=true;if(this.current)this.host.pauseMusic(this.current.handle);}
  resume(){if(!this.paused)return;this.paused=false;if(this.current)this.host.resumeMusic(this.current.handle);}
  destroy(){this.fade?.destroy();for(const handle of this.handles.values())this.host.unloadMusic(handle);this.handles.clear();this.current=null;this.interruption=null;}
}
