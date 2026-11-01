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

test('relative trackpad starts neutral anywhere and produces graduated, symmetric steering',()=>{
 const zone=surface(),pointers=new Map();bindTouchSteering(zone,pointers,()=>true,()=>({touchMode:'trackpad',sensitivity:1}));
 zone.send('pointerdown',1,800);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer:0,brake:false});
 zone.send('pointermove',1,840);const small=readDrivingInput(new Set(),pointers).steer;assert.ok(small>0&&small<.5);
 zone.send('pointermove',1,900);const large=readDrivingInput(new Set(),pointers).steer;assert.ok(large>small&&large<1);
 zone.send('pointermove',1,760);assert.equal(readDrivingInput(new Set(),pointers).steer,-small);
 zone.send('pointermove',1,799);assert.equal(readDrivingInput(new Set(),pointers).steer,0);
 zone.send('pointerup',1);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer:0,brake:false});
});
test('trackpad second finger brakes without moving the origin, and remaining fingers re-anchor on primary release',()=>{
 const zone=surface(),pointers=new Map();bindTouchSteering(zone,pointers,()=>true,()=>({touchMode:'trackpad',sensitivity:1}));
 zone.send('pointerdown',1,300);zone.send('pointermove',1,370);const steer=readDrivingInput(new Set(),pointers).steer;
 zone.send('pointerdown',2,900);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer,brake:true});
 zone.send('pointerup',2);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer,brake:false});
 zone.send('pointerdown',2,900);zone.send('pointerup',1);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer:0,brake:false});
 zone.send('pointermove',2,850);assert.ok(readDrivingInput(new Set(),pointers).steer<0);
 zone.send('pointercancel',2);assert.equal(pointers.size,0);
});
test('trackpad cannot retain input after leaving the screen area, pause, rotation or a mode change',()=>{
 const zone=surface(),pointers=new Map();let mode='trackpad',running=true;const controls=bindTouchSteering(zone,pointers,()=>running,()=>({touchMode:mode,sensitivity:.7}));
 zone.send('pointerdown',1,300);zone.send('pointermove',1,500);assert.ok(readDrivingInput(new Set(),pointers).steer>0);
 zone.send('pointermove',1,600,390);assert.equal(pointers.size,0);zone.send('pointermove',1,600,600);assert.equal(readDrivingInput(new Set(),pointers).steer,0);
 running=false;zone.send('pointermove',1,700);assert.equal(pointers.size,0);controls.clear();running=true;mode='buttons';zone.send('pointermove',1,800);assert.equal(pointers.size,0);
 zone.send('pointerdown',2,800);assert.equal(readDrivingInput(new Set(),pointers).steer,1);controls.dispose();assert.equal(pointers.size,0);
});
