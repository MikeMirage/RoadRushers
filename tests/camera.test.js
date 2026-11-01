import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import { CameraRig } from '../src/camera.js';

const drive = { x: 0, z: 0, vx: 0, vz: 16, speed: 16, heading: 0 };
const overheadModes=['topdown','topdown-1.2','topdown-1.4'];
const project=(rig,point,aspect)=>{
  const camera=new PerspectiveCamera(rig.fov,aspect,.05,1000);
  camera.position.copy(rig.position);camera.lookAt(rig.look);camera.updateMatrixWorld();
  return point.clone().project(camera);
};
const carOnScreen=(rig,pose,aspect)=>project(rig,new Vector3(pose.x,(pose.y||0)+.5,pose.z),aspect);

test('the default view is high above the car with a wide framing', () => {
  const rig = new CameraRig().update(1 / 60, drive);
  const offset = rig.position.clone().sub(rig.look);
  assert.ok(offset.y > Math.hypot(offset.x, offset.z), 'camera is not more top-down than a 45 degree view');
  assert.ok(offset.length() > 50, 'camera is still too close to the car');
});

test('a drift or spin of the car does not rotate the overhead view', () => {
  const a = new CameraRig().update(1 / 60, drive);
  const b = new CameraRig().update(1 / 60, { ...drive, heading: Math.PI * 0.8 });
  assert.ok(a.position.distanceTo(b.position) < 1e-9);
  assert.ok(a.look.distanceTo(b.look) < 1e-9);
  const before = a.position.clone().sub(a.look);
  for (let i = 0; i < 120; i++) a.update(1 / 60, { ...drive, heading: i / 120 * Math.PI * 2 });
  assert.ok(before.distanceTo(a.position.clone().sub(a.look)) < 1e-9);
});

test('the trailing camera follows movement rather than the nose during a slide', () => {
  const a = new CameraRig().update(1 / 60, drive, 'chase');
  const b = new CameraRig().update(1 / 60, { ...drive, heading: 1.1 }, 'chase');
  assert.ok(a.position.distanceTo(b.position) < 1e-9);
  assert.ok(a.position.y > 15, 'third person must also leave more room for drift');
});

test('overhead tracking does not accumulate translation or elevation lag', () => {
  const rig = new CameraRig().update(1 / 60, { ...drive, vx: 0, vz: 0 });
  const pose={...drive,x:120,y:18,z:-80,vx:0,vz:0};
  rig.update(1/60,pose);
  const point=carOnScreen(rig,pose,16/9);
  assert.ok(Math.abs(point.x)<1e-9&&Math.abs(point.y)<1e-9,'the car must stay centered after moving or respawning');
});

test('portrait framing leaves additional space around the car', () => {
  const landscape = new CameraRig().update(1 / 60, drive, 'topdown', false, 16 / 9);
  const portrait = new CameraRig().update(1 / 60, drive, 'topdown', false, 9 / 16);
  assert.ok(portrait.position.distanceTo(portrait.look) > landscape.position.distanceTo(landscape.look) * 1.2);
});

test('overhead zooms magnify the existing view exactly without changing its angle or target',()=>{
  for(const aspect of [16/9,9/16]){
    const base=new CameraRig().update(1/120,drive,'topdown',true,aspect),offset=base.position.clone().sub(base.look);
    for(const [mode,zoom]of [['topdown-1.2',1.2],['topdown-1.4',1.4]]){
      const view=new CameraRig().update(1/120,drive,mode,true,aspect),closer=view.position.clone().sub(view.look);
      assert.ok(Math.abs(offset.length()/closer.length()-zoom)<1e-9);
      assert.ok(offset.clone().normalize().distanceTo(closer.clone().normalize())<1e-9);
      assert.ok(base.look.distanceTo(view.look)<1e-9);assert.equal(view.fov,base.fov);
    }
  }
});

