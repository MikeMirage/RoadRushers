import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LocalOcclusion,markPlayerOccluder,isOverheadPoint } from '../src/local-occlusion.js';
import { World } from '../src/world.js';
import { Circuit } from '../src/circuit.js';
import { TRACKS } from '../src/config.js';
import { KIT_PRESETS,kitConfig } from '../src/track-pieces.js';
import { disposeSceneGroup } from '../src/basic-scene.js';

const eight=()=>new Circuit(kitConfig(KIT_PRESETS.find(p=>p.id==='kit-eight-v1').pieces));
function setup(circuit){
  const world=Object.create(World.prototype);world.scene=new THREE.Scene();world.occlusion=new LocalOcclusion();world.resetDrivingEffects=()=>{};
  world.build(circuit,'track','clear');return world;
}
function pose(circuit,progress){
  const p=circuit.at(progress);return {...p,progress,groundY:p.y,vx:Math.sin(p.heading)*16,vz:Math.cos(p.heading)*16};
}
function cameraAt(drive){
  const camera=new THREE.PerspectiveCamera(45,1.5,.1,700);
  camera.position.set(drive.x+24,drive.y+48,drive.z+24);camera.lookAt(drive.x,drive.y+.5,drive.z);camera.updateMatrixWorld();return camera;
}
const sizeRenderer={getDrawingBufferSize(size){return size.set(1200,800);}};
function dispose(world){world.occlusion.clear();disposeSceneGroup(world.environment);}

test('the lower crossing opens, while the same upper deck and nearby ramps remain drivable',()=>{
  const c=eight(),cross=c.layout.crossings[0],world=setup(c),effect=world.occlusion;
  const low=pose(c,cross.lowerProgress);effect.update(1/60,low,cameraAt(low),sizeRenderer);
  assert.equal(effect.covered,true);assert.equal(effect.strength,1);
  assert.equal(isOverheadPoint(cross.upperY,cross.upperProgress,low.y,low.progress,c.length),true);
  effect.reset();const high=pose(c,cross.upperProgress);effect.update(1/60,high,cameraAt(high),sizeRenderer);
  assert.equal(effect.covered,false);assert.equal(effect.strength,0);
  assert.equal(isOverheadPoint(high.y+.7,high.progress,high.y,high.progress,c.length),false);
  assert.equal(isOverheadPoint(low.y+3,low.progress+12/c.length,low.y,low.progress,c.length),false);
  assert.equal(isOverheadPoint(6,.005,0,.995,1000,true),false,'lap seam is the same nearby route');
  assert.equal(isOverheadPoint(6,.005,0,.995,1000,false),true,'open tracks do not wrap');
  dispose(world);
});

test('tunnel roofs open without treating the tunnel road or columns as overhead geometry',()=>{
  const preset=KIT_PRESETS.find(p=>p.id==='kit-gallery-v2'),c=new Circuit(kitConfig(preset.pieces)),world=setup(c);
  const section=c.layout.sections.find(s=>s.spec.kind==='tunnel'),drive=pose(c,(section.from+section.to)/2/c.length);
  world.occlusion.update(1/60,drive,cameraAt(drive),sizeRenderer);assert.equal(world.occlusion.covered,true);
  const tunnel=world.environment.getObjectByName('tunnel');assert.ok(tunnel.children.every(m=>m.userData.playerOccluder));
  assert.equal(isOverheadPoint(drive.y,-1,drive.y,drive.progress,c.length),false);
  dispose(world);
  const bridgeWorld=setup(eight()),piers=[];
  bridgeWorld.environment.traverse(m=>{if(m.isInstancedMesh&&!m.userData.playerOccluder)piers.push(m);});
  assert.ok(piers.length>0);assert.ok(piers.every(m=>!bridgeWorld.occlusion.meshes.includes(m)));
  dispose(bridgeWorld);
});

