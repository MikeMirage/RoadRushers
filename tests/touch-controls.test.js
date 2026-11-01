import test from 'node:test';
import assert from 'node:assert/strict';
import { bindTouchSteering,readDrivingInput,touchDirection,trackpadSteer } from '../src/input.js';

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

test('absolute trackpad uses the first touch position and the full width for graduated steering',()=>{
 const zone=surface(),pointers=new Map();bindTouchSteering(zone,pointers,()=>true,()=>({touchMode:'trackpad',sensitivity:1}));
 const read=()=>readDrivingInput(new Set(),pointers);
 zone.send('pointerdown',1,250);const left=read().steer;assert.ok(left<-.45&&left>-.55);
 zone.send('pointermove',1,750);const right=read().steer;assert.equal(right,-left);
 zone.send('pointermove',1,500);assert.deepEqual(read(),{steer:0,brake:false});
 zone.send('pointermove',1,0);assert.equal(read().steer,-1);
 zone.send('pointermove',1,1000);assert.equal(read().steer,1);
 zone.send('pointerup',1);assert.deepEqual(read(),{steer:0,brake:false});
 zone.send('pointerdown',2,750);assert.equal(read().steer,right,'the same target must not depend on a previous touch origin');
 zone.send('pointerup',2);assert.equal(pointers.size,0);
});
test('trackpad response uses the whole width at every sensitivity and screen size',()=>{
 for(const width of [320,390,844,1000])for(const sensitivity of [.7,1,1.4]){
  const bounds={left:37,right:37+width},centre=37+width/2;
  assert.equal(trackpadSteer(bounds.left,bounds,sensitivity),-1);assert.equal(trackpadSteer(bounds.right,bounds,sensitivity),1);assert.equal(trackpadSteer(centre,bounds,sensitivity),0);
  assert.equal(trackpadSteer(centre+2,bounds,sensitivity),0);
  let previous=-1;for(let x=bounds.left;x<=bounds.right;x++){const steer=trackpadSteer(x,bounds,sensitivity);assert.ok(steer>=previous&&steer>=-1&&steer<=1);previous=steer;}
  assert.equal(trackpadSteer(centre-width/4,bounds,sensitivity),-trackpadSteer(centre+width/4,bounds,sensitivity));
 }
 const bounds={left:0,right:1000};assert.ok(trackpadSteer(750,bounds,.7)<trackpadSteer(750,bounds,1));assert.ok(trackpadSteer(750,bounds,1)<trackpadSteer(750,bounds,1.4));
});
test('second finger brakes without changing the steering target, and handoff uses the remaining position',()=>{
 const zone=surface(),pointers=new Map();bindTouchSteering(zone,pointers,()=>true,()=>({touchMode:'trackpad',sensitivity:1}));
 zone.send('pointerdown',1,300);zone.send('pointermove',1,370);const steer=readDrivingInput(new Set(),pointers).steer;
 zone.send('pointerdown',2,900);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer,brake:true});
 zone.send('pointerup',2);assert.deepEqual(readDrivingInput(new Set(),pointers),{steer,brake:false});
 zone.send('pointerdown',2,900);zone.send('pointerup',1);const handed=readDrivingInput(new Set(),pointers);assert.equal(handed.brake,false);assert.ok(handed.steer>.75&&handed.steer<.85);
 zone.send('pointermove',2,850);assert.ok(readDrivingInput(new Set(),pointers).steer<handed.steer);
 zone.send('pointercancel',2);assert.equal(pointers.size,0);
});
test('absolute trackpad releases outside the lower half and cleans up on pause, rotation and mode changes',()=>{
 const zone=surface(),pointers=new Map();let mode='trackpad',running=true;const controls=bindTouchSteering(zone,pointers,()=>running,()=>({touchMode:mode,sensitivity:.7}));
 zone.send('pointerdown',1,800);assert.ok(readDrivingInput(new Set(),pointers).steer>0);
 zone.send('pointermove',1,600,390);assert.equal(pointers.size,0);
 zone.send('pointermove',1,600,600);assert.ok(readDrivingInput(new Set(),pointers).steer>0,'returning uses the actual horizontal target');
 zone.send('pointermove',1,-1,600);assert.equal(pointers.size,0);
 running=false;zone.send('pointermove',1,700);assert.equal(pointers.size,0);controls.clear();running=true;mode='buttons';zone.send('pointermove',1,800);assert.equal(pointers.size,0);
 zone.send('pointerdown',2,800);assert.equal(readDrivingInput(new Set(),pointers).steer,1);controls.dispose();assert.equal(pointers.size,0);
});
