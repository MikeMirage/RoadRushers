import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingMix,SURFACE_AUDIO,blendLoopEdges} from '../src/driving-audio-mix.js';
import {EngineAudio} from '../src/audio.js';

test('asphalt squeal is absent on loose surfaces, at rest and in the air',()=>{
 const slide={speed:24,slip:1,surface:'asphalt'};
 assert.ok(drivingMix(slide).tire>0);
 for(const surface of ['gravel','dirt','mud','ice'])assert.equal(drivingMix({...slide,surface}).tire,0,surface);
 assert.equal(drivingMix({...slide,speed:0}).tire,0);
 assert.equal(drivingMix({...slide,grounded:false}).tire,0);
 assert.equal(drivingMix({...slide,slip:.15}).tire,0);
 assert.ok(drivingMix({...slide,wetness:.8}).tire<drivingMix(slide).tire);
 assert.ok(drivingMix({...slide,slip:.2}).tire<.002);
});

test('surface textures are distinct, dirt is quieter and darker than gravel',()=>{
 const s={speed:24,slip:.5};
 const gravel=drivingMix({...s,surface:'gravel'}),dirt=drivingMix({...s,surface:'dirt'});
 assert.ok(dirt.loose<gravel.loose);assert.ok(dirt.looseHz<gravel.looseHz);assert.ok(dirt.looseRate<gravel.looseRate);
 assert.equal(drivingMix({...s,surface:'mud'}).loose,0);
 assert.ok(drivingMix({...s,surface:'ice'}).road<drivingMix({...s,surface:'mud'}).road);
 for(const surface of Object.keys(SURFACE_AUDIO)){
  const parked=drivingMix({...s,surface,speed:0});for(const key of ['tire','loose','road','wind','kerb'])assert.equal(parked[key],0);
  const air=drivingMix({...s,surface,grounded:false,kerb:true});for(const key of ['tire','loose','road','kerb'])assert.equal(air[key],0);
 }
});

test('driving mix stays bounded and braking unloads the engine without muting it',()=>{
 const s={speed:31,slip:1,surface:'asphalt',throttle:1};
 const load=drivingMix(s),brake=drivingMix({...s,braking:true});
 assert.ok(load.engine>brake.engine);assert.ok(brake.engine>0);assert.ok(load.engineHz>brake.engineHz);
 assert.ok(load.tire<=.14);assert.ok(load.engine<.26);
 for(const [key,value] of Object.entries(drivingMix({...s,speed:NaN,slip:Infinity})))assert.ok(Number.isFinite(value),key);
 const stopped=drivingMix({...s,kerb:true,weather:'rain'},false);for(const key of ['engine','tire','loose','road','wind','rain','kerb'])assert.equal(stopped[key],0,key);
});

test('loop overlap smooths the boundary and leaves the original buffer intact',()=>{
 const channels=[Float32Array.from({length:1000},(_,i)=>i/1000),Float32Array.from({length:1000},(_,i)=>-i/1000)];
 const original={length:1000,sampleRate:1000,numberOfChannels:2,getChannelData:c=>channels[c]};
 const context={createBuffer(n,length,rate){const data=Array.from({length:n},()=>new Float32Array(length));return {length,sampleRate:rate,getChannelData:c=>data[c]};}};
 const loop=blendLoopEdges(original,context,.035);assert.equal(loop.length,965);
 for(let c=0;c<2;c++){const data=loop.getChannelData(c);assert.ok(Math.abs(data[0]-data.at(-1))<.002);assert.equal(data[34],channels[c][34]);assert.equal(data[200],channels[c][200]);}
 assert.equal(channels[0][0],0);assert.equal(channels[0].length,1000);
});

test('tire voice cuts harsh frequencies and smooths surface transitions',()=>{
 const filters=[],audio=new EngineAudio(),param=()=>({value:0,setTargetAtTime(v){this.value=v;}}),node=()=>({connect(){}});
 audio.context={currentTime:1,createBufferSource(){return {...node(),playbackRate:param(),start(){}};},createGain(){return {...node(),gain:param()};},createBiquadFilter(){const filter={...node(),frequency:param(),Q:param(),gain:param()};filters.push(filter);return filter;}};
 audio.buffers.set('tire-scrub-r4',{});audio.loop('tire-scrub-r4',{},.14,.96,1600);
 assert.ok(filters.some(f=>f.type==='peaking'&&f.frequency.value===2700&&f.gain.value===-10));
 assert.ok(filters.some(f=>f.type==='highpass'&&f.frequency.value===100));
 assert.equal(audio.loops.get('tire-scrub-r4').low.frequency.value,1600);
 audio.loop('tire-scrub-r4',{},0,.96,1250);assert.equal(audio.loops.get('tire-scrub-r4').gain.gain.value,0);assert.equal(filters.length,3);
});
