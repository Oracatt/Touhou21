import {TouhouMusicFade} from '@ts-stg/thlib/touhou';
import {MUSIC_TRACKS} from './music-data.js';

export class MusicController {
  constructor(host,settings){this.host=host;this.settings=settings;this.handles=new Map();this.current=null;this.paused=false;this.fade=null;}
  play(trackId,restart=true){const track=MUSIC_TRACKS.find(value=>value.id===trackId);if(!track)throw new Error(`Unknown music ${trackId}`);
    if(this.current?.id===trackId&&!restart)return;this.fade?.destroy();this.fade=null;
    if(this.current)this.host.stopMusic(this.current.handle);
    if(!this.handles.has(trackId)){const handle=this.host.loadMusic(track.file);this.host.setMusicLoop(handle,track.loopStartFrame/track.sampleRate,track.loopEndFrame/track.sampleRate);this.handles.set(trackId,handle);}
    const handle=this.handles.get(trackId);this.current={id:trackId,handle};this.host.seekMusic(handle,0);this.host.playMusic(handle,this.settings.musicVolume/100);this.paused=false;
  }
  fadeOut(seconds=2){if(!this.current)return;const handle=this.current.handle;this.fade?.destroy();this.fade=new TouhouMusicFade({seconds,volume:this.settings.musicVolume,setVolume:volume=>this.host.setMusicVolume(handle,volume),stop:()=>this.host.stopMusic(handle)});}
  update(){if(!this.paused)this.fade?.update();}
  volume(){if(!this.current)return;if(this.fade?.alive)this.fade.setVolume(this.settings.musicVolume);else this.host.setMusicVolume(this.current.handle,this.settings.musicVolume/100);}
  pause(){if(this.paused)return;this.paused=true;if(this.current)this.host.pauseMusic(this.current.handle);}
  resume(){if(!this.paused)return;this.paused=false;if(this.current)this.host.resumeMusic(this.current.handle);}
  destroy(){this.fade?.destroy();for(const handle of this.handles.values())this.host.unloadMusic(handle);this.handles.clear();this.current=null;}
}
