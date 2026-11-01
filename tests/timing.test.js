import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock, FIXED_STEP } from '../src/timing.js';
import { AdaptiveResolution } from '../src/performance.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel } from '../src/physics.js';
import { TRACKS } from '../src/config.js';

test('slow rendering frames preserve the same car movement and simulated time', () => {
  const run = intervals => {
    const clock = new FixedStepClock(), car = new DriveModel(new Circuit({ ...TRACKS[0], width: 300 }));
    let time = 0;
    for (const dt of intervals) {
      const count = clock.advance(dt);
      for (let i = 0; i < count; i++) { car.step(FIXED_STEP, 0.2, 'dirt', 'rain'); time += FIXED_STEP; }
      assert.ok(clock.alpha >= 0 && clock.alpha < 1.00001);
    }
    return { car, time };
  };
  const fast = run(Array(240).fill(1 / 120));
  const slow = run(Array(20).fill(0.1));
  assert.ok(Math.abs(fast.time - 2) < 1e-9);
  assert.ok(Math.abs(fast.time - slow.time) < 1e-9, 'slow frames made the simulation run in slow motion');
  assert.ok(Math.hypot(fast.car.x - slow.car.x, fast.car.z - slow.car.z) < 1e-8);
});

test('a long interruption has a bounded catch-up cost and no lingering backlog', () => {
  const clock = new FixedStepClock();
  assert.ok(clock.advance(5) <= 30);
  assert.equal(clock.advance(1 / 60), 2);
  clock.reset(); assert.equal(clock.alpha, 0); assert.equal(clock.advance(0), 0);
});

test('render poses move smoothly between physics updates without changing simulation state', () => {
  const car = new DriveModel(new Circuit(TRACKS[0]));
  car.vx = 12; car.vz = 5;
  car.step(FIXED_STEP, 1, 'gravel', 'rain');
  const actualX = car.x, actualZ = car.z;
  const samples = [0, 0.25, 0.5, 0.75, 1].map(t => ({ ...car.interpolated(t) }));
  for (let i = 1; i < samples.length; i++) {
    const stepDistance = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z);
    assert.ok(stepDistance > 0 && stepDistance < 0.04);
  }
  assert.equal(car.x, actualX); assert.equal(car.z, actualZ);
  assert.equal(samples.at(-1).x, actualX); assert.equal(samples.at(-1).z, actualZ);
});

test('heading interpolation crosses the angle seam without a full rotation', () => {
  const car = new DriveModel(new Circuit(TRACKS[0]));
  car.previousPose.heading = Math.PI - 0.01; car.heading = -Math.PI + 0.01;
  assert.ok(Math.abs(car.interpolated(0.5).heading - Math.PI) < 1e-8);
});

test('sustained wall contact is stationary instead of bouncing inward each tick', () => {
  const c = new Circuit(TRACKS[0]), p = c.at(0), car = new DriveModel(c);
  car.x = p.x + p.normal.x * 5.3; car.z = p.z + p.normal.z * 5.3;
  car.heading = Math.atan2(p.normal.x, p.normal.z);
  car.vx = p.normal.x * 12; car.vz = p.normal.z * 12;
  for (let i = 0; i < 360; i++) car.step(FIXED_STEP, 0, 'gravel', 'rain');
  const normalSpeed = car.vx * car.road.nx + car.vz * car.road.nz;
  assert.ok(Math.abs(normalSpeed) < 1e-7, 'the wall keeps injecting a bouncing velocity');
  assert.ok(c.nearest(car.x, car.z).distance < 5.301);
});

test('adaptive resolution lowers GPU load during sustained slow rendering', () => {
  const quality = new AdaptiveResolution(2), initial = quality.ratio;
  for (let i = 0; i < 150; i++) quality.sample(1 / 25);
  assert.ok(quality.ratio < initial);
  for (let i = 0; i < 1000; i++) quality.sample(1 / 25);
  assert.ok(quality.ratio >= 1.5);
});

test('adaptive resolution stays within native resolution and avoids changes for isolated hitches', () => {
  const quality = new AdaptiveResolution(1);
  for (let i = 0; i < 500; i++) quality.sample(1 / 60);
  assert.equal(quality.ratio, 1);
  quality.sample(2); quality.sample(0.2);
  assert.equal(quality.ratio, 1);
});

test('adaptive resolution recovers gradually when rendering becomes consistently fast', () => {
  const quality = new AdaptiveResolution(2);
  for (let i = 0; i < 150; i++) quality.sample(1 / 25);
  const low = quality.ratio;
  for (let i = 0; i < 1600; i++) quality.sample(1 / 60);
  assert.ok(quality.ratio > low && quality.ratio <= 2);
});
