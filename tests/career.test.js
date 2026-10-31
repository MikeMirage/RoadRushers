import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, VEHICLES, CHAMPIONSHIP } from '../src/config.js';
import { Career, CAREER_KEY, medalFor } from '../src/career.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel, LapTracker } from '../src/physics.js';
import { buildVehicle, preloadVehicles, setBrakeLights } from '../src/vehicles.js';
import { Box3, Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readFile } from 'node:fs/promises';

const memory = () => { const values=new Map();return { getItem:k=>values.get(k)||null, setItem:(k,v)=>values.set(k,v) }; };
const context = event => ({ mode:'career', track:TRACKS.find(t=>t.id===event.track), vehicle:VEHICLES.find(v=>v.id===event.vehicle), surface:'track', weather:event.weather, pace:'normal' });
const events=CHAMPIONSHIP.events;
const complete = (career,index,level='bronze') => { const e=events[index],s=context(e);return career.record(e.id,s.track.medals[level],s); };

test('new careers start with exactly one car and one official event',()=>{
  const career=new Career(memory());
  assert.deepEqual(career.unlocked,['coda']);assert.equal(career.points,0);assert.equal(career.cupMedal,0);
  assert.equal(career.eventAvailable(events[0].id),true);assert.equal(career.eventAvailable(events[1].id),false);
});

test('medals respect the displayed target boundaries and reject invalid times',()=>{
  const t=TRACKS[0];
  assert.equal(medalFor(t.medals.gold,t),3);assert.equal(medalFor(t.medals.silver,t),2);assert.equal(medalFor(t.medals.bronze,t),1);
  assert.equal(medalFor(t.medals.bronze+.02,t),0);assert.equal(medalFor(t.medals.gold+1e-10,t),3);
  for(const value of [0,-1,null,NaN,Infinity])assert.equal(medalFor(value,t),0);
});

test('first bronze unlocks the rally car and next stage, and all bronzes unlock the GT',()=>{
  const career=new Career(memory());
  assert.deepEqual(complete(career,0).newVehicles.map(v=>v.id),['apex']);
  assert.equal(career.eventAvailable(events[1].id),true);assert.equal(career.eventAvailable(events[2].id),false);
  complete(career,1);const award=complete(career,2);
  assert.deepEqual(award.newVehicles.map(v=>v.id),['velo']);assert.equal(career.completed,3);assert.equal(career.points,3);assert.equal(career.cupMedal,1);
});

test('replays improve medals and cup rank permanently without repeated car grants',()=>{
  const career=new Career(memory());for(let i=0;i<3;i++)complete(career,i);
  complete(career,0,'gold');complete(career,1,'gold');complete(career,2,'silver');assert.equal(career.cupMedal,3);assert.equal(career.points,8);
  const award=complete(career,0);assert.deepEqual(award.newVehicles,[]);assert.equal(career.medal(events[0].id),3);assert.equal(career.cupMedal,3);
});

test('missing a medal leaves the event replayable and later events locked',()=>{
  const career=new Career(memory()),e=events[0],s=context(e);
  assert.equal(career.record(e.id,s.track.medals.bronze+10,s).medal,0);
  assert.deepEqual(career.unlocked,['coda']);assert.equal(career.nextEvent().id,e.id);assert.equal(career.eventAvailable(events[1].id),false);
});

test('training, wrong cars, altered conditions and locked events cannot earn championship rewards',()=>{
  const career=new Career(memory()),e=events[0],s=context(e);
  for(const change of [{mode:'practice'},{vehicle:VEHICLES[1]},{surface:'ice'},{weather:'rain'},{pace:'fast'},{track:TRACKS[2]}])assert.throws(()=>career.record(e.id,40,{...s,...change}));
  assert.throws(()=>complete(career,1));for(const value of [0,1,-10,NaN,Infinity])assert.throws(()=>career.record(e.id,value,s));
  assert.equal(career.points,0);assert.deepEqual(career.unlocked,['coda']);
});

test('saved progress survives reload, while corrupt and out-of-order data are ignored',()=>{
  const store=memory(),career=new Career(store);complete(career,0);complete(career,1,'silver');
  const restored=new Career(store);assert.equal(restored.points,3);assert.deepEqual(restored.unlocked,['coda','apex']);
  store.setItem(CAREER_KEY,JSON.stringify({version:1,results:{[events[2].id]:40},unlocked:['velo']}));assert.deepEqual(new Career(store).unlocked,['coda']);
  store.setItem(CAREER_KEY,'invalid JSON');assert.equal(new Career(store).completed,0);
});

test('unavailable storage keeps progression playable in memory',()=>{
  const career=new Career({getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}});
  complete(career,0);assert.ok(career.unlocked.includes('apex'));assert.equal(career.saveAvailable,false);
});

