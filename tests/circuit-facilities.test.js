import test from 'node:test';import assert from 'node:assert/strict';
import {Circuit} from '../src/circuit.js';import {KIT_PRESETS,kitConfig} from '../src/track-pieces.js';
import {generateCircuitDressing,normalizeCircuitDressing,addCircuitInfrastructure,corridorIndex} from '../src/circuit-dressing.js';
import {FACILITY_LIMITS,normalizeCircuitFacilities} from '../src/circuit-facilities.js';
import {buildCircuitFacilities} from '../src/circuit-facilities-view.js';import {disposeSceneGroup} from '../src/basic-scene.js';

test('facilities are deterministic, persist, preserve existing scenery and respect footprint budgets',()=>{
  for(const preset of KIT_PRESETS){
    const c=new Circuit(kitConfig(preset.pieces)),d=generateCircuitDressing(c),f=d.facilities,clear=corridorIndex(c);
    assert.deepEqual(generateCircuitDressing(c).facilities,f);assert.deepEqual(normalizeCircuitDressing(JSON.parse(JSON.stringify(d))).facilities,f);
    assert.deepEqual(addCircuitInfrastructure(c,d,{rails:false}).facilities,f);
    for(const key of Object.keys(FACILITY_LIMITS))assert.ok(f[key].length<=FACILITY_LIMITS[key]);
    for(const [u,o]of f.marshals){const p=c.at(u,o);assert.ok(clear(p,2.5,3.7));assert.ok(Math.abs(p.y)<.2);for(const [v,t]of d.tires){const q=c.at(v,t);assert.ok(Math.hypot(p.x-q.x,p.z-q.z)>3.4);}}
    for(const [u,o]of f.turnSigns)assert.ok(clear(c.at(u,o),.8,2.3));
    for(const [a,b,side]of f.bridgeRails)for(const u of [a,(a+b)/2,b]){assert.ok(c.hasRoad(u));assert.ok(c.at(u).y>=.99);assert.ok(clear(c.at(u,side*(c.widthAt(u)/2+.72)),.18,1.2));}
  }
});
test('bridge rails and marshal geometry have route attributes for the existing occlusion system',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[1].pieces)),d=generateCircuitDressing(c);assert.ok(d.facilities.bridgeRails.length);assert.ok(d.facilities.marshals.length);assert.ok(d.facilities.turnSigns.length);
  const g=buildCircuitFacilities(c,d.facilities);let triangles=0;
  g.traverse(o=>{if(!o.isMesh)return;assert.equal(o.geometry.attributes.occlusionRoute.count,o.geometry.attributes.position.count);for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));triangles+=o.geometry.index.count/3;assert.ok(o.frustumCulled);assert.equal(o.castShadow,false);});
  assert.ok(triangles<10000);disposeSceneGroup(g);
});
test('invalid facilities are rejected and old presets remain readable',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[1].pieces)),d=generateCircuitDressing(c);delete d.facilities;assert.equal(normalizeCircuitDressing(d).facilities,undefined);assert.ok(addCircuitInfrastructure(c,d,{}).facilities);
  assert.throws(()=>normalizeCircuitFacilities({marshals:Array(13).fill([0,10]),turnSigns:[],bridgeRails:[]}));
  assert.throws(()=>normalizeCircuitFacilities({marshals:[],turnSigns:[[0,NaN,1,0]],bridgeRails:[]}));
  assert.throws(()=>normalizeCircuitFacilities({marshals:[],turnSigns:[],bridgeRails:[[.8,.2,1]]}));
});
