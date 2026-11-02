import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createVehicleMaterial, customizeVehicleMaterial, createVehicleDepthMaterial } from './vehicle-material.js';
import { selectVehicleLOD, vehicleProjectedDiameter } from './vehicle-lod.js';

// Deliberately empty until each exported vehicle passes its production gates.
// Publishing an entry changes both game and garage routing; a high source alone
// must never accidentally become a race model.
export const PRODUCTION_VEHICLES = Object.freeze({});
const manifests=new Map(),levels=new Map(),textures=new Map();
const base=import.meta.env?.BASE_URL||'/';
const labels=['FL','FR','RL','RR'];
const pending=(cache,key,make)=>{
  if(!cache.has(key))cache.set(key,make().catch(error=>{cache.delete(key);throw error;}));
  return cache.get(key);
};
const assetURL=(id,path)=>`${base}models/optimized/${id}/${path}`;

async function manifest(id){
  return pending(manifests,id,async()=>{
    const response=await fetch(assetURL(id,'manifest.json'));
    if(!response.ok)throw new Error(`Vehicle manifest ${id}: HTTP ${response.status}`);
    const data=await response.json();
    if(data.status!=='validated')throw new Error(`Vehicle ${id} has not passed production validation`);
    return data;
  });
}
async function texture(url,color=false){
  return pending(textures,`${url}:${color}`,async()=>{
    const map=await new THREE.TextureLoader().loadAsync(url);
    map.flipY=false;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=4;return map;
  });
}

function sharedTextureLoader(){
  return new GLTFLoader().register(parser=>({
    name:'RoadRushersSharedVehicleTextures',
    loadTexture(index){
      const definition=parser.json.textures[index];
      const image=parser.json.images[definition.source];
      if(!image?.uri||image.uri.startsWith('data:'))return null;
      const isColor=(parser.json.materials||[]).some(m=>m.pbrMetallicRoughness?.baseColorTexture?.index===index||m.emissiveTexture?.index===index);
      return texture(THREE.LoaderUtils.resolveURL(image.uri,parser.options.path),isColor).then(map=>{
        parser.associations.set(map,{textures:index});return map;
      });
    },
  }));
}

/** Fetch only requested qualities. Shared cached assets are never disposed by
 * individual cars, ghosts, or rival instances. Rejected requests can retry. */
export async function preloadVehicleAsset(id,qualities=['race','far']) {
  const data=await manifest(id);
  return Promise.all(qualities.map(quality=>pending(levels,`${id}:${quality}`,async()=>{
    const spec=data.levels[quality];if(!spec)throw new Error(`Missing ${id}/${quality} LOD`);
    const gltf=await sharedTextureLoader().loadAsync(assetURL(id,spec.url));
    const maps={};
    await Promise.all(['body','wheel'].map(async role=>{
      const slots=data.textures[spec.textureQuality||quality][role];maps[role]={};
      await Promise.all(Object.entries(slots).map(async([slot,url])=>{
        maps[role][slot]=await texture(assetURL(id,url),slot==='baseColor'||slot==='emission');
      }));
    }));
    for(const name of ['BodySuspension',...labels.flatMap(s=>[`Suspension_${s}`,`Steering_${s}`,`Wheel_${s}`])]){
      if(!gltf.scene.getObjectByName(name))throw new Error(`Invalid vehicle rig: ${id}/${quality}/${name}`);
    }
    const entry={gltf,maps,spec,data,quality};ready.set(`${id}:${quality}`,entry);return entry;
  })));
}
const ready=new Map();
export const vehicleAssetReady=(id,quality)=>ready.has(`${id}:${quality}`);

/** Construct one quality from preloaded resources. Rivals request one source
 * per LOD, then instance its shared geometry. No per-car network requests. */