test('switching zoom uses the existing smooth follow rather than snapping to the new view',()=>{
  const rig=new CameraRig().update(1/120,drive),before=rig.position.clone(),target=new CameraRig().update(1/120,drive,'topdown-1.4');
  rig.update(1/120,drive,'topdown-1.4');
  assert.ok(rig.position.distanceTo(before)>0);assert.ok(rig.position.distanceTo(before)<1);
  assert.ok(rig.position.distanceTo(target.position)>1);
  for(let i=0;i<240;i++)rig.update(1/120,drive,'topdown-1.4');
  assert.ok(rig.position.distanceTo(target.position)<.02);
  rig.update(1/120,drive,'chase');assert.ok(rig.position.toArray().every(Number.isFinite));
});

test('all overhead zooms keep the car in the central 16 percent of the screen through fast turns, jumps and frame drops',()=>{
  for(const mode of overheadModes)for(const aspect of [320/844,9/16,16/9,844/390,3.5])for(const dt of [1/120,1/30,.25]){
    const rig=new CameraRig(),pose={...drive,y:0};
    for(let i=0;i<160;i++){
      const heading=Math.sin(i*.09)*Math.PI,speed=15+i%90;
      pose.vx=Math.sin(heading)*speed;pose.vz=Math.cos(heading)*speed;
      pose.x+=pose.vx*dt;pose.z+=pose.vz*dt;pose.y=8+Math.sin(i*.13)*8;pose.heading=i*.47;
      if(i===80){pose.x+=300;pose.z-=200;}
      rig.update(dt,pose,mode,false,aspect);
      const point=carOnScreen(rig,pose,aspect);
      assert.ok(Math.abs(point.x)<=.160001&&Math.abs(point.y)<=.160001,`${mode}, aspect ${aspect}, dt ${dt}: car left center (${point.x},${point.y})`);
      assert.ok(point.z>-1&&point.z<1);
    }
  }
});

test('overhead anticipation points along actual motion and eases back to center when stopped',()=>{
  for(const mode of overheadModes){
    const pose={...drive,vx:20,vz:-12},rig=new CameraRig().update(1/60,pose,mode);
    const anticipation=rig.look.clone().sub(new Vector3(pose.x,.5,pose.z));
    assert.ok(anticipation.dot(new Vector3(pose.vx,0,pose.vz))>0);
    assert.ok(anticipation.length()>1);
    const before=rig.look.clone();rig.update(1/120,{...pose,vx:0,vz:0},mode);
    assert.ok(rig.look.distanceTo(before)<.5,'stopping must not snap the anticipation');
    for(let i=0;i<240;i++)rig.update(1/120,{...pose,vx:0,vz:0},mode);
    assert.ok(rig.look.distanceTo(new Vector3(pose.x,.5,pose.z))<.03);
  }
});

test('overhead prediction follows the upcoming bend and the direction actually being travelled',()=>{
  const radius=18,circuit={length:2*Math.PI*radius,at(progress){const a=progress*2*Math.PI;return {x:radius*(1-Math.cos(a)),y:0,z:radius*Math.sin(a),heading:a};}};
  for(const direction of [-1,1]){
    const pose={...drive,progress:0,vz:20*direction,heading:Math.PI};
    const rig=new CameraRig().update(1/60,pose,'topdown',true,9/16,circuit);
    assert.ok(rig.look.x>.1,'the camera should anticipate the bend rather than aim down the straight tangent');
    assert.ok(rig.look.z*direction>1,'anticipation must follow forward or reverse movement, not the nose');
    const point=carOnScreen(rig,pose,9/16);
    assert.ok(Math.abs(point.x)<=.160001&&Math.abs(point.y)<=.160001);
  }
});

test('screen rotation and changes from chase to any overhead zoom preserve centered framing',()=>{
  const rig=new CameraRig().update(1/60,drive,'chase'),pose={...drive};
  for(let i=0;i<360;i++){
    const aspect=i%120<60?320/844:844/390,mode=overheadModes[Math.floor(i/30)%3];
    pose.x+=.5;pose.z-=.3;pose.vx=Math.sin(i*.04)*35;pose.vz=Math.cos(i*.04)*35;
    rig.update(1/60,pose,mode,false,aspect);
    const point=carOnScreen(rig,pose,aspect);
    assert.ok(Math.abs(point.x)<=.160001&&Math.abs(point.y)<=.160001,`${mode} at ${aspect}: ${point.toArray()}`);
  }
});
