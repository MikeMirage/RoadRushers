import {MUSIC_TRACKS,MusicDirector,musicPresence} from './music-library.js';
import {drivingMix,blendLoopEdges} from './driving-audio-mix.js';
/** Sample mixer: approved Magnific music/FX plus lightweight environmental and UI layers. */
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const approach=(p,v,t,s=.07)=>p.setTargetAtTime(v,t,s);
const ROOT='./audio/magnific-v2/';
export const UI_SAMPLES={navigate:'ui-navigate',confirm:'ui-confirm-r3',back:'ui-back-r3'};
const DRIVING_LOOPS=new Set(['v8-steady','tire-scrub-r4','gravel-roll']);
const SIGNALS=new Set(['ui-confirm-r3','ui-back-r3','race-countdown-tick','race-start']);
export class EngineAudio {
  enabled=true;
  constructor(){this.options={soundEnabled:true,masterVolume:.8,musicVolume:.5,engineVolume:.8,effectsVolume:.8,ambientVolume:.6,uiVolume:.55};this.buffers=new Map();this.loops=new Map();this.music=new Map();this.musicDirector=new MusicDirector();this.lastImpact=0;this.lastLanding=0;this.lastImpactAt=-Infinity;this.lastLandingAt=-Infinity;this.hitVariant=0;this.lastUI=-Infinity;this.hidden=false;}
  setOptions(options={}){Object.assign(this.options,options);this.enabled=this.options.soundEnabled!==false;this.applyLevels();}
  setHidden(hidden){this.hidden=hidden;this.applyLevels();if(hidden)for(const track of this.music.values())track.element.pause();}
  applyLevels(){if(!this.context)return;const t=this.context.currentTime,o=this.options;approach(this.master.gain,this.enabled&&!this.hidden?clamp(o.masterVolume):0,t);for(const [bus,key] of [[this.engineBus,'engineVolume'],[this.fxBus,'effectsVolume'],[this.ambientBus,'ambientVolume'],[this.uiBus,'uiVolume']])approach(bus.gain,clamp(o[key]),t);}
  unlock(snapshot){
    if(snapshot)this.lastScene={...this.lastScene,...snapshot};
    if(!this.enabled)return false;
    if(!this.context){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
      const c=this.context=new AC();this.master=c.createGain();this.master.gain.value=0;
      const limiter=c.createDynamicsCompressor();limiter.threshold.value=-10;limiter.knee.value=8;limiter.ratio.value=5;limiter.attack.value=.004;limiter.release.value=.18;
      this.master.connect(limiter);limiter.connect(c.destination);
      for(const name of ['engineBus','fxBus','ambientBus','uiBus','musicBus']){this[name]=c.createGain();this[name].connect(this.master);}
      this.makeAtmosphere();this.applyLevels();
      for(const name of [...Object.values(UI_SAMPLES),'race-countdown-tick','race-start','v8-steady','tire-scrub-r4','gravel-roll','guardrail-a','guardrail-b'])this.load(name);
    }
    if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    for(const track of this.music.values())track.blocked=false;
    if(this.lastScene)this.updateMusic(this.lastScene);
    return true;
  }
  toggle(){this.setOptions({soundEnabled:!this.enabled});if(this.enabled)this.unlock();return this.enabled;}
  async load(name){try{const response=await fetch(`${ROOT}${name}.${SIGNALS.has(name)?'wav':'mp3'}`);if(!response.ok)return;const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(name,DRIVING_LOOPS.has(name)?blendLoopEdges(buffer,this.context):buffer);}catch{/* Keep remaining layers available if one asset fails. */}}
  makeAtmosphere(){
    const c=this.context,b=c.createBuffer(1,c.sampleRate*2,c.sampleRate),d=b.getChannelData(0);let last=0;
    for(let i=0;i<d.length;i++){last=last*.8+(Math.random()*2-1)*.2;d[i]=last;}
    const landing=c.createBuffer(1,Math.round(c.sampleRate*.20),c.sampleRate),samples=landing.getChannelData(0);let low=0;
    for(let i=0;i<samples.length;i++){const t=i/c.sampleRate;low=low*.92+(Math.random()*2-1)*.08;samples[i]=(Math.sin(t*2*Math.PI*65)*.65+low*.35)*Math.min(1,t/.006)*Math.exp(-t*28);}
    this.buffers.set('landing-thump',landing);
    const noise=c.createBufferSource();noise.buffer=b;noise.loop=true;noise.start();
    for(const [name,type,hz] of [['wind','lowpass',650],['road','bandpass',450],['rain','highpass',2000],['kerb','lowpass',170]]){const filter=c.createBiquadFilter();filter.type=type;filter.frequency.value=hz;filter.Q.value=.5;const gain=c.createGain();gain.gain.value=0;noise.connect(filter);filter.connect(gain);gain.connect(this.ambientBus);this[name]={filter,gain};}
  }
  loop(name,bus,volume,rate=1,cutoff=2200){
    let voice=this.loops.get(name);const buffer=this.buffers.get(name);
    if(!voice&&buffer){
      const c=this.context,source=c.createBufferSource(),gain=c.createGain(),high=c.createBiquadFilter(),low=c.createBiquadFilter();
      source.buffer=buffer;source.loop=true;gain.gain.value=0;high.type='highpass';high.frequency.value=name==='v8-steady'?45:100;high.Q.value=.5;low.type='lowpass';low.frequency.value=cutoff;low.Q.value=.5;
      source.connect(high);
      if(name==='tire-scrub-r4'){const harsh=c.createBiquadFilter();harsh.type='peaking';harsh.frequency.value=2700;harsh.Q.value=.8;harsh.gain.value=-10;high.connect(harsh);harsh.connect(low);}else high.connect(low);
      low.connect(gain);gain.connect(bus);source.start();voice={source,gain,low};this.loops.set(name,voice);
    }
    if(voice){const t=this.context.currentTime;approach(voice.gain.gain,volume,t,volume<voice.gain.gain.value ? .11 : .07);approach(voice.source.playbackRate,rate,t,.18);approach(voice.low.frequency,cutoff,t,.12);}
  }
  oneShot(name,volume=1,bus=this.fxBus){const buffer=this.buffers.get(name);if(!buffer)return;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=volume;source.connect(gain);gain.connect(bus);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};}
  get currentMusic(){return this.musicDirector.current;}
  setMusicScope(options={}){
    this.musicDirector.setScope(options);
    if(this.context&&this.lastScene)this.updateMusic(this.lastScene);
    return this.currentMusic;
  }
  nextMusic(options={}){
    if(!this.lastScene)return null;
    this.musicFor(this.lastScene);this.musicDirector.skip(options);
    if(this.context)this.updateMusic(this.lastScene);
    return this.currentMusic;
  }
  musicFor(s){return this.musicDirector.select(s.scene);}
  updateMusic(s){
    let target=this.musicFor(s);const c=this.context;
    const current=this.music.get(target);
    if(current&&!current.retired&&this.enabled&&!this.hidden&&this.options.musicVolume>0&&this.options.masterVolume>0&&this.musicDirector.plan?.tracks.length>1&&((Number.isFinite(current.element.duration)&&current.element.duration-current.element.currentTime<1.8)||current.element.ended))target=this.musicDirector.advance();
    if(target&&!this.music.has(target)){
      const element=new Audio(MUSIC_TRACKS[target].file);element.preload='auto';element.hidden=true;element.dataset.gameMusic=target;document.body.append(element);
      const source=c.createMediaElementSource(element),gain=c.createGain();gain.gain.value=0;source.connect(gain);gain.connect(this.musicBus);
      this.music.set(target,{element,gain,blocked:false,pending:false,retired:false});
    }
    const duck=1-clamp(Math.max((s.slip||0)*.22,(s.impact||0)*.35));
    approach(this.musicBus.gain,clamp(this.options.musicVolume)*musicPresence(s.scene)*duck,c.currentTime,.15);
    for(const [name,track] of this.music){const audible=name===target&&this.enabled&&!this.hidden&&this.options.musicVolume>0&&this.options.masterVolume>0;
      track.element.loop=this.musicDirector.plan?.tracks.length===1;
      approach(track.gain.gain,audible?1:0,c.currentTime,.45);
      if(audible&&track.retired){track.element.currentTime=0;track.retired=false;}
      if(audible&&track.element.paused&&!track.blocked&&!track.pending){track.pending=true;track.element.play().catch(()=>{track.blocked=true;}).finally(()=>{track.pending=false;});}
      if(!audible&&track.gain.gain.value<.002){if(!track.element.paused)track.element.pause();if(name!==target)track.retired=true;}
    }
  }
  ui(kind='confirm'){
    if(!this.context||!this.enabled||this.hidden||!this.options.uiVolume||!this.options.masterVolume)return;
    const c=this.context,t=c.currentTime;if(t-this.lastUI<.065&&(kind==='navigate'||kind===this.lastUIKind))return;
    // Interface samples use their own bus, independent of driving effects.
    if(UI_SAMPLES[kind]){
      const name=UI_SAMPLES[kind];if(!this.buffers.has(name))return;
      this.lastUI=t;this.lastUIKind=kind;this.oneShot(name,kind==='navigate' ? .35 : .3,this.uiBus);return;
    }
    this.lastUI=t;this.lastUIKind=kind;
    // Notifications retain a provisional cue until sample integration.
    const notes={notify:[880,1100]}[kind]||[660];
    notes.forEach((frequency,i)=>{const o=c.createOscillator(),g=c.createGain(),start=t+i*.055;o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(kind==='navigate' ? .035 : .055,start+.004);g.gain.exponentialRampToValueAtTime(.0001,start+.065);o.connect(g);g.connect(this.uiBus);o.start(start);o.stop(start+.075);o.onended=()=>{o.disconnect();g.disconnect();};});
  }
  countdown(step){
    if(!this.context||!this.enabled||this.hidden||!this.options.masterVolume||!this.options.effectsVolume)return;
    if(![0,1,2,3].includes(step))return;
    this.oneShot(step===0?'race-start':'race-countdown-tick',.65);
  }
  update(value,running){
    const s=typeof value==='object'?value:{speed:value,running};this.lastScene=s;
    if(!this.context)return;this.applyLevels();this.updateMusic(s);
    const active=this.enabled&&!this.hidden&&s.running,t=this.context.currentTime,m=drivingMix(s,active);
    this.loop('v8-steady',this.engineBus,m.engine,m.engineRate,m.engineHz);
    this.loop('tire-scrub-r4',this.fxBus,m.tire,m.tireRate,m.tireHz);
    this.loop('gravel-roll',this.fxBus,m.loose,m.looseRate,m.looseHz);
    approach(this.wind.gain.gain,m.wind,t,.2);
    approach(this.road.gain.gain,m.road,t,.12);
    approach(this.road.filter.frequency,m.roadHz,t,.2);
    approach(this.rain.gain.gain,m.rain,t,.2);
    approach(this.kerb.gain.gain,m.kerb,t,.04);
    const hit=s.impact||0,landing=s.landing||0;
    if(active&&hit>this.lastImpact+.16&&t-this.lastImpactAt>.18){this.oneShot(this.hitVariant++%2?'guardrail-b':'guardrail-a',.10+clamp(hit)*.20);this.lastImpactAt=t;}
    if(active&&landing>this.lastLanding+.15&&t-this.lastLandingAt>.22){this.oneShot('landing-thump',.12+clamp(landing)*.15);this.lastLandingAt=t;}
    this.lastImpact=hit;this.lastLanding=landing;
  }
}
