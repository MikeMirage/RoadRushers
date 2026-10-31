import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene,Texture,Matrix4,Vector3 } from 'three';
import { RaceSession,RaceProgress,makeRaceTrack,resolveCarContacts } from '../src/race.js';
import { RivalFleet } from '../src/rival-fleet.js';
import { DriveModel } from '../src/physics.js';
import { Circuit } from '../src/circuit.js';
import { TRACKS,VEHICLES } from '../src/config.js';
import { KIT_PRESETS,kitConfig } from '../src/track-pieces.js';
import { renderRaceResult,renderRaceSetup,availableRaceTracks } from '../src/race-ui.js';

const tracks=[...TRACKS,...KIT_PRESETS.map(p=>kitConfig(p.pieces,p.name,p.id))];
const inputFor=(car,c)=>{const p=c.at(car.road.progress+.024),desired=Math.atan2(p.x-car.x,p.z-car.z),delta=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));return {steer:delta>.035?-1:delta<-.035?1:0,brake:false};};

test('a twelve-car grid contains one player and eleven distinct rivals without spawn overlaps',()=>{
  for(const track of tracks){const {circuit,error}=makeRaceTrack(track);assert.equal(error,null);const r=new RaceSession(circuit,VEHICLES[0]);assert.equal(r.rivals.length,11);assert.equal(r.racers.length,12);assert.equal(r.position,12);assert.equal(new Set(r.rivals.map(a=>a.name)).size,11);assert.equal(resolveCarContacts(r.racers,circuit),0);}
});

test('race setup supports 4, 8 and 12 cars, while requiring a closed track',()=>{
  const c=makeRaceTrack(TRACKS[0]).circuit;
  for(const count of [4,8,12]){const r=new RaceSession(c,VEHICLES[0],{count});assert.equal(r.count,count);assert.equal(r.rivals.length,count-1);}
  assert.throws(()=>new RaceSession(new Circuit(kitConfig(['straight'])),VEHICLES[0]));
});

test('width variants preserve the base track and reject folding or overlapping road edges',()=>{
  const base=TRACKS[0],wide=makeRaceTrack(base,14);assert.equal(wide.config.width,14);assert.equal(base.width,11.5);assert.equal(wide.error,null);assert.ok(wide.config.id!==base.id);
  assert.ok(makeRaceTrack(TRACKS[2],16).error);assert.ok(makeRaceTrack(tracks[3],16).error);
  assert.equal(makeRaceTrack(wide.config,'original').config.width,base.width);
});

test('ordered progress counts the grid approach, then full laps, without awarding reverse crossings',()=>{
  const progress=new RaceProgress(.98,2,100);let finished=false;
  for(let i=1;i<=102;i++){finished=progress.step(.1,(.98+i*.01)%1,i*.1,1)||finished;if(i===3)assert.equal(progress.completed,0);}
  assert.equal(finished,true);assert.equal(progress.completed,1);assert.ok(Math.abs(progress.finishTime-10.2)<.001);
  const reverse=new RaceProgress(.98,2,100);for(let i=1;i<30;i++)assert.equal(reverse.step(.1,(.98-i*.01+1)%1,i*.1,1),false);assert.equal(reverse.nextGate,0);
  const jump=new RaceProgress(.98,2,100);for(const u of [.6,.1,.99,.01])jump.step(.1,u,.1,1);assert.equal(jump.finishTime,null);
});

test('contacts transfer momentum and separate bumpers without adding bounce energy',()=>{
  const c=new Circuit(kitConfig([{id:'straight-long',length:150}])),a=new DriveModel(c),b=new DriveModel(c);a.reset(c,.3);b.reset(c,.3+2.8/c.length);a.vz=20;
  const before=b.z-a.z,contacts=resolveCarContacts([{drive:a},{drive:b}],c);
  assert.ok(contacts>0);assert.ok(a.vz<20&&b.vz>0);assert.ok(b.z-a.z>before);assert.ok(a.vz*a.vz+b.vz*b.vz<=400.001);assert.ok(Number.isFinite(a.x));
});

test('cars crossing at different bridge heights never collide',()=>{
  const c=makeRaceTrack(tracks[4]).circuit,cross=c.layout.crossings[0],a=new DriveModel(c),b=new DriveModel(c);
  a.reset(c,cross.lowerProgress);b.reset(c,cross.upperProgress);a.vz=10;b.vx=-10;
  const before=[a.x,a.y,a.z,a.vz,b.x,b.y,b.z,b.vx];assert.equal(resolveCarContacts([{drive:a},{drive:b}],c),0);assert.deepEqual([a.x,a.y,a.z,a.vz,b.x,b.y,b.z,b.vx],before);
});

test('contact against guardrails stays bounded instead of injecting repeated outward velocity',()=>{
  const c=new Circuit(kitConfig([{id:'straight-long',length:150}])),a=new DriveModel(c),b=new DriveModel(c);a.reset(c,.3,4.3);b.reset(c,.3,2.8);
  for(let i=0;i<200;i++){b.vx=2;resolveCarContacts([{drive:a},{drive:b}],c);for(const car of [a,b]){assert.ok(Math.abs(car.road.offset)<=4.30001);assert.ok(car.speed<3);}}
  assert.ok(a.vx<.001);
});

