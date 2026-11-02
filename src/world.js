import { activeCircuitDressing } from './circuit-dressing.js';
import { buildCircuitDressing,circuitAsphaltMaterial } from './circuit-dressing-view.js';
import { animateVehicle } from './vehicle-pose.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SURFACES, VEHICLES } from './config.js';
import { buildVehicle, preloadVehicles } from './vehicles.js';
import { CameraRig } from './camera.js';
import { DriftEffects } from './drift-effects.js';
import { BrakeEffects } from './brake-effects.js';
import { roadRibbon as ribbon,trackStructures,trackCurbs } from './road-geometry.js';
import { RivalFleet } from './rival-fleet.js';
import { GhostView } from './ghost-view.js';
import { basicFloor,disposeSceneGroup } from './basic-scene.js';
import { GameplayRenderer } from './gameplay-renderer.js';
import { LocalOcclusion,markPlayerOccluder } from './local-occlusion.js';

const temp = new THREE.Object3D();
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, ...options });

export class World {
  constructor(container,policy) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(policy.maximum);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    // One local shadow map, refreshed at a bounded rate independently of rendering.
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
    Object.assign(this.sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:230});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.035;this.sun.shadow.intensity=.65;
    this.shadowElapsed=0;this.shadowReady=false;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.background=new THREE.Color('#8faaa1');
    this.renderPipeline=new GameplayRenderer(this.renderer,this.scene,this.camera);
    this.occlusion=new LocalOcclusion();this.renderPipeline.setOcclusion(this.occlusion);
    this.effectsEnabled=false;
    this.setGraphics(policy);
    this.car = new THREE.Group();
    this.scene.add(this.car);
    this.wheels = [];
    this.cameraReady = false;
    this.cameraRig = new CameraRig();
    this.brakeEffects = new BrakeEffects(this.scene);
    window.addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  async loadCar(vehicle = VEHICLES[0]) {
    await preloadVehicles(vehicle);
    this.setVehicle(vehicle);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), new THREE.MeshBasicMaterial({ color: 0x162a22, transparent: true, opacity: 0.15, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.y = 1.25;
    this.car.add(shadow);this.contactShadow=shadow;
    this.underpassMarker=new THREE.Mesh(new THREE.RingGeometry(1.7,1.9,32),new THREE.MeshBasicMaterial({color:0xd9ff80,depthTest:false,depthWrite:false,transparent:true,opacity:.85}));
    this.underpassMarker.rotation.x=-Math.PI/2;this.underpassMarker.renderOrder=30;this.underpassMarker.visible=false;this.scene.add(this.underpassMarker);
  }

  setVehicle(vehicle) {
    if (this.vehicleId === vehicle.id && !vehicle.prototype) return;
    const model = buildVehicle(vehicle);
    if(model.assetOwnership==='shared-cache'){
      if(!this.vehicleEnvironment){
        const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);
        this.vehicleEnvironment=pmrem.fromScene(studio,.05);studio.dispose();pmrem.dispose();
        this.scene.userData.vehicleEnvironment=this.vehicleEnvironment.texture;
      }
      model.group.traverse(o=>{if(o.isMesh&&o.material.userData.vehicleAtlas)o.material.envMap=this.vehicleEnvironment.texture;});
    }
    if (this.body) {
      this.body.removeFromParent();
      if(this.vehicleModel?.dispose)this.vehicleModel.dispose();
      else {
      const geometries = new Set(), materials = new Set();
      this.body.traverse(node => { if(node.geometry)geometries.add(node.geometry);if(node.material)materials.add(node.material); });
      geometries.forEach(g => g.dispose());materials.forEach(m => {m.map?.dispose();m.dispose();});
      }
    }
    this.vehicleModel = model;
    this.body = model.group; this.wheels = model.wheels; this.frontWheels = model.frontWheels;
    this.vehicleId = vehicle.id; this.car.add(this.body);
    this.body.traverse(node=>{if(node.isMesh)node.castShadow=!(Array.isArray(node.material)?node.material:[node.material]).some(material=>material.transparent);});
    this.shadowReady=false;
    this.brakeEffects.bind(model);
    this.driftEffects?.bind(model);
  }

  setRivals(session) {
    if(session&&this.fleet?.session===session)return;
    this.fleet?.dispose();this.fleet=session?new RivalFleet(this.scene,session,this.brakeEffects.glow.material.map):null;
    this.shadowReady=false;
  }

  setGhost(enabled) {
    this.ghost?.dispose();
    this.ghost = enabled ? new GhostView(this.scene, this.vehicleModel) : null;
  }

  updateRoadGroups(surfaceId) {
    const ids = Object.keys(SURFACES), geometry = this.roadMesh.geometry;
    geometry.clearGroups();
    let previous = -1, begin = 0;
    const progress=geometry.userData.roadProgress;
    for(let i=0;i<=progress.length;i++) {
      const index = i === progress.length ? -1 : ids.indexOf(this.circuit.surfaceAt(progress[i], surfaceId));
      if(index !== previous) {
        if(i>0)geometry.addGroup(begin*6,(i-begin)*6,previous);
        begin=i;previous=index;
      }
    }
  }

  build(circuit, surfaceId, weatherId) {
    this.occlusion?.clear();
    disposeSceneGroup(this.environment);
    this.circuit = circuit;
    this.environment = new THREE.Group();
    this.scene.add(this.environment);
    const dressing=activeCircuitDressing(circuit);
    const half = u => circuit.widthAt(u) / 2;
    this.roadMaterials = Object.entries(SURFACES).map(([id,surface])=>dressing&&id==='asphalt'?circuitAsphaltMaterial():mat(surface.color,{roughness:surface.roughness,side:THREE.DoubleSide}));
    this.environment.add(ribbon(circuit, u => -half(u)-1, u => half(u)+1, dressing?-.02:0.015, mat('#bcb393', { side: THREE.DoubleSide })));
    this.roadMesh = ribbon(circuit, u => -half(u), u => half(u), 0.035, this.roadMaterials);
    this.environment.add(this.roadMesh);
    const stripe = mat('#eee9cf', { side: THREE.DoubleSide });
    this.environment.add(ribbon(circuit, u => -half(u)+0.34, u => -half(u)+0.48, 0.055, stripe));
    this.environment.add(ribbon(circuit, u => half(u)-0.48, u => half(u)-0.34, 0.055, stripe));
    this.environment.add(trackStructures(circuit));
    this.addTrackDetails();
    this.environment.add(dressing?buildCircuitDressing(circuit,dressing):basicFloor(circuit));
    this.environment.updateMatrixWorld(true);
    this.environment.traverse(node=>{node.matrixAutoUpdate=false;});
    this.setConditions(surfaceId, weatherId);
    this.occlusion?.bind(this.environment,circuit);
    this.cameraReady = false;
    this.resetDrivingEffects();
    this.shadowReady=false;
  }

  addTrackDetails() {
    const circuit = this.circuit;
    this.environment.add(trackCurbs(circuit));
    // A checkered start line, without roadside scenery or an overhead gantry.
    const start = new THREE.Group(), spawn = circuit.at(0);
    start.position.set(spawn.x, spawn.y+0.07, spawn.z); start.rotation.y = spawn.heading;
    const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(circuit.config.width / 12, 0.02, 0.6), mat('#ffffff'), 24);
    const darkTile = new THREE.Color('#252f2a'), lightTile = new THREE.Color('#f6f1d9');
    for (let x = 0; x < 12; x++) for (let z = 0; z < 2; z++) {
      temp.position.set((x - 5.5) * circuit.config.width / 12, 0, (z - 0.5) * 0.6);
      temp.rotation.set(0, 0, 0); temp.scale.set(1, 1, 1); temp.updateMatrix();
      tiles.setMatrixAt(x * 2 + z, temp.matrix); tiles.setColorAt(x * 2 + z, (x + z) % 2 ? darkTile : lightTile);
    }
    start.add(markPlayerOccluder(tiles,0));
    this.environment.add(start);
    // Roadside arrows communicate the driving direction.
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(-0.35, -0.5); arrowShape.lineTo(0, 0); arrowShape.lineTo(0.35, -0.5);
    arrowShape.lineTo(0.35, -0.15); arrowShape.lineTo(0, 0.35); arrowShape.lineTo(-0.35, -0.15);
    const arrows = new THREE.InstancedMesh(new THREE.ShapeGeometry(arrowShape), mat('#d4d6c1', { transparent: true, opacity: 0.65, side: THREE.DoubleSide, forceSinglePass: true }), 20);
    for (let i = 0; i < 20; i++) {
      const p = circuit.at((i + 0.35) / 20);
      temp.rotation.set(-p.pitch, p.heading, p.bank, 'YXZ'); temp.rotateX(Math.PI/2); temp.position.set(p.x, p.y+0.065, p.z); temp.scale.setScalar(circuit.hasRoad((i+.35)/20)?1:0); temp.updateMatrix();
      arrows.setMatrixAt(i, temp.matrix);
    }
    this.environment.add(markPlayerOccluder(arrows,Array.from({length:20},(_,i)=>(i+.35)/20)));
    this.directionArrows=arrows;
  }

  setGraphics(policy) {
    this.renderPipeline.setGraphics(policy);
    this.occlusion?.invalidateMaterials();
    const enabled=policy.shadowSize>0,changed=this.renderer.shadowMap.enabled!==enabled;
    this.renderer.shadowMap.enabled=enabled;this.shadowHz=policy.shadowHz||60;
    if(enabled&&this.sun.shadow.mapSize.x!==policy.shadowSize){
      this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.mapSize.set(policy.shadowSize,policy.shadowSize);
    }
    if(changed)this.scene.traverse(node=>{for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)material.needsUpdate=true;});
    this.shadowReady=false;
    if(this.effectsEnabled!==policy.effects){
      this.effectsEnabled=policy.effects;
      if(policy.effects&&!this.driftEffects){this.driftEffects=new DriftEffects(this.scene);if(this.vehicleModel)this.driftEffects.bind(this.vehicleModel);}
      this.driftEffects?.reset();
      if(this.driftEffects)this.driftEffects.trails.visible=policy.effects;
    }
  }

  setConditions(surfaceId, weatherId) {
    // Weather changes grip in the simulation; the basic scene stays neutral.
    this.surfaceId=surfaceId;this.weatherId=weatherId;this.updateRoadGroups(surfaceId);
  }

  updateShadows(dt,drive,running){
    if(!this.renderer.shadowMap.enabled)return;
    this.shadowElapsed+=dt;
    if(this.shadowReady&&(!running||this.shadowElapsed<1/this.shadowHz-1e-4))return;
    this.sun.target.position.set(drive.x,drive.y||0,drive.z);
    this.sun.position.set(drive.x-65,(drive.y||0)+100,drive.z+45);
    this.sun.target.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate=true;this.shadowElapsed=0;this.shadowReady=true;
  }

  update(dt, drive, cameraMode, running, animateWeather = true, alpha = 1) {
    this.car.position.set(drive.x, (drive.y||0)+0.075, drive.z);
    this.car.rotation.y = drive.heading;
    if (this.body) {
      animateVehicle(this.vehicleModel,drive,dt,running);
    }
    if(this.contactShadow){
      this.contactShadow.visible=!this.renderer.shadowMap.enabled&&drive.roadSupported!==false;
      this.contactShadow.position.y=(drive.groundY??drive.y??0)-(drive.y||0)+.025;
      this.contactShadow.material.opacity=.15/Math.max(1,1+((drive.y||0)-(drive.groundY??drive.y??0))*.55);
    }
    this.underpassMarker.visible=Boolean(this.fleet);if(this.underpassMarker.visible)this.underpassMarker.position.set(drive.x,(drive.y||0)+.2,drive.z);
    const rig=this.cameraRig.update(dt,drive,cameraMode,!this.cameraReady,this.camera.aspect,this.circuit);
    this.camera.position.copy(rig.position);this.camera.lookAt(rig.look);
    if(this.camera.fov!==rig.fov){this.camera.fov=rig.fov;this.camera.updateProjectionMatrix();}
    this.cameraReady=true;
    this.camera.updateMatrixWorld();
    this.vehicleModel?.updateLOD?.(this.camera,this.renderer.domElement.clientHeight);
    this.ghost?.updateLOD?.(this.camera,this.renderer.domElement.clientHeight);
    if(this.effectsEnabled)this.driftEffects?.update(animateWeather?dt:0,drive,running,this.circuit.surfaceAt(drive.progress||0,this.surfaceId));
    this.brakeEffects.update(drive,this.circuit,running);
    this.fleet?.update(dt,alpha,running,this.camera,this.renderer.domElement.clientHeight);
    this.occlusion?.update(dt,drive,this.camera,this.renderer);
    this.updateShadows(dt,drive,running);
    this.renderPipeline.render(dt);
  }

  resetDrivingEffects() {
    this.occlusion?.reset();
    this.driftEffects?.reset();
    this.brakeEffects.reset();
  }
}
