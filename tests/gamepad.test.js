import test from 'node:test';
import assert from 'node:assert/strict';
import {GamepadReader,readStandardGamepad,gamepadAxis,directionalTarget} from '../src/gamepad.js';
import {DriveModel} from '../src/physics.js';
import {Circuit} from '../src/circuit.js';
import {TRACKS,VEHICLES} from '../src/config.js';
import {readDrivingInput,bindMouseDriving} from '../src/input.js';
const pad=(pressed={},axes=[0,0,0,0],index=0)=>({index,id:'DualSense 054c',mapping:'standard',connected:true,axes,buttons:Array.from({length:17},(_,i)=>({value:pressed[i]??0,pressed:(pressed[i]??0)>.5}))});
test('standard pad axes reject noise and preserve full steering and analog triggers',()=>{
 assert.equal(gamepadAxis(.1),0);assert.equal(gamepadAxis(-1),-1);assert.equal(gamepadAxis(Infinity),0);
 const input=readStandardGamepad(pad({6:.35,7:.8},[-.7,0,.4,-.3]));assert.equal(input.family,'playstation');assert.ok(input.steer<-.6);assert.equal(input.brake,.35);assert.equal(input.throttle,.8);assert.ok(input.orbitX>0);
 assert.equal(readStandardGamepad({...pad(),mapping:''}),null);assert.equal(readStandardGamepad({...pad(),connected:false}),null);
});
test('confirm fires only on press, while navigation has a bounded repeat delay',()=>{
 const reader=new GamepadReader();assert.deepEqual(reader.sample([pad()],0).actions,[]);
 assert.deepEqual(reader.sample([pad({0:1})],10).actions,['confirm']);assert.deepEqual(reader.sample([pad({0:1})],400).actions,[]);
 reader.sample([pad()],420);assert.deepEqual(reader.sample([pad({0:1})],430).actions,['confirm']);
 assert.ok(reader.sample([pad({15:1})],500).actions.includes('right'));assert.deepEqual(reader.sample([pad({15:1})],800).actions,[]);assert.deepEqual(reader.sample([pad({15:1})],850).actions,['right']);
 assert.deepEqual(reader.sample([pad({15:1})],900).actions,[]);
});
test('vertical navigation activates the pad and disconnecting clears held controls',()=>{
 const reader=new GamepadReader();reader.sample([pad()],0);const moving=reader.sample([pad({},[0,-.9,0,0])],10);assert.equal(moving.active,true);assert.ok(moving.actions.includes('up'));
 const lost=reader.sample([],20);assert.equal(lost.disconnected,true);assert.equal(lost.pad,null);assert.deepEqual(lost.actions,[]);assert.equal(reader.sample([],30).disconnected,false);
});
test('pad selection survives sparse slots and a replacement held button cannot confirm',()=>{
 const reader=new GamepadReader();reader.sample([null,pad({},[0,0,0,0],4)],0);
 assert.equal(reader.sample([pad({},[0,0,0,0],1),null,pad({},[0,0,0,0],4)],1).pad.index,4);
 const replacement=reader.sample([pad({0:1},[0,0,0,0],1)],10);assert.equal(replacement.disconnected,true);assert.deepEqual(replacement.actions,[]);
 assert.deepEqual(reader.sample([pad({0:1},[0,0,0,0],1)],20).actions,[]);
});
test('spatial menu navigation follows the requested direction rather than DOM order',()=>{
 const items=[{id:'left',x:20,y:20},{id:'right',x:150,y:20},{id:'below',x:20,y:120}];
 assert.equal(directionalTarget(items,'left','right'),'right');assert.equal(directionalTarget(items,'left','down'),'below');assert.equal(directionalTarget(items,'right','left'),'left');assert.equal(directionalTarget(items,'left','up'),null);
});
test('manual R2 throttle can hold at rest, accelerate progressively and steer while braking',()=>{
 const circuit=new Circuit(TRACKS[0]),stopped=new DriveModel(circuit,VEHICLES[0]),partial=new DriveModel(circuit,VEHICLES[0]),full=new DriveModel(circuit,VEHICLES[0]);
 for(let i=0;i<60;i++){stopped.step(1/120,0,'asphalt','clear','normal',false,0);partial.step(1/120,0,'asphalt','clear','normal',false,.5);full.step(1/120,0,'asphalt','clear','normal',false,1);}
 assert.equal(stopped.speed,0);assert.ok(full.speed>partial.speed);assert.ok(partial.speed>0);
 full.step(1/120,.7,'asphalt','clear','normal',.3,.5);assert.ok(full.steer>0);assert.ok(full.brake>0&&full.brake<.3);
 assert.equal(readDrivingInput(new Set(['KeyS']),new Map()).brake,true);
});
test('mouse steering and braking release on cancellation and pause without stuck inputs',()=>{
 const listeners={},pointers=new Map(),captured=new Set();let running=true;
 const host={addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name],getBoundingClientRect:()=>({left:0,right:1000,top:0,bottom:600}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
 const controls=bindMouseDriving(host,pointers,()=>running),event=(buttons,x=750)=>({pointerType:'mouse',pointerId:1,buttons,clientX:x,preventDefault(){}});
 listeners.pointerdown(event(1));assert.ok(readDrivingInput(new Set(),pointers).steer>.4);
 listeners.pointermove(event(3));assert.equal(readDrivingInput(new Set(),pointers).brake,true);
 listeners.pointercancel({...event(0),type:'pointercancel'});assert.deepEqual(readDrivingInput(new Set(),pointers),{steer:0,brake:false});
 listeners.pointerdown(event(1));running=false;controls.clear();assert.equal(pointers.size,0);assert.equal(captured.size,0);controls.dispose();
});
