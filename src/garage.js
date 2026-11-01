import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { VEHICLES } from './config.js';
import { buildVehicle } from './vehicles.js';
import { collectionPage, vehiclesOnPage } from './vehicle-catalog.js';
import { disposeVehicle } from './vehicle-modeler.js';
import { updateCustomization, setCustomWrapping } from './vehicle-customization.js';

/** Fit the actual model, including its depth, inside the perspective viewport. */
export function garageCameraFrame(bounds,aspect,fov=40){
  const target=bounds.getCenter(new THREE.Vector3()),direction=new THREE.Vector3(2.8,1.6,3.2).normalize();
  const right=new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
  const vertical=Math.tan(THREE.MathUtils.degToRad(fov/2))*.82,horizontal=vertical*aspect;
  let distance=4.8;
  for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
    const point=new THREE.Vector3(x,y,z).sub(target);
    distance=Math.max(distance,point.dot(direction)+Math.max(Math.abs(point.dot(right))/horizontal,Math.abs(point.dot(up))/vertical));
  }
  return {target,position:target.clone().addScaledVector(direction,distance),distance};
}

/** A separate, on-demand showroom. Only one of the game/showroom renders at once. */
export class GarageView {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.domElement.setAttribute('aria-label', 'Colección 3D de micromachines. Arrastra para girar y selecciona un coche para ampliarlo.');
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#e8edf3');
    this.camera = new THREE.PerspectiveCamera(40, 1, .05, 160);
    const studio = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(studio, .05);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .55;
    studio.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#f6f7eb', '#8b9689', 1.6));
    const key = new THREE.DirectionalLight('#fff1d5', 2); key.position.set(-4, 8, 6); this.scene.add(key);
    const fill = new THREE.DirectionalLight('#d4e7f1', 1.2); fill.position.set(7, 5, -4); this.scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#e0e7ef', roughness: .85 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.06; this.scene.add(floor);
    this.models = new Map(); this.displays = new Map(); this.visible = false; this.mode = 'detail';
    this.selectedId = VEHICLES[0].id; this.targetPosition = new THREE.Vector3(); this.targetLook = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.modelData=new Map();this.page=null;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = .075;
    this.controls.enablePan = false; this.controls.minPolarAngle = .22; this.controls.maxPolarAngle = Math.PI/2-.06;
    this.controls.maxDistance = 70; this.controls.minDistance = 5;
    let start, multiplePointers=false;
    const activePointers=new Set();
    this.renderer.domElement.addEventListener('pointerdown', e => {
      activePointers.add(e.pointerId);if(activePointers.size>1)multiplePointers=true;
      start=[e.clientX,e.clientY];
    });
    this.renderer.domElement.addEventListener('pointercancel', e => {activePointers.delete(e.pointerId);start=null;if(!activePointers.size)multiplePointers=false;});
    this.renderer.domElement.addEventListener('pointerup', e => {
      activePointers.delete(e.pointerId);
      const canSelect=start&&!multiplePointers&&Math.hypot(e.clientX-start[0],e.clientY-start[1])<=7&&!this.transition;
      start=null;if(!activePointers.size)multiplePointers=false;
      if(!canSelect)return;
      const rect=this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hits=this.raycaster.intersectObjects([...this.displays.values()].map(v=>v.display).filter(d=>d.visible),true);
      if(!hits.length)return;
      let node=hits[0].object;while(node&&!node.userData.vehicleId)node=node.parent;
      if(node)this.onSelect(node.userData.vehicleId);
    });
    this.resizeObserver = new ResizeObserver(()=>this.resize());
  }

  loadPage(page) {
    if(this.page===page)return;
    for(const model of this.modelData.values())disposeVehicle(model);
    for(const {display}of this.displays.values()){
      display.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});display.removeFromParent();
    }
    this.models.clear();this.modelData.clear();this.displays.clear();this.page=page;
    const vehicles=vehiclesOnPage(VEHICLES,page);
    for (const [index, vehicle] of vehicles.entries()) {
      const display = new THREE.Group();
      display.userData.vehicleId = vehicle.id;
      const base = new THREE.Mesh(new RoundedBoxGeometry(4.05, .22, 4.6, 2, .11), new THREE.MeshStandardMaterial({ color: '#edf1f7', roughness: .6 }));
      base.position.y = .07; display.add(base);
      const data=buildVehicle(vehicle),model=data.group;
      model.position.y = .19; model.rotation.y = -.22;
      model.userData.vehicleId = vehicle.id; display.add(model);
      const contact = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshBasicMaterial({ color: '#606d60', transparent: true, opacity: .13, depthWrite: false }));
      contact.rotation.x = -Math.PI/2; contact.scale.y = 1.2; contact.position.y = .185; display.add(contact);
      const plateCanvas = document.createElement('canvas'); plateCanvas.width = 512; plateCanvas.height = 96;
      const ctx = plateCanvas.getContext('2d');
      ctx.fillStyle = '#d8decf'; ctx.fillRect(0,0,512,96);
      ctx.fillStyle = '#425649'; ctx.font = '600 27px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${String(vehicle.number??index+1).padStart(2,'0')}  /  ${vehicle.name.toUpperCase()}`,256,59);
      const texture = new THREE.CanvasTexture(plateCanvas); texture.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.85,.53), new THREE.MeshBasicMaterial({map:texture}));
      plate.rotation.x = -Math.PI/2; plate.position.set(0,.186,1.88); display.add(plate);
      this.scene.add(display); this.models.set(vehicle.id,model);this.modelData.set(vehicle.id,data); this.displays.set(vehicle.id,{display,base});
    }
    this.selectedId=vehicles[0].id;
  }

  showPage(page){
    this.loadPage(page);this.mode='detail';this.resize();
  }

  customize(patch){
    const model=this.modelData.get(this.selectedId);if(!model?.materials)return false;
    return updateCustomization(model,patch);
  }

  async uploadWrap(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Usa una imagen PNG, JPG o WEBP de hasta 8 MB.');
    const model=this.modelData.get(this.selectedId),url=URL.createObjectURL(file);
    if(!model?.materials){URL.revokeObjectURL(url);return;}
    try{const texture=await new THREE.TextureLoader().loadAsync(url);if(this.modelData.get(model.vehicle.id)!==model){texture.dispose();return;}setCustomWrapping(model,texture);}finally{URL.revokeObjectURL(url);}
  }

  mount(host, selectedId) {
    this.host=host; host.appendChild(this.renderer.domElement);
    this.resizeObserver.disconnect();this.resizeObserver.observe(host);
    this.visible=true;this.loadPage(collectionPage(selectedId)); this.selectedId=selectedId;
    this.resize(); this.setView('detail',true);
  }

  hide() { this.visible=false; this.controls.enabled=false; this.resizeObserver.disconnect(); }

  orbit(x,y,dt){
    if(!this.visible||this.transition||Math.abs(x)+Math.abs(y)<.01)return;
    const offset=this.camera.position.clone().sub(this.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    spherical.theta-=x*dt*1.8;spherical.phi=Math.max(this.controls.minPolarAngle,Math.min(this.controls.maxPolarAngle,spherical.phi+y*dt*1.3));
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));this.controls.update();
  }

  resize() {
    if(!this.host||!this.visible)return;
    const width=this.host.clientWidth,height=this.host.clientHeight;
    if(!width||!height)return;
    this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
    const portrait=this.camera.aspect<1.1;
    const count=this.displays.size,columns=count===3?(portrait?2:3):(portrait?2:5),rows=Math.ceil(count/columns);
    [...this.displays.values()].forEach(({display},i)=>{
      display.position.set((i%columns-(columns-1)/2)*4.35,0,(Math.floor(i/columns)-(rows-1)/2)*5.1);
    });
    this.setView(this.mode,true);
  }

  select(id) { if(!VEHICLES.some(v=>v.id===id))return;this.loadPage(collectionPage(id));this.selectedId=id;this.resize();this.setView('detail'); }

  setView(mode, immediate=false) {
    this.mode=mode;
    const portrait=this.camera.aspect<1.1;
    for(const [id,{display,base}]of this.displays){display.visible=mode==='overview'||id===this.selectedId;base.material.color.set(id===this.selectedId?'#f2f2df':'#e3e8dc');}
    if(mode==='detail') {
      const model=this.models.get(this.selectedId);model.updateWorldMatrix(true,true);
      const {target,position,distance}=garageCameraFrame(new THREE.Box3().setFromObject(model),this.camera.aspect,this.camera.fov);
      this.targetLook.copy(target);this.targetPosition.copy(position);
      this.controls.minDistance=distance*.65;this.controls.maxDistance=Math.max(13,distance*2);
    } else {
      this.targetLook.set(0,.4,portrait?-.1:0);
      const large=this.displays.size>3;
      this.targetPosition.set(large?(portrait?5:9):5.5,large?(portrait?27:18):7.5,large?(portrait?27:23):10);
      this.controls.minDistance=large?17:11;this.controls.maxDistance=70;
    }
    if(immediate){this.camera.position.copy(this.targetPosition);this.controls.target.copy(this.targetLook);this.camera.lookAt(this.targetLook);this.transition=false;this.controls.enabled=true;this.controls.update();}
    else {this.transition=true;this.controls.enabled=false;}
  }

  update(dt) {
    if(!this.visible)return;
    if(this.transition){const alpha=1-Math.exp(-7*dt);this.camera.position.lerp(this.targetPosition,alpha);this.controls.target.lerp(this.targetLook,alpha);this.camera.lookAt(this.controls.target);if(this.camera.position.distanceTo(this.targetPosition)<.015){this.transition=false;this.controls.enabled=true;}}
    else this.controls.update();
    this.renderer.render(this.scene,this.camera);
  }
}
