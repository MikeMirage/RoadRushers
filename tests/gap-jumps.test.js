import test from 'node:test';
import assert from 'node:assert/strict';
import { Raycaster,Vector3,MeshBasicMaterial } from 'three';
import { PIECE_CATALOG,PIECE_FAMILIES,KIT_PRESETS,samplePiece,kitConfig,compileLayout } from '../src/track-pieces.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel,LapTracker } from '../src/physics.js';
import { roadRibbon,trackStructures } from '../src/road-geometry.js';
import { TrackEditorDocument,defaultEditorDocument,parseEditorFile,editorTrackConfig } from '../src/track-editor-state.js';
import { closeTrackLayout } from '../src/track-closure.js';
import { renderPlayground } from '../src/playground-ui.js';
import { resolvePlayground,playgroundTracks,DEFAULT_PLAYGROUND } from '../src/playground.js';
import { trackPanel } from '../src/track-editor-ui.js';
import { RaceSession } from '../src/race.js';
import { VEHICLES } from '../src/config.js';
import { World } from '../src/world.js';

const course=(piece='gap-jump-short')=>new Circuit(kitConfig(['straight-64',piece,'straight-long']));
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const dispose=group=>group.traverse(o=>o.geometry?.dispose());

test('jump modules have flat outer connectors and explicit adjustable voids',()=>{
  assert.ok(PIECE_FAMILIES.includes('Saltos'));
  for(const spec of PIECE_CATALOG.filter(p=>p.kind==='gap-jump')){
    const sampled=samplePiece(spec.id),c=course(spec.id),gap=c.gaps[0];
    near(sampled.points[0].grade,0);near(sampled.points.at(-1).grade,0);near(sampled.points.at(-1).y,0);
    near(sampled.advance,spec.launchLength+spec.gapLength+spec.landingLength);
    near((gap.to-gap.from)*c.length,spec.gapLength);
    assert.equal(c.hasRoad(gap.from-1/c.length),true);assert.equal(c.hasRoad((gap.from+gap.to)/2),false);assert.equal(c.hasRoad(gap.to+1/c.length),true);
    assert.deepEqual(c.roadRanges([gap.from+.001,gap.to-.001]),[]);
    assert.equal(c.roadRanges().length,2);
    const p=c.at((gap.from+gap.to)/2),nearest=c.nearest(p.x,p.z);assert.equal(nearest.supported,false);assert.equal(nearest.gap,gap);
  }
});

test('road, stripes and structural decks have no triangles across a jump void',()=>{
  const c=course(),gap=c.gaps[0],middle=(gap.from+gap.to)/2,p=c.at(middle),material=new MeshBasicMaterial({side:2});
  const road=roadRibbon(c,-5,5,.035,material),structures=trackStructures(c);road.updateMatrixWorld(true);structures.updateMatrixWorld(true);
  const ray=new Raycaster(new Vector3(p.x,20,p.z),new Vector3(0,-1,0));
  assert.equal(ray.intersectObject(road,true).length,0);assert.equal(ray.intersectObject(structures,true).length,0);
  const progress=road.geometry.userData.roadProgress;assert.equal(progress.length*6,road.geometry.index.count);
  assert.ok(progress.every(u=>c.hasRoad(u)));
  for(const u of [gap.from-1/c.length,gap.to+1/c.length]){const q=c.at(u);ray.set(new Vector3(q.x,20,q.z),new Vector3(0,-1,0));assert.ok(ray.intersectObject(road).length);}
  assert.ok(structures.getObjectByName('takeoff-lip'));assert.ok(structures.getObjectByName('landing-lip'));
  dispose(road);dispose(structures);material.dispose();
});

test('material groups still cover exactly the visible road after a hole',()=>{
  const c=course({id:'gap-jump-short',surface:'gravel'}),material=new MeshBasicMaterial(),roadMesh=roadRibbon(c,-5,5,.035,material);
  World.prototype.updateRoadGroups.call({circuit:c,roadMesh},'track');
  const groups=roadMesh.geometry.groups;
  assert.ok(groups.some(g=>g.materialIndex===2));assert.equal(groups.reduce((n,g)=>n+g.count,0),roadMesh.geometry.index.count);
  World.prototype.updateRoadGroups.call({circuit:c,roadMesh},'ice');
  assert.equal(roadMesh.geometry.groups.length,1);assert.equal(roadMesh.geometry.groups[0].count,roadMesh.geometry.index.count);
  dispose(roadMesh);material.dispose();
});

