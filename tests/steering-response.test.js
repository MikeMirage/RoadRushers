import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_VEHICLES } from '../src/config.js';
import { DriveModel } from '../src/physics.js';
import { readDrivingInput } from '../src/input.js';
import { provingGround } from '../scripts/starter-vehicle-benchmark.mjs';

const dt=1/120;
function steeringStep(vehicle,{speed=18,slip=0,surface='asphalt',weather='clear',direction=1}={}){
  const car=new DriveModel(provingGround,vehicle);
  car.vx=Math.sin(slip)*speed;car.vz=Math.cos(slip)*speed;car.speed=speed;car.driftAngle=slip;
  const keys=new Set([direction>0?'ArrowRight':'ArrowLeft']);
  const input=readDrivingInput(keys,new Map());
  car.step(dt,input.steer,surface,weather);
  return car;
}

test('keyboard steering retains full yaw authority and response at high speed',()=>{
  for(const vehicle of ORIGINAL_VEHICLES)for(const direction of [-1,1]){
    const reference=steeringStep(vehicle,{speed:8,direction});
    for(const speed of [18,24,30]){
      const car=steeringStep(vehicle,{speed,direction});
      assert.ok(Math.abs(car.angularSpeed-reference.angularSpeed)<1e-12,`${vehicle.id}: yaw muted at ${speed}`);
      assert.equal(car.steer,reference.steer);
    }
  }
});

test('small slides never suppress a keyboard countersteering correction',()=>{
  for(const vehicle of ORIGINAL_VEHICLES)for(const direction of [-1,1]){
    const reference=steeringStep(vehicle,{direction});
    for(const slip of [-.3,-.03,-.001,0,.001,.03,.3]){
      const car=steeringStep(vehicle,{slip,direction});
      assert.ok(Math.abs(car.angularSpeed-reference.angularSpeed)<1e-12,`${vehicle.id}: correction muted at slip ${slip}`);
    }
  }
});

test('reduced tire grip affects momentum without slowing steering response',()=>{
  for(const vehicle of ORIGINAL_VEHICLES){
    const dry=steeringStep(vehicle,{slip:.2});
    for(const [surface,weather] of [['asphalt','rain'],['gravel','clear'],['mud','clear']]){
      const car=steeringStep(vehicle,{slip:.2,surface,weather});
      assert.ok(Math.abs(car.angularSpeed-dry.angularSpeed)<1e-12,`${vehicle.id}: response muted on ${surface}/${weather}`);
      assert.ok(Math.abs(car.driftAngle)>Math.abs(dry.driftAngle),`${vehicle.id}: tire grip must still affect sliding`);
    }
  }
});
