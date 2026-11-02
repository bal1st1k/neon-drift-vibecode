'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),progress=require('../progress.js'),radio=require('../radio.js');
function fixture(){
 const media=[],events=new Map(),timers=new Map();let timerId=0,nextPlay=null;
 class Media{
  constructor(){this.listeners=new Map();this.volume=1;this.src='';this.paused=false;media.push(this);}
  addEventListener(name,fn){this.listeners.set(name,fn);}removeEventListener(name){this.listeners.delete(name);}
  play(){this.paused=false;const value=nextPlay;nextPlay=null;return value||Promise.resolve();}
  pause(){this.paused=true;}removeAttribute(name){if(name==='src')this.src='';}load(){this.unloaded=true;}
  emit(name){this.listeners.get(name)?.();}
 }
 const sandbox={Audio:Media,navigator:{onLine:true},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync('radio.js','utf8'),sandbox);const states=[],player=new sandbox.NDRadio.RadioPlayer({onState:s=>states.push(s.phase)});
 return {player,media,states,sandbox,events,timers,nextPlay:value=>nextPlay=value};
}
(async()=>{
 assert.equal(radio.stations.length,2);for(const s of radio.stations){assert.match(s.url,/^https:\/\//);assert.match(s.website,/^https:\/\//);}assert.equal(new Set(radio.stations.map(s=>s.id)).size,2);
 {
  const {player:p,media,states,timers,events}=fixture();p.configure();assert.equal(media.length,0);p.configure({enabled:true});assert.equal(p.phase,'gesture');assert.equal(media.length,0);p.unlock();assert.equal(media.length,1);assert.equal(p.phase,'connecting');assert.equal(media[0].volume,.65*.42);assert.equal(media[0].preload,'none');media[0].emit('playing');assert.equal(p.phase,'playing');assert.equal(timers.size,0);
  p.configure({enabled:true,volume:.2,masterVolume:.5});assert.equal(media.length,1);assert.equal(media[0].volume,.1);
  const old=media[0],stale=old.listeners.get('error');p.configure({enabled:true,stationId:'initial-d'});assert.equal(media.length,2);assert.equal(old.src,'');assert.equal(old.paused,true);assert.ok(old.unloaded);assert.equal(old.listeners.size,0);stale();assert.equal(p.phase,'connecting');media[1].emit('playing');assert.equal(p.phase,'playing');
  p.configure({enabled:true,sound:false,stationId:'initial-d'});assert.equal(p.phase,'muted');assert.equal(p.media,null);assert.equal(media[1].src,'');p.configure({enabled:true,stationId:'initial-d'});assert.equal(media.length,3);
  p.configure({enabled:false});assert.equal(p.phase,'off');assert.equal(p.media,null);assert.equal(timers.size,0);p.unlock();assert.equal(media.length,3);p.destroy();assert.equal(events.size,0);assert.ok(states.includes('playing'));
 }
 console.log('PASS radio is network-silent by default and before a gesture, volume changes reuse playback, station switches stop old streams, mute/off release connections');
 {
  const f=fixture(),p=f.player;f.sandbox.navigator.onLine=false;p.configure({enabled:true});p.unlock();assert.equal(p.phase,'offline');assert.equal(f.media.length,0);f.sandbox.navigator.onLine=true;f.events.get('online')();assert.equal(f.media.length,1);f.media[0].emit('playing');f.sandbox.navigator.onLine=false;f.events.get('offline')();assert.equal(p.phase,'offline');assert.equal(p.media,null);f.sandbox.navigator.onLine=true;f.events.get('online')();assert.equal(f.media.length,2);
  p.suspend();assert.equal(p.media,null);p.resume();assert.equal(f.media.length,3);p.destroy();p.resume();assert.equal(f.media.length,3);assert.equal(f.timers.size,0);
 }
 console.log('PASS offline/online recovery, page suspension and resource cleanup remain bounded');
 {
  const f=fixture(),p=f.player;p.configure({enabled:true});p.unlock();const first=f.media[0];first.emit('waiting');assert.equal(p.phase,'buffering');assert.equal(f.timers.size,1);[...f.timers.values()][0]();assert.equal(p.phase,'error');assert.equal(p.media,null);assert.equal(f.timers.size,0);p.unlock();p.configure({enabled:true,volume:.4});assert.equal(f.media.length,1);p.retry();assert.equal(f.media.length,2);f.media[1].emit('error');assert.equal(p.phase,'error');p.destroy();
 }
 {
  const f=fixture(),p=f.player;f.nextPlay(Promise.reject(Object.assign(new Error('gesture'),{name:'NotAllowedError'})));p.configure({enabled:true});p.unlock();await new Promise(setImmediate);assert.equal(p.phase,'gesture');assert.equal(p.media,null);p.unlock();assert.equal(f.media.length,2);p.destroy();
 }
 {
  const f=fixture(),p=f.player;let reject;f.nextPlay(new Promise((resolve,fail)=>reject=fail));p.configure({enabled:true});p.unlock();p.configure({enabled:true,stationId:'initial-d'});f.media[1].emit('playing');reject(new Error('old station failed'));await new Promise(setImmediate);assert.equal(p.phase,'playing');p.destroy();
 }
 console.log('PASS buffering timeout, explicit retries, autoplay refusal and obsolete play rejections do not leave phantom streams or unhandled promises');
 {
  const s=progress.defaults();assert.equal(s.settings.radio,false);assert.equal(s.settings.radioStation,'eurobeat');assert.equal(s.settings.radioVolume,.65);s.settings={...s.settings,radio:true,music:true,radioStation:'initial-d',radioVolume:.3};const clean=progress.sanitize(JSON.parse(JSON.stringify(s)));assert.equal(clean.settings.radio,true);assert.equal(clean.settings.music,false);assert.equal(clean.settings.radioStation,'initial-d');assert.equal(clean.settings.radioVolume,.3);
  s.settings.radioStation='https://evil.invalid/';s.settings.radioVolume=Infinity;assert.equal(progress.sanitize(s).settings.radioStation,'eurobeat');assert.equal(progress.sanitize(s).settings.radioVolume,.65);delete s.settings.radio;delete s.settings.radioStation;delete s.settings.radioVolume;assert.equal(progress.sanitize(s).settings.radio,false);
 }
 console.log('PASS radio preferences survive reload, station IDs and volumes are validated, legacy saves stay offline and local music is mutually exclusive');
})().catch(error=>{console.error(error);process.exitCode=1;});
