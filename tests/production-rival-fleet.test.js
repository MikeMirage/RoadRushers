import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { ProductionRivalFleet } from '../src/production-rival-fleet.js';
import { createVehicleMaterial } from '../src/vehicle-material.js';

function representation(){
  const group=new T.Group(),bodyRig=new T.Group();bodyRig.name='BodySuspension';group.add(bodyRig);
  group.userData={wheelbase:2,track:1.4};
  const mask=new T.DataTexture(new Uint8Array([255,0,0,255]),1,1);
  const body=createVehicleMaterial({mask}),wheel=createVehicleMaterial({role:'wheel',mask});
  const geometry=new T.BoxGeometry(1.4,.6,2.5),mesh=new T.Mesh(geometry,body);bodyRig.add(mesh);
  const wheels=[],frontWheels=[];
  for(const [i,label]of ['FL','FR','RL','RR'].entries()){
    const pivot=new T.Group(),roll=new T.Group();pivot.name=`Steering_${label}`;roll.name=`Wheel_${label}`;
    pivot.position.set(i%2===0?-.7:.7,.3,i<2?1:-1);pivot.userData.side=i%2===0?-1:1;
    group.add(pivot);pivot.add(roll);roll.add(new T.Mesh(new T.BoxGeometry(.2,.5,.5),wheel));wheels.push(roll);if(i<2)frontWheels.push(pivot);
  }
  return {group,bodyRig,wheels,frontWheels,wheelRadius:.3,visualScale:1,restBodyY:0,customization:{rideHeight:0},geometry};
}

test('production rivals compact independent LOD buckets and keep shared source geometry intact',()=>{
  const race=representation(),far=representation();let disposed=false;
  const source={representations:{race,far},brakeRearZ:-1.3,dispose(){disposed=true;}};
  const drives=[-5,-100].map((z,i)=>({x:0,y:0,z,heading:0,pitch:0,roll:0,bodyPitch:.02,bodyRoll:.03,heave:.01,speed:10,steer:.1,groundY:0,progress:0,braking:i===1,brake:1}));
  const session={interaction:'contact',circuit:{length:100,at:()=>({y:0,pitch:0,bank:0})},rivals:drives.map((d,i)=>({color:i?'#0000ff':'#ff0000',drive:{interpolated:()=>d}}))};
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,1,.1,1000);camera.updateMatrixWorld();
  const fleet=new ProductionRivalFleet(scene,session,new T.Texture(),source);
  fleet.update(.1,1,true,camera,900);
  assert.equal(fleet.buckets.race.count,1);assert.equal(fleet.buckets.far.count,1);
  assert.equal(fleet.buckets.race.brakes.getX(0),0);assert.equal(fleet.buckets.far.brakes.getX(0),1);
  assert.equal(fleet.buckets.race.parts[0].mesh.geometry.attributes.position,race.geometry.attributes.position);
  assert.equal(race.geometry.getAttribute('aBrake'),undefined);
  const color=new T.Color();fleet.buckets.far.parts[0].mesh.getColorAt(0,color);assert.equal(color.getHex(),0x0000ff);
  drives[1].z=-5;fleet.update(.1,1,true,camera,900);
  assert.equal(fleet.buckets.race.count,2);assert.equal(fleet.buckets.far.count,0);
  assert.equal(fleet.buckets.far.parts[0].mesh.visible,false);
  assert.equal(fleet.buckets.race.brakes.getX(1),1);
  const position=race.geometry.attributes.position,index=race.geometry.index;
  fleet.dispose();assert.ok(disposed);assert.equal(race.geometry.attributes.position,position);assert.equal(race.geometry.index,index);
  assert.equal(scene.children.length,0);
});
