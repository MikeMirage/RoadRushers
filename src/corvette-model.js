import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PRODUCTION_VEHICLES, preloadVehicleAsset, createVehicleAsset } from './vehicle-assets.js';

export const CORVETTE_PRODUCTION_ASSET=PRODUCTION_VEHICLES['c7-sport'];
const baseURL=import.meta.env?.BASE_URL||'/';
export const CORVETTE_MODEL_URL = CORVETTE_PRODUCTION_ASSET?`${baseURL}models/optimized/${CORVETTE_PRODUCTION_ASSET}/garage.glb`:`${baseURL}models/corvette-c7/corvette-c7.glb`;
export const CORVETTE_TEMPLATE_URL=CORVETTE_PRODUCTION_ASSET?`${baseURL}models/optimized/${CORVETTE_PRODUCTION_ASSET}/skin-template.png`:`${baseURL}models/corvette-c7/skin-template.png`;
export const CORVETTE_DOWNLOAD_URL=CORVETTE_PRODUCTION_ASSET?`${baseURL}models/optimized/${CORVETTE_PRODUCTION_ASSET}/garage-package.zip`:CORVETTE_MODEL_URL;
export const CORVETTE_DIMENSIONS = { length: 4.49, width: 1.877, height: 1.239, wheelbase: 2.71 };
export const CORVETTE_LIMITS = { steering: .45, rideHeight: [-.045,.07], suspension: [-.025,.025] };
let templatePromise;
export function preloadCorvette() {
  if(CORVETTE_PRODUCTION_ASSET)return preloadVehicleAsset(CORVETTE_PRODUCTION_ASSET,['garage']);
  return templatePromise ||= new GLTFLoader().loadAsync(CORVETTE_MODEL_URL).catch(error => { templatePromise = null; throw error; });
}

