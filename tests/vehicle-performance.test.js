import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES } from '../src/config.js';
import { VEHICLE_BATCHES } from '../src/vehicle-catalog.js';
import { COLLECTION_PERFORMANCE } from '../src/vehicle-performance.js';
import { measureVehicle } from '../scripts/starter-vehicle-benchmark.mjs';
import { renderStudioDetail } from '../src/vehicle-collection-ui.js';

test('every collection model has distinct driving and factory-stat profiles',()=>{
  const cars=VEHICLES.filter(v=>v.prototype);
  assert.equal(Object.keys(COLLECTION_PERFORMANCE).length,cars.length);
  for(const batch of VEHICLE_BATCHES){
    const group=cars.filter(v=>v.batch===batch.id);
    assert.equal(new Set(group.map(v=>JSON.stringify(COLLECTION_PERFORMANCE[v.id]))).size,group.length,batch.id);
    assert.equal(new Set(group.map(v=>v.stats.join(','))).size,group.length,batch.id);
  }
});
test('initial cars start at 3–5 out of ten and all factory cars retain upgrade headroom',()=>{
  for(const id of ['coda','apex','velo','bambino','borough','kafer','parisienne','bubble']){
    const v=VEHICLES.find(v=>v.id===id);assert.ok(v.stats.every(n=>n>=3&&n<=5),`${id}: ${v.stats}`);
    const html=renderStudioDetail(id);assert.equal((html.match(/max="10"/g)||[]).length,3);
  }
  for(const v of VEHICLES)assert.ok(v.stats.every(n=>Number.isFinite(n)&&n>=3&&n<=7.6),v.id);
  assert.ok(VEHICLES.find(v=>v.id==='volt').stats[0]>VEHICLES.find(v=>v.id==='coda').stats[0]);
});
test('European collection differences are measurable in the real driving model',()=>{
  const metrics=VEHICLES.filter(v=>v.batch==='heritage').map(measureVehicle),byId=id=>metrics.find(v=>v.id===id);
  assert.equal(new Set(metrics.map(m=>m.topSpeed)).size,10);
  assert.ok(byId('sovereign').topSpeed>byId('borough').topSpeed*1.1);
  assert.ok(byId('borough').stopFrom18<byId('kafer').stopFrom18*.92);
  assert.ok(byId('kafer').slideAngleDegrees>byId('borough').slideAngleDegrees*1.1);
  assert.ok(byId('deesse').slideAngleDegrees<byId('speedwell').slideAngleDegrees*.7);
});