test('all road materials, shoulders, curbs and markings participate and flat tracks stay on one pass',()=>{
  const world=setup(eight()),effect=world.occlusion;
  assert.ok(effect.meshes.includes(world.roadMesh));assert.ok(effect.meshes.includes(world.directionArrows));
  const curbs=effect.meshes.find(m=>m.isInstancedMesh&&m.count>100);
  assert.ok(curbs);assert.ok(curbs.geometry.getAttribute('occlusionRoute').isInstancedBufferAttribute);
  assert.equal(curbs.geometry.getAttribute('occlusionRoute').count,curbs.count);
  assert.ok(effect.meshes.every(m=>m.geometry.getAttribute('occlusionRoute')));
  dispose(world);
  const flat=setup(new Circuit(TRACKS[0]));let draws=0;
  flat.occlusion.render({render(){draws++;}},flat.scene,new THREE.Camera());
  assert.equal(draws,1);assert.equal(flat.occlusion.variants.size,0);dispose(flat);
});

test('opaque deck occlusion uses its nearest depth and restores materials, shadows and render state',()=>{
  const scene=new THREE.Scene(),background=new THREE.Color('#8faaa1');scene.background=background;
  const original=new THREE.MeshStandardMaterial({side:THREE.DoubleSide}),mesh=markPlayerOccluder(new THREE.Mesh(new THREE.BoxGeometry(10,.6,10),original),.7);
  scene.add(mesh);const sun=new THREE.DirectionalLight();scene.add(sun);
  const effect=new LocalOcclusion();effect.bind(scene,{length:200,closed:true,layout:{maxHeight:6,minHeight:0,sections:[]}});effect.strength=1;
  const camera=new THREE.PerspectiveCamera(),seen=[],target={name:'existing MSAA target'};
  const renderer={autoClear:true,shadowMap:{autoUpdate:false,needsUpdate:true},getRenderTarget(){return target;},
    render(){seen.push({material:mesh.material,camera:camera.layers.mask,background:scene.background,clear:this.autoClear});this.shadowMap.needsUpdate=false;}};
  effect.render(renderer,scene,camera);
  assert.equal(seen.length,3);assert.equal(seen[1].material.colorWrite,false);assert.equal(seen[1].material.depthWrite,true);
  assert.equal(seen[2].material.depthFunc,THREE.EqualDepth);assert.equal(seen[2].material.depthWrite,false);
  assert.equal(seen[2].material.transparent,true);assert.equal(seen[2].clear,false);assert.equal(seen[2].background,null);
  assert.equal(mesh.material,original);assert.equal(camera.layers.mask,1);assert.equal(sun.layers.mask,1);
  assert.equal(scene.background,background);assert.equal(renderer.autoClear,true);assert.equal(renderer.getRenderTarget(),target);
  assert.equal(renderer.shadowMap.autoUpdate,false);assert.equal(renderer.shadowMap.needsUpdate,false);
  renderer.render=()=>{throw new Error('context lost');};assert.throws(()=>effect.render(renderer,scene,camera),/context lost/);
  assert.equal(mesh.material,original);assert.equal(scene.background,background);assert.equal(camera.layers.mask,1);assert.equal(sun.layers.mask,1);
  effect.clear();mesh.geometry.dispose();original.dispose();
});

test('changing tracks releases only derived materials and returns every mesh to its original layers',()=>{
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial(),mesh=markPlayerOccluder(new THREE.Mesh(new THREE.BoxGeometry(),material),.5);
  group.add(mesh);const effect=new LocalOcclusion();effect.bind(group,{layout:{maxHeight:6,minHeight:0,sections:[]}});
  let originalDisposed=0,derivedDisposed=0;material.addEventListener('dispose',()=>originalDisposed++);
  for(const m of Object.values(effect.variant(material)))m.addEventListener('dispose',()=>derivedDisposed++);
  effect.use('reveal');effect.clear();assert.equal(derivedDisposed,3);assert.equal(originalDisposed,0);
  assert.equal(mesh.material,material);assert.equal(mesh.layers.mask,1);assert.equal(effect.strength,0);
  mesh.geometry.dispose();material.dispose();
});
