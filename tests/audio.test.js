import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {EngineAudio,UI_SAMPLES} from '../src/audio.js';
import {AUDIO_LEVELS,renderAudioSettings} from '../src/audio-settings-ui.js';
import {DEFAULT_PREFERENCES,normalizePreferences,loadPreferences,savePreferences,PREFERENCES_KEY} from '../src/preferences.js';

test('existing saves gain enabled audio and channel levels persist independently',()=>{
 let saved=JSON.stringify({version:3,options:{touchMode:'trackpad'}});
 const storage={getItem:()=>saved,setItem:(key,value)=>{assert.equal(key,PREFERENCES_KEY);saved=value;}};
 const migrated=loadPreferences(storage);assert.equal(migrated.soundEnabled,true);assert.equal(migrated.musicVolume,.5);
 const options=normalizePreferences({...migrated,soundEnabled:false,musicVolume:.17,engineVolume:5,uiVolume:-2,ambientVolume:NaN});
 assert.equal(options.engineVolume,1);assert.equal(options.uiVolume,0);assert.equal(options.ambientVolume,.6);
 savePreferences(storage,options);assert.deepEqual(loadPreferences(storage),options);
});

test('both settings surfaces expose independently labelled channel controls',()=>{
 for(const prefix of ['pause-audio','audio']){
  const html=renderAudioSettings(DEFAULT_PREFERENCES,prefix);
  for(const [key] of AUDIO_LEVELS){assert.ok(html.includes(`id="${prefix}-${key}"`));assert.ok(html.includes(`for="${prefix}-${key}"`));}
  assert.ok(html.includes('aria-pressed="true"'));
 }
});

const parameter=()=>({value:0,setTargetAtTime(value){this.value=value;}});
const bus=()=>({gain:parameter()});
test('mute and background visibility override the master without changing channel preferences',()=>{
 const audio=new EngineAudio();assert.equal(audio.enabled,true);assert.equal(audio.context,undefined);
 audio.context={currentTime:1};for(const key of ['master','engineBus','fxBus','ambientBus','uiBus'])audio[key]=bus();
 audio.setOptions({masterVolume:.7,engineVolume:.9,effectsVolume:.3});assert.equal(audio.master.gain.value,.7);assert.equal(audio.engineBus.gain.value,.9);assert.equal(audio.fxBus.gain.value,.3);
 let pauses=0;audio.music.set('menu',{element:{pause(){pauses++;}}});
 audio.setHidden(true);assert.equal(audio.master.gain.value,0);assert.equal(pauses,1);
 audio.setHidden(false);assert.equal(audio.master.gain.value,.7);
 audio.setOptions({soundEnabled:false});assert.equal(audio.master.gain.value,0);assert.equal(audio.options.engineVolume,.9);
 audio.setOptions({soundEnabled:true});assert.equal(audio.master.gain.value,.7);
 const muted=new EngineAudio();muted.setOptions({soundEnabled:false});assert.equal(muted.unlock(),false);assert.equal(muted.context,undefined);
});

test('runtime only selects locally available approved music and FX',()=>{
 const audio=new EngineAudio(),sources=JSON.parse(readFileSync(new URL('../public/audio/magnific-v2/sources.json',import.meta.url)));
 const selected=new Set(['ui-navigate','ui-confirm','v8-steady','gravel-roll','guardrail-a','guardrail-b']);
 for(const screen of ['hub','garage','race','results'])selected.add(audio.musicFor({scene:{screen}}));
 assert.equal(audio.musicFor({scene:{screen:'loading'}}),null);
 for(const id of selected){const source=sources.find(x=>x.id===id);assert.equal(source?.reviewStatus,'approved',id);assert.ok(existsSync(new URL(`../public${source.file}`,import.meta.url)),id);}
 assert.ok(!selected.has('coastal-velocity'));assert.equal(sources.find(x=>x.id==='coastal-velocity-r2').reviewStatus,'pending');
});


