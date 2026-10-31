import { SURFACES, WEATHER, PACES, VEHICLES } from './config.js';

const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const POSE_FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'speed', 'steer', 'slip', 'impact', 'pitch', 'roll', 'landing', 'brake'];
export const START_PROGRESS = 0;

export class DriveModel {
  constructor(circuit, vehicle = VEHICLES[0]) { this.vehicle = vehicle; this.reset(circuit); }

  reset(circuit, progress = START_PROGRESS, offset = 0) {
    this.circuit = circuit;
    const start = circuit.at(progress,offset);
    Object.assign(this, { x: start.x, y:start.y||0, z: start.z, heading: start.heading, vx: 0, vy:0, vz: 0,
      grounded:true, airTime:0, pitch:0, roll:0, landing:0,
      braking:false, brake:0,
      steer: 0, angularSpeed: 0, drift: 0, driftAngle: 0, speed: 0, slip: 0, impact: 0, distance: 0 });
    this.road = circuit.nearest(this.x, this.z, {progress,y:this.y});
    this.previousPose = {}; this.renderPose = {};
    for (const field of POSE_FIELDS) this.previousPose[field] = this.renderPose[field] = this[field];
    this.previousPose.heading = this.renderPose.heading = this.heading;
  }

  step(dt, input, surfaceId, weatherId, paceId = 'normal', brakeInput = false) {
    for (const field of POSE_FIELDS) this.previousPose[field] = this[field];
    this.previousPose.heading = this.heading;
    const priorRoad=this.road;
    const activeSurface = this.circuit.surfaceAt(this.road.progress, surfaceId);
    const surface = SURFACES[activeSurface], weather = WEATHER[weatherId], vehicle = this.vehicle;
    this.braking=Boolean(brakeInput);
    // Pressure builds while held; releasing immediately restores automatic throttle.
    this.brake=this.braking?damp(this.brake,1,3.8,dt):0;
    this.steer = damp(this.steer, this.braking?0:Math.max(-1, Math.min(1, input)), 9 * vehicle.response, dt);
    const speed = Math.hypot(this.vx, this.vz);
    // Break rear traction progressively while cornering at speed. When released,
    // the tires recover over time, so momentum can carry a slide into countersteer.
    const driftTarget = Math.max(0, Math.min(1, (Math.abs(this.steer) * speed - 4) / 8));
    this.drift = damp(this.drift, driftTarget, driftTarget > this.drift ? 5 : 2.2, dt);
    const terrainGrip = activeSurface === 'dirt' || activeSurface === 'gravel' || activeSurface === 'mud' ? vehicle.looseGrip : 1;
    const grip = Math.max(0.65, surface.grip * vehicle.grip * terrainGrip * (1 - this.drift * vehicle.drift)) * weather.grip;
    // Steering always means left/right relative to the vehicle, in either camera.
    // Keep enough steering authority to recover after a head-on wall contact.
    const turn = 2.65 * vehicle.turn * Math.max(0.4, Math.min(1, speed / 7)) * (activeSurface === 'ice' ? 0.85 : 1);
    this.angularSpeed = damp(this.angularSpeed, -this.steer * turn * (this.grounded?1:.25), 4.5 * vehicle.yawResponse, dt);
    this.heading = wrap(this.heading + this.angularSpeed * dt);
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    let forward = this.vx * fx + this.vz * fz;
    let lateral = this.vx * fz - this.vz * fx;
    const cruiseSpeed = surface.speed * PACES[paceId].speed * vehicle.speed;
    const target = cruiseSpeed * (1 - Math.abs(this.steer) * 0.08);
    if(this.grounded){
      if(!this.braking)forward = damp(forward, target, 1.45 * vehicle.acceleration, dt);
      // Static holding avoids creeping backwards when braking at rest on a ramp.
      if(!this.braking||speed>.05)forward -= Math.sin(Math.atan(this.road.grade||0))*5*dt;
    }
    lateral *= Math.exp(-(this.grounded?grip:.05) * dt);
    this.vx = fx * forward + fz * lateral;
    this.vz = fz * forward - fx * lateral;
    if(this.braking&&this.grounded){
      const brakingGrip=Math.max(.2,Math.min(1.15,surface.grip/9.5*vehicle.grip*terrainGrip))*weather.grip;
      const currentSpeed=Math.hypot(this.vx,this.vz),deceleration=12*this.brake*brakingGrip;
      const retained=Math.max(0,currentSpeed-deceleration*dt)/Math.max(1e-9,currentSpeed);
      // Slow the real momentum, including a slide, without reversing or snapping direction.
      this.vx*=retained;this.vz*=retained;
    }
    const velocityScale = Math.min(1, cruiseSpeed * 1.08 / Math.max(0.001, Math.hypot(this.vx, this.vz)));
    this.vx *= velocityScale;
    this.vz *= velocityScale;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.distance += speed * dt;
    this.road = this.circuit.nearest(this.x, this.z, {progress:priorRoad.progress,y:this.y});

    // Solid track edges: project the car inside and remove outward velocity.
    const limit = this.circuit.widthAt(this.road.progress) / 2 - 0.7;
    this.impact = Math.max(0, this.impact - dt * 4);
    if (Math.abs(this.road.offset) > limit) {
      const sign = Math.sign(this.road.offset);
      this.x = this.road.x + this.road.nx * limit * sign;
      this.z = this.road.z + this.road.nz * limit * sign;
      const outward = (this.vx * this.road.nx + this.vz * this.road.nz) * sign;
      if (outward > 0) {
        // Sliding contact: cancel the outward motion without bouncing every tick.
        this.vx -= this.road.nx * sign * outward;
        this.vz -= this.road.nz * sign * outward;
        const friction = Math.exp(-1.8 * dt);
        this.vx *= friction;
        this.vz *= friction;
        this.impact = Math.min(1, outward / 6);
      }
    }
    this.stepHeight(dt);
    this.speed = Math.hypot(this.vx, this.vz);
    // Measure the actual velocity after collisions, not a cosmetic body rotation.
    forward = this.vx * fx + this.vz * fz;
    lateral = this.vx * fz - this.vz * fx;
    this.driftAngle = Math.atan2(lateral, Math.max(0.1, forward));
    this.slip = this.speed > 3 ? Math.min(1, Math.abs(this.driftAngle) / 0.75) : 0;
    return this;
  }

