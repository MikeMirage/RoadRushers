import fs from 'node:fs/promises';
import {readGLB,measureGLB,measureGLBTransforms,textureMipBytes} from './vehicle-production-audit.mjs';
const directory=new URL('../public/models/corvette-study/',import.meta.url),draft=process.argv.includes('--draft');
const bytes=await fs.readFile(new URL('model.glb',directory)),gltf=readGLB(bytes),stats=measureGLB(bytes),transforms=measureGLBTransforms(bytes);
const errors=[],warnings=[],check=(condition,message)=>{if(!condition)errors.push(message);};
const nodes=new Map(gltf.nodes.map(n=>[n.name,n]));
for(const name of ['BodySuspension',...['FL','FR','RL','RR'].flatMap(s=>[`Suspension_${s}`,`Steering_${s}`,`Wheel_${s}`])])check(nodes.has(name),`Missing rig node ${name}`);
check(stats.triangles<=40000,`Study exceeds 40,000-triangle ceiling: ${stats.triangles}`);
check(stats.nonIndexedPrimitives===0,'Unindexed geometry');
check(Math.abs(transforms.minimumXYZ[1])<.025,'Wheel contact plane is not at ground zero');
const wheels=Object.fromEntries(transforms.wheels.map(w=>[w.name,w.center]));
if(Object.keys(wheels).length===4){check(wheels.Wheel_FL[0]<0&&wheels.Wheel_RL[0]<0&&wheels.Wheel_FR[0]>0&&wheels.Wheel_RR[0]>0,'Wheel sides do not follow X convention');check(wheels.Wheel_FL[2]>wheels.Wheel_RL[2]&&wheels.Wheel_FR[2]>wheels.Wheel_RR[2],'Wheel axles do not follow +Z front');}
const roles=new Set(),normalImages=new Set();
for(const m of gltf.materials||[]){const role=m.extras?.vehicleRole;roles.add(role);check(Boolean(role),`Material ${m.name} lacks vehicleRole`);check(!m.pbrMetallicRoughness?.baseColorTexture,'Generated color texture remains');check(!m.pbrMetallicRoughness?.metallicRoughnessTexture&&!m.occlusionTexture&&!m.emissiveTexture,'Additional packed/surface map remains');if(m.normalTexture){const t=gltf.textures[m.normalTexture.index];normalImages.add(t.source);}}
for(const role of ['paint','rim','rubber'])check(roles.has(role),`Missing customization role ${role}`);
check(draft||normalImages.size>0,'No normal map in final study');
for(const mesh of gltf.meshes||[])for(const p of mesh.primitives){check(p.attributes.NORMAL!==undefined,`${mesh.name} has no normals`);if(gltf.materials[p.material]?.normalTexture)for(const key of ['TEXCOORD_0','TANGENT'])check(p.attributes[key]!==undefined,`${mesh.name} lacks ${key}`);}
const maps=[];
for(const index of normalImages){const image=gltf.images[index];let buffer;if(image.uri)buffer=await fs.readFile(new URL(image.uri,directory));else{const view=gltf.bufferViews[image.bufferView],offset=28+bytes.readUInt32LE(12)+(view.byteOffset||0);buffer=bytes.subarray(offset,offset+view.byteLength);}check(buffer.subarray(1,4).toString()==='PNG','Normal image must be lossless PNG');const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);maps.push({image:index,width,height,fileBytes:buffer.length,rgba8MipBytes:textureMipBytes(width,height)});}
if(stats.triangles>10000)warnings.push('Studio representation, above the separate 8–10k race budget; not registered as a race asset.');
if(draft)warnings.push('Draft geometry/material review only; normal bake and final asset QA pending.');
const report={pass:errors.length===0,draft,stats,transforms,roles:[...roles],maps,errors,warnings,textureMemoryBasis:'RGBA8 complete mip chain, excluding driver overhead',remainingGate:'Multi-angle appearance and actual WebGL rig/material interaction review'};
await fs.mkdir(new URL('../art/corvette-study/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../art/corvette-study/package-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