function makeWrap(kind) {
  if (typeof document === 'undefined' || kind === 'none') return null;
  const canvas = document.createElement('canvas'); canvas.width=1536;canvas.height=1024;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1536,1024);
  // UV0 is a 3×2 atlas: sides | top/underside | front/rear. 2.5% tile padding.
  // Blender exporter flips V: +Y top surfaces occupy canvas row 0 (flipY=false).
  ctx.fillStyle='#10151d';
  for(const [col,row] of [[1,0],[2,0],[2,1]]) {
    const center=col*512+256;
    ctx.fillRect(center-39,row*512,32,512);ctx.fillRect(center+7,row*512,32,512);
    if(kind==='race'){ctx.fillStyle='#ef492e';ctx.fillRect(center-3,row*512,6,512);ctx.fillStyle='#10151d';}
  }
  if(kind==='race')for(const row of [0,1]){
    const y=row*512+225;
    ctx.fillStyle='#10151d';ctx.fillRect(13,row*512+72,486,28);
    ctx.fillStyle='#ef492e';ctx.fillRect(13,row*512+63,486,7);
    ctx.fillStyle='#eff3f2';ctx.beginPath();ctx.arc(245,y,48,0,Math.PI*2);ctx.fill();
    ctx.font='bold 58px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#11141a';ctx.fillText('07',245,y+2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;
  texture.anisotropy=8;texture.name=`C7 ${kind} livery`;return texture;
}

/** Mechanical (rigid object) rig. Metres, +Y up, +Z front, wheel spin local X. */
export async function loadCorvette(options = {}) {
  if(CORVETTE_PRODUCTION_ASSET){
    await preloadCorvette();
    const model=createVehicleAsset(CORVETTE_PRODUCTION_ASSET,'garage',{...options,scale:1});
    const labels=['FL','FR','RL','RR'];
    model.suspensionPivots=labels.map(label=>model.group.getObjectByName(`Suspension_${label}`));
    const rest=model.suspensionPivots.map(p=>p.position.y),pose={steering:0,spin:0,suspension:0};
    model.setPose=patch=>{
      Object.assign(pose,patch);
      model.frontWheels.forEach(p=>p.rotation.y=THREE.MathUtils.clamp(Number(pose.steering)||0,-CORVETTE_LIMITS.steering,CORVETTE_LIMITS.steering));
      model.wheels.forEach(p=>p.rotation.x=Number(pose.spin)||0);
      model.bodyRig.position.y=model.restBodyY+model.customization.rideHeight+THREE.MathUtils.clamp(Number(pose.suspension)||0,...CORVETTE_LIMITS.suspension);
      if(patch.cornerSuspension)model.suspensionPivots.forEach((p,i)=>p.position.y=rest[i]+THREE.MathUtils.clamp(Number(patch.cornerSuspension[labels[i]])||0,...CORVETTE_LIMITS.suspension));
      model.group.updateMatrixWorld(true);
    };
    return model;
  }
  const gltf = await preloadCorvette();
  return createCorvetteModel(gltf.scene, options);
}

export function createCorvetteModel(source, options = {}) {
  const group = source.clone(true); group.name = 'Corvette_C7';
  const materialClones = new Map(); const geometryClones = new Map();
  group.traverse(object => {
    if (!object.isMesh) return;
    if(!geometryClones.has(object.geometry))geometryClones.set(object.geometry,object.geometry.clone());
    object.geometry=geometryClones.get(object.geometry);
    object.castShadow=true;object.receiveShadow=true;
    const cloneMaterial = original => {
      if (!materialClones.has(original)) {
        const m=original.clone();
        if(m.name==='M_Paint') { m.clearcoat=1;m.clearcoatRoughness=.12;m.envMapIntensity=1.15; }
        if(m.name==='M_Glass') { m.envMapIntensity=1.25; }
        materialClones.set(original,m);
      }
      return materialClones.get(original);
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  const allMaterials=[...materialClones.values()], byName=name=>allMaterials.find(m=>m.name===name);
  const materials = { paint:byName('M_Paint'),glass:byName('M_Glass'),rim:byName('M_Rim'),tire:byName('M_Rubber'),carbon:byName('M_Carbon'),brakes:byName('M_TailLight'),headlights:byName('M_HeadLight') };
  materials.rims=materials.rim;materials.rubber=materials.tire;
  const labels=['FL','FR','RL','RR'],node=name=>{const found=group.getObjectByName(name);if(!found)throw new Error(`Corvette rig node missing: ${name}`);return found;};
  const bodyRig=node('BodySuspension'), wheels=labels.map(s=>node(`Wheel_${s}`)),frontWheels=['FL','FR'].map(s=>node(`Steering_${s}`)),suspensionPivots=labels.map(s=>node(`Suspension_${s}`));
  const wheelSlots=wheels.map((roll,i)=>{
    let tire;roll.traverse(o=>{if(o.isMesh && o.material?.name==='M_Rubber')tire=o;});
    const treads=[];roll.traverse(o=>{if(o.userData.tireDetail)treads.push(o);});
    const sport=new THREE.Group();sport.name=`SportTread_${labels[i]}`;sport.visible=false;
    const radius=roll.userData.radius || (i<2?.337:.345),width=roll.userData.width || (i<2?.245:.285);
    const grooveMat=new THREE.MeshStandardMaterial({color:'#080a0c',roughness:.9});grooveMat.name=`SportGroove_${labels[i]}`;
    for(const x of [-width*.21,width*.21]){
      const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius-.002,.002,4,96),grooveMat);
      mesh.rotation.y=Math.PI/2;mesh.position.x=x;sport.add(mesh);
    }
    roll.add(sport);
    return {roll,tire,rim:null,side:i%2===0?-1:1,radius,width,treads,sport};
  });
  const initialBody=bodyRig.position.y,restSuspension=suspensionPivots.map(p=>p.position.y);
  const cfg={paint:'#167db1',finish:'gloss',wrap:'none',rimColor:'#252b31',tire:'street',rideHeight:0};
  const pose={steering:0,spin:0,suspension:0};let generatedTexture=null,externalTexture=null;
  let triangles=0,meshCount=0;
  group.traverse(o=>{if(o.isMesh&&!o.parent?.name.startsWith('SportTread_')){meshCount++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
  const model={group,bodyRig,wheels,frontWheels,suspensionPivots,wheelSlots,materials,customization:cfg,brakeMaterials:[materials.brakes],brakeRearZ:-2.29,vehicle:options.vehicle||{id:'corvette-c7'},sockets:{},stats:{triangles,meshes:meshCount,materials:allMaterials.length,optionalSportTriangles:6144,dimensions:{width:size.x,height:size.y,length:size.z},wheelbase:2.71,source:'Original mesh authored from supplied C7 reference; rigid hierarchy rig.'}};
  model.setPose = patch => {
    Object.assign(pose,patch);
    const steering=THREE.MathUtils.clamp(Number(pose.steering)||0,-CORVETTE_LIMITS.steering,CORVETTE_LIMITS.steering);
    frontWheels.forEach(p=>{p.rotation.y=steering;});
    if(Number.isFinite(pose.spin))wheels.forEach(p=>{p.rotation.x=pose.spin;});
    const travel=THREE.MathUtils.clamp(Number(pose.suspension)||0,...CORVETTE_LIMITS.suspension);
    bodyRig.position.y=initialBody+cfg.rideHeight+travel;
    if(patch.cornerSuspension) suspensionPivots.forEach((p,i)=>{p.position.y=restSuspension[i]+THREE.MathUtils.clamp(Number(patch.cornerSuspension[labels[i]])||0,-.025,.025);});
    group.updateMatrixWorld(true);
  };
  model.setCustomization = patch => {
    if(patch.color&&!patch.paint)patch={...patch,paint:patch.color};
    Object.assign(cfg,patch);
    cfg.rideHeight=THREE.MathUtils.clamp(Number(cfg.rideHeight)||0,...CORVETTE_LIMITS.rideHeight);
    if(materials.paint){
      materials.paint.color.set(cfg.paint);
      const finish={gloss:[.24,1,.12],satin:[.43,.4,.30],matte:[.72,.08,.6]}[cfg.finish]||[.24,1,.12];
      [materials.paint.roughness,materials.paint.clearcoat,materials.paint.clearcoatRoughness]=finish;
      if(Object.hasOwn(patch,'texture')) externalTexture=patch.texture;
      if(Object.hasOwn(patch,'wrap')){generatedTexture?.dispose();generatedTexture=makeWrap(cfg.wrap);}
      if(externalTexture){externalTexture.colorSpace=THREE.SRGBColorSpace;externalTexture.flipY=false;externalTexture.needsUpdate=true;}
      materials.paint.map=externalTexture||generatedTexture;materials.paint.needsUpdate=true;
    }
    materials.rim?.color.set(cfg.rimColor);
    if(materials.tire)materials.tire.roughness=cfg.tire==='slick'?.88:cfg.tire==='sport'?.72:.8;
    for(const slot of wheelSlots){
      slot.treads.forEach(o=>o.visible=cfg.tire==='street');slot.sport.visible=cfg.tire==='sport';
      // Width differs; rolling radius stays unchanged to preserve road contact.
      if(slot.tire)slot.tire.scale.x=cfg.tire==='slick'?1.10:cfg.tire==='sport'?1.055:1;
    }
    group.userData.customization={...cfg,texture:undefined};model.setPose({});
    return model;
  };
  model.dispose = () => {
    generatedTexture?.dispose();const geometries=new Set(),mats=new Set();
    group.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
    geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());group.removeFromParent();
  };
  model.setCustomization(options.customization||{});
  return model;
}
