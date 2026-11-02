import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';
import { vehicleProjectedDiameter, selectVehicleLOD } from '../src/vehicle-lod.js';

test('LOD dead band prevents oscillation while distance changes slightly', () => {
  let lod='race';
  for(const pixels of [100,81,80,95]) { lod=selectVehicleLOD(pixels,lod); assert.equal(lod,'race'); }
  lod=selectVehicleLOD(79,lod); assert.equal(lod,'far');
  for(const pixels of [81,109,95]) { lod=selectVehicleLOD(pixels,lod); assert.equal(lod,'far'); }
  assert.equal(selectVehicleLOD(110,lod),'race');
});

test('projection respects FOV, camera transform, viewport size and near plane', () => {
  const camera=new PerspectiveCamera(60,1.5,.1,1000);camera.updateMatrixWorld();
  const p=new Vector3(0,0,-10),diameter=vehicleProjectedDiameter(camera,p,1,900);
  assert.ok(diameter>150&&diameter<160);
  assert.equal(vehicleProjectedDiameter(camera,p,1,450),diameter/2);
  camera.position.z=10;camera.updateMatrixWorld();
  assert.ok(vehicleProjectedDiameter(camera,p,1,900)<diameter*.51);
  camera.position.z=0;camera.updateMatrixWorld();
  assert.equal(vehicleProjectedDiameter(camera,new Vector3(0,0,-.5),1,900),Infinity);
  assert.equal(vehicleProjectedDiameter(camera,new Vector3(0,0,10),1,900),0);
});

test('orthographic projection does not vary with distance', () => {
  const camera=new OrthographicCamera(-5,5,5,-5,.1,100);camera.updateMatrixWorld();
  assert.equal(vehicleProjectedDiameter(camera,new Vector3(0,0,-10),1,1000),200);
  assert.equal(vehicleProjectedDiameter(camera,new Vector3(0,0,-30),1,1000),200);
});
