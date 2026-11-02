import { buildHeroVehicle,HERO_DESIGNS } from './hero-vehicle-models.js';
import { STARTER_DESIGNS } from './starter-vehicle-models.js';
import { buildCollectionVehicle } from './vehicle-modeler.js';
import { loadCustomization, prepareVehicleWrap } from './vehicle-customization.js';
import { PRODUCTION_VEHICLES, preloadVehicleAsset, createVehicleAsset, createVehicleAssetWithLOD } from './vehicle-assets.js';
import { setVehicleMaterialBrake } from './vehicle-material.js';

export const vehicleAvailable=vehicle=>Boolean(vehicle.design||PRODUCTION_VEHICLES[vehicle.id]||HERO_DESIGNS[vehicle.id]||STARTER_DESIGNS[vehicle.id]);

// The three base cars are now native editable coachwork. Keep this asynchronous
// hook for callers; they no longer depend on the old toy truck GLB or textures.
export async function preloadVehicles(vehicle,quality='race'){
  const id=PRODUCTION_VEHICLES[vehicle?.id];
  if(id)await preloadVehicleAsset(id,quality==='garage'?['garage']:['race','far']);
}

export function setBrakeLights(materials, amount) {
  const intensity=Math.max(0,Math.min(1,amount))*2.6;
  for(const lens of materials||[]){
    if(lens.userData.vehicleAtlas)setVehicleMaterialBrake(lens,amount);
    else lens.emissiveIntensity=intensity;
  }
}

export function buildVehicle(vehicle,{quality='race',scale=null,environment=null}={}) {
  const asset=PRODUCTION_VEHICLES[vehicle.id];
  if(asset){
    const options={vehicle,customization:loadCustomization(vehicle),scale,environment};
    const model=quality==='race'?createVehicleAssetWithLOD(asset,options):createVehicleAsset(asset,quality,options);
    prepareVehicleWrap(model);return model;
  }
  if (vehicle.design) {
    const model=buildCollectionVehicle(vehicle,loadCustomization(vehicle));
    prepareVehicleWrap(model);
    return model;
  }
  const model=buildHeroVehicle(vehicle);
  model.customization=loadCustomization(vehicle);
  // Native coachwork has merged wheel hardware; offer its supported finishes
  // without pretending it can use the collection's replaceable wheel meshes.
  model.setCustomization=patch=>{
    Object.assign(model.customization,patch);
    const cfg=model.customization,m=model.materials;
    m.paint?.color.set(cfg.color);m.glass?.color.set(cfg.glass);
    if(m.glass)m.glass.opacity=cfg.glassOpacity;
  };
  model.setCustomization({});return model;
}

// Small navigational badges; the selectable garage itself always uses real 3D models.
export function carIllustration(vehicle) {
  const truck=vehicle.id==='coda'||vehicle.design?.features.includes('pickup'),cobra=vehicle.id==='velo'||vehicle.design?.features.includes('open');
  const silhouette=truck?'M8 22H39V11H65L77 23H99V33H8Z':cobra?'M8 27Q10 18 29 21L43 23L50 16H54L57 22Q84 13 100 26V33H8Z':'M8 24L25 21L36 10H67L80 21L100 24V33H8Z';
  return `<svg class="car-illustration" viewBox="0 0 108 44" fill="none" aria-hidden="true"><ellipse cx="54" cy="37" rx="47" ry="4" fill="#102321" opacity=".3"/><path d="${silhouette}" fill="${vehicle.color}"/>${truck?'<path d="M45 14H63L70 23H45Z" fill="#42616a"/>':cobra?'<path d="M32 21H49V26H32Z" fill="#273b40"/>':'<path d="M39 13H51V20H31L39 13ZM55 13H66L74 20H55Z" fill="#42616a"/>'}<circle cx="27" cy="32" r="9" fill="#263237"/><circle cx="81" cy="32" r="9" fill="#263237"/><circle cx="27" cy="32" r="4" fill="#d5dadd"/><circle cx="81" cy="32" r="4" fill="#d5dadd"/></svg>`;
}