  stepHeight(dt) {
    const ground=this.road.y,along=this.vx*this.road.tx+this.vz*this.road.tz;
    const supportVy=(this.road.grade||0)*along;
    this.landing=Math.max(0,this.landing-dt*3);
    // Lose contact only at a physical crest; there is no procedural vibration.
    if(this.grounded&&this.vy>1&&supportVy<this.vy-24*dt-.015)this.grounded=false;
    if(this.grounded){this.y=ground;this.vy=supportVy;this.airTime=0;}
    else{
      this.airTime+=dt;this.y+=this.vy*dt-12*dt*dt;this.vy-=24*dt;
      if(this.y<=ground&&this.vy<=supportVy){
        this.landing=this.airTime>.08?Math.min(1,Math.max(0,(supportVy-this.vy)/12)):0;
        const retain=1-this.landing*.04;this.vx*=retain;this.vz*=retain;
        this.y=ground;this.vy=supportVy;this.grounded=true;this.airTime=0;
      }
    }
    const slope=(this.road.grade||0)*(Math.sin(this.heading)*this.road.tx+Math.cos(this.heading)*this.road.tz);
    this.pitch=damp(this.pitch,this.grounded?Math.atan(slope):Math.atan2(this.vy,Math.max(6,Math.hypot(this.vx,this.vz))),10,dt);
    this.roll=damp(this.roll,this.grounded?(this.road.bank||0)*Math.cos(this.heading-Math.atan2(this.road.tx,this.road.tz)):0,10,dt);
  }

  interpolated(alpha) {
    const t = Math.max(0, Math.min(1, alpha));
    for (const field of POSE_FIELDS) this.renderPose[field] = this.previousPose[field] + (this[field] - this.previousPose[field]) * t;
    this.renderPose.heading = this.previousPose.heading + wrap(this.heading - this.previousPose.heading) * t;
    this.renderPose.progress = this.road.progress;
    this.renderPose.grounded=this.grounded;this.renderPose.groundY=this.road.y;this.renderPose.airTime=this.airTime;
    this.renderPose.braking=this.braking;
    return this.renderPose;
  }
}

export class LapTracker {
  constructor(progress = START_PROGRESS) { this.reset(progress); }
  reset(progress = START_PROGRESS) {
    this.previous = progress;
    this.nextGate = 1;
    this.time = 0;
    this.lap = 1;
    this.last = null;
    this.wrongWay = false;
  }
  step(dt, progress) {
    this.time += dt;
    let delta = progress - this.previous;
    if (delta < -0.5) delta += 1;
    if (delta > 0.5) delta -= 1;
    this.wrongWay = delta < -0.00008;
    const prev = this.previous;
    this.previous = progress;
    // Ordered gates and bounded movement reject shortcuts and spawn teleports.
    if (delta <= 0 || delta > 0.06) return null;
    const gate = this.nextGate / 8;
    if (this.nextGate < 8 && prev < gate && progress >= gate) this.nextGate++;
    if (prev > 0.94 && progress < 0.06 && this.nextGate === 8) {
      this.last = this.time;
      this.time = 0;
      this.lap++;
      this.nextGate = 1;
      return this.last;
    }
    return null;
  }
  get progress() { return (this.nextGate - 1) / 8; }
}

export function formatTime(seconds) {
  if (seconds == null) return '—:—.——';
  const hundredths = Math.floor(seconds * 100 + 1e-7);
  return `${Math.floor(hundredths / 6000)}:${String(Math.floor(hundredths / 100) % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}
