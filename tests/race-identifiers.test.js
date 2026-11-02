import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {createPlayerMarker,rivalLabelPlacement} from '../src/race-identifiers.js';

test('the player marker is a subtle road arc and is occluded by car geometry',()=>{
  const marker=createPlayerMarker();
  assert.equal(marker.material.depthTest,true);assert.equal(marker.material.depthWrite,false);
  assert.ok(marker.material.opacity<=.3);assert.ok(marker.geometry.parameters.outerRadius-marker.geometry.parameters.innerRadius<.05);
  assert.ok(marker.geometry.parameters.thetaLength<Math.PI);assert.equal(marker.renderOrder,1);
  marker.geometry.dispose();marker.material.dispose();
});
test('rival names project above visible cars and disappear behind or far from the camera',()=>{
  const camera=new PerspectiveCamera(50,.5,.1,700);camera.position.set(0,12,18);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const vehicle={},point=rivalLabelPlacement({x:0,y:0,z:0},vehicle,camera,390,780);
  assert.ok(point&&point.x>180&&point.x<210);
  const ground=new Vector3().project(camera);assert.ok(point.y<(1-ground.y)*780/2);
  assert.equal(rivalLabelPlacement({x:0,y:0,z:100},vehicle,camera,390,780),null);
  assert.equal(rivalLabelPlacement({x:1000,y:0,z:0},vehicle,camera,390,780),null);
});
