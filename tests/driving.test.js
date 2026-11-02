import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, SURFACES, WEATHER } from '../src/config.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel, LapTracker, START_PROGRESS, formatTime } from '../src/physics.js';

const circuit = new Circuit(TRACKS[0]);
const simulate = (model, seconds, input = 0, surface = 'asphalt', weather = 'clear', hz = 120) => {
  for (let i = 0; i < seconds * hz; i++) model.step(1 / hz, input, surface, weather);
};

test('all three circuits are closed and the sampled collision path follows the rendered path', () => {
  for (const config of TRACKS) {
    const c = new Circuit(config), a = c.at(0), b = c.at(1);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
    assert.ok(c.length > 350);
    for (let i = 0; i < 60; i++) {
      const p = c.at(i / 60), n = c.nearest(p.x, p.z);
      assert.ok(n.distance < 0.02, `${config.id}: collision centerline mismatch`);
    }
  }
});

test('acceleration requires only left/right steering, and right turns right relative to the car', () => {
  const car = new DriveModel(circuit), start = { x: car.x, z: car.z, heading: car.heading };
  simulate(car, 1);
  assert.ok(car.speed > 7);
  assert.ok(Math.hypot(car.x - start.x, car.z - start.z) > 3);
  const before = car.heading;
  simulate(car, 0.3, 1);
  const angle = Math.atan2(Math.sin(car.heading - before), Math.cos(car.heading - before));
  assert.ok(angle < 0, 'right input must decrease yaw when forward is +Z');
});

test('ice and wet asphalt retain more lateral slip than dry asphalt', () => {
  const slipFor = (surface, weather) => {
    const car = new DriveModel(circuit);
    car.heading = 0; car.vx = 6; car.vz = 10;
    car.step(1 / 120, 0, surface, weather);
    return Math.abs(car.vx);
  };
  assert.ok(slipFor('ice', 'clear') > slipFor('asphalt', 'clear'));
  assert.ok(slipFor('asphalt', 'rain') > slipFor('asphalt', 'clear'));
});

test('a fast dry-asphalt turn produces a real slide while retaining momentum', () => {
  const car = new DriveModel(new Circuit({ ...TRACKS[0], width: 300 }));
  simulate(car, 2);
  const entrySpeed = car.speed;
  simulate(car, 0.5, 1);
  assert.ok(Math.abs(car.driftAngle) > 0.25, 'dry asphalt is too planted to drift');
  assert.ok(car.speed > entrySpeed * 0.75, 'the slide killed the car momentum');
  assert.equal(car.impact, 0, 'test slide touched a wall');
  const velocityHeading = Math.atan2(car.vx, car.vz);
  const separation = Math.abs(Math.atan2(Math.sin(velocityHeading - car.heading), Math.cos(velocityHeading - car.heading)));
  assert.ok(separation > 0.25, 'the visual angle must correspond to the actual movement');
});

test('releasing steering preserves the slide briefly, then progressively restores traction', () => {
  const car = new DriveModel(new Circuit({ ...TRACKS[0], width: 300 }));
  simulate(car, 2); simulate(car, 0.5, 1);
  const slip = car.slip;
  simulate(car, 0.1);
  assert.ok(car.slip > slip * 0.5, 'lateral momentum snapped to the body heading');
  simulate(car, 2);
  assert.ok(car.slip < 0.02, 'traction never recovered after releasing the steering');
});

test('countersteering brings the nose back toward the sliding trajectory', () => {
  const makeSlide = () => {
    const car = new DriveModel(new Circuit({ ...TRACKS[0], width: 300 }));
    simulate(car, 2); simulate(car, 0.5, 1);
    return car;
  };
  const released = makeSlide(), countersteered = makeSlide();
  simulate(released, 0.3, 0); simulate(countersteered, 0.3, -1);
  assert.ok(Math.abs(countersteered.driftAngle) < Math.abs(released.driftAngle) * 0.5);
  // Full countersteering keeps turning after alignment; release it to avoid
  // starting a slide in the other direction, rather than muting the input.
  simulate(countersteered, 0.1, -1);
  assert.ok(countersteered.driftAngle < 0);
});

