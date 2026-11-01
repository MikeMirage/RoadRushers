import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceStats} from '../src/performance.js';

function setup(search=''){
 const previous={document:globalThis.document,location:globalThis.location};
 globalThis.location={search};globalThis.document={body:{appendChild(){}},createElement(){return {dataset:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){this.removed=true;}};}};
 return {stats:new PerformanceStats(),restore(){for(const [k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}};
}

test('the compact meter shows only FPS and avoids collecting diagnostic samples',()=>{
 const {stats,restore}=setup();try{
  stats.setEnabled(true);assert.equal(stats.output.dataset.detailed,'false');assert.equal(stats.output.attributes['aria-live'],'off');
  for(let i=0;i<125;i++)stats.sample(1/120,10,{get info(){throw Error('compact FPS should not inspect renderer diagnostics');}});
  assert.equal(stats.output.textContent,'120 FPS');assert.equal(stats.samples.length,0);
  const output=stats.output;stats.setEnabled(false);assert.equal(output.removed,true);assert.equal(stats.output,null);
 }finally{restore();}
});

test('technical details remain opt-in, and resetting excludes time spent in menus',()=>{
 const {stats,restore}=setup();try{
  stats.setEnabled(true,{detailed:true});for(let i=0;i<25;i++)stats.sample(1/30,2,{});stats.reset();
  for(let i=0;i<125;i++)stats.sample(1/120,.5,{info:{render:{calls:20,triangles:12000}},getPixelRatio:()=>1.25});
  assert.match(stats.output.textContent,/120 FPS · p95/);assert.match(stats.output.textContent,/20 llamadas/);assert.equal(stats.output.dataset.detailed,'true');
 }finally{restore();}
});

test('the diagnostic URL still forces the detailed meter',()=>{
 const {stats,restore}=setup('?stats=1');try{assert.equal(stats.output.dataset.detailed,'true');stats.setEnabled(false);assert.ok(stats.output);}finally{restore();}
});
