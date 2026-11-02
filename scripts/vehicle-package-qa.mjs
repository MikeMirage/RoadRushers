import fs from 'node:fs/promises';
import path from 'node:path';
import { readGLB, measureGLB, measureGLBTransforms, textureMipBytes } from './vehicle-production-audit.mjs';

const id=process.argv[2];
if(!id||!/^[a-z0-9-]+$/.test(id))throw new Error('Usage: node scripts/vehicle-package-qa.mjs asset-id');
const directory=path.resolve('public/models/optimized',id);
const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
const errors=[],warnings=[],levels={};
const sourcePath=name=>{
  const absolute=path.resolve(directory,name);
  if(!absolute.startsWith(directory+path.sep))throw new Error('Package resource outside asset directory');
  return absolute;
};
const textureFiles=new Map();
for(const [quality,spec] of Object.entries(manifest.levels)){
  const bytes=await fs.readFile(sourcePath(spec.url)),gltf=readGLB(bytes),stats={...measureGLB(bytes),...measureGLBTransforms(bytes)};
  const budget=quality==='garage'?22000:quality==='far'?4000:(manifest.gameId==='apex'||id.includes('lancer'))?8000:10000;
  if(stats.triangles>budget)errors.push(`${quality}: ${stats.triangles} triangles exceed ${budget}; requires an evidenced exception`);
  if(quality==='race'&&stats.primitives>9)errors.push(`${quality}: ${stats.primitives} primitives exceed 9`);
  if(stats.nonIndexedPrimitives)errors.push(`${quality}: non-indexed geometry`);
  for(const name of ['BodySuspension',...['FL','FR','RL','RR'].flatMap(s=>[`Suspension_${s}`,`Steering_${s}`,`Wheel_${s}`])]){
    if(!gltf.nodes.some(node=>node.name===name))errors.push(`${quality}: missing rig node ${name}`);
  }
  for(const mesh of gltf.meshes||[])for(const primitive of mesh.primitives){
    for(const attribute of ['POSITION','NORMAL','TEXCOORD_0','TANGENT']){
      if(primitive.attributes[attribute]===undefined)errors.push(`${quality}/${mesh.name}: missing ${attribute}`);
    }
    const position=gltf.accessors[primitive.attributes.POSITION];
    if(!position.min||!position.max||![...position.min,...position.max].every(Number.isFinite))errors.push(`${quality}/${mesh.name}: invalid bounds`);
  }
  for(const extension of gltf.extensionsUsed||[])if(['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(extension))errors.push(`${quality}: ${extension} decoder not validated in this pipeline`);
  const packageTextures=manifest.textures[spec.textureQuality||quality];
  const used=new Set();
  for(const role of ['body','wheel']){
    for(const required of ['baseColor','normal','orm','mask'])if(!packageTextures?.[role]?.[required])errors.push(`${quality}/${role}: missing ${required} bake`);
    for(const name of Object.values(packageTextures?.[role]||{})){
      used.add(name);
      if(textureFiles.has(name))continue;
      const image=await fs.readFile(sourcePath(name));
      if(image.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error(`${name}: expected PNG bake; add a verified decoder before changing formats`);
      const width=image.readUInt32BE(16),height=image.readUInt32BE(20);
      textureFiles.set(name,{width,height,fileBytes:image.length,gpuRGBA8WithMipBytes:textureMipBytes(width,height)});
      if(quality==='race'&&Math.max(width,height)>1024)warnings.push(`${quality}: ${name} exceeds initial 1K texture target`);
    }
  }
  levels[quality]={...stats,textures:[...used],textureFileBytes:[...used].reduce((n,key)=>n+textureFiles.get(key).fileBytes,0),textureGPUBytesWithMips:[...used].reduce((n,key)=>n+textureFiles.get(key).gpuRGBA8WithMipBytes,0)};
}
for(const quality of ['garage','race','far'])if(!levels[quality])errors.push(`Missing ${quality} LOD`);
const runtimeTextures=new Set(['race','far'].flatMap(q=>levels[q]?.textures||[]));
const report={id,pass:errors.length===0,errors,warnings,levels,textures:Object.fromEntries(textureFiles),
  raceAndFarSharedTextureGPUBytes:[...runtimeTextures].reduce((n,key)=>n+textureFiles.get(key).gpuRGBA8WithMipBytes,0),
  measurementScope:'Exported active-scene geometry and PNG dimensions; GPU texture payload assumes uncompressed RGBA8 with full mip chain. Excludes driver overhead.',
  remainingGates:['Blender geometry/UV/bake QA','Reference silhouette and reflection review','Exported runtime rig and customization','Gameplay/rivals screenshots and LOD transitions']};
await fs.mkdir('artifacts/vehicle-pipeline',{recursive:true});
await fs.writeFile(`artifacts/vehicle-pipeline/${id}-package-qa.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.pass)process.exitCode=1;
