import { Vector3, Matrix4, MathUtils } from 'three';
import { cameraView } from './camera-views.js';

const OVERHEAD_OFFSET=new Vector3(24,48,24),UP=new Vector3(0,1,0),ORIGIN=new Vector3();
const CENTER_LIMIT=.16;

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
    this.car=new Vector3();this.desiredLead=new Vector3();this.lookAhead=new Vector3();this.framedLead=new Vector3();
    this.smoothedOffset=new Vector3();this.framingOffset=new Vector3();this.rotation=new Matrix4();
    this.contactOffset=new Vector3();this.contactVelocity=new Vector3();this.lastEdgeHitId=0;
    this.right=new Vector3();this.up=new Vector3();this.backward=new Vector3();
  }

  update(dt, drive, mode = 'topdown', reset = false, aspect = 16 / 9, circuit) {
    this.updateContact(dt,drive,reset);
    if(mode!=='chase')return this.updateOverhead(dt,drive,mode,reset,aspect,circuit);
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
    const distance = (22 + Math.min(speed, 24) * 0.12) * zoom;
    offset.set(-Math.sin(this.travelHeading) * distance, 18 * zoom, -Math.cos(this.travelHeading) * distance);
    const fov = 51;
    const desiredPosition = this.desiredPosition.copy(this.focus).add(offset);
    const alpha = initialize ? 1 : 1 - Math.exp(-3.5 * dt);
    this.position.lerp(desiredPosition, alpha);
    this.look.lerp(this.focus, alpha);
    this.fov = initialize ? fov : MathUtils.damp(this.fov, fov, 4, dt);
    this.initialized = true;
    this.mode=mode;
    return this;
  }

  updateContact(dt,drive,reset){
    const event=drive.edgeHitId||0;
    if(reset){this.contactOffset.set(0,0,0);this.contactVelocity.set(0,0,0);this.lastEdgeHitId=event;return;}
    if(event>0&&event!==this.lastEdgeHitId){
      const strength=MathUtils.clamp(drive.edgeImpact||0,0,1);
      this.contactVelocity.x-=(drive.edgeNormalX||0)*strength*.85;this.contactVelocity.z-=(drive.edgeNormalZ||0)*strength*.85;this.contactVelocity.y+=strength*.16;
    }
    this.lastEdgeHitId=event;
    const steps=Math.max(1,Math.ceil(Math.min(.25,dt)/.016)),h=Math.min(.25,Math.max(0,dt))/steps;
    for(let i=0;i<steps;i++){this.contactVelocity.addScaledVector(this.contactOffset,-150*h).multiplyScalar(Math.exp(-18*h));this.contactOffset.addScaledVector(this.contactVelocity,h);}
    this.contactOffset.clampLength(0,.10);
  }

  limitLead(lead,offset,fov,aspect){
    // Use the same camera basis and perspective division as the rendered view.
    this.rotation.lookAt(offset,ORIGIN,UP);
    this.right.setFromMatrixColumn(this.rotation,0);this.up.setFromMatrixColumn(this.rotation,1);this.backward.setFromMatrixColumn(this.rotation,2);
    const distance=offset.length(),depth=lead.dot(this.backward),vertical=Math.tan(MathUtils.degToRad(fov/2))*CENTER_LIMIT;
    const horizontal=vertical*aspect,x=Math.abs(lead.dot(this.right))-horizontal*depth,y=Math.abs(lead.dot(this.up))-vertical*depth;
    let scale=1;
    if(x>0)scale=Math.min(scale,horizontal*distance/x);
    if(y>0)scale=Math.min(scale,vertical*distance/y);
    return lead.multiplyScalar(scale);
  }

  updateOverhead(dt,drive,mode,reset,aspect,circuit){
    const initialize=reset||!this.initialized,velocity=this.velocity.set(drive.vx,0,drive.vz),speed=velocity.length(),raisedChase=mode==='chase-high';
    this.car.set(drive.x,(drive.y||0)+.5,drive.z);
    const distance=Math.min(12,speed*.45);
    this.desiredLead.copy(velocity).multiplyScalar(speed>.01?distance/speed:0);
    const progress=drive.progress??drive.road?.progress;
    if(circuit&&Number.isFinite(progress)&&speed>1){
      const road=circuit.at(progress),along=velocity.x*Math.sin(road.heading)+velocity.z*Math.cos(road.heading);
      const anticipation=MathUtils.clamp((Math.abs(along)/speed-.35)/.5,0,1)*.65;
      const ahead=circuit.at(progress+Math.sign(along)*distance/circuit.length);
      this.delta.set(ahead.x-road.x,(ahead.y||0)-(road.y||0),ahead.z-road.z);
      this.desiredLead.lerp(this.delta,anticipation);
    }
    if(initialize||this.mode==='chase')this.lookAhead.copy(this.desiredLead);
    else this.lookAhead.lerp(this.desiredLead,1-Math.exp(-3.5*dt));
    if(initialize)this.travelHeading=speed>1?Math.atan2(drive.vx,drive.vz):drive.heading;
    else if(speed>1){
      const turn=Math.atan2(Math.sin(Math.atan2(drive.vx,drive.vz)-this.travelHeading),Math.cos(Math.atan2(drive.vx,drive.vz)-this.travelHeading));
      this.travelHeading+=turn*(1-Math.exp(-1.8*dt));
    }
    const zoom=Math.max(1,Math.sqrt(1/Math.max(.3,aspect)));
    if(raisedChase)this.offset.set(-Math.sin(this.travelHeading)*24,36,-Math.cos(this.travelHeading)*24).multiplyScalar(zoom);
    else this.offset.copy(OVERHEAD_OFFSET).multiplyScalar(zoom/cameraView(mode).zoom);
    if(initialize)this.smoothedOffset.copy(this.offset);
    else this.smoothedOffset.copy(this.position).sub(this.look).lerp(this.offset,1-Math.exp(-3.5*dt));
    const fov=raisedChase?48:45;
    this.fov=initialize?fov:MathUtils.damp(this.fov,fov,4,dt);
    // The three zooms share their target; the closest one sets the safe lead.
    if(raisedChase)this.framingOffset.copy(this.offset);
    else this.framingOffset.copy(OVERHEAD_OFFSET).multiplyScalar(zoom/1.4);
    this.limitLead(this.framedLead.copy(this.lookAhead),this.framingOffset,fov,aspect);
    this.limitLead(this.framedLead,this.smoothedOffset,this.fov,aspect);
    this.focus.copy(this.car).add(this.framedLead);this.look.copy(this.focus);
    // Follow translation and elevation immediately. Only anticipation and zoom lag.
    this.position.copy(this.look).add(this.smoothedOffset);
    this.initialized=true;this.mode=mode;
    return this;
  }
}