function driveLap(track,vehicle,weather,surface='track') {
  const circuit=new Circuit(track), car=new DriveModel(circuit,vehicle), laps=new LapTracker();
  for(let i=0;i<120*150;i++) {
    const target=circuit.at(car.road.progress+.024),angle=Math.atan2(target.x-car.x,target.z-car.z);
    const delta=Math.atan2(Math.sin(angle-car.heading),Math.cos(angle-car.heading));
    car.step(1/120,delta>.035?-1:delta<-.035?1:0,surface,weather);
    const lap=laps.step(1/120,car.road.progress);if(lap)return lap;
  }
  return null;
}

test('three fully simulated official laps complete the cup and persist both car unlocks',()=>{
  const store=memory(),career=new Career(store);
  for(const e of events){const s=context(e),time=driveLap(s.track,s.vehicle,s.weather);assert.ok(time&&time<=s.track.medals.gold,`${e.id}: gold target is unreachable`);career.record(e.id,time,s);}
  const restored=new Career(store);assert.equal(restored.cupMedal,3);assert.equal(restored.points,9);assert.deepEqual(restored.unlocked,['coda','apex','velo']);
});

test('all three cars can finish every technical layout',()=>{
  for(const track of TRACKS)for(const vehicle of VEHICLES)assert.ok(driveLap(track,vehicle,track.weather),`${vehicle.id} cannot finish ${track.id}`);
});

test('car profiles produce different acceleration, steering response and loose-surface grip',()=>{
  const c=new Circuit({...TRACKS[0],width:300});
  const drive=(vehicle,surface)=>{const car=new DriveModel(c,vehicle);for(let i=0;i<240;i++)car.step(1/120,0,surface,'clear');for(let i=0;i<120;i++)car.step(1/120,1,surface,'clear');return car;};
  const hatch=drive(VEHICLES[0],'asphalt'),rally=drive(VEHICLES[1],'gravel'),gt=drive(VEHICLES[2],'asphalt');
  assert.ok(gt.speed>hatch.speed);assert.ok(Math.abs(gt.driftAngle)>Math.abs(hatch.driftAngle));
  assert.ok(Math.abs(rally.driftAngle)<Math.abs(drive(VEHICLES[0],'gravel').driftAngle));
});

test('vehicle meshes have three distinct silhouettes and valid wheel pivots',async()=>{
  // Parse the production truck, replacing only its image decoder in the Node runtime.
  const loader=new GLTFLoader();loader.register(()=>({name:'headless-image',loadTexture:()=>Promise.resolve(new Texture())}));
  await preloadVehicles(async()=>{const bytes=await readFile(new URL('../public/models/vehicle-truck-yellow.glb',import.meta.url));return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');});
  const models=VEHICLES.filter(v=>!v.prototype).map(buildVehicle),sizes=models.map(m=>{const b=new Box3().setFromObject(m.group);return {height:b.max.y-b.min.y,length:b.max.z-b.min.z};});
  for(const m of models){assert.equal(m.wheels.length,4);assert.equal(m.frontWheels.length,2);}
  for(const model of models){
    assert.ok(model.brakeMaterials.length>0);
    const lenses=new Box3();model.group.traverse(n=>{if(n.isMesh&&model.brakeMaterials.includes(n.material))lenses.union(new Box3().setFromObject(n));});
    assert.ok(lenses.max.z<-.9&&lenses.min.x<-.4&&lenses.max.x>.4,'brake lenses must sit on both rear corners');
    setBrakeLights(model.brakeMaterials,1);assert.ok(model.brakeMaterials.every(m=>m.emissiveIntensity>2));
    setBrakeLights(model.brakeMaterials,0);assert.ok(model.brakeMaterials.every(m=>m.emissiveIntensity===0));
  }
  assert.ok(sizes[2].height<sizes[1].height);assert.ok(sizes[2].length>sizes[0].length);
});

test('track sectors change width and material continuously around the start line',()=>{
  for(const track of TRACKS){const c=new Circuit(track);assert.ok(Math.abs(c.widthAt(0)-c.widthAt(.999999))<.001);assert.ok(c.widthAt(.3)<c.config.width);}
  const c=new Circuit(TRACKS[1]);assert.equal(c.surfaceAt(.3),'gravel');assert.equal(c.surfaceAt(.7),'dirt');assert.equal(c.surfaceAt(.3,'ice'),'ice');
});

test('technical corners leave enough inner radius for the road and guardrails',()=>{
  for(const t of TRACKS){const c=new Circuit(t);for(let i=0;i<720;i++){
    const a=c.at((i-1)/720),b=c.at((i+1)/720);
    const angle=Math.abs(Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading)));
    const radius=c.length*2/720/Math.max(angle,1e-7);
    assert.ok(radius>c.widthAt(i/720)/2+.7,`${t.id}: inner edge folds at ${i/720}`);
  }}
});
