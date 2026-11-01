import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4,Vector3,MeshBasicMaterial } from 'three';
import { PIECE_CATALOG,KIT_PRESETS,samplePiece,compileLayout,kitConfig } from '../src/track-pieces.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel,LapTracker } from '../src/physics.js';
import { CameraRig } from '../src/camera.js';
import { roadRibbon,trackStructures } from '../src/road-geometry.js';
import { VEHICLES } from '../src/config.js';

const eight=()=>new Circuit(kitConfig(KIT_PRESETS[1].pieces));
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);

test('all catalog pieces have a common flat, unbanked connection contract',()=>{
  assert.ok(PIECE_CATALOG.length>=100);
  for(const spec of PIECE_CATALOG){
    const {points}=samplePiece(spec.id),a=points[0],b=points.at(-1);
    for(const field of ['x','y','z','heading','grade','bank'])near(a[field],0);
    near(b.grade,0);near(b.bank,0);
    if(spec.kind==='curve')near(b.heading,(spec.direction==='right'?-1:1)*spec.angle*Math.PI/180);
    else near(b.heading,0);
    near(b.y,spec.rise||0);
    for(const p of points)for(const value of Object.values(p))assert.ok(Number.isFinite(value));
  }
});

test('all example assemblies close exactly in position, height and heading',()=>{
  for(const preset of KIT_PRESETS){const data=compileLayout(preset.pieces);assert.equal(data.closed,true,preset.name);assert.deepEqual(data.errors,[]);near(data.gap,0);near(data.heightGap,0);near(data.angleGap,0);assert.ok(data.maxGrade<=.36);}
});

test('the figure eight has one crossing with two distinct levels and safe clearance',()=>{
  const c=eight(),[cross]=c.layout.crossings;assert.equal(c.layout.crossings.length,1);near(cross.clearance,6);
  const low=c.at(cross.lowerProgress),high=c.at(cross.upperProgress);
  assert.ok(Math.hypot(low.x-high.x,low.z-high.z)<.04);near(low.y,0);near(high.y,6);
  const lower=c.nearest(cross.x,cross.z,{progress:cross.lowerProgress,y:0});
  const upper=c.nearest(cross.x,cross.z,{progress:cross.upperProgress,y:6});
  assert.ok(Math.abs(lower.progress-cross.lowerProgress)<.001);assert.ok(Math.abs(upper.progress-cross.upperProgress)<.001);
});

test('both traversals of the crossing preserve their own route and lap-gate continuity',()=>{
  const c=eight(),cross=c.layout.crossings[0];
  for(const progress of [cross.lowerProgress,cross.upperProgress]){
    const car=new DriveModel(c);car.reset(c,progress-.015);const p=c.at(progress-.015);
    car.vx=Math.sin(p.heading)*19;car.vz=Math.cos(p.heading)*19;
    let previous=car.road.progress;
    for(let i=0;i<130;i++){car.step(1/120,0,'track','clear');assert.ok(Math.abs(car.road.progress-previous)<.002,'jumped to the crossing branch');previous=car.road.progress;}
    assert.ok(car.road.progress>progress);assert.ok(Math.abs(car.y-(progress===cross.lowerProgress?0:6))<.1);
  }
});

test('open connections, a ground-level bridge and a crossing without clearance are rejected',()=>{
  assert.equal(compileLayout(['straight']).closed,false);
  assert.ok(compileLayout(['bridge']).errors.some(e=>e.includes('6 m')));
  assert.ok(compileLayout(['ramp-down']).errors.some(e=>e.includes('debajo')));
  const flat=KIT_PRESETS[1].pieces.map(p=>p==='ramp-up'||p==='ramp-down'?{id:'straight',length:28}:p==='bridge'?'straight':p);
  assert.ok(compileLayout(flat).errors.some(e=>e.includes('separación vertical')));
});

test('rendered road vertices follow the same elevation and banking as physics',()=>{
  for(const pieces of [['ramp-up'],['bank-right'],['jump']]){
    const c=new Circuit(kitConfig(pieces)),mesh=roadRibbon(c,-5,5,.035,new MeshBasicMaterial()),a=mesh.geometry.attributes.position;
    for(let i=0;i<=c.count;i+=12)for(let side=0;side<2;side++){const p=c.at(i/c.count,side?5:-5),n=i*2+side;near(a.getY(n),p.y+.035,1e-5);near(a.getX(n),p.x,1e-5);}
  }
});

test('bridge piers leave the lower road corridor unobstructed',()=>{
  const c=eight(),cross=c.layout.crossings[0],structure=trackStructures(c),piers=structure.children.find(o=>o.isInstancedMesh),m=new Matrix4(),position=new Vector3();
  assert.ok(piers?.count>2);
  for(let i=0;i<piers.count;i++){piers.getMatrixAt(i,m);position.setFromMatrixPosition(m);const lower=c.nearest(position.x,position.z,{progress:cross.lowerProgress,window:.09});assert.ok(lower.distance>c.config.width/2+1.2);}
});

test('jump crests create a ballistic flight and a stable landing on the real surface',()=>{
  const c=new Circuit(kitConfig(['jump','straight-long'])),car=new DriveModel(c);car.vz=20;
  let air=0,gap=0,landed=false,wasAir=false;
  for(let i=0;i<360;i++){car.step(1/120,0,'track','clear');air=Math.max(air,car.airTime);gap=Math.max(gap,car.y-car.road.y);assert.ok(car.y>=car.road.y-1e-9);if(!car.grounded)wasAir=true;else if(wasAir)landed=true;}
  assert.ok(air>.15&&air<1);assert.ok(gap>.2&&gap<2);assert.equal(landed,true);assert.equal(car.grounded,true);near(car.y,car.road.y);near(car.vy,0);
});

test('camera follows elevated decks without shifting the car out of its overhead framing',()=>{
  const base={x:0,y:0,z:0,vx:0,vz:15,heading:0},rig=new CameraRig().update(1/60,base);
  const initial=rig.position.y,look=rig.look.y;rig.update(1/60,{...base,y:6});near(rig.position.y,initial+6);near(rig.look.y,look+6);
  for(let i=0;i<240;i++)rig.update(1/60,{...base,y:6});near(rig.position.y,initial+6,.01);assert.ok(rig.position.y-rig.look.y>40);
});

test('every car completes all three modular assemblies with only digital left/right inputs',()=>{
  for(const preset of KIT_PRESETS)for(const vehicle of VEHICLES){
    const c=new Circuit(kitConfig(preset.pieces)),car=new DriveModel(c,vehicle),laps=new LapTracker();let result=null;
    for(let i=0;i<120*120;i++){
      const p=c.at(car.road.progress+.02),desired=Math.atan2(p.x-car.x,p.z-car.z),delta=Math.atan2(Math.sin(desired-car.heading),Math.cos(desired-car.heading));
      car.step(1/120,delta>.035?-1:delta<-.035?1:0,'track','clear');assert.ok(Number.isFinite(car.y));
      result=laps.step(1/120,car.road.progress);if(result)break;
    }
    assert.ok(result,`${vehicle.id} could not finish ${preset.name}`);
  }
});

test('overlapping laps and malformed stored piece definitions cannot become drivable layouts',()=>{
  const repeated=compileLayout([...KIT_PRESETS[0].pieces,...KIT_PRESETS[0].pieces]);
  assert.ok(repeated.errors.length>0);
  assert.throws(()=>samplePiece({id:'missing',kind:'straight',length:24}));
  assert.throws(()=>samplePiece({id:'straight',length:Infinity}));
});
