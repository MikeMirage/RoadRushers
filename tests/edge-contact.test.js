import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveEdgeContact,edgeRadius} from '../src/edge-contact.js';
import {ContactAudioEvents} from '../src/contact-audio.js';
import {CameraRig} from '../src/camera.js';

const car=(extra={})=>({vehicle:{id:'coda'},circuit:{widthAt:()=>12},road:{x:0,y:0,z:0,offset:5.3,nx:1,nz:0,progress:0,supported:true},x:5.3,y:0,z:0,vx:.3,vz:20,heading:0,angularSpeed:0,impact:0,edgeHitId:0,edgeScrape:0,...extra});
test('grazing contact contains the body without destroying along-wall momentum',()=>{
 const c=car();resolveEdgeContact(c,1/120);
 assert.ok(c.x<=6-edgeRadius(c));assert.ok(c.vz>19.9);assert.equal(c.vx,0);assert.equal(c.edgeHitId,0);assert.ok(c.edgeScrape>0);assert.ok(c.edgePan>0);
});
test('frontal hit loses normal energy with a restrained rebound and one physical event',()=>{
 const c=car({heading:Math.PI/2,vx:15,vz:0});const before=c.vx**2;
 resolveEdgeContact(c,1/120);assert.equal(c.edgeHitId,1);assert.equal(c.edgeImpact,1);assert.ok(c.vx<0&&c.vx>-1.5);assert.ok(c.vx**2<before*.02);assert.ok(c.x<=6-edgeRadius(c));
 for(let i=0;i<120;i++){c.vx=.12;c.road.offset=6-edgeRadius(c);resolveEdgeContact(c,1/120);}
 assert.equal(c.edgeHitId,1,'steady pressure must not generate a machine-gun of hits');
});
test('left/right response is symmetric and contact switches off away from the barrier',()=>{
 const right=car({vx:4}),left=car({x:-5.3,vx:-4,road:{x:0,y:0,z:0,offset:-5.3,nx:1,nz:0,progress:0,supported:true}});
 resolveEdgeContact(right,1/120);resolveEdgeContact(left,1/120);
 assert.equal(right.edgeImpact,left.edgeImpact);assert.equal(right.edgePan,-left.edgePan);assert.ok(Math.abs(right.vx+left.vx)<1e-9);assert.equal(right.vz,left.vz);
 right.road.offset=0;for(let i=0;i<90;i++)resolveEdgeContact(right,1/120);assert.equal(right.edgeTouching,false);assert.ok(right.edgeScrape<1e-6);
});
test('the body footprint depends on vehicle dimensions and heading; gaps have no invisible wall',()=>{
 const c=car();const side=edgeRadius(c);c.heading=Math.PI/2;assert.ok(edgeRadius(c)>side);
 c.road.supported=false;c.vx=10;const original=c.x;resolveEdgeContact(c,1/120);assert.equal(c.x,original);assert.equal(c.vx,10);assert.equal(c.edgeHitId,0);
 c.road.supported=true;c.activeGap={};c.y=3;resolveEdgeContact(c,1/120);assert.equal(c.x,original);
});
test('audio reacts once per physical onset, keeps direction and does not replay a paused hit',()=>{
 const events=new ContactAudioEvents(),s={edgeHitId:1,edgeImpact:.8,impact:.8,edgeTouching:true,edgePan:-.65};
 assert.deepEqual(events.update(s,true,1),{strength:.8,pan:-.65});
 for(let i=1;i<100;i++)assert.equal(events.update(s,true,1+i/120),null);
 assert.ok(events.update({...s,edgeHitId:2},true,2));
 assert.equal(events.update({...s,edgeHitId:3},false,3),null);assert.equal(events.update({...s,edgeHitId:3},true,4),null);
 assert.equal(events.update({...s,edgeHitId:3,impact:0,edgeTouching:false},true,4.1),null);
 assert.ok(events.update({impact:.7},true,5),'car-to-car impact remains audible');
});
test('camera contact impulse is directional, bounded and settles without permanent drift',()=>{
 const rig=new CameraRig();rig.updateContact(1/120,{edgeHitId:0},true);
 const s={edgeHitId:1,edgeImpact:1,edgeNormalX:1,edgeNormalZ:0};rig.updateContact(1/120,s,false);
 assert.ok(rig.contactOffset.x<0);assert.ok(rig.contactOffset.length()<=.10);
 for(let i=0;i<240;i++)rig.updateContact(1/120,s,false);
 assert.ok(rig.contactOffset.length()<1e-5);rig.updateContact(1/120,{...s,edgeHitId:2},true);assert.equal(rig.contactOffset.length(),0);
});