export function createVehicleAsset(id,quality,{vehicle,customization={},scale=null,environment=null}={}) {
  const entry=ready.get(`${id}:${quality}`);
  if(!entry)throw new Error(`Preload ${id}/${quality} before building it`);
  const d=entry.data.dimensions;
  scale??=quality==='garage'?1:(vehicle?.handling?.wheelbase||d.wheelbase)/d.wheelbase;
  const group=entry.gltf.scene.clone(true);group.name=`${id}-${quality}`;
  group.scale.setScalar(scale);
  const materials={};
  for(const role of ['body','wheel'])materials[role]=createVehicleMaterial({role,...entry.maps[role],environment});
  const wheelDepth=createVehicleDepthMaterial(materials.wheel);
  group.traverse(o=>{
    if(!o.isMesh)return;
    const name=o.material?.name;
    const role=o.userData.vehicleRole||(name==='VehicleWheel'?'wheel':name==='VehicleBody'?'body':null);
    if(!role)throw new Error(`Unclassified vehicle primitive ${id}/${o.name}/${name}`);
    o.material=materials[role];o.castShadow=o.receiveShadow=true;
    if(role==='wheel')o.customDepthMaterial=wheelDepth;
  });
  const node=name=>group.getObjectByName(name);
  const bodyRig=node('BodySuspension'),wheels=labels.map(s=>node(`Wheel_${s}`));
  const frontWheels=['FL','FR'].map(s=>node(`Steering_${s}`));
  frontWheels.forEach((p,i)=>p.userData.side=i===0?-1:1);
  Object.assign(group.userData,{wheelRadius:d.wheelRadius*scale,wheelbase:d.wheelbase*scale,track:d.track*scale});
  const cfg={color:vehicle?.color||'#045d91',finish:'gloss',wrap:'none',rimColor:'#252b31',tire:'street',rideHeight:0,...customization};
  let skinSource=null,ownedSkin=null;
  const model={group,bodyRig,wheels,frontWheels,vehicle:vehicle||{id},quality,visualScale:scale,restBodyY:bodyRig.position.y,
    wheelRadius:d.wheelRadius*scale,materials:{paint:materials.body,rims:materials.wheel,rubber:materials.wheel,...materials},
    brakeMaterials:[materials.body],brakeRearZ:-d.length*scale*.49,sockets:{},customization:cfg,
    stats:{...entry.spec,dimensions:d},assetOwnership:'shared-cache'};
  // Effects consume root-local coordinates, not a source node below a scaled parent.
  group.updateMatrixWorld(true);
  for(const [key,index] of [['trail-rear-left',2],['trail-rear-right',3]]){
    const socket=new THREE.Object3D();socket.position.copy(wheels[index].getWorldPosition(new THREE.Vector3()));
    socket.position.y=0;model.sockets[key]=socket;
  }
  model.setCustomization=patch=>{
    Object.assign(cfg,patch);if(patch.paint)cfg.color=patch.paint;
    if(patch.color)cfg.paint=patch.color;
    if(Object.hasOwn(patch,'texture')&&patch.texture!==skinSource){
      ownedSkin?.dispose();skinSource=patch.texture;ownedSkin=skinSource?.clone()||null;
    }
    delete cfg.texture;
    cfg.rideHeight=THREE.MathUtils.clamp(Number(cfg.rideHeight)||0,-.045,.07);
    for(const material of Object.values(materials))customizeVehicleMaterial(material,{...cfg,texture:ownedSkin});
    bodyRig.position.y=model.restBodyY+cfg.rideHeight;
    return model;
  };
  model.dispose=()=>{ownedSkin?.dispose();wheelDepth.dispose();Object.values(materials).forEach(m=>m.dispose());group.removeFromParent();};
  model.setCustomization(cfg);return model;
}

export function createVehicleAssetWithLOD(id,options={}){
  const representations={race:createVehicleAsset(id,'race',options),far:createVehicleAsset(id,'far',options)};
  let quality='race';const first=representations.race;
  const group=new THREE.Group();group.name=id;Object.assign(group.userData,first.group.userData);
  group.add(first.group,representations.far.group);representations.far.group.visible=false;
  const bounds=new THREE.Box3().setFromObject(first.group),sphere=bounds.getBoundingSphere(new THREE.Sphere());
  const center=new THREE.Vector3();
  const model={group,vehicle:first.vehicle,assetOwnership:'shared-cache',representations,
    brakeMaterials:Object.values(representations).flatMap(m=>m.brakeMaterials),brakeRearZ:first.brakeRearZ,sockets:first.sockets};
  for(const key of ['bodyRig','wheels','frontWheels','wheelRadius','visualScale','restBodyY','materials','stats','customization']){
    Object.defineProperty(model,key,{get:()=>representations[quality][key]});
  }
  Object.defineProperty(model,'quality',{get:()=>quality});
  model.setQuality=next=>{
    if(next===quality)return;
    const previous=representations[quality],current=representations[next];if(!current)return;
    for(const [oldNode,newNode] of [[previous.bodyRig,current.bodyRig],...previous.wheels.map((w,i)=>[w,current.wheels[i]]),...previous.frontWheels.map((w,i)=>[w,current.frontWheels[i]])]){
      newNode.rotation.copy(oldNode.rotation);
      // Wheel centres belong to each authored LOD; only sprung-body travel moves.
      if(oldNode===previous.bodyRig)newNode.position.y=oldNode.position.y;
    }
    previous.group.visible=false;current.group.visible=true;quality=next;
  };
  model.updateLOD=(camera,height)=>{
    group.updateWorldMatrix(true,false);center.copy(sphere.center).applyMatrix4(group.matrixWorld);
    model.setQuality(selectVehicleLOD(vehicleProjectedDiameter(camera,center,sphere.radius,height),quality));
  };
  model.setCustomization=patch=>{Object.values(representations).forEach(m=>m.setCustomization(patch));return model;};
  model.dispose=()=>{Object.values(representations).forEach(m=>m.dispose());group.removeFromParent();};
  return model;
}
