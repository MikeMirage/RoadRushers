import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { Circuit } from '../src/circuit.js';
import { TRACKS } from '../src/config.js';
import { kitConfig,KIT_PRESETS } from '../src/track-pieces.js';
import { basicFloor,disposeSceneGroup } from '../src/basic-scene.js';
import { GameplayRenderer } from '../src/gameplay-renderer.js';

test('all gameplay tracks ignore scenery, manual props and authored lighting',()=>{
  const world=Object.create(World.prototype);world.scene=new THREE.Scene();world.resetDrivingEffects=()=>{};
  for(const config of [...TRACKS,...KIT_PRESETS.map(p=>kitConfig(p.pieces,p.name,p.id))]){
    const circuit=new Circuit({...config,manualProps:[{id:'unused',type:'chalet',position:[0,0,0]}]});
    world.build(circuit,'track','rain');
    const grid=world.environment.getObjectByName('basic-grid');assert.ok(grid,config.id);
    assert.equal(world.landscape,undefined);assert.equal(world.manualProps,undefined);assert.equal(world.atmosphere,undefined);
    assert.equal(world.roadMesh.material.length,5);assert.ok(world.roadMesh.geometry.groups.length>0);
    assert.ok(grid.geometry.attributes.position.array.every(Number.isFinite));
    assert.equal(world.scene.children.length,1,'rebuilding must replace the previous world');
  }
  disposeSceneGroup(world.environment);
});

test('the basic floor covers long and offset custom tracks with one opaque draw',()=>{
  const circuit=new Circuit({...TRACKS[0],points:TRACKS[0].points.map(([x,z])=>[x+5000,z-4000])}),floor=basicFloor(circuit);
  assert.equal(floor.material.transparent,false);assert.equal(floor.geometry.index.count,6);
  assert.ok(floor.position.x>4000);assert.ok(floor.position.z< -3000);
  const group=new THREE.Group();group.add(floor);let disposed=0;floor.geometry.addEventListener('dispose',()=>disposed++);floor.material.addEventListener('dispose',()=>disposed++);disposeSceneGroup(group);assert.equal(disposed,2);
});

test('zero MSAA renders directly and disabling MSAA releases offscreen resources',()=>{
  let draws=0,resets=0,disposed=0;
  const renderer={capabilities:{maxSamples:4},info:{autoReset:true,reset(){resets++;}},render(){draws++;}};
  const pipeline=new GameplayRenderer(renderer,new THREE.Scene(),new THREE.Camera());pipeline.setGraphics({samples:0});pipeline.render(1/120);
  assert.equal(draws,1);assert.equal(resets,1);assert.equal(renderer.info.autoReset,true);assert.equal(pipeline.composer,undefined);
  pipeline.samples=4;pipeline.composer={dispose(){disposed++;}};pipeline.output={dispose(){disposed++;}};pipeline.setGraphics({samples:0});pipeline.render(1/120);
  assert.equal(disposed,2);assert.equal(draws,2);assert.equal(pipeline.composer,null);
});

test('local shadows follow the car at 60 Hz while rendering at 120 Hz, and stop refreshing in pause',()=>{
 const world=Object.create(World.prototype);world.sun=new THREE.DirectionalLight();world.renderer={shadowMap:{enabled:true,needsUpdate:false}};world.shadowElapsed=0;world.shadowHz=60;world.shadowReady=false;
 const drive={x:2400,y:6,z:-1200};let refreshes=0;
 for(let i=0;i<120;i++){world.renderer.shadowMap.needsUpdate=false;world.updateShadows(1/120,{...drive,x:drive.x+i},true);if(world.renderer.shadowMap.needsUpdate)refreshes++;}
 assert.equal(refreshes,60);assert.ok(Math.abs(world.sun.target.position.x-(drive.x+118))<.001);assert.equal(world.sun.target.position.y,6);
 world.renderer.shadowMap.needsUpdate=false;world.updateShadows(1,false,false);assert.equal(world.renderer.shadowMap.needsUpdate,false);
 world.shadowReady=false;world.updateShadows(1/120,drive,false);assert.equal(world.renderer.shadowMap.needsUpdate,true);
 world.renderer.shadowMap.enabled=false;world.renderer.shadowMap.needsUpdate=false;world.updateShadows(1,drive,true);assert.equal(world.renderer.shadowMap.needsUpdate,false);
});
