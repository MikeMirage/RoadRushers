import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { NEW_VEHICLES, VEHICLE_BATCHES } from '../src/vehicle-catalog.js';
import { buildCollectionVehicle, disposeVehicle } from '../src/vehicle-modeler.js';
import { inspectVehicle } from './vehicle-qa.mjs';

// GLTFExporter uses the browser FileReader interface even for geometry-only GLBs.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});}
};
const output='public/models/collection';await mkdir(output,{recursive:true});
const manifest={version:1,axes:'+Y up, +Z forward',scale:'RoadRushers miniature metres',uvLayout:'panel-atlas-3x2',batches:VEHICLE_BATCHES,vehicles:[]};
for(const batch of VEHICLE_BATCHES){
  for(const vehicle of NEW_VEHICLES.filter(v=>v.batch===batch.id)){
    const model=buildCollectionVehicle(vehicle),qa=inspectVehicle(model);
    if(!qa.pass)throw new Error(`${vehicle.id}: ${qa.errors.join('; ')}`);
    const bytes=await new GLTFExporter().parseAsync(model.group,{binary:true,onlyVisible:true});
    await writeFile(`${output}/${vehicle.id}.glb`,Buffer.from(bytes));
    manifest.vehicles.push({id:vehicle.id,name:vehicle.name,batch:vehicle.batch,inspiration:vehicle.inspiration,file:`${vehicle.id}.glb`,bytes:bytes.byteLength,triangles:qa.triangles,primitives:qa.primitives,dimensions:qa.dimensions,customization:model.group.userData.customization,sockets:qa.sockets});
    disposeVehicle(model);
  }
  console.log(`Exportada tanda ${String(VEHICLE_BATCHES.indexOf(batch)+1).padStart(2,'0')}: ${batch.name} (10 GLB)`);
}
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`${manifest.vehicles.length} GLB · ${(manifest.vehicles.reduce((n,v)=>n+v.bytes,0)/1024/1024).toFixed(2)} MiB`);
