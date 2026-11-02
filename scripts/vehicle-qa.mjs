import { Box3, Vector3 } from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ORIGINAL_VEHICLES } from '../src/config.js';
import { buildVehicle } from '../src/vehicles.js';
import { NEW_VEHICLES, VEHICLE_BATCHES } from '../src/vehicle-catalog.js';
import { buildCollectionVehicle, disposeVehicle } from '../src/vehicle-modeler.js';

export function inspectVehicle(model){
  const errors=[],meshes=[],materials=new Set(),box=new Box3().setFromObject(model.group),size=box.getSize(new Vector3());
  let triangles=0,degenerate=0,collapsedPaintUVs=0;
  model.group.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,index=g.index;
    const count=index?.count??p.count;triangles+=count/3;materials.add(o.material.name);meshes.push({name:o.name,triangles:count/3});
    if(!n||!uv)errors.push(`${o.name}: missing normals/UV`);
    for(const attr of [p,n,uv].filter(Boolean))if(!attr.array.every(Number.isFinite))errors.push(`${o.name}: nonfinite attribute`);
    for(let i=0;i<count;i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      const a=new Vector3().fromBufferAttribute(p,ids[0]),b=new Vector3().fromBufferAttribute(p,ids[1]),c=new Vector3().fromBufferAttribute(p,ids[2]);
      if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-16)degenerate++;
      if(o.material===model.materials.paint){
        const [a,b,c]=ids.map(k=>[uv.getX(k),uv.getY(k)]);
        if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-12)collapsedPaintUVs++;
      }
    }
  });
  if(degenerate)errors.push(`${degenerate} degenerate triangles`);
  if(collapsedPaintUVs)errors.push(`${collapsedPaintUVs} collapsed wrapping UV triangles`);
  if(model.wheels.length!==4||model.frontWheels.length!==2)errors.push('invalid wheel pivots');
  for(const name of ['trail-rear-left','trail-rear-right','exhaust-left','exhaust-right'])if(!model.sockets[name])errors.push(`missing ${name}`);
  for(const slot of ['exterior-paint','secondary-paint','windows','rubber','rims','taillights'])if(!materials.has(slot)&&slot!=='secondary-paint')errors.push(`missing ${slot}`);
  if(Math.abs(box.min.y)>.002)errors.push(`ground contact ${box.min.y}`);
  const budget=model.vehicle.handling?45000:12000;
  if(triangles>budget)errors.push(`triangle budget ${triangles}/${budget}`);
  return {id:model.vehicle.id,name:model.vehicle.name,batch:model.vehicle.batch,axes:'+Y up, +Z forward',dimensions:size.toArray().map(n=>+n.toFixed(4)),triangles,primitives:meshes.length,materials:[...materials],wheelPivots:4,steeringPivots:2,sockets:Object.keys(model.sockets),uvLayout:model.vehicle.handling?'vehicle-space-planar':'panel-atlas-3x2',degenerateTriangles:degenerate,collapsedPaintUVs,errors,meshes,pass:!errors.length};
}

export async function runQA(){
  const vehicles=[];
  for(const batch of VEHICLE_BATCHES){
    for(const vehicle of NEW_VEHICLES.filter(v=>v.batch===batch.id)){
      const model=buildCollectionVehicle(vehicle);vehicles.push(inspectVehicle(model));disposeVehicle(model);
    }
    console.log(`Tanda ${batch.name}: ${vehicles.filter(v=>v.batch===batch.id&&v.pass).length}/10`);
  }
  const starters=ORIGINAL_VEHICLES.map(v=>{const model=buildVehicle(v),qa=inspectVehicle(model);disposeVehicle(model);return qa;});
  console.log(`Serie base: ${starters.filter(v=>v.pass).length}/3`);
  const report={starters,implementation:'Native Three.js procedural meshes, independently exported glTF 2.0',pass:[...vehicles,...starters].every(v=>v.pass),count:vehicles.length,vehicles};
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/collection-qa.json',JSON.stringify(report,null,2)+'\n');
  if(!report.pass){console.error([...vehicles,...starters].filter(v=>!v.pass).map(v=>({id:v.id,errors:v.errors})));process.exitCode=1;}
  return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runQA();
