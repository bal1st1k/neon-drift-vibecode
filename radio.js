/*! NEON DRIFT | Made by bal1st1k */
/* Optional live radio. The offline game makes no radio requests until enabled by a gesture. */
(function(root){
  'use strict';
  const stations=Object.freeze([
    Object.freeze({id:'eurobeat',name:'Eurobeat · laut.fm',genre:'Super Eurobeat / 90s / музыка для тоге',url:'https://eurobeat.stream.laut.fm/eurobeat',website:'https://laut.fm/eurobeat'}),
    Object.freeze({id:'initial-d',name:'Initial D · Zeno',genre:'Евробит из Initial D',url:'https://stream.zeno.fm/u8r9xbvr5f0uv',website:'https://zeno.fm/radio/initial-d/'})
  ]);
  const stationById=id=>stations.find(station=>station.id===id)||stations[0];
  const bounded=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
  class RadioPlayer{
    constructor({onState=()=>{}}={}){
      this.onState=onState;this.enabled=false;this.sound=true;this.station=stations[0];this.volume=.65;this.masterVolume=.42;
      this.unlocked=false;this.suspended=false;this.destroyed=false;this.media=null;this.phase='off';this.generation=0;this.timeout=null;this.listeners=[];
      this.online=()=>{if(this.enabled&&this.sound&&this.unlocked&&!this.suspended)this._connect();};
      this.offline=()=>{if(this.enabled&&this.sound){this._release();this._state('offline');}};
      root.addEventListener?.('online',this.online);root.addEventListener?.('offline',this.offline);
    }
    _state(phase){this.phase=phase;this.onState({phase,station:this.station,enabled:this.enabled});}
    _clearTimeout(){if(this.timeout!==null){root.clearTimeout(this.timeout);this.timeout=null;}}
    _release(){
      this.generation++;this._clearTimeout();
      if(this.media){for(const [name,handler] of this.listeners)this.media.removeEventListener(name,handler);this.media.pause();this.media.removeAttribute('src');this.media.load();}
      this.listeners=[];this.media=null;
    }
    configure({enabled=false,sound=true,stationId='eurobeat',volume=.65,masterVolume=.42}={}){
      if(this.destroyed)return;
      const station=stationById(stationId),changed=this.enabled!==!!enabled||this.sound!==!!sound||this.station.id!==station.id;
      this.enabled=!!enabled;this.sound=!!sound;this.station=station;this.volume=bounded(volume,.65);this.masterVolume=bounded(masterVolume,.42);
      if(this.media)this.media.volume=this.volume*this.masterVolume;
      if(!this.enabled||!this.sound||this.suspended){
        if(this.media)this._release();this._state(!this.enabled?'off':!this.sound?'muted':'paused');return;
      }
      if(!this.unlocked){this._state('gesture');return;}
      if(changed||this.phase==='off'||this.phase==='muted'||this.phase==='paused')this._connect();
    }
    unlock(){
      if(this.destroyed)return;
      this.unlocked=true;
      if(this.enabled&&this.sound&&!this.suspended&&this.phase==='gesture')this._connect();
    }
    retry(){if(this.destroyed)return;this.unlocked=true;if(this.enabled&&this.sound&&!this.suspended)this._connect();}
    _connect(){
      if(this.destroyed||!this.enabled||!this.sound||!this.unlocked||this.suspended)return;
      this._release();
      if(root.navigator?.onLine===false){this._state('offline');return;}
      if(typeof root.Audio!=='function'){this._state('unsupported');return;}
      const generation=this.generation;
      const fail=phase=>{if(generation!==this.generation)return;this._release();this._state(phase);};
      const armTimeout=()=>{this._clearTimeout();this.timeout=root.setTimeout(()=>fail('error'),20000);};
      try{
        const media=new root.Audio();this.media=media;media.preload='none';media.volume=this.volume*this.masterVolume;
        const listen=(name,handler)=>{const guarded=()=>{if(generation===this.generation)handler();};media.addEventListener(name,guarded);this.listeners.push([name,guarded]);};
        listen('playing',()=>{this._clearTimeout();this._state('playing');});
        listen('waiting',()=>{this._state('buffering');armTimeout();});listen('stalled',()=>{this._state('buffering');armTimeout();});
        listen('error',()=>fail('error'));listen('ended',()=>fail('error'));
        media.src=this.station.url;this._state('connecting');armTimeout();
        Promise.resolve(media.play()).catch(error=>{if(generation!==this.generation)return;if(error?.name==='NotAllowedError'){this.unlocked=false;fail('gesture');}else fail('error');});
      }catch(_){fail('error');}
    }
    suspend(){if(this.destroyed)return;this.suspended=true;this._release();this._state(this.enabled?'paused':'off');}
    resume(){if(this.destroyed)return;this.suspended=false;if(this.enabled&&this.sound&&this.unlocked)this._connect();}
    destroy(){if(this.destroyed)return;this.destroyed=true;this._release();root.removeEventListener?.('online',this.online);root.removeEventListener?.('offline',this.offline);}
  }
  const api={stations,stationById,RadioPlayer};root.NDRadio=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
