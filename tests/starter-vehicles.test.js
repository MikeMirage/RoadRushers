import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3,Box3 } from 'three';
import { ORIGINAL_VEHICLES,SURFACES } from '../src/config.js';
import { DriveModel } from '../src/physics.js';
import { buildVehicle,setBrakeLights } from '../src/vehicles.js';
import { animateVehicle } from '../src/vehicle-pose.js';
import { inspectVehicle } from '../scripts/vehicle-qa.mjs';
import { disposeVehicle } from '../src/vehicle-modeler.js';
import { provingGround,runFor,measureVehicle,measureLap,FAST_TEST_TRACK } from '../scripts/starter-vehicle-benchmark.mjs';

const metrics=ORIGINAL_VEHICLES.map(measureVehicle);

test('starter cars retain legacy cruise ceilings and controllable steering',()=>{
  assert.deepEqual(Object.values(SURFACES).map(s=>s.speed),[21,18,19,16,16.5]);
  for(const vehicle of ORIGINAL_VEHICLES.slice(0,3)){
    const car=new DriveModel(provingGround,vehicle);runFor(car,30);
    assert.ok(Math.abs(car.speed-21*vehicle.speed)<.1,`${vehicle.id}: ${car.speed*3.6} km/h`);
    const z=car.z;runFor(car,1);assert.ok(car.z-z>=20,'cruise must move the simulation, not only the speedometer');
    runFor(car,.5,{steer:1});assert.ok(Math.abs(car.angularSpeed)>1,'full steering must still turn at cruise');
    runFor(car,.35,{steer:-1});assert.ok(car.angularSpeed>0,'countersteering must remain available');
  }
});

test('base cars have close straight-line performance and different measurable advantages',()=>{
  const [truck,rally,roadster]=metrics;
  assert.ok(roadster.topSpeed>rally.topSpeed&&rally.topSpeed>truck.topSpeed);
  assert.ok(roadster.topSpeed/truck.topSpeed<1.10,'the roadster must not run away on every straight');
  assert.ok(rally.secondsTo15<roadster.secondsTo15&&rally.secondsTo15<truck.secondsTo15);
  assert.ok(truck.secondsTo15/rally.secondsTo15<1.16,'launch gap is too large for base cars');
  assert.ok(truck.stopFrom18<rally.stopFrom18&&rally.stopFrom18<roadster.stopFrom18);
  assert.ok(rally.cornerRetention>truck.cornerRetention&&rally.cornerRetention>roadster.cornerRetention);
  assert.ok(roadster.slideAngleDegrees>truck.slideAngleDegrees&&truck.slideAngleDegrees>rally.slideAngleDegrees);
  assert.ok(rally.gravelSlideDegrees<truck.gravelSlideDegrees&&truck.gravelSlideDegrees<roadster.gravelSlideDegrees);
  for(const result of metrics){assert.ok(result.wetStopFrom18>result.stopFrom18*1.3);assert.ok(result.cornerRetention>.75&&result.cornerRetention<.96);assert.ok(result.recoverySeconds<1);}
});

test('the roadster converts top speed into the quickest lap on an actual fast course',()=>{
  const laps=ORIGINAL_VEHICLES.map(v=>measureLap(v,FAST_TEST_TRACK));
  for(const lap of laps){assert.ok(lap.seconds>20&&lap.seconds<60);assert.equal(lap.wallContactSeconds,0);}
  assert.ok(laps[2].seconds<laps[0].seconds&&laps[2].seconds<laps[1].seconds);
  assert.ok(laps[0].seconds/laps[2].seconds<1.10);
});

test('acceleration and braking transfer load between axles and pitch the sprung mass in opposite directions',()=>{
  for(const v of ORIGINAL_VEHICLES){
    const car=new DriveModel(provingGround,v);runFor(car,.7);
    assert.ok(car.frontLoad<v.handling.frontWeight);assert.ok(car.bodyPitch>0);
    assert.ok(Math.abs(car.frontLoad+car.rearLoad-1)<1e-12);
    car.vz=car.speed=18;runFor(car,.7,{brake:true});
    assert.ok(car.frontLoad>v.handling.frontWeight);assert.ok(car.bodyPitch<0);
  }
});

test('mass affects real acceleration and stopping distance rather than only a garage statistic',()=>{
  const v=ORIGINAL_VEHICLES[0],heavy={...v,handling:{...v.handling,mass:v.handling.mass*1.5}};
  const lightCar=new DriveModel(provingGround,v),heavyCar=new DriveModel(provingGround,heavy);
  runFor(lightCar,1);runFor(heavyCar,1);assert.ok(lightCar.speed>heavyCar.speed*1.1);
  for(const car of [lightCar,heavyCar]){car.reset(provingGround);car.vz=car.speed=18;runFor(car,1,{brake:true});}
  assert.ok(heavyCar.speed>lightCar.speed+2);
});

