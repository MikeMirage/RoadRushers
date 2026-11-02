import * as THREE from 'three';
import { defaultCustomization, customizeVehicle, applyWrapTexture, WRAP_STYLES, RIM_STYLES, TIRE_STYLES } from './vehicle-modeler.js';
import { PRODUCTION_VEHICLES } from './vehicle-assets.js';

export const CUSTOMIZATION_KEY='roadrushers.customization.v1';
const sessionTextures=new Map();
const sessionConfigurations=new Map();
const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);

export function loadCustomization(vehicle,storage){
  const production=Boolean(PRODUCTION_VEHICLES[vehicle.id]);
  const cfg=production?{color:vehicle.color,finish:'gloss',wrap:'none',rimColor:'#252b31',tire:'street',rideHeight:0,trail:'none'}:vehicle.design?defaultCustomization(vehicle):{color:vehicle.color,glass:'#567681',glassOpacity:.85,wrap:'none',trail:'none'};
  try{
    let saved=sessionConfigurations.get(vehicle.id);
    if(!saved){storage??=globalThis.localStorage;saved=JSON.parse(storage?.getItem(CUSTOMIZATION_KEY)||'{}')[vehicle.id];}
    if(!saved)return cfg;
    for(const key of ['color','secondary','rimColor','glass'])if(color(saved[key]))cfg[key]=saved[key];
    for(const [key,choices]of [['wrap',production?['none','stripes','race']:WRAP_STYLES],['rim',RIM_STYLES],['tire',production?['street','sport','slick']:TIRE_STYLES],['trail',['none','amber','cyan','violet']]])if(choices.includes(saved[key]))cfg[key]=saved[key];
    if(production){
      if(['gloss','satin','matte'].includes(saved.finish))cfg.finish=saved.finish;
      if(Number.isFinite(saved.rideHeight))cfg.rideHeight=THREE.MathUtils.clamp(saved.rideHeight,-.045,.07);
    }
    if(Number.isFinite(saved.glassOpacity))cfg.glassOpacity=THREE.MathUtils.clamp(saved.glassOpacity,.2,1);
  }catch{/* Storage is optional; each model still works in memory. */}
  return cfg;
}

export function saveCustomization(id,cfg,storage){
  sessionConfigurations.set(id,{...cfg});
  try{
    storage??=globalThis.localStorage;
    const all=JSON.parse(storage?.getItem(CUSTOMIZATION_KEY)||'{}');all[id]={...cfg};
    storage?.setItem(CUSTOMIZATION_KEY,JSON.stringify(all));return Boolean(storage);
  }catch{return false;}
}

export function wrapTexture(style){
  if(!WRAP_STYLES.includes(style)||style==='none')return null;
  const size=192,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x/size*3)%1,v=(y/size*2)%1;
    const light=style==='stripes'?(u>.36&&u<.44||u>.56&&u<.64):style==='checkers'?(Math.floor(u*10)+Math.floor(v*16))%2===0:((u*2+v*3)%1)<.27;
    const i=(y*size+x)*4,c=light?245:style==='checkers'?70:175;data[i]=c;data[i+1]=c;data[i+2]=c;data[i+3]=255;
  }
  const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.name=`wrap-${style}`;t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}

export function prepareVehicleWrap(model){
  const custom=sessionTextures.get(model.vehicle.id);
  if(model.setCustomization){model.setCustomization({texture:custom||null});return;}
  applyWrapTexture(model,custom?.clone()??wrapTexture(model.customization.wrap));
}

export function updateCustomization(model,patch){
  if(model.setCustomization){
    if(patch.wrap!==undefined){sessionTextures.get(model.vehicle.id)?.dispose();sessionTextures.delete(model.vehicle.id);patch={...patch,texture:null};}
    model.setCustomization(patch);return saveCustomization(model.vehicle.id,model.customization);
  }
  customizeVehicle(model,patch);
  if(patch.wrap!==undefined){sessionTextures.get(model.vehicle.id)?.dispose();sessionTextures.delete(model.vehicle.id);const old=model.materials.paint.map;applyWrapTexture(model,wrapTexture(patch.wrap));old?.dispose();}
  return saveCustomization(model.vehicle.id,model.customization);
}

export function setCustomWrapping(model,texture){
  sessionTextures.get(model.vehicle.id)?.dispose();sessionTextures.set(model.vehicle.id,texture.clone());
  if(model.setCustomization){model.setCustomization({texture});texture.dispose();return;}
  const old=model.materials.paint.map;applyWrapTexture(model,texture);old?.dispose();
}
