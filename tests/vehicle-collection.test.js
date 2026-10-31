import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NEW_VEHICLES, VEHICLE_BATCHES, vehiclesOnPage } from '../src/vehicle-catalog.js';
import { VEHICLES } from '../src/config.js';
import { buildCollectionVehicle, customizeVehicle, applyWrapTexture, disposeVehicle } from '../src/vehicle-modeler.js';
import { loadCustomization, saveCustomization, wrapTexture } from '../src/vehicle-customization.js';
import { inspectVehicle } from '../scripts/vehicle-qa.mjs';
import { setBrakeLights } from '../src/vehicles.js';

test('50 original designs form five complete batches, alongside the three cup cars',()=>{
  assert.equal(NEW_VEHICLES.length,50);assert.equal(VEHICLES.length,53);
  assert.equal(new Set(VEHICLES.map(v=>v.id)).size,53);
  for(const b of VEHICLE_BATCHES)assert.equal(vehiclesOnPage(VEHICLES,b.id).length,10);
  assert.equal(vehiclesOnPage(VEHICLES,'originals').length,3);
  assert.equal(new Set(NEW_VEHICLES.map(v=>JSON.stringify(v.design))).size,50);
});

for(const batch of VEHICLE_BATCHES)test(`${batch.name}: geometry, UV atlas, wheel pivots and functional brake lenses`,()=>{
  for(const v of NEW_VEHICLES.filter(v=>v.batch===batch.id)){
    const m=buildCollectionVehicle(v),qa=inspectVehicle(m);assert.deepEqual(qa.errors,[],v.id);
    const left=m.sockets['trail-rear-left'].position,right=m.sockets['trail-rear-right'].position;
    assert.equal(left.z,-v.design.wheelbase);assert.equal(right.z,left.z);assert.ok(left.x<0&&right.x>0);
    for(const slot of m.wheelSlots){assert.equal(slot.tire.parent,slot.roll);assert.equal(slot.rim.parent,slot.roll);}
    const brakes=new Box3();m.group.traverse(o=>{if(o.isMesh&&o.material===m.materials.brakes)brakes.union(new Box3().setFromObject(o));});
    assert.ok(brakes.max.z<-.9&&brakes.min.x<0&&brakes.max.x>0,`${v.id}: rear lenses`);
    setBrakeLights(m.brakeMaterials,1);assert.ok(m.materials.brakes.emissiveIntensity>2);
    setBrakeLights(m.brakeMaterials,0);assert.equal(m.materials.brakes.emissiveIntensity,0);
    disposeVehicle(m);
  }
});

test('paint, wheels, tires, glass and wrapping are independent on every instance',()=>{
  const a=buildCollectionVehicle(NEW_VEHICLES[0]),b=buildCollectionVehicle(NEW_VEHICLES[0]);
  const geometry=a.materials.paint,oldTire=a.wheelSlots[0].tire.geometry,oldRim=a.wheelSlots[0].rim.geometry,position=a.wheels[0].parent.position.clone();
  customizeVehicle(a,{color:'#ad3344',secondary:'#123456',rim:'mesh',tire:'all-terrain',rimColor:'#cca055',glass:'#132d3d',glassOpacity:.35});
  assert.notEqual(a.materials.paint.color.getHex(),b.materials.paint.color.getHex());assert.equal(a.materials.paint,geometry);
  assert.notEqual(a.wheelSlots[0].tire.geometry,oldTire);assert.notEqual(a.wheelSlots[0].rim.geometry,oldRim);
  assert.equal(a.materials.glass.opacity,.35);assert.deepEqual(a.wheels[0].parent.position,position);
  for(const style of ['stripes','checkers','diagonal']){const t=wrapTexture(style);applyWrapTexture(a,t);assert.equal(a.materials.paint.map,t);assert.equal(b.materials.paint.map,null);t.dispose();}
  assert.ok(Math.abs(new Box3().setFromObject(a.group).min.y)<.002);
  disposeVehicle(a);disposeVehicle(b);
});

test('customization survives storage reload and rejects invalid saved values',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},v=NEW_VEHICLES[17];
  const cfg=loadCustomization(v,storage);saveCustomization(v.id,{...cfg,color:'#123abc',rim:'mesh'},storage);
  assert.equal(loadCustomization(v,storage).color,'#123abc');assert.equal(loadCustomization(v,storage).rim,'mesh');
  const other=NEW_VEHICLES[18];storage.setItem('roadrushers.customization.v1',JSON.stringify({[other.id]:{color:'javascript:bad',rim:'unknown',glassOpacity:20}}));
  const valid=loadCustomization(other,storage);assert.equal(valid.color,other.color);assert.equal(valid.glassOpacity,1);assert.notEqual(valid.rim,'unknown');
});

test('50 shipped GLBs reload with wheel hierarchy, UVs and customization extras intact',async()=>{
  const loader=new GLTFLoader();
  for(const v of NEW_VEHICLES){
    const bytes=await readFile(new URL(`../public/${v.modelUrl}`,import.meta.url));
    const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
    const root=gltf.scene.getObjectByName(v.id);assert.ok(root,v.id);assert.equal(root.userData.vehicleId,v.id);assert.equal(root.userData.customization.version,1);
    for(const side of ['left','right']){
      assert.ok(root.getObjectByName(`steer-front-${side}`).getObjectByName(`wheel-front-${side}`));
      assert.equal(root.getObjectByName(`trail-rear-${side}`).userData.socket,'trail-rear');
    }
    const paint=root.getObjectByName('exterior-paint');assert.ok(paint.geometry.attributes.uv);assert.equal(paint.material.name,'exterior-paint');
    const size=new Box3().setFromObject(root).getSize(new Vector3());assert.ok(size.y>.8&&size.z>2);
    const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
  }
});
