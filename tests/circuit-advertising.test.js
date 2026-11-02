import test from 'node:test';import assert from 'node:assert/strict';
import {Circuit} from '../src/circuit.js';import {KIT_PRESETS,kitConfig} from '../src/track-pieces.js';
import {generateCircuitDressing,addCircuitInfrastructure} from '../src/circuit-dressing.js';
import {advertisingSite,advertisingAvoidsSigns} from '../src/circuit-advertising.js';

test('advertising uses complete readable panels on sensible sites and preserves existing safety',()=>{
  let total=0;
  for(const i of [0,1,4]){
    const c=new Circuit(kitConfig(KIT_PRESETS[i].pieces)),d=generateCircuitDressing(c),valid=advertisingSite(c),rows=d.infrastructure.ads;
    total+=rows.length;assert.ok(rows.length<=32);
    for(const [a,b,side,offset]of rows){assert.ok(Math.abs((b-a)*c.length-6)<.01);assert.ok(valid(a,b,side,offset));assert.ok(advertisingAvoidsSigns(c,[a,b,side],d));}
    for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++)assert.ok(Math.abs((rows[a][0]+rows[a][1]-rows[b][0]-rows[b][1])/2)*c.length>=18);
    const next=addCircuitInfrastructure(c,d,{advertising:false});assert.deepEqual(next.tires,d.tires);assert.deepEqual(next.segments,d.segments);assert.deepEqual(next.facilities,d.facilities);assert.equal(next.infrastructure.ads.length,0);
  }
  assert.ok(total>0);
});
test('advertising is rejected under an upper road even when a laterally offset panel is not directly covered',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[1].pieces)),valid=advertisingSite(c);let checks=0;
  for(let i=8;i<400;i++){
    const u=i/400,p=c.at(u),other=c.nearest(p.x,p.z,{exclude:u,window:.04});
    if(other.y>p.y+1&&other.distance<c.widthAt(other.progress)/2&&Math.abs(p.y)<.3){
      for(const side of [-1,1])assert.equal(valid(u-3/c.length,u+3/c.length,side,4.5),false);checks++;
    }
  }
  assert.ok(checks>0,'fixture must include a genuine lower carriageway');
});

test('triangular advertising has four-metre height and opaque faces visible from above',async()=>{
  const {buildCircuitInfrastructure}=await import('../src/circuit-infrastructure-view.js');
  const {disposeSceneGroup}=await import('../src/basic-scene.js');
  const {ADVERTISING_SHAPE,advertisingCenter}=await import('../src/circuit-advertising.js');
  const c=new Circuit(kitConfig(KIT_PRESETS[4].pieces)),d=generateCircuitDressing(c);
  assert.ok(d.infrastructure.ads.length);
  const group=buildCircuitInfrastructure(c,{rails:[],fences:[],ads:d.infrastructure.ads},d);
  const faces=group.children.filter(o=>o.name.startsWith('club-ad:'));assert.ok(faces.length);
  let max=0;for(const mesh of faces){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    assert.equal(mesh.material.transparent,false);
    for(let i=0;i<p.count;i++){max=Math.max(max,p.getY(i));assert.ok(n.getY(i)>.4,'advertising normals must point upwards');}
  }
  assert.ok(Math.abs(max-ADVERTISING_SHAPE.height)<.01);
  assert.ok(advertisingCenter(3.8)-ADVERTISING_SHAPE.halfBase>3.8);
  disposeSceneGroup(group);
});
