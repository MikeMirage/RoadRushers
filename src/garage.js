import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { VEHICLES } from './config.js';
import { buildVehicle, preloadVehicles,vehicleAvailable } from './vehicles.js';
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

export function studioCameraFrame(aspect,fov=36){
  const bounds=new THREE.Box3(new THREE.Vector3(-1.4,0,-1.65),new THREE.Vector3(1.4,1.65,1.65));
  const frame=garageCameraFrame(bounds,aspect,fov);
  frame.position.sub(frame.target).multiplyScalar(.82).add(frame.target);
  return frame;
}

/** One renderer shared by the home car, studio lineup and cached card images. */
export class GarageView {
  constructor(onSelect) {
    this.onSelect=onSelect;
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    this.renderer.setClearColor('#15191e',0);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Estudio 3D. Desliza a izquierda o derecha para cambiar de coche.');
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(36,1,.05,180);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(this.renderer);
    this.environmentTarget=pmrem.fromScene(room,.06);this.scene.environment=this.environmentTarget.texture;this.scene.environmentIntensity=.5;
    room.dispose();pmrem.dispose();
    this.lights=[];
    const ambient=new THREE.HemisphereLight('#e5efff','#29323e',1.1);
    const key=new THREE.DirectionalLight('#fff8f2',3);key.position.set(-4,7,6);key.castShadow=true;
    key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-12,right:12,top:10,bottom:-10,near:.1,far:35});key.shadow.normalBias=.035;key.shadow.bias=-.0001;key.shadow.radius=4;
    const fill=new THREE.DirectionalLight('#d6e8ff',1.25);fill.position.set(5,3,5);
    const rim=new THREE.DirectionalLight('#9bceff',3.2);rim.position.set(3,5,-5);
    this.key=key;
    for(const light of [ambient,key,fill,rim]){this.scene.add(light);this.lights.push(light);}
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.ShadowMaterial({color:'#050a12',opacity:.28,depthWrite:false}));
    this.floor.rotation.x=-Math.PI/2;this.floor.position.y=-.015;this.floor.receiveShadow=true;this.scene.add(this.floor);
    this.lineup=new THREE.Group();this.scene.add(this.lineup);
    this.rowDirection=new THREE.Vector3(3.2,0,-2.8).normalize();this.spacing=3.6;this.slideTarget=new THREE.Vector3();
    this.models=new Map();this.displays=new Map();this.modelData=new Map();this.thumbnails=new Map();this.thumbnailPending=new Map();
    this.pendingModels=new Map();this.modelRequests=new Map();this.pageVersion=0;this.visible=false;this.page=null;this.mode='detail';this.presentation='garage';
    this.selectedId=VEHICLES[0].id;this.reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.enablePan=false;
    this.controls.minPolarAngle=.3;this.controls.maxPolarAngle=Math.PI/2-.07;this.controls.enabled=false;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    let start;
    this.renderer.domElement.addEventListener('pointerdown',e=>{if(!e.isPrimary)return;start=[e.clientX,e.clientY];this.renderer.domElement.setPointerCapture(e.pointerId);});
    this.renderer.domElement.addEventListener('pointercancel',()=>{start=null;});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(!start)return;const dx=e.clientX-start[0],dy=e.clientY-start[1];start=null;
      if(this.mode==='customize')return;
      if(this.presentation==='garage'&&Math.abs(dx)>32&&Math.abs(dx)>Math.abs(dy)*1.3){this.onSelect(this.neighbor(dx<0?1:-1));return;}
      if(Math.hypot(dx,dy)>8)return;
      const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
      this.raycaster.setFromCamera(this.pointer,this.camera);
      const hit=this.raycaster.intersectObjects([...this.displays.values()],true)[0];
      let node=hit?.object;while(node&&!node.userData.vehicleId)node=node.parent;
      if(node)this.onSelect(node.userData.vehicleId);
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());
  }
  loadPage(page){
    if(this.page===page)return;
    this.pageVersion++;for(const data of this.modelData.values())disposeVehicle(data);
    this.lineup.clear();this.models.clear();this.modelData.clear();this.displays.clear();this.pendingModels.clear();this.modelRequests.clear();this.page=page;
    this.pageVehicles=(this.allowedIds?VEHICLES.filter(v=>this.allowedIds.includes(v.id)):vehiclesOnPage(VEHICLES,page)).filter(vehicleAvailable);
    for(const [index,v]of this.pageVehicles.entries()){
      const display=new THREE.Group();display.userData.vehicleId=v.id;display.position.copy(this.rowDirection).multiplyScalar(index*this.spacing);
      this.lineup.add(display);this.displays.set(v.id,display);
    }
    this.selectedId=this.pageVehicles[0].id;this.positionLineup(true);
  }
  async ensureModel(id,quality='garage'){
    const current=this.modelData.get(id);if(current&&current.group.userData.studioQuality===quality)return true;
    const key=`${id}:${quality}`;if(this.pendingModels.has(key))return this.pendingModels.get(key);
    const version=this.pageVersion,request=Symbol(id);this.modelRequests.set(id,request);
    const promise=(async()=>{
      const vehicle=VEHICLES.find(v=>v.id===id);if(!vehicle)return false;
      await preloadVehicles(vehicle,quality);
      if(this.pageVersion!==version||this.modelRequests.get(id)!==request)return false;
      const data=buildVehicle(vehicle,{quality,environment:this.scene.environment});
      const old=this.modelData.get(id);if(old)disposeVehicle(old);
      const group=data.group;group.userData.studioQuality=quality;group.userData.vehicleId=id;group.rotation.y=-.22;
      group.updateWorldMatrix(true,true);
      const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
      // Asset pipelines use different units. Normalize for a coherent toy shelf.
      const scale=3.25/Math.max(size.x,size.z);group.scale.multiplyScalar(scale);group.updateWorldMatrix(true,true);
      const fitted=new THREE.Box3().setFromObject(group),center=fitted.getCenter(new THREE.Vector3());
      group.position.set(-center.x,-fitted.min.y,-center.z);
      group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
      this.displays.get(id).add(group);this.models.set(id,group);this.modelData.set(id,data);return true;
    })();
    this.pendingModels.set(key,promise);
    try{return await promise;}finally{if(this.pageVersion===version)this.pendingModels.delete(key);}
  }
  neighbor(direction){
    const index=this.pageVehicles.findIndex(v=>v.id===this.selectedId);
    return this.pageVehicles[THREE.MathUtils.clamp(index+direction,0,this.pageVehicles.length-1)].id;
  }
  async loadNeighbors(){
    if(this.presentation!=='garage')return;
    const version=this.pageVersion,index=this.pageVehicles.findIndex(v=>v.id===this.selectedId);
    const nearby=this.pageVehicles.filter((_,i)=>Math.abs(i-index)<=2);
    await Promise.allSettled(nearby.map(v=>this.ensureModel(v.id,v.id===this.selectedId?'garage':'race')));
    if(version!==this.pageVersion)return;
    // Keep only a small working set in GPU memory, even for larger categories.
    for(const [id,data]of this.modelData)if(!nearby.some(v=>v.id===id)){disposeVehicle(data);this.modelData.delete(id);this.models.delete(id);}
  }
  positionLineup(immediate=false){
    const index=this.pageVehicles.findIndex(v=>v.id===this.selectedId);
    this.slideTarget.copy(this.rowDirection).multiplyScalar(-Math.max(0,index)*this.spacing);
    if(immediate||this.reducedMotion)this.lineup.position.copy(this.slideTarget);
    this.host?.setAttribute('aria-busy',String(this.lineup.position.distanceTo(this.slideTarget)>.005));
    for(const [id,display]of this.displays)display.visible=this.presentation==='garage'||id===this.selectedId;
  }
  async showPage(page){this.loadPage(page);this.mode='detail';await this.ensureModel(this.selectedId);this.resize();this.loadNeighbors();}
  async select(id){
    if(!VEHICLES.some(v=>v.id===id))return;
    if(this.allowedIds&&!this.allowedIds.includes(id))return;
    const page=this.allowedIds?'owned':collectionPage(id),changed=this.page!==page;this.loadPage(page);this.selectedId=id;
    await this.ensureModel(id);if(this.selectedId!==id)return;
    this.mode='detail';this.controls.enabled=false;this.positionLineup(changed);this.loadNeighbors();
  }
  customize(patch){
    const model=this.modelData.get(this.selectedId);if(!model?.materials&&!model?.setCustomization)return false;
    this.thumbnails.delete(this.selectedId);return updateCustomization(model,patch);
  }
  async uploadWrap(file){
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Usa una imagen PNG, JPG o WEBP de hasta 8 MB.');
    const model=this.modelData.get(this.selectedId),url=URL.createObjectURL(file);
    if(!model){URL.revokeObjectURL(url);return;}
    try{const texture=await new THREE.TextureLoader().loadAsync(url);if(this.modelData.get(this.selectedId)!==model){texture.dispose();return;}setCustomWrapping(model,texture);this.thumbnails.delete(this.selectedId);}finally{URL.revokeObjectURL(url);}
  }
  async mount(host,selectedId,{presentation='garage',allowedIds=null}={}){
    if(JSON.stringify(this.allowedIds)!==JSON.stringify(allowedIds))this.page=null;this.allowedIds=allowedIds;
    this.presentation=presentation;this.host=host;host.appendChild(this.renderer.domElement);
    this.resizeObserver.disconnect();this.resizeObserver.observe(host);this.visible=true;
    this.loadPage(this.allowedIds?'owned':collectionPage(selectedId));this.selectedId=selectedId;this.mode='detail';
    await this.ensureModel(selectedId);if(this.host!==host||this.selectedId!==selectedId)return;
    this.positionLineup(true);this.resize();this.loadNeighbors();
  }
  hide(){this.visible=false;this.controls.enabled=false;this.resizeObserver.disconnect();}
  setGraphics(policy){this.renderer.shadowMap.enabled=policy.shadowSize>0;}
  resize(){
    if(!this.host||!this.visible)return;
    const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;
    this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.setView(this.mode,true);
  }
  setView(mode){
    this.mode=mode;this.positionLineup(mode==='customize');
    const bounds=new THREE.Box3(new THREE.Vector3(-1.4,0,-1.65),new THREE.Vector3(1.4,1.65,1.65));
    const frame=this.presentation==='garage'&&mode!=='customize'?studioCameraFrame(this.camera.aspect,this.camera.fov):garageCameraFrame(bounds,this.camera.aspect,this.camera.fov);
    this.camera.position.copy(frame.position);this.controls.target.copy(frame.target);this.camera.lookAt(frame.target);
    this.controls.minDistance=frame.distance*.65;this.controls.maxDistance=frame.distance*2;
    this.controls.enabled=mode==='customize';this.controls.update();
    this.renderer.domElement.style.touchAction=mode==='customize'?'none':'pan-y';
    for(const [id,display]of this.displays)display.visible=mode==='customize'?id===this.selectedId:this.presentation==='garage'||id===this.selectedId;
  }
  async showView(mode){this.setView(mode);}
  orbit(x,y,dt){
    if(!this.visible||this.mode!=='customize'||Math.abs(x)+Math.abs(y)<.01)return;
    const offset=this.camera.position.clone().sub(this.controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    spherical.theta-=x*dt*1.8;spherical.phi=THREE.MathUtils.clamp(spherical.phi+y*dt*1.3,this.controls.minPolarAngle,this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(offset.setFromSpherical(spherical));this.controls.update();
  }
  /** Card images use real customized models and the same renderer, without changing the studio. */
  async thumbnail(id){
    if(this.thumbnails.has(id))return this.thumbnails.get(id);
    if(this.thumbnailPending.has(id))return this.thumbnailPending.get(id);
    const promise=(async()=>{
      const vehicle=VEHICLES.find(v=>v.id===id);await preloadVehicles(vehicle,'race');
      const model=buildVehicle(vehicle,{quality:'race',environment:this.scene.environment}),scene=new THREE.Scene();scene.environment=this.scene.environment;scene.environmentIntensity=.5;
      for(const light of this.lights)scene.add(light.clone());
      scene.add(model.group);model.group.rotation.y=-.22;model.group.updateWorldMatrix(true,true);
      const width=384,height=220,camera=new THREE.PerspectiveCamera(36,width/height,.05,180);
      const frame=garageCameraFrame(new THREE.Box3().setFromObject(model.group),width/height,36);
      camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
      // Fit the visible silhouette, rather than empty corners of a world AABB.
      let extent=0;const projected=new THREE.Vector3();
      model.group.traverseVisible(node=>{
        const positions=node.geometry?.attributes.position;if(!positions)return;
        for(let i=0;i<positions.count;i++){
          projected.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).project(camera);
          extent=Math.max(extent,Math.abs(projected.x),Math.abs(projected.y));
        }
      });
      if(extent>0){camera.zoom=.92/extent;camera.updateProjectionMatrix();}
      const target=new THREE.WebGLRenderTarget(width,height),pixels=new Uint8Array(width*height*4),previous=this.renderer.getRenderTarget();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      try{
        this.renderer.setRenderTarget(target);this.renderer.clear();this.renderer.render(scene,camera);this.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
        const context=canvas.getContext('2d'),image=context.createImageData(width,height);
        for(let row=0;row<height;row++)image.data.set(pixels.subarray((height-row-1)*width*4,(height-row)*width*4),row*width*4);
        context.putImageData(image,0,0);const url=canvas.toDataURL('image/webp',.9);this.thumbnails.set(id,url);return url;
      }finally{this.renderer.setRenderTarget(previous);target.dispose();disposeVehicle(model);}
    })();
    this.thumbnailPending.set(id,promise);try{return await promise;}finally{this.thumbnailPending.delete(id);}
  }
  update(dt){
    if(!this.visible)return;
    this.lineup.position.lerp(this.slideTarget,this.reducedMotion?1:1-Math.exp(-9*dt));
    this.host?.setAttribute('aria-busy',String(this.lineup.position.distanceTo(this.slideTarget)>.005));
    if(this.controls.enabled)this.controls.update();this.renderer.render(this.scene,this.camera);
  }
}
