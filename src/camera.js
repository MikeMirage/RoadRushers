import { Vector3, MathUtils } from 'three';
import { cameraView } from './camera-views.js';

/** Velocity-led framing: rotating the car in a drift must not spin the view. */
export class CameraRig {
  constructor() {
    this.focus = new Vector3();
    this.position = new Vector3();
    this.look = new Vector3();
    this.travelHeading = 0;
    this.fov = 45;
    this.initialized = false;
    this.velocity = new Vector3(); this.desiredFocus = new Vector3();
    this.delta = new Vector3(); this.offset = new Vector3(); this.desiredPosition = new Vector3();
  }

  update(dt, drive, mode = 'topdown', reset = false, aspect = 16 / 9) {
    const initialize = reset || !this.initialized;
    const velocity = this.velocity.set(drive.vx, 0, drive.vz);
    const speed = velocity.length();
    const lead = speed > 0.01 ? velocity.multiplyScalar(Math.min(5.5, speed * 0.3) / speed) : velocity;
    const desiredFocus = this.desiredFocus.set(drive.x, (drive.y||0)+0.5, drive.z).add(lead);
    if (initialize) {
      this.focus.copy(desiredFocus);
      this.travelHeading = speed > 1 ? Math.atan2(drive.vx, drive.vz) : drive.heading;
    } else {
      this.focus.lerp(desiredFocus, 1 - Math.exp(-2.4 * dt));
      // Keep the car in a bounded area without locking it to the screen center.
      const delta = this.delta.set(drive.x, (drive.y||0)+0.5, drive.z).sub(this.focus);
      if (delta.length() > 6) this.focus.addScaledVector(delta, 1 - 6 / delta.length());
      if (speed > 1) {
        const diff = Math.atan2(Math.sin(Math.atan2(drive.vx, drive.vz) - this.travelHeading), Math.cos(Math.atan2(drive.vx, drive.vz) - this.travelHeading));
        this.travelHeading += diff * (1 - Math.exp(-1.8 * dt));
      }
    }
    // Extra distance on a narrow screen preserves room on both sides of a slide.
    const zoom = Math.max(1, Math.sqrt(1 / Math.max(0.3, aspect)));
    const offset = this.offset;
    let fov;
    if (mode === 'chase') {
      const distance = (22 + Math.min(speed, 24) * 0.12) * zoom;
      offset.set(-Math.sin(this.travelHeading) * distance, 18 * zoom, -Math.cos(this.travelHeading) * distance);
      fov = 51;
    } else {
      // Fixed azimuth and a 55° elevation, like a small drifting diorama.
      offset.set(24, 48, 24).multiplyScalar(zoom/cameraView(mode).zoom);
      fov = 45;
    }
    const desiredPosition = this.desiredPosition.copy(this.focus).add(offset);
    const alpha = initialize ? 1 : 1 - Math.exp(-3.5 * dt);
    this.position.lerp(desiredPosition, alpha);
    this.look.lerp(this.focus, alpha);
    this.fov = initialize ? fov : MathUtils.damp(this.fov, fov, 4, dt);
    this.initialized = true;
    return this;
  }
}
