import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { GhostRecords, GhostRecorder, GHOST_KEY, sampleGhost, validGhost } from '../src/ghost.js';
import { GhostView } from '../src/ghost-view.js';
import { LapTracker } from '../src/physics.js';
import { Circuit } from '../src/circuit.js';
import { VEHICLES, TRACKS } from '../src/config.js';
import { buildVehicle } from '../src/vehicles.js';
import { resultContext } from '../src/results.js';

const near = (a,b) => assert.ok(Math.abs(a-b)<.0002,`${a} != ${b}`);
const pose = t => ({x:t*10,y:t*.2,z:t*2,heading:.2,pitch:.1,roll:.05,steer:.2,speed:10,distance:t*10});
const memory = () => {const data=new Map();return {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};};
function recording(duration=1) {
  const recorder=new GhostRecorder(pose(0));
  for(let t=.01;t<duration-.00001;t+=.01)recorder.step(t,pose(t));
  return recorder.step(duration,pose(duration),duration);
}
const context = patch => {const settings={mode:'practice',track:TRACKS[0],vehicle:VEHICLES[1],surface:'track',weather:'clear',pace:'normal',...patch};return resultContext(settings,new Circuit(settings.track));};

test('the fastest complete replay persists across sessions and slower laps cannot replace it',()=>{
  const storage=memory(),records=new GhostRecords(storage),ctx=context();
  assert.equal(records.get(ctx),null);assert.equal(records.recordLap(ctx,recording(2)),true);
  assert.equal(records.recordLap(ctx,recording(3)),false);assert.equal(records.recordLap(ctx,recording(1)),true);
  const loaded=new GhostRecords(storage).get(ctx);assert.equal(loaded.duration,1);near(sampleGhost(loaded,.75).x,7.5);
  assert.equal(records.recordLap(ctx,recording(1)),false);
});
test('replays follow timing categories, isolating geometry, car, weather and contact races',()=>{
  const storage=memory(),records=new GhostRecords(storage),ctx=context();records.recordLap(ctx,recording());
  for(const patch of [{vehicle:VEHICLES[2]},{weather:'rain'},{surface:'ice'},{pace:'calm'},{track:{...TRACKS[0],width:14}},{mode:'race',raceRules:{count:4,laps:3,interaction:'contact'}}])assert.equal(records.get(context(patch)),null);
  assert.equal(records.get(context({camera:'chase',track:{...TRACKS[0],environmentTheme:'tokyo'}})).duration,1);
});
test('crossings split exact boundary poses and preserve the remainder of the next lap',()=>{
  const recorder=new GhostRecorder(pose(0));recorder.step(.97,pose(.97));
  const first=recorder.step(1.03,pose(1.03),1.005);assert.equal(validGhost(first),true);near(first.duration,1.005);near(sampleGhost(first,first.duration).x,10.05);
  const second=recorder.step(2.04,pose(2.04),2.01);near(second.duration,1.005);near(sampleGhost(second,0).x,10.05);near(sampleGhost(second,second.duration).x,20.1);
});
test('only validated full laps become replay candidates, including consecutive laps in one session',()=>{
  const tracker=new LapTracker(),recorder=new GhostRecorder(pose(0)),completed=[];
  // Cross the start repeatedly without visiting gates: no recorded lap.
  for(let i=1;i<=30;i++){const lap=tracker.step(.01,i%2?.99:.01);const candidate=recorder.step(tracker.elapsed,pose(tracker.elapsed),lap?tracker.lapStartedAt:null);assert.equal(candidate,null);}
  tracker.reset();const validRecorder=new GhostRecorder(pose(0));
  for(let i=1;i<=205;i++){const lap=tracker.step(.1,(i%100)/100);const candidate=validRecorder.step(tracker.elapsed,pose(tracker.elapsed),lap?tracker.lapStartedAt:null);if(candidate)completed.push(candidate);}
  assert.equal(completed.length,2);for(const lap of completed){near(lap.duration,10);assert.equal(validGhost(lap),true);}
});
test('corrupted or unavailable storage never breaks driving and a new best remains in memory',()=>{
  const ctx=context(),storage=memory();storage.setItem(GHOST_KEY+ctx.key,'broken');assert.equal(new GhostRecords(storage).get(ctx),null);
  for(const bad of [{...recording(),duration:NaN},{...recording(),frames:[[0,NaN]]},{...recording(),frames:recording().frames.toReversed()}]){storage.setItem(GHOST_KEY+ctx.key,JSON.stringify(bad));assert.equal(new GhostRecords(storage).get(ctx),null);}
  const records=new GhostRecords({getItem(){throw Error();},setItem(){throw Error();}});
  assert.equal(records.recordLap(ctx,recording()),true);assert.equal(records.get(ctx).duration,1);assert.equal(records.saveAvailable,false);
});
test('playback uses shortest-angle interpolation and disappears after finishing until the next lap',()=>{
  const recorder=new GhostRecorder({...pose(0),heading:Math.PI-.01});const lap=recorder.step(1,{...pose(1),heading:-Math.PI+.01},1);
  near(sampleGhost(lap,.5).heading,Math.PI);assert.equal(sampleGhost(lap,-.1),null);assert.equal(sampleGhost(lap,1.01),null);near(sampleGhost(lap,0).x,0);
});
test('long laps keep bounded replay storage without losing their start or finish',()=>{
  const recorder=new GhostRecorder(pose(0));
  for(let time=1;time<1000;time++)recorder.step(time,pose(time));
  const lap=recorder.step(1000,pose(1000),1000);assert.equal(validGhost(lap),true);assert.ok(lap.frames.length<=6001);near(sampleGhost(lap,999.5).x,9995);
});
test('the ghost is translucent, follows elevations, freezes on pause and clears trails on a new lap',()=>{
  const scene=new Scene(),model=buildVehicle(VEHICLES[1]),view=new GhostView(scene,model),lap=recording(2);
  view.update(lap,1,true);assert.equal(view.group.visible,true);assert.equal(view.material.transparent,true);assert.ok(view.material.opacity>.1&&view.material.opacity<.4);assert.equal(view.material.depthWrite,false);
  near(view.group.position.y,.275);assert.ok(view.geometry.drawRange.count>0);
  const position=view.group.position.clone(),trail=Array.from(view.positions);view.update(lap,1,true);assert.deepEqual(view.group.position,position);assert.deepEqual(Array.from(view.positions),trail);
  view.update(lap,0,true);assert.equal(view.trail.visible,false);near(view.group.position.x,0);
  view.update(lap,3,true);assert.equal(view.group.visible,false);assert.equal(view.trail.visible,false);
  view.update(lap,1,false);assert.equal(view.group.visible,false);assert.equal(view.trail.visible,false);
  let disposed=false;model.group.traverse(node=>node.geometry?.addEventListener('dispose',()=>disposed=true));view.dispose();assert.equal(disposed,false);assert.equal(scene.children.length,0);
});