test('ghost mode never resolves car contacts, even when trajectories overlap',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0],{interaction:'ghost'});
  const p=r.player.drive;for(const bot of r.rivals)bot.drive.reset(r.circuit,p.road.progress,p.road.offset);
  for(let i=0;i<60;i++)r.step(1/120,{steer:0,brake:false});assert.equal(r.contacts,0);
});

test('the eleven AIs finish every original and modular track in both interaction modes',()=>{
  for(const track of tracks)for(const interaction of ['ghost','contact']){
    const r=new RaceSession(makeRaceTrack(track).circuit,VEHICLES[0],{interaction,laps:1});
    while(r.elapsed<90&&!r.finished&&r.finishers.length<11)r.step(1/120,{steer:0,brake:true},'track',track.weather);
    assert.equal(r.finishers.length,11,`${track.id}/${interaction}: rivals got stuck`);assert.equal(r.finished,false);assert.equal(r.player.finishTime,null);
    for(const a of r.rivals){assert.ok(a.finishTime>10);assert.ok(Number.isFinite(a.drive.y));}
  }
});

test('each vehicle can finish a twelve-car race with contact, including the elevated crossing',()=>{
  for(const vehicle of VEHICLES.slice(0,3))for(const track of [TRACKS[0],tracks[4]]){
    const r=new RaceSession(makeRaceTrack(track).circuit,vehicle,{interaction:'contact',laps:1});
    while(r.elapsed<100&&!r.finished)r.step(1/120,inputFor(r.player.drive,r.circuit),'track',track.weather);
    assert.equal(r.finished,true,`${vehicle.id}/${track.id}`);assert.ok(r.position>=1&&r.position<=12);assert.ok(r.player.finishTime>15);
    const elapsed=r.elapsed;r.step(1/120,{steer:0,brake:false});assert.equal(r.elapsed,elapsed);
  }
});

test('ranking follows full lap progress and keeps already-finished positions stable',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0]);r.racers[0].tracker.absolute=.95;r.player.tracker.absolute=1.1;assert.equal(r.position,1);
  r.racers[0].place=1;r.racers[0].finishTime=30;r.player.place=2;r.player.finishTime=31;assert.equal(r.standings()[0],r.racers[0]);assert.equal(r.position,2);
});

test('retry resets all progress, contacts and controls and reproduces the same seeded race',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0],{interaction:'contact'});
  const run=()=>{for(let i=0;i<240;i++)r.step(1/120,inputFor(r.player.drive,r.circuit));return r.racers.map(a=>[a.drive.x,a.drive.z,a.drive.speed,a.tracker.absolute]);};
  const first=run();r.reset();assert.equal(r.elapsed,0);assert.equal(r.contacts,0);assert.equal(r.finishers.length,0);assert.equal(r.player.drive.braking,false);assert.deepEqual(run(),first);
});

test('opponent rendering remains instanced as the grid grows and updates brake lights per rival',()=>{
  for(const vehicle of [VEHICLES[1],VEHICLES[2]]){
    const counts=[];
    for(const count of [4,12]){
      const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,vehicle,{count,interaction:'contact'}),scene=new Scene(),fleet=new RivalFleet(scene,r,new Texture());
      r.rivals[0].drive.braking=true;r.rivals[0].drive.brake=1;fleet.update(1/60,1,true);counts.push(fleet.parts.length);
      assert.ok(fleet.parts.length<=45);assert.ok(fleet.parts.every(p=>p.isInstancedMesh&&p.count===count-1));assert.equal(fleet.brakes.getX(0),1);assert.equal(fleet.brakes.getX(1),0);
      const a=new Matrix4(),b=new Matrix4(),pa=new Vector3(),pb=new Vector3();fleet.parts[0].getMatrixAt(0,a);fleet.parts[0].getMatrixAt(1,b);pa.setFromMatrixPosition(a);pb.setFromMatrixPosition(b);assert.ok(pa.distanceTo(pb)>1);
      fleet.dispose();assert.equal(scene.children.length,0);
    }
    assert.equal(counts[0],counts[1]);
  }
});

test('results distinguish AI opponents and unfinished cars without claiming online players',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0],{laps:1});r.player.finishTime=40;r.player.place=1;
  const html=renderRaceResult(r,TRACKS[0]);assert.ok(html.includes('CARRERA IA'));assert.ok(html.includes('ORDEN AL CRUZAR TU META'));assert.ok(html.includes('En pista'));
  const options={trackId:TRACKS[0].id,count:12,laps:3,width:'original',interaction:'ghost'},setup=renderRaceSetup(options,availableRaceTracks(TRACKS[0]),VEHICLES[0]);assert.ok(setup.includes('TÚ + 11 RIVALES IA'));assert.ok(setup.includes('data-race-interaction="contact"'));
});


test('new collection cars keep their dimensions, brake lenses and instanced render in a race',()=>{
  const vehicle=VEHICLES.find(v=>v.design);if(!vehicle)return;
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,vehicle,{count:12,interaction:'contact'});
  const scene=new Scene(),fleet=new RivalFleet(scene,r,new Texture());
  for(let i=0;i<120;i++)r.step(1/120,inputFor(r.player.drive,r.circuit));
  fleet.update(1/60,1,true);assert.ok(fleet.source.brakeMaterials.length>0);assert.equal(fleet.actors.length,11);assert.ok(r.racers.every(a=>Number.isFinite(a.drive.x)));fleet.dispose();
});
