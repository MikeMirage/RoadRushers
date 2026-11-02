import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Box3, Vector3, Matrix4, Quaternion } from 'three';
import { PRODUCTION_VEHICLES } from '../src/vehicle-assets.js';
import { ORIGINAL_VEHICLES } from '../src/config.js';
import { buildVehicle } from '../src/vehicles.js';

export function measureModel(model) {
  const geometries=new Set(),materials=new Set();let triangles=0,primitives=0,drawVertices=0,nonIndexed=0;
  model.group.updateMatrixWorld(true);
  model.group.traverseVisible(node=>{
    if(!node.isMesh)return;
    const g=node.geometry;geometries.add(g);const mats=Array.isArray(node.material)?node.material:[node.material];mats.forEach(m=>materials.add(m));
    triangles+=(g.index?.count??g.attributes.position.count)/3;drawVertices+=g.attributes.position.count;
    primitives+=Array.isArray(node.material)?g.groups.length||mats.length:1;
    if(!g.index)nonIndexed++;
  });
  const buffers=new Set();let geometryBytes=0,uniqueVertices=0;
  for(const g of geometries){uniqueVertices+=g.attributes.position.count;for(const a of [...Object.values(g.attributes),g.index].filter(Boolean)){const array=a.isInterleavedBufferAttribute?a.data.array:a.array;if(!buffers.has(array)){buffers.add(array);geometryBytes+=array.byteLength;}}}
  const size=new Box3().setFromObject(model.group).getSize(new Vector3());
  const wheels=(model.wheels||[]).map(w=>({name:w.name,center:w.getWorldPosition(new Vector3()).toArray()}));
  return {triangles,drawVertices,uniqueVertices,primitives,materials:materials.size,uniqueGeometries:geometries.size,geometryBufferBytes:geometryBytes,nonIndexedMeshes:nonIndexed,dimensionsMeters:size.toArray(),wheels};
}

export function readGLB(bytes) {
  if(bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2)throw new Error('Expected glTF2 GLB');
  if(bytes.readUInt32LE(8)!==bytes.byteLength)throw new Error('Invalid GLB declared length');
  const length=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+length).toString());
}
export function measureGLB(bytes) {
  const gltf=readGLB(bytes),accessors=new Set(),usedMaterials=new Set(),views=new Set();let triangles=0,primitives=0,drawVertices=0,nonIndexed=0;
  // Count submitted instances in the active scene, not just mesh definitions:
  // four wheels can share one glTF mesh without becoming one rendered wheel.
  const renderedMeshes=[];
  const visit=(id,ancestors=new Set())=>{
    if(ancestors.has(id))throw new Error('Cyclic glTF node hierarchy');
    const node=gltf.nodes[id];if(!node)throw new Error(`Missing glTF node ${id}`);
    if(node.mesh!==undefined)renderedMeshes.push(node.mesh);
    for(const child of node.children||[])visit(child,new Set([...ancestors,id]));
  };
  for(const root of gltf.scenes?.[gltf.scene??0]?.nodes||[])visit(root);
  for(const id of renderedMeshes)for(const p of gltf.meshes[id].primitives){
    if((p.mode??4)!==4)throw new Error('Non-triangle primitive');primitives++;
    const position=gltf.accessors[p.attributes.POSITION];drawVertices+=position.count;
    triangles+=(p.indices===undefined?position.count:gltf.accessors[p.indices].count)/3;
    if(p.indices===undefined)nonIndexed++;
    if(p.material!==undefined)usedMaterials.add(p.material);
    for(const id of [...Object.values(p.attributes),p.indices].filter(x=>x!==undefined))accessors.add(id);
  }
  for(const id of accessors){const a=gltf.accessors[id];if(a.bufferView!==undefined)views.add(a.bufferView);}
  return {triangles,drawVertices,primitives,materials:usedMaterials.size,meshDefinitions:gltf.meshes?.length||0,renderedMeshInstances:renderedMeshes.length,geometryBufferBytes:[...views].reduce((n,i)=>n+gltf.bufferViews[i].byteLength,0),fileBytes:bytes.byteLength,nonIndexedPrimitives:nonIndexed,images:gltf.images?.length||0,extensions:gltf.extensionsUsed||[]};
}