test('solid edges contain the car under sustained steering for every surface and weather', () => {
  for (const surface of Object.keys(SURFACES)) for (const weather of Object.keys(WEATHER)) {
    const car = new DriveModel(circuit);
    simulate(car, 4, 1, surface, weather);
    const nearest = circuit.nearest(car.x, car.z);
    assert.ok(nearest.distance <= circuit.config.width / 2 - 0.69, `${surface}/${weather} escaped wall`);
    assert.ok(Number.isFinite(car.speed));
  }
});

test('timestep produces comparable car movement at 60 and 120 Hz', () => {
  const a = new DriveModel(circuit), b = new DriveModel(circuit);
  simulate(a, 1, 0, 'asphalt', 'clear', 60); simulate(b, 1, 0, 'asphalt', 'clear', 120);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.08);
});

test('left/right-only inputs can complete a valid lap on each circuit with its default conditions', () => {
  for (const track of TRACKS) {
    const c = new Circuit(track), car = new DriveModel(c), laps = new LapTracker();
    let finished = null;
    for (let i = 0; i < 90 * 120 && !finished; i++) {
      const look = c.at(car.road.progress + (track.surface === 'ice' ? 0.032 : 0.024));
      const target = Math.atan2(look.x - car.x, look.z - car.z);
      const diff = Math.atan2(Math.sin(target - car.heading), Math.cos(target - car.heading));
      // This test driver uses the same three states as the keyboard: left, right, released.
      const input = diff > 0.035 ? -1 : diff < -0.035 ? 1 : 0;
      car.step(1 / 120, input, track.surface, track.weather);
      finished = laps.step(1 / 120, car.road.progress);
    }
    assert.ok(finished > 15 && finished < 90, `${track.id} cannot complete an ordered lap`);
    assert.equal(laps.lap, 2);
  }
});

test('steering can recover from a head-on collision without reverse or a throttle button', () => {
  const car = new DriveModel(circuit), p = circuit.at(0);
  car.x = p.x + p.normal.x * 5.2; car.z = p.z + p.normal.z * 5.2;
  car.heading = Math.atan2(p.normal.x, p.normal.z);
  car.vx = p.normal.x * 12; car.vz = p.normal.z * 12;
  simulate(car, 4, 1);
  assert.ok(car.speed > 5, 'car got stuck facing a wall');
});

test('lap tracker requires all ordered gates, then completes exactly one lap', () => {
  const laps = new LapTracker();
  let result;
  for (let i = 2; i <= 101; i++) result = laps.step(0.1, (i % 100) / 100) || result;
  assert.ok(result > 9);
  assert.equal(laps.lap, 2);
  assert.equal(laps.nextGate, 1);
});

test('reverse laps, crossing the line repeatedly, and teleporting cannot produce a lap', () => {
  const reverse = new LapTracker(0.99);
  for (let i = 98; i >= 0; i--) assert.equal(reverse.step(0.1, i / 100), null);
  assert.equal(reverse.lap, 1);
  const shortcut = new LapTracker(0.95);
  for (const p of [0.99, 0.01, 0.99, 0.01, 0.5, 0.99, 0.01]) assert.equal(shortcut.step(0.1, p), null);
  assert.equal(shortcut.lap, 1);
});

test('reset returns vehicle and timer to a stationary new session', () => {
  const car = new DriveModel(circuit); simulate(car, 1, 1); car.reset(circuit);
  const expected = circuit.at(START_PROGRESS);
  assert.equal(car.speed, 0); assert.equal(car.vx, 0); assert.equal(car.vz, 0);
  assert.equal(car.angularSpeed, 0); assert.equal(car.driftAngle, 0); assert.equal(car.slip, 0);
  assert.ok(Math.hypot(car.x - expected.x, car.z - expected.z) < 1e-8);
  const laps = new LapTracker(); laps.step(3, 0.15); laps.reset();
  assert.equal(laps.time, 0); assert.equal(laps.nextGate, 1); assert.equal(laps.lap, 1);
});

test('time formatting never rounds a fraction into an extra minute or second', () => {
  assert.equal(formatTime(null), '—:—.——');
  assert.equal(formatTime(0), '0:00.00');
  assert.equal(formatTime(61.999), '1:01.99');
  assert.equal(formatTime(120), '2:00.00');
});
