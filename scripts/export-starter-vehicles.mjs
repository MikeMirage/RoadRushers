import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3,Vector3 } from 'three';
import { ORIGINAL_VEHICLES } from '../src/config.js';
import { buildVehicle } from '../src/vehicles.js';
import { disposeVehicle } from '../src/vehicle-modeler.js';
import { inspectVehicle } from './vehicle-qa.mjs';

globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result=`data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;this.onloadend?.();});}
};
const output='public/models/starters';await mkdir(output,{recursive:true});
const manifest={version:2,axes:'+Y up, +Z forward',source:'src/starter-vehicle-models.js',license:'Original procedural geometry, MIT; no third-party meshes or manufacturer insignia',vehicles:[]};
for(const vehicle of ORIGINAL_VEHICLES){
  const model=buildVehicle(vehicle),qa=inspectVehicle(model);if(!qa.pass)throw new Error(`${vehicle.id}: ${qa.errors.join('; ')}`);
  const bytes=await new GLTFExporter().parseAsync(model.group,{binary:true,onlyVisible:true});
  const path=`${output}/${vehicle.id}.glb`;await writeFile(path,Buffer.from(bytes));
  // Reimport the file actually written, checking the live runtime contract.
  const written=await readFile(path),gltf=await new GLTFLoader().parseAsync(written.buffer.slice(written.byteOffset,written.byteOffset+written.byteLength),'');
  for(const name of ['sprung-body','steer-front-left','steer-front-right','wheel-rear-left','wheel-rear-right','trail-rear-left','trail-rear-right'])if(!gltf.scene.getObjectByName(name))throw new Error(`${vehicle.id}: exported ${name} missing`);
  const bounds=new Box3().setFromObject(gltf.scene).getSize(new Vector3());
  if(bounds.toArray().some((n,i)=>Math.abs(n-qa.dimensions[i])>.001))throw new Error(`${vehicle.id}: exported scale mismatch`);
  manifest.vehicles.push({id:vehicle.id,name:vehicle.name,file:`${vehicle.id}.glb`,bytes:written.byteLength,triangles:qa.triangles,primitives:qa.primitives,materials:qa.materials,dimensions:qa.dimensions,inspiration:model.group.userData.inspiration,qa:'PASS; native geometry and reimported GLB'});
  console.log(`${vehicle.name}: ${qa.triangles} triangles, ${qa.primitives} primitives, ${(written.byteLength/1024).toFixed(0)} KiB · reimport PASS`);
  disposeVehicle(model);gltf.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
}
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
