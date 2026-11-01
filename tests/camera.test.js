import test from 'node:test';
import assert from 'node:assert/strict';
import { CameraRig } from '../src/camera.js';

const drive = { x: 0, z: 0, vx: 0, vz: 16, speed: 16, heading: 0 };

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

test('camera follow is smooth but keeps the car within the framing deadzone', () => {
  const rig = new CameraRig().update(1 / 60, { ...drive, vx: 0, vz: 0 });
  rig.update(1 / 60, { ...drive, x: 12, vx: 0, vz: 0 });
  assert.ok(rig.focus.x > 0 && rig.focus.x < 12, 'the camera locked to the vehicle');
  assert.ok(Math.abs(12 - rig.focus.x) <= 6.01, 'the car escaped the framing area');
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