test('corner loads lean the body toward the loaded outside wheels and settle without idle vibration',()=>{
  for(const v of ORIGINAL_VEHICLES){
    const car=new DriveModel(provingGround,v);runFor(car,3);runFor(car,.8,{steer:.6});
    assert.ok(Math.abs(car.bodyRoll)>.005);assert.ok(car.leftLoad!==car.rightLoad);
    assert.equal(Math.sign(car.bodyRoll),Math.sign(car.lateralAcceleration));
    assert.equal(Math.sign(car.leftLoad-car.rightLoad),Math.sign(car.lateralAcceleration));
    runFor(car,5,{brake:true});
    assert.ok(Math.abs(car.bodyRoll)<.0001);assert.ok(Math.abs(car.bodyPitch)<.0001);
    assert.ok(Math.abs(car.heave)<.0001);
    car.reset(provingGround);runFor(car,2,{brake:true});
    assert.equal(car.bodyRoll,0);assert.equal(car.bodyPitch,0);assert.equal(car.heave,0);
  }
});

test('springs, load transfer and driving remain comparable at 60 and 120 Hz during a maneuver',()=>{
  for(const v of ORIGINAL_VEHICLES){
    const cars=[60,120].map(hz=>{const c=new DriveModel(provingGround,v);runFor(c,2,{hz});runFor(c,.7,{hz,steer:.55});runFor(c,.5,{hz,brake:true});return c;});
    assert.ok(Math.abs(cars[0].speed-cars[1].speed)<.15);
    assert.ok(Math.abs(cars[0].bodyRoll-cars[1].bodyRoll)<.012);
    assert.ok(Math.abs(cars[0].bodyPitch-cars[1].bodyPitch)<.012);
  }
});

test('three production models pass mesh QA and keep braking confined to rear lenses',()=>{
  for(const v of ORIGINAL_VEHICLES){
    const model=buildVehicle(v),qa=inspectVehicle(model);assert.deepEqual(qa.errors,[],v.id);
    assert.ok(qa.triangles>18000&&qa.triangles<45000);assert.ok(qa.primitives<38);
    assert.ok(qa.dimensions[2]/qa.dimensions[0]>1.9,'toy-wide proportions');
    assert.equal(model.materials.paint.clearcoat,1);
    for(const slot of model.wheelSlots)assert.ok(Math.abs(slot.steer.position.y-slot.radius)<1e-6);
    const lights=new Box3();model.group.traverse(o=>{if(o.isMesh&&model.brakeMaterials.includes(o.material))lights.union(new Box3().setFromObject(o));});
    assert.ok(lights.max.z<-1.4);setBrakeLights(model.brakeMaterials,1);assert.ok(model.materials.brakes.emissiveIntensity>2);
    assert.equal(model.materials.calipers.emissiveIntensity,1);assert.equal(model.materials.calipers.emissive.getHex(),0);
    disposeVehicle(model);
  }
});

test('body suspension never lifts wheel contacts, steering uses separate inner and outer angles, and pause freezes rolling',()=>{
  for(const v of ORIGINAL_VEHICLES){
    const model=buildVehicle(v),before=model.wheelSlots.map(s=>s.steer.getWorldPosition(new Vector3()));
    const pose={pitch:0,roll:0,steer:1,steeringAngle:-.35,speed:18,bodyRoll:.09,bodyPitch:-.04,heave:-.03};
    animateVehicle(model,pose,.1,true);
    model.wheelSlots.forEach((slot,i)=>assert.ok(slot.steer.getWorldPosition(new Vector3()).distanceTo(before[i])<1e-9));
    const inner=model.frontWheels.find(w=>w.userData.side===-1),outer=model.frontWheels.find(w=>w.userData.side===1);
    assert.ok(Math.abs(inner.rotation.y)>Math.abs(outer.rotation.y));
    assert.equal(model.bodyRig.rotation.z,.09);assert.equal(model.bodyRig.position.y,-.03);
    const rotation=model.wheels[0].rotation.x;animateVehicle(model,pose,.1,false);assert.equal(model.wheels[0].rotation.x,rotation);
    assert.ok(Math.abs(rotation-18*.1/model.wheelRadius)<1e-9);disposeVehicle(model);
  }
});
