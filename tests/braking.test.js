import test from 'node:test';
import assert from 'node:assert/strict';
import { Circuit } from '../src/circuit.js';
import { DriveModel } from '../src/physics.js';
import { VEHICLES } from '../src/config.js';
import { kitConfig } from '../src/track-pieces.js';
import { readDrivingInput } from '../src/input.js';

const straight=()=>new Circuit(kitConfig([{id:'straight-long',length:180}]));
const step=(car,seconds,brake=true,surface='asphalt',weather='clear',hz=120)=>{
  for(let i=0;i<Math.round(seconds*hz);i++)car.step(1/hz,0,surface,weather,'normal',brake);
};

test('both keyboard directions brake while a single direction still steers',()=>{
  const pointers=new Map();
  assert.deepEqual(readDrivingInput(new Set(),pointers),{steer:0,brake:false});
  assert.deepEqual(readDrivingInput(new Set(['ArrowLeft']),pointers),{steer:-1,brake:false});
  assert.deepEqual(readDrivingInput(new Set(['KeyD']),pointers),{steer:1,brake:false});
  for(const codes of [['ArrowLeft','ArrowRight'],['KeyA','KeyD'],['ArrowLeft','KeyD'],['KeyA','ArrowRight']]){
    assert.deepEqual(readDrivingInput(new Set(codes),pointers),{steer:0,brake:true});
  }
});

test('multitouch and mixed keyboard/touch braking release correctly one control at a time',()=>{
  const pointers=new Map([[11,-1],[12,1]]),keys=new Set();
  assert.deepEqual(readDrivingInput(keys,pointers),{steer:0,brake:true});
  pointers.delete(11);assert.deepEqual(readDrivingInput(keys,pointers),{steer:1,brake:false});
  keys.add('KeyA');assert.equal(readDrivingInput(keys,pointers).brake,true);
  pointers.clear();assert.deepEqual(readDrivingInput(keys,pointers),{steer:-1,brake:false});
  keys.clear();assert.deepEqual(readDrivingInput(keys,pointers),{steer:0,brake:false});
});

test('a short brake press is gentle and holding progressively slows every car to rest',()=>{
  for(const vehicle of VEHICLES){
    const car=new DriveModel(straight(),vehicle);step(car,3,false);
    const entry=car.speed;step(car,.1);
    assert.ok(car.speed<entry&&car.speed>entry*.95,vehicle.id);
    const earlyPressure=car.brake,earlySpeed=car.speed;
    assert.ok(earlyPressure>0&&earlyPressure<.4);
    step(car,.5);assert.ok(car.brake>earlyPressure);assert.ok(car.speed<earlySpeed-2);
    // The faster cruise ceiling increases the full stopping time.
    step(car,5);assert.equal(car.speed,0);assert.equal(car.vx,0);assert.equal(car.vz,0);
    step(car,1);assert.equal(car.speed,0,'holding the brake restarted acceleration');
  }
});

test('releasing one direction releases the brake and resumes acceleration into the turn',()=>{
  const car=new DriveModel(straight());car.vz=12;step(car,3);
  const input=readDrivingInput(new Set(['ArrowLeft']),new Map());
  car.step(1/120,input.steer,'asphalt','clear','normal',input.brake);
  assert.equal(car.braking,false);assert.equal(car.brake,0);assert.ok(car.speed>0);assert.ok(car.steer<0);
  step(car,.5,false);assert.ok(car.speed>5);
});

test('braking preserves slide direction instead of snapping the car to its nose',()=>{
  const car=new DriveModel(straight());car.vx=5;car.vz=12;
  car.step(1/120,0,'ice','clear','normal',true);
  assert.ok(car.vx>4.8);assert.ok(car.vz>11.9);assert.ok(Math.abs(car.driftAngle)>.3);
});

test('low grip and wet surfaces require more braking distance',()=>{
  const speedAfter=(surface,weather)=>{const car=new DriveModel(straight());car.vz=12;step(car,.7,true,surface,weather);return car.speed;};
  const dry=speedAfter('asphalt','clear'),wet=speedAfter('asphalt','rain'),ice=speedAfter('ice','clear');
  assert.ok(dry<wet&&wet<ice);
});

test('holding the brake at rest on either ramp does not accelerate or roll backwards',()=>{
  for(const id of ['ramp-up','ramp-down']){
    const c=new Circuit({...kitConfig([id]),startHeight:id==='ramp-down'?6:0}),car=new DriveModel(c);car.reset(c,.5);
    const {x,y,z}=car;step(car,3);
    assert.equal(car.speed,0);assert.equal(car.x,x);assert.equal(car.z,z);assert.ok(Math.abs(car.y-y)<1e-8);
    car.reset(c);assert.equal(car.brake,0);assert.equal(car.braking,false);
  }
});

test('braking in midair keeps momentum and does not cancel the flight',()=>{
  const cars=[new DriveModel(straight()),new DriveModel(straight())];
  for(const car of cars){car.grounded=false;car.y=5;car.vz=12;}
  step(cars[0],.3,false);step(cars[1],.3,true);
  assert.equal(cars[1].grounded,false);assert.equal(cars[1].vz,cars[0].vz);assert.equal(cars[1].y,cars[0].y);
});

test('progressive braking behaves consistently at 60 and 120 simulation steps per second',()=>{
  const cars=[new DriveModel(straight()),new DriveModel(straight())];for(const car of cars)car.vz=18;
  step(cars[0],1,true,'asphalt','clear',60);step(cars[1],1,true,'asphalt','clear',120);
  assert.ok(Math.abs(cars[0].speed-cars[1].speed)<.06);
  assert.ok(Math.abs(cars[0].z-cars[1].z)<.15);
});
