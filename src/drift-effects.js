import * as THREE from 'three';

const SMOKE_COUNT = 192;
const TRAIL_COUNT = 2400;

/** Pooled tire marks and smoke, using the smoke sprite from the original kit. */
export class DriftEffects {
  constructor(scene,texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}sprites/smoke.png`)) {
    this.trailPositions = new Float32Array(TRAIL_COUNT * 18);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.trailGeometry.setDrawRange(0, 0);
    this.trails = new THREE.Mesh(this.trailGeometry, new THREE.MeshBasicMaterial({ color: '#1d2822', transparent: true, opacity: 0.38, side: THREE.DoubleSide, forceSinglePass:true, depthWrite: false }));
    this.trails.frustumCulled = false;
    scene.add(this.trails);

    this.positions = new Float32Array(SMOKE_COUNT * 3);
    this.opacities = new Float32Array(SMOKE_COUNT);
    this.sizes = new Float32Array(SMOKE_COUNT);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(this.opacities, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({ map: texture, color: '#bbc1b4', size: 1, transparent: true, depthWrite: false });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'attribute float aSize;\nattribute float aOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('void main() {', 'void main() {\nvOpacity = aOpacity;');
      shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
      shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse, opacity * vOpacity );');
    };
    this.smoke = new THREE.Points(geometry, material);
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
    this.particles = Array.from({ length: SMOKE_COUNT }, () => ({ life: 0, vx: 0, vz: 0, vy: 0, size: 0 }));
    this.lastTires = [{ x: 0, y:0, z: 0 }, { x: 0, y:0, z: 0 }];
    this.tires = [{ x: 0, y:0, z: 0 }, { x: 0, y:0, z: 0 }];
    this.reset();
  }

  bind(model) {
    const left=model.sockets?.['trail-rear-left']?.position;
    this.rearOffset=left?-left.z:.77;this.halfTrack=left?Math.abs(left.x):.57;
    this.reset();
  }

  reset() {
    this.trailIndex = 0; this.smokeIndex = 0; this.emitTime = 0; this.hasLastTires = false; this.activeCount = 0;
    this.trailGeometry.setDrawRange(0, 0);
    this.opacities.fill(0); this.sizes.fill(0);
    this.smoke.geometry.attributes.aOpacity.needsUpdate = true;
    this.smoke.geometry.attributes.aSize.needsUpdate = true;
    this.particles.forEach(p => { p.life = 0; });
    this.smoke.visible = false;
  }

  update(dt, drive, running, surface) {
    if (dt <= 0) return;
    if (surface !== this.surface) {
      this.smoke.material.color.set(surface === 'dirt' || surface === 'gravel' || surface === 'mud' ? '#c4ac85' : surface === 'ice' ? '#e3eeee' : '#bdc3b7');
      this.trails.material.color.set(surface === 'ice' ? '#d7eff0' : '#1d2822');
      this.surface = surface;
    }
    const fx = Math.sin(drive.heading), fz = Math.cos(drive.heading);
    const offset=this.rearOffset??.77,track=this.halfTrack??.57;
    const backX = drive.x - fx * offset, backZ = drive.z - fz * offset;
    const tires = this.tires;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      tires[i].y=(drive.groundY??drive.y??0)-Math.tan(drive.pitch||0)*offset+Math.tan(drive.roll||0)*side*track+.075;
      tires[i].x = backX + fz * side * track; tires[i].z = backZ - fx * side * track;
    }
    const sliding = running && drive.grounded!==false && drive.speed > 4 && drive.slip > 0.18 && drive.impact < 0.3;
    this.trailGeometry.attributes.position.clearUpdateRanges();
    if (sliding && this.hasLastTires) {
      for (let i = 0; i < 2; i++) this.mark(this.lastTires[i], tires[i]);
      this.emitTime += dt;
      while (this.emitTime >= 1 / 48) {
        for (const tire of tires) this.emit(tire, drive);
        this.emitTime -= 1 / 48;
      }
    } else this.emitTime = 0;
    if (running) {
      for (let i = 0; i < 2; i++) { this.lastTires[i].x = tires[i].x; this.lastTires[i].z = tires[i].z; this.lastTires[i].y=tires[i].y; }
      this.hasLastTires = drive.grounded!==false;
    }
    if (!sliding && !this.activeCount) return;
    this.activeCount = 0;
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const p = this.particles[i];
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - dt);
      if (p.life > 0) this.activeCount++;
      const age = 1 - p.life / 1.25;
      this.positions[i * 3] += p.vx * dt;
      this.positions[i * 3 + 1] += p.vy * dt;
      this.positions[i * 3 + 2] += p.vz * dt;
      this.opacities[i] = p.life > 0 ? (1 - age) * 0.2 : 0;
      this.sizes[i] = p.size * (0.75 + age * 2.4);
    }
    for (const attr of Object.values(this.smoke.geometry.attributes)) attr.needsUpdate = true;
    this.smoke.visible = this.activeCount > 0;
  }

  mark(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 0.005 || length > 3) return;
    const nx = -dz / length * 0.11, nz = dx / length * 0.11;
    const offset = this.trailIndex % TRAIL_COUNT * 18;
    this.trailPositions.set([
      a.x - nx, a.y, a.z - nz, b.x - nx, b.y, b.z - nz, a.x + nx, a.y, a.z + nz,
      a.x + nx, a.y, a.z + nz, b.x - nx, b.y, b.z - nz, b.x + nx, b.y, b.z + nz,
    ], offset);
    this.trailIndex++;
    this.trailGeometry.attributes.position.needsUpdate = true;
    this.trailGeometry.attributes.position.addUpdateRange(offset, 18);
    this.trailGeometry.setDrawRange(0, Math.min(TRAIL_COUNT, this.trailIndex) * 6);
  }

  emit(tire, drive) {
    const i = this.smokeIndex++ % SMOKE_COUNT, p = this.particles[i];
    this.positions.set([tire.x + (Math.random() - 0.5) * 0.2, tire.y+.08, tire.z + (Math.random() - 0.5) * 0.2], i * 3);
    p.life = 1.25; p.size = 0.9 + Math.random() * 0.4;
    p.vx = drive.vx * 0.06 + (Math.random() - 0.5) * 0.6;
    p.vz = drive.vz * 0.06 + (Math.random() - 0.5) * 0.6;
    p.vy = 0.5 + Math.random() * 0.4;
  }
}