test('a real ballistic flight crosses the short void and lands without midair support',()=>{
  const c=course(),car=new DriveModel(c);car.reset(c,45/c.length);car.vz=20;
  let overVoid=0,air=0,landed=false,left=false;
  for(let i=0;i<720;i++){
    const wasAir=!car.grounded;car.step(1/120,0,'track','clear');
    if(car.road.gap){overVoid++;assert.equal(car.grounded,false);}
    if(!car.grounded)left=true;
    if(wasAir&&car.grounded&&!car.respawned)landed=true;
    air=Math.max(air,car.airTime);assert.ok(Number.isFinite(car.y));assert.equal(car.recoveries,0);
    if(car.road.progress>c.gaps[0].to+.12)break;
  }
  assert.ok(overVoid>20);assert.ok(air>.3);assert.equal(left,true);assert.equal(landed,true);
  assert.equal(car.grounded,true);near(car.y,car.road.y);
});

test('the void provides neither an invisible floor nor side walls and adds no jump boost',()=>{
  const c=course(),gap=c.gaps[0],car=new DriveModel(c);car.reset(c,(gap.from+gap.to)/2,9);
  car.grounded=false;car.vz=10;car.vy=2;const y=car.y,dt=1/120;
  car.step(dt,0,'track','clear');assert.equal(car.grounded,false);assert.equal(car.road.supported,false);
  near(car.x,9);near(car.y,y+2*dt-12*dt*dt);near(car.vy,2-24*dt);
});

test('a missed landing recovers before takeoff and never snaps up from below the landing ramp',()=>{
  const c=course('gap-jump-long'),gap=c.gaps[0],car=new DriveModel(c);car.reset(c,gap.from-.15/c.length);car.vz=6;car.vy=car.road.grade*6;
  let air=false,recovered=false;
  for(let i=0;i<240;i++){
    car.step(1/120,0,'track','clear', 'normal',true);
    if(car.road.gap){air=true;assert.equal(car.grounded,false);}
    if(car.respawned){recovered=true;assert.ok(car.recoveryRewind>0);break;}
  }
  assert.equal(air,true);assert.equal(recovered,true);assert.equal(car.recoveries,1);
  near(car.road.progress,gap.recovery,1e-4);near(car.y,car.road.y);assert.ok(car.road.supported);assert.equal(car.speed,0);
  const timer=new LapTracker();timer.elapsed=7;timer.time=7;timer.nextGate=5;timer.rewind(gap.recovery);assert.equal(timer.elapsed,7);assert.equal(timer.time,7);assert.equal(timer.step(1/120,gap.recovery),null);
});

test('intentional gaps survive editing, save/export and closure and allow testing a closed course',()=>{
  const piece={id:'gap-jump-short',launchLength:14,gapLength:7,landingLength:20,height:2.5};
  const pieces=closeTrackLayout(['straight-64',piece,'straight-long']),doc=new TrackEditorDocument({...defaultEditorDocument(),name:'Saltos',pieces});
  assert.deepEqual(doc.value.pieces[1],piece);assert.deepEqual(parseEditorFile(JSON.stringify(doc.value)),doc.value);
  const compiled=compileLayout(pieces);assert.equal(compiled.closed,true);assert.deepEqual(compiled.errors,[]);assert.equal(compiled.gaps.length,1);
  const before=structuredClone(doc.value);doc.closeCircuit();assert.deepEqual(doc.value,before);
  const config=editorTrackConfig(doc.value),tracks=playgroundTracks(config),options={...DEFAULT_PLAYGROUND,trackId:config.id};
  assert.equal(resolvePlayground(options,tracks).error,null);assert.doesNotMatch(renderPlayground(options,tracks),/<button type="submit" class="primary-button" disabled>/);
  const html=trackPanel({document:doc,focusSection:1,compiled,search:'',family:'Saltos',palettePiece:'gap-jump-short'});
  for(const key of ['launchLength','gapLength','landingLength','height'])assert.ok(html.includes(`data-edit-key="${key}"`));
  assert.ok(html.includes('hueco sin carretera'));
  for(const patch of [{gapLength:-1},{gapLength:Infinity},{launchLength:0},{landingLength:101},{height:0}])assert.throws(()=>samplePiece({...piece,...patch}));
});

test('the jump demonstration is closed and playable, and recovery rewinds race progress',()=>{
  const preset=KIT_PRESETS.find(p=>p.id==='kit-jump-school-v3'),c=new Circuit(kitConfig(preset.pieces));
  assert.equal(c.closed,true);assert.deepEqual(c.layout.errors,[]);
  const session=new RaceSession(c,VEHICLES[0],{count:4}),player=session.player,gap=c.gaps[0];
  player.drive.reset(c,gap.from-.1/c.length);player.drive.vz=4;player.drive.vy=player.drive.road.grade*4;
  player.tracker.previous=player.drive.road.progress;player.tracker.absolute=player.drive.road.progress;player.tracker.nextGate=Math.floor(player.tracker.absolute*8)+1;
  let recovered=false;
  for(let i=0;i<300;i++){
    session.step(1/120,{steer:0,brake:true});
    if(player.drive.respawned){recovered=true;near(player.tracker.absolute,player.drive.road.progress,1e-3);break;}
  }
  assert.equal(recovered,true);assert.equal(player.tracker.completed,0);assert.equal(player.finishTime,null);
});
