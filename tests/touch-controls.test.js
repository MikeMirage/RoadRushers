import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchSteering,readDrivingInput,touchDirection } from '../src/input.js';

function surface(){
  const handlers=new Map(),captures=new Set(),nodes=new Map();
  for(const id of ['#steer-left','#steer-right']){const names=new Set();nodes.set(id,{classList:{toggle(name,on){if(on)names.add(name);else names.delete(name);},contains:n=>names.has(n)}});}
  return {handlers,captures,querySelector:id=>nodes.get(id),getBoundingClientRect:()=>({left:0,right:1000,top:400,bottom:800}),
    addEventListener:(n,h)=>handlers.set(n,h),removeEventListener:n=>handlers.delete(n),
    setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id),
    send(type,id,x=200,y=600){handlers.get(type)?.({pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,preventDefault(){}});}};
}
test('the lower left and right halves are exact contiguous steering areas',()=>{
  const rect={left:0,right:390,top:422,bottom:844};
  assert.equal(touchDirection(0,422,rect),-1);assert.equal(touchDirection(194.9,843,rect),-1);
  assert.equal(touchDirection(195,422,rect),1);assert.equal(touchDirection(389,843,rect),1);
  for(const [x,y]of [[195,421],[195,844],[-1,600],[390,600]])assert.equal(touchDirection(x,y,rect),0);
});
test('two fingers brake, releasing either returns steering, and crossing the middle changes direction',()=>{
  const zone=surface(),pointers=new Map(),controls=bindTouchSteering(zone,pointers,()=>true),keys=new Set();
  zone.send('pointerdown',1,100);assert.deepEqual(readDrivingInput(keys,pointers),{steer:-1,brake:false});
  zone.send('pointerdown',2,900);assert.deepEqual(readDrivingInput(keys,pointers),{steer:0,brake:true});
  zone.send('pointerup',2);assert.deepEqual(readDrivingInput(keys,pointers),{steer:-1,brake:false});
  zone.send('pointermove',1,900);assert.deepEqual(readDrivingInput(keys,pointers),{steer:1,brake:false});
  zone.send('pointerup',1);assert.deepEqual(readDrivingInput(keys,pointers),{steer:0,brake:false});controls.dispose();
});
test('leaving the lower half releases steering and returning while held resumes it',()=>{
  const zone=surface(),pointers=new Map();bindTouchSteering(zone,pointers,()=>true);
  zone.send('pointerdown',1,100);zone.send('pointermove',1,100,399);assert.equal(pointers.size,0);
  zone.send('pointermove',1,700,500);assert.equal(pointers.get(1),1);
  zone.send('pointercancel',1);assert.equal(pointers.size,0);assert.equal(zone.querySelector('#steer-right').classList.contains('pressed'),false);
});
test('pause, rotation, lost capture and disposal cannot leave a held direction behind',()=>{
  const zone=surface(),pointers=new Map();let running=false;const controls=bindTouchSteering(zone,pointers,()=>running);
  zone.send('pointerdown',1);assert.equal(pointers.size,0);running=true;
  zone.send('pointerdown',1);zone.send('pointerdown',2,900);controls.clear();
  assert.equal(pointers.size,0);assert.equal(zone.captures.size,0);zone.send('pointermove',1);assert.equal(pointers.size,0);
  zone.send('pointerdown',3);zone.send('lostpointercapture',3);assert.equal(pointers.size,0);
  controls.dispose();assert.equal(zone.handlers.size,0);
});