export function textureMipBytes(width,height,bytesPerPixel=4){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw new Error('Invalid texture dimensions');
  let bytes=0;
  while(true){bytes+=width*height*bytesPerPixel;if(width===1&&height===1)return bytes;width=Math.max(1,Math.floor(width/2));height=Math.max(1,Math.floor(height/2));}
}

export function measureGLBTransforms(bytes){
  const gltf=readGLB(bytes),jsonLength=bytes.readUInt32LE(12),binaryOffset=28+jsonLength;
  if(bytes.readUInt32LE(24+jsonLength)!==0x004e4942)throw new Error('Expected binary GLB chunk');
  const bounds=new Box3(),point=new Vector3(),wheels=[];
  const walk=(id,parent)=>{
    const node=gltf.nodes[id];
    const local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3().fromArray(node.translation||[0,0,0]),new Quaternion().fromArray(node.rotation||[0,0,0,1]),new Vector3().fromArray(node.scale||[1,1,1]));
    const matrix=new Matrix4().multiplyMatrices(parent,local);
    if(/^Wheel_(FL|FR|RL|RR)$/.test(node.name||''))wheels.push({name:node.name,center:new Vector3().setFromMatrixPosition(matrix).toArray()});
    if(node.mesh!==undefined)for(const primitive of gltf.meshes[node.mesh].primitives){
      const accessor=gltf.accessors[primitive.attributes.POSITION],view=gltf.bufferViews[accessor.bufferView];
      if(accessor.componentType!==5126||accessor.sparse)throw new Error('Transform measurement requires plain float32 POSITION; compressed decoding not validated');
      const offset=binaryOffset+(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||12;
      for(let i=0;i<accessor.count;i++)bounds.expandByPoint(point.set(bytes.readFloatLE(offset+i*stride),bytes.readFloatLE(offset+i*stride+4),bytes.readFloatLE(offset+i*stride+8)).applyMatrix4(matrix));
    }
    for(const child of node.children||[])walk(child,matrix);
  };
  for(const root of gltf.scenes[gltf.scene??0].nodes||[])walk(root,new Matrix4());
  return {dimensionsXYZ:bounds.getSize(new Vector3()).toArray(),minimumXYZ:bounds.min.toArray(),maximumXYZ:bounds.max.toArray(),wheels};
}

async function audit(){
  const out=process.argv[2]||'artifacts/vehicle-pipeline/current-audit.json';
  const rows=[];
  for(const vehicle of ORIGINAL_VEHICLES){
    const asset=PRODUCTION_VEHICLES[vehicle.id];
    if(asset){
      const directory=new URL(`../public/models/optimized/${asset}/`,import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('manifest.json',directory),'utf8'));
      const levels={};for(const [quality,spec]of Object.entries(manifest.levels)){
        const bytes=await fs.readFile(new URL(spec.url,directory));levels[quality]={...measureGLB(bytes),...measureGLBTransforms(bytes)};
      }
      rows.push({id:vehicle.id,name:vehicle.name,route:`models/optimized/${asset}/manifest.json`,levels});continue;
    }
    try{const model=buildVehicle(vehicle);rows.push({id:vehicle.id,name:vehicle.name,route:'src/vehicles.js buildVehicle',...measureModel(model)});}
    catch(error){rows.push({id:vehicle.id,name:vehicle.name,route:'src/vehicles.js buildVehicle',error:error.message});}
  }
  const bytes=await fs.readFile(new URL('../public/models/corvette-c7/corvette-c7.glb',import.meta.url));
  const report={kind:'Measured loaded factory geometry and exported GLB buffers; no FPS inference',geometryMemory:'Typed-array byteLength / GLB buffer-view bytes; excludes driver overhead',vehicles:rows,independentCorvette:{route:'corvette-garage.html -> src/corvette-model.js -> models/corvette-c7/corvette-c7.glb',...measureGLB(bytes)}};
  await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await audit();