test('approved UI samples use the interface bus, suppress repeats and respect mute',()=>{
 const voices=[];let disconnected=0;
 const audio=new EngineAudio();audio.uiBus={name:'interface'};audio.fxBus={name:'driving'};
 audio.context={currentTime:1,
  createBufferSource(){const voice={connect(node){this.gain=node;},start(){voices.push(this);},disconnect(){disconnected++;}};return voice;},
  createGain(){return {gain:{value:0},connect(node){this.bus=node;},disconnect(){disconnected++;}};},
  createOscillator(){throw new Error('Approved UI must not use synthetic tones');}
 };
 const navigate={},confirm={};audio.buffers.set('ui-navigate',navigate);audio.buffers.set(UI_SAMPLES.confirm,confirm);
 audio.ui('navigate');assert.equal(voices.length,1);assert.equal(voices[0].buffer,navigate);assert.equal(voices[0].gain.bus,audio.uiBus);
 audio.ui('navigate');assert.equal(voices.length,1);
 audio.ui('confirm');assert.equal(voices.length,2);assert.equal(voices[1].buffer,confirm);assert.equal(voices[1].gain.bus,audio.uiBus);
 audio.context.currentTime=2;audio.options.uiVolume=0;audio.ui('confirm');assert.equal(voices.length,2);
 audio.options.uiVolume=.5;audio.options.masterVolume=0;audio.ui('confirm');assert.equal(voices.length,2);
 audio.options.masterVolume=.8;audio.hidden=true;audio.ui('confirm');assert.equal(voices.length,2);
 audio.hidden=false;audio.enabled=false;audio.ui('confirm');assert.equal(voices.length,2);
 voices[0].onended();assert.equal(disconnected,2);
});

test('UI samples still loading do not produce a substitute tone or throttle the next cue',()=>{
 const audio=new EngineAudio();audio.context={currentTime:1,createOscillator(){throw Error('Unexpected substitute');}};
 audio.ui('navigate');assert.equal(audio.lastUI,-Infinity);
});


test('countdown produces three matching horn pulses and a distinct start through effects',()=>{
 const audio=new EngineAudio(),events=[];audio.context={};audio.oneShot=(...args)=>events.push(args);
 for(const step of [3,2,1,0])audio.countdown(step);
 assert.deepEqual(events.map(x=>x[0]),['race-countdown-tick','race-countdown-tick','race-countdown-tick','race-start']);
 audio.options.effectsVolume=0;audio.countdown(3);assert.equal(events.length,4);
 audio.options.effectsVolume=.8;audio.hidden=true;audio.countdown(0);assert.equal(events.length,4);
 audio.hidden=false;audio.enabled=false;audio.countdown(0);assert.equal(events.length,4);
 audio.enabled=true;audio.countdown(-1);assert.equal(events.length,4);
});

test('accept is one octave above cancel and all digital cues have bounded short duration',()=>{
 const read=name=>{const wav=readFileSync(new URL(`../public/audio/magnific-v2/${name}.wav`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),44100);return Array.from({length:(wav.length-44)/2},(_,i)=>wav.readInt16LE(44+i*2));};
 const pitch=samples=>{let crossings=0;for(let i=1;i<samples.length;i++)if(samples[i-1]<=0&&samples[i]>0)crossings++;return crossings/(samples.length/44100);};
 const accept=read(UI_SAMPLES.confirm),cancel=read(UI_SAMPLES.back),tick=read('race-countdown-tick'),go=read('race-start');
 assert.equal(accept.length,4410);assert.equal(cancel.length,4410);assert.ok(Math.abs(pitch(accept)/pitch(cancel)-2)<.03);
 assert.equal(tick.length/44100,.22);assert.equal(go.length/44100,.42);assert.ok(Math.abs(pitch(go)/pitch(tick)-2)<.03);
 for(const samples of [accept,cancel,tick,go]){assert.ok(Math.max(...samples)<32767);assert.equal(samples[0],0);assert.ok(Math.abs(samples.at(-1))<100);}
});
