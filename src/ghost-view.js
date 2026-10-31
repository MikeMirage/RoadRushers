import * as THREE from 'three';
import { sampleGhost } from './ghost.js';

const TRAIL_STEPS = 16;
const TRAIL_DURATION = .7;

/** A visual replay only: shared car geometry, translucent cyan, two short fading ribbons. */
export class GhostView {
  constructor(scene, model) {
    this.group = new THREE.Group(); this.group.name = 'personal-best-ghost'; scene.add(this.group);
    this.body = model.group.clone(true); this.body.rotation.set(0, 0, 0); this.group.add(this.body);
    const sources = [], copies = []; model.group.traverse(node => sources.push(node)); this.body.traverse(node => copies.push(node));
    this.wheels = (model.wheels || []).map(node => copies[sources.indexOf(node)]);
    this.frontWheels = (model.frontWheels || []).map(node => copies[sources.indexOf(node)]);
    this.material = new THREE.MeshBasicMaterial({ color: '#8be1ee', transparent: true, opacity: .24, depthWrite: false });
    this.body.traverse(node => { if (node.isMesh) { node.material = this.material; node.castShadow = node.receiveShadow = false; node.renderOrder = 2; } });
    const socket = model.sockets?.['trail-rear-left']?.position;
    this.rear = socket?.z ?? -1.1; this.halfTrack = Math.abs(socket?.x ?? .65);
    this.positions = new Float32Array(TRAIL_STEPS * 2 * 6 * 3);
    this.colors = new Float32Array(this.positions.length);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setDrawRange(0, 0);
    this.trail = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color: '#8be1ee', vertexColors: true, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.trail.name = 'personal-best-trail'; this.trail.frustumCulled = false; scene.add(this.trail);
    this.pose = {}; this.from = {}; this.to = {}; this.group.visible = this.trail.visible = false;
  }
  update(record, time, visible) {
    const pose = visible && sampleGhost(record, time, this.pose);
    this.group.visible = Boolean(pose); this.trail.visible = Boolean(visible && record && time > 0 && time < record.duration + TRAIL_DURATION);
    if (pose) {
      this.group.position.set(pose.x, pose.y + .075, pose.z); this.group.rotation.y = pose.heading;
      this.body.rotation.x = -pose.pitch; this.body.rotation.z = pose.roll + pose.steer * pose.speed * .003;
      this.wheels.forEach(wheel => { wheel.rotation.x = pose.distance * 3.3; });
      this.frontWheels.forEach(wheel => { wheel.rotation.y = -pose.steer * .35; });
    }
    if (!this.trail.visible) return;
    let vertex = 0;
    for (let i = 0; i < TRAIL_STEPS; i++) {
      const aTime = time - TRAIL_DURATION * (1 - i / TRAIL_STEPS), bTime = aTime + TRAIL_DURATION / TRAIL_STEPS;
      const a = sampleGhost(record, Math.max(0, aTime), this.from), b = sampleGhost(record, bTime, this.to);
      if (!a || !b || bTime <= 0 || Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) > 6) continue;
      for (const side of [-1, 1]) {
        for (const [p, edge, fade] of [[a,-1,i/TRAIL_STEPS],[b,-1,(i+1)/TRAIL_STEPS],[a,1,i/TRAIL_STEPS],[a,1,i/TRAIL_STEPS],[b,-1,(i+1)/TRAIL_STEPS],[b,1,(i+1)/TRAIL_STEPS]]) {
          const lateral = side * this.halfTrack + edge * .085, fx = Math.sin(p.heading), fz = Math.cos(p.heading);
          this.positions.set([p.x + fx*this.rear + fz*lateral, p.y + .12 + Math.sin(p.pitch)*this.rear + Math.sin(p.roll)*lateral, p.z + fz*this.rear - fx*lateral], vertex*3);
          this.colors.fill(fade * fade, vertex*3, vertex*3+3); vertex++;
        }
      }
    }
    this.geometry.setDrawRange(0, vertex); this.geometry.attributes.position.needsUpdate = this.geometry.attributes.color.needsUpdate = true;
  }
  dispose() {
    this.group.removeFromParent(); this.trail.removeFromParent(); this.material.dispose(); this.geometry.dispose(); this.trail.material.dispose();
  }
}
