import * as THREE from 'three';
import { SURFACES, WEATHER, VEHICLES } from './config.js';
import { buildVehicle, preloadVehicles } from './vehicles.js';
import { buildEnvironment } from './environments.js';
import { CameraRig } from './camera.js';
import { DriftEffects } from './drift-effects.js';
import { BrakeEffects } from './brake-effects.js';
import { roadRibbon as ribbon,trackStructures } from './road-geometry.js';
import { RivalFleet } from './rival-fleet.js';
import { GhostView } from './ghost-view.js';
import { EnvironmentSystem } from './environment-system.js';
import { normalizeEnvironment, environmentForTrack } from './environment-config.js';
import { ManualPropLayer } from './manual-props.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applyEnvironmentPbr, roadPbrId } from './environment-assets.js';
import { enhanceLandscape } from './landscape-assets.js';
import { polishScenery } from './scenery-polish.js';

const temp = new THREE.Object3D();
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...options });

function seeded(seed = 718) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}

function surfaceTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), rng = seeded(14);
  ctx.fillStyle = '#bcbcbc'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22000; i++) {
    const v = Math.floor(145 + rng() * 95);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(rng() * 256, rng() * 256, 1 + rng(), 1 + rng());
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class World {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // The scenery is static; the moving car uses its soft contact shadow.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute('aria-label', 'Circuito de carreras 3D');
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 700);
    this.hemisphere=new THREE.HemisphereLight(0xe2f5ff, 0x768254, 2.6);this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight(0xffe3b2, 3.1);
    this.sun.position.set(-65, 100, 45);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -130, right: 130, top: 130, bottom: -130, near: 1, far: 300 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.normalBias = 0.06;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.atmosphere=new EnvironmentSystem(this.renderer,this.scene,this.camera,this.sun,this.hemisphere);
    this.moon=new THREE.DirectionalLight('#789ac9',.4);this.moon.position.set(50,90,-40);this.scene.add(this.moon);
    this.car = new THREE.Group();
    this.scene.add(this.car);
    this.headlamp=new THREE.SpotLight('#fff0ce',0,32,.47,.6,1.4);this.headlamp.position.set(0,.85,.65);this.headlamp.target.position.set(0,.1,16);this.car.add(this.headlamp,this.headlamp.target);
    this.wheels = [];
    this.cameraReady = false;
    this.cameraRig = new CameraRig();
    this.texture = surfaceTexture();
    this.driftEffects = new DriftEffects(this.scene);
    this.brakeEffects = new BrakeEffects(this.scene);
    this.particlePositions = new Float32Array(640 * 3);
    const rng = seeded(81);
    for (let i = 0; i < 640; i++) this.particlePositions.set([(rng() - 0.5) * 100, rng() * 45, (rng() - 0.5) * 100], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.precipitation = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf0faff, size: 0.14, transparent: true, opacity: 0.65, depthWrite: false }));
    this.precipitation.frustumCulled = false;
    this.precipitationSnow={value:0};
    this.precipitation.material.onBeforeCompile=shader=>{shader.uniforms.rrSnowParticle=this.precipitationSnow;shader.fragmentShader='uniform float rrSnowParticle;\n'+shader.fragmentShader.replace('#include <map_particle_fragment>',`#include <map_particle_fragment>
      vec2 rrP=gl_PointCoord-.5;float rrRain=1.0-smoothstep(.035,.15,abs(rrP.x));float rrFlake=1.0-smoothstep(.2,.5,length(rrP));diffuseColor.a*=mix(rrRain,rrFlake,rrSnowParticle);`);};
    this.scene.add(this.precipitation);
    window.addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  async loadCar(vehicle = VEHICLES[0]) {
    await preloadVehicles();
    this.setVehicle(vehicle);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0x162a22, transparent: true, opacity: 0.15, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.y = 1.25;
    this.car.add(shadow);this.contactShadow=shadow;
    this.underpassMarker=new THREE.Mesh(new THREE.RingGeometry(1.7,1.9,32),new THREE.MeshBasicMaterial({color:0xd9ff80,depthTest:false,depthWrite:false,transparent:true,opacity:.85}));
    this.underpassMarker.rotation.x=-Math.PI/2;this.underpassMarker.renderOrder=30;this.underpassMarker.visible=false;this.scene.add(this.underpassMarker);
  }

  setVehicle(vehicle) {
    if (this.vehicleId === vehicle.id && !vehicle.prototype) return;
    if (this.body) {
      this.body.removeFromParent();
      const geometries = new Set(), materials = new Set();
      this.body.traverse(node => { if(node.geometry)geometries.add(node.geometry);if(node.material)materials.add(node.material); });
      geometries.forEach(g => g.dispose());materials.forEach(m => {m.map?.dispose();m.dispose();});
    }
    const model = buildVehicle(vehicle);
    this.vehicleModel = model;
    this.body = model.group; this.wheels = model.wheels; this.frontWheels = model.frontWheels;
    this.vehicleId = vehicle.id; this.car.add(this.body);
    this.brakeEffects.bind(model);
    this.driftEffects.bind(model);
  }

  setRivals(session) {
    if(session&&this.fleet?.session===session)return;
    this.fleet?.dispose();this.fleet=session?new RivalFleet(this.scene,session,this.brakeEffects.glow.material.map):null;
  }

  setGhost(enabled) {
    this.ghost?.dispose();
    this.ghost = enabled ? new GhostView(this.scene, this.vehicleModel) : null;
  }

  updateRoadGroups(surfaceId) {
    const ids = Object.keys(SURFACES), geometry = this.roadMesh.geometry;
    geometry.clearGroups();
    let previous = -1, begin = 0;
    for(let i=0;i<=this.circuit.count;i++) {
      const index = i === this.circuit.count ? -1 : ids.indexOf(this.circuit.surfaceAt((i+.5)/this.circuit.count, surfaceId));
      if(index !== previous) {
        if(i>0)geometry.addGroup(begin*6,(i-begin)*6,previous);
        begin=i;previous=index;
      }
    }
  }

  build(circuit, surfaceId, weatherId) {
    this.manualProps?.dispose();this.manualProps=null;
    if (this.environment) {
      this.scene.remove(this.environment);
      const geometries = new Set(), materials = new Set();
      this.environment.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.isInstancedMesh) o.dispose();
        for (const material of (Array.isArray(o.material) ? o.material : [o.material])) if (material) materials.add(material);
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    }
    this.circuit = circuit;
    this.environmentSettings=normalizeEnvironment({...environmentForTrack(circuit.config,weatherId),...(this.graphicsQuality?{quality:this.graphicsQuality}:{})});
    this.environment = new THREE.Group();
    this.scene.add(this.environment);
    const half = u => circuit.widthAt(u) / 2;
    this.roadMaterials = Object.entries(SURFACES).map(([id,surface]) => {
      const material=mat(surface.color,{map:this.texture,roughness:surface.roughness,side:THREE.DoubleSide});
      const asset=roadPbrId(id);if(asset)applyEnvironmentPbr(material,asset,{repeat:[2,2],normalStrength:.55});
      return material;
    });
    this.environment.add(ribbon(circuit, u => -half(u)-1, u => half(u)+1, 0.015, mat('#bcb393', { side: THREE.DoubleSide })));
    this.roadMesh = ribbon(circuit, u => -half(u), u => half(u), 0.035, this.roadMaterials);
    this.environment.add(this.roadMesh);
    const stripe = mat('#eee9cf', { side: THREE.DoubleSide });
    this.environment.add(ribbon(circuit, u => -half(u)+0.34, u => -half(u)+0.48, 0.055, stripe));
    this.environment.add(ribbon(circuit, u => half(u)-0.48, u => half(u)-0.34, 0.055, stripe));
    this.environment.add(trackStructures(circuit));
    this.addTrackDetails();
    this.addLandscape();
    this.manualProps=new ManualPropLayer(this.environment,circuit.config.manualProps||[]);
    this.setConditions(surfaceId, weatherId);
    this.cameraReady = false;
    this.resetDrivingEffects();
  }

  addTrackDetails() {
    const circuit = this.circuit, half = circuit.config.width / 2;
    const count = Math.floor(circuit.length / 2.3);
    const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.65, 0.16, 2.36), mat('#efead5'), count * 2);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.38, 3.6), mat('#dee1cf', { metalness: 0.3 }), Math.floor(circuit.length / 3.5) * 2);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), mat('#71796d'), rails.count);
    const red = new THREE.Color('#d96f49'), white = new THREE.Color('#f3efdc');
    for (let i = 0; i < count; i++) for (let side = 0; side < 2; side++) {
      const p = circuit.at(i / count, (side ? 1 : -1) * (circuit.widthAt(i / count) / 2 + 0.07));
      temp.position.set(p.x, p.y+0.09, p.z); temp.rotation.set(-p.pitch, p.heading, p.bank, 'YXZ'); temp.scale.set(1, 1, 1); temp.updateMatrix();
      curbs.setMatrixAt(i * 2 + side, temp.matrix); curbs.setColorAt(i * 2 + side, i % 2 ? red : white);
    }
    for (let i = 0; i < rails.count / 2; i++) for (let side = 0; side < 2; side++) {
      const p = circuit.at(i / (rails.count / 2), (side ? 1 : -1) * (circuit.widthAt(i / (rails.count / 2)) / 2 + 0.68));
      temp.position.set(p.x, p.y+0.8, p.z); temp.rotation.set(-p.pitch, p.heading, p.bank, 'YXZ'); temp.updateMatrix();
      rails.setMatrixAt(i * 2 + side, temp.matrix);
      temp.position.y = p.y+0.42; temp.updateMatrix(); posts.setMatrixAt(i * 2 + side, temp.matrix);
    }
    curbs.receiveShadow = true; rails.castShadow = true;
    this.roadCurbs=curbs;this.curbTheme=null;
    this.environment.add(curbs, rails, posts);
    // A checkered start line and a compact overhead gantry.
    const start = new THREE.Group(), spawn = circuit.at(0);
    start.position.set(spawn.x, spawn.y+0.07, spawn.z); start.rotation.y = spawn.heading;
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(circuit.config.width / 12, 0.02, 0.6), mat('#ffffff'), 24);
    const darkTile = new THREE.Color('#252f2a'), lightTile = new THREE.Color('#f6f1d9');
    for (let x = 0; x < 12; x++) for (let z = 0; z < 2; z++) {
      temp.position.set((x - 5.5) * circuit.config.width / 12, 0, (z - 0.5) * 0.6);
      temp.rotation.set(0, 0, 0); temp.scale.set(1, 1, 1); temp.updateMatrix();
      tiles.setMatrixAt(x * 2 + z, temp.matrix); tiles.setColorAt(x * 2 + z, (x + z) % 2 ? darkTile : lightTile);
    }
    start.add(tiles);
    const dark = mat('#263e35');
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.32, 9.2, 0.32), dark);
      post.position.set(side * (half + 1.1), 4.6, 0); post.castShadow = true; start.add(post);
    }
    const bannerCanvas = document.createElement('canvas'); bannerCanvas.width = 1024; bannerCanvas.height = 128;
    const ctx = bannerCanvas.getContext('2d');
    ctx.fillStyle = '#263e35'; ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#dbff80'; ctx.font = 'italic 800 76px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ROADRUSHERS', 512, 92);
    const bannerTex = new THREE.CanvasTexture(bannerCanvas); bannerTex.colorSpace = THREE.SRGBColorSpace;
    this.bannerTexture?.dispose(); this.bannerTexture = bannerTex;
    const banner = new THREE.Mesh(new THREE.BoxGeometry(circuit.config.width + 2.5, 1.45, 0.2), new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 1 }));
    banner.position.y = 8.8; start.add(banner); this.environment.add(start);
    this.banner = banner; this.gantryPosition = spawn;
    // Roadside arrows communicate the driving direction.
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.35, -0.5); arrowShape.lineTo(0, 0); arrowShape.lineTo(0.35, -0.5);
    arrowShape.lineTo(0.35, -0.15); arrowShape.lineTo(0, 0.35); arrowShape.lineTo(-0.35, -0.15);
    const arrows = new THREE.InstancedMesh(new THREE.ShapeGeometry(arrowShape), mat('#d4d6c1', { transparent: true, opacity: 0.65, side: THREE.DoubleSide, forceSinglePass: true }), 20);
    for (let i = 0; i < 20; i++) {
      const p = circuit.at((i + 0.35) / 20);
      temp.rotation.set(-p.pitch, p.heading, p.bank, 'YXZ'); temp.rotateX(Math.PI/2); temp.position.set(p.x, p.y+0.065, p.z); temp.scale.set(1, 1, 1); temp.updateMatrix();
      arrows.setMatrixAt(i, temp.matrix);
    }
    this.environment.add(arrows);
    this.directionArrows=arrows;
  }

  addLandscape() {
    this.landscape=new THREE.Group();this.landscape.name='biome-landscape';this.environment.add(this.landscape);
    buildEnvironment(this.landscape,this.circuit,this.environmentSettings);
    polishScenery(this.landscape);
    const landscape=this.landscape;
    void enhanceLandscape(landscape,this.circuit,this.environmentSettings,()=>this.landscape===landscape)
      .then(changed=>{if(changed)this.renderer.shadowMap.needsUpdate=true;});
  }

  applyEnvironment(input,reflections=true){
    const state=normalizeEnvironment({...input,...(this.graphicsQuality?{quality:this.graphicsQuality}:{})}),previous=this.environmentSettings;
    const rebuild=!previous||['theme','biome','grassDensity','quality'].some(key=>previous[key]!==state[key]);
    this.environmentSettings=state;
    if(rebuild&&this.landscape){
      const gs=new Set(),ms=new Set();this.landscape.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)ms.add(m);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.landscape.removeFromParent();this.addLandscape();
    }
    this.atmosphere.configure(state,this.circuit);if(reflections)this.atmosphere.refreshReflections();
    const urban=['tokyo','bund'].includes(state.theme);
    if(this.roadCurbs&&this.curbTheme!==urban){const a=new THREE.Color(urban?'#9aa6a0':'#d96f49'),b=new THREE.Color('#f3efdc');for(let i=0;i<this.roadCurbs.count;i++)this.roadCurbs.setColorAt(i,i%4<2?a:b);this.roadCurbs.instanceColor.needsUpdate=true;this.curbTheme=urban;}
    if(this.directionArrows)this.directionArrows.visible=!urban;
    const night=this.atmosphere.solar.elevation<0;
    this.moon.intensity=night?1.6:.05;
    this.headlamp.intensity=this.atmosphere.solar.elevation<5?65:0;
    this.roadMaterials?.forEach((m,i)=>{m.roughness=SURFACES[Object.keys(SURFACES)[i]].roughness*(1-state.wetness*.68);m.emissive.set(night?'#27394c':'#000000');m.emissiveIntensity=night?.4:0;});
    this.precipitation.visible=['rain','snow'].includes(state.weather)&&state.precipitation>0;
    this.precipitationSnow.value=state.weather==='snow'?1:0;this.precipitation.material.size=state.weather==='snow'?.32:.65;
    this.precipitationCount=Math.floor((state.quality==='mobile'?320:640)*state.precipitation);
    this.precipitation.geometry.setDrawRange(0,this.precipitationCount);
  }

  setEditorView(enabled,focus){
    this.editorControls??=new OrbitControls(this.camera,this.renderer.domElement);this.editorControls.enabled=enabled;
    this.editorControls.enableDamping=true;this.editorControls.minDistance=10;this.editorControls.maxDistance=1400;this.editorControls.maxPolarAngle=Math.PI/2-.025;
    this.camera.far=enabled?2200:700;this.camera.near=enabled?1:.1;
    if(enabled){const p=focus||this.car.position;this.editorControls.target.set(p.x,p.y+.6,p.z);this.camera.position.set(p.x+36,p.y+24,p.z+42);this.camera.fov=45;this.camera.updateProjectionMatrix();this.editorControls.update();}else{this.camera.clearViewOffset();this.cameraReady=false;}
  }

  fitEnvironmentView(){
    const bounds=new THREE.Box3().setFromPoints(this.circuit.samples),theme=this.environmentSettings.theme;
    if(['amalfi','norway','bund'].includes(theme))bounds.max.z+=theme==='bund'?180:70;
    const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.z,55);
    const portraitZoom=Math.max(1,.95/this.camera.aspect);
    this.editorControls.target.copy(center);this.camera.position.copy(center).add(new THREE.Vector3(span*.65,span*.7,span*.8).multiplyScalar(portraitZoom));this.editorControls.update();
  }

  setConditions(surfaceId, weatherId) {
    const weatherChanged=this.weatherId!==weatherId,defaults=environmentForTrack(this.circuit.config,weatherId);
    this.surfaceId = surfaceId; this.weatherId = weatherId;
    this.updateRoadGroups(surfaceId);
    Object.values(SURFACES).forEach((surface,i) => {
      this.roadMaterials[i].roughness = weatherId === 'rain' ? 0.3 : surface.roughness;
      this.roadMaterials[i].metalness = i === 3 ? 0.16 : 0;
    });
    const state={...this.environmentSettings,weather:weatherId};
    if(weatherChanged)for(const key of ['clouds','fog','precipitation','wetness','snow'])state[key]=defaults[key];
    if(weatherId==='sunset'&&weatherChanged&&this.circuit.config.editorEnvironment?.weather!=='sunset')state.hour=18.2;
    this.applyEnvironment(state);
  }

  update(dt, drive, cameraMode, running, animateWeather = true, alpha = 1) {
    this.car.position.set(drive.x, (drive.y||0)+0.075, drive.z);
    this.car.rotation.y = drive.heading;
    if (this.body) {
      this.body.rotation.x=-(drive.pitch||0);
      this.body.rotation.z = THREE.MathUtils.damp(this.body.rotation.z, (drive.roll||0)+drive.steer * drive.speed * 0.003, 6, dt);
      this.body.position.y = 0;
      for (const wheel of this.wheels) wheel.rotation.x += running ? drive.speed * dt * 3.3 : 0;
      for (const wheel of this.frontWheels || []) wheel.rotation.y = -drive.steer * 0.35;
    }
    if(this.contactShadow){
      this.contactShadow.position.y=(drive.groundY??drive.y??0)-(drive.y||0)+.025;
      this.contactShadow.material.opacity=.15/Math.max(1,1+((drive.y||0)-(drive.groundY??drive.y??0))*.55);
    }
    const underpass=this.circuit.layout?.crossings.some(c=>(drive.y||0)<c.upperY-3&&Math.hypot(drive.x-c.x,drive.z-c.z)<this.circuit.config.width*.9);
    this.underpassMarker.visible=Boolean(underpass||this.fleet);if(this.underpassMarker.visible)this.underpassMarker.position.set(drive.x,(drive.y||0)+.2,drive.z);
    if(this.editorControls?.enabled){this.editorControls.update();this.camera.near=Math.max(.2,Math.min(20,this.camera.position.distanceTo(this.editorControls.target)*.02));this.camera.setViewOffset(innerWidth,innerHeight,innerWidth>760?175:0,innerWidth<=760?innerHeight*.2:0,innerWidth,innerHeight);}
    else{
      const rig = this.cameraRig.update(dt, drive, cameraMode, !this.cameraReady, this.camera.aspect);
      this.camera.position.copy(rig.position); this.camera.lookAt(rig.look);
      this.camera.fov = rig.fov; this.camera.updateProjectionMatrix(); this.cameraReady = true;
    }
    // The chase camera can pass through the start arch. Hide its sign nearby.
    this.banner.visible = Math.hypot(this.camera.position.x - this.gantryPosition.x, this.camera.position.z - this.gantryPosition.z) > 19;
    if (this.precipitation.visible) {
      this.precipitation.position.set(drive.x, drive.y||0, drive.z);
      for (let i = 0; animateWeather && i < this.precipitationCount; i++) {
        const idx = i * 3;
        this.particlePositions[idx + 1] -= dt * (this.weatherId === 'rain' ? 32 : 4.4);
        const wind=this.environmentSettings.wind,angle=this.environmentSettings.windDirection*Math.PI/180;
        this.particlePositions[idx]=(this.particlePositions[idx]+Math.sin(angle)*wind*dt+150)%100-50;
        this.particlePositions[idx+2]=(this.particlePositions[idx+2]+Math.cos(angle)*wind*dt+150)%100-50;
        if (this.particlePositions[idx + 1] < 0) this.particlePositions[idx + 1] += 45;
      }
      if (animateWeather) this.precipitation.geometry.attributes.position.needsUpdate = true;
    }
    this.driftEffects.update(animateWeather ? dt : 0, drive, running, this.circuit.surfaceAt(drive.progress || 0, this.surfaceId));
    this.brakeEffects.update(drive,this.circuit,running);
    this.fleet?.update(dt,alpha,running);
    this.atmosphere.update(animateWeather?dt:0,this.landscape,this.editorControls?.enabled?this.camera.position.distanceTo(this.editorControls.target):0);this.atmosphere.render(dt);
  }

  resetDrivingEffects() {
    this.driftEffects.reset();
    this.brakeEffects.reset();
  }
}
