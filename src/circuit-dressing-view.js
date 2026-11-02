import {circuitGrassMaterial,buildCircuitGrass} from './circuit-grass.js';
import {buildCircuitMarkers} from './circuit-markers-view.js';
import {buildCircuitInfrastructure} from './circuit-infrastructure-view.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyEnvironmentPbr } from './environment-assets.js';
import { markPlayerOccluder } from './local-occlusion.js';

const material=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.92,...extra});
/** Shared 1K textures; the shader adds only low-frequency variation, no per-frame JS. */
export function circuitAsphaltMaterial(){
  const m=material('#444744',{side:THREE.DoubleSide});
  applyEnvironmentPbr(m,'asphalt_track',{repeat:[2,2],normalStrength:.38});
  m.metalness=0;m.metalnessMap=null;
  const previous=m.onBeforeCompile;
  m.onBeforeCompile=shader=>{
    previous.call(m,shader);
    shader.vertexShader='varying vec2 circuitUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncircuitUv=uv*8.0;');
    shader.fragmentShader='varying vec2 circuitUv;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float asphaltPatch=sin(circuitUv.y*.073+sin(circuitUv.x*.67))*sin(circuitUv.y*.139+circuitUv.x*.31);
      float wheel=exp(-pow((abs(circuitUv.x)-1.15)*1.7,2.0));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.055,.059,.06),.25);
      diffuseColor.rgb*=1.04+asphaltPatch*.065-wheel*.065;
    `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor-wheel*.045,.62,1.0);
    `);
  };
  m.customProgramCacheKey=()=> 'club-asphalt-v1';return m;
}
let advertMap;
function advertisingMaterial(){
  const m=material('#e6e2d6');
  if(typeof document==='undefined')return m;
  if(!advertMap){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#173539';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#e8e5d7';ctx.fillRect(0,232,1024,24);
    ctx.fillStyle='#d4e86a';ctx.fillRect(30,35,14,170);ctx.font='900 122px sans-serif';ctx.fillText('PRL',70,158);
    ctx.fillStyle='#f2efdf';ctx.font='bold 43px sans-serif';ctx.fillText('ROAD RUSHERS',350,108);ctx.font='26px sans-serif';ctx.fillText('CLUB CIRCUIT  /  MOTORSPORT',353,160);
    advertMap=new THREE.CanvasTexture(canvas);advertMap.colorSpace=THREE.SRGBColorSpace;advertMap.anisotropy=4;
  }
  m.map=advertMap;return m;
}
function ground(circuit,m){
  const box=new THREE.Box3().setFromPoints(circuit.samples),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(500,size.x+240),Math.max(500,size.z+240)),m);
  mesh.rotation.x=-Math.PI/2;mesh.position.set(center.x,-.09,center.z);mesh.receiveShadow=true;mesh.name='club-ground';return mesh;
}
/** Resolved strips + instanced props in spatial cells. No updates required during play. */
export function buildCircuitDressing(circuit,recipe){
  const root=new THREE.Group();root.name='club-circuit';
  const concrete=material('#b6b2a4'),gravel=material('#a6a18e'),grass=circuitGrassMaterial();
  applyEnvironmentPbr(concrete,'brushed_concrete',{worldMeters:3,normalStrength:.3});
  applyEnvironmentPbr(gravel,'gravel_road',{worldMeters:3,normalStrength:.55});
  // Matte scenery needs no metallic/ARM sampling; reserve full PBR for the asphalt.
  for(const m of [concrete,gravel,grass]){m.metalness=0;m.metalnessMap=null;m.aoMap=null;m.roughnessMap=null;m.roughness=1;}
  root.add(ground(circuit,grass),buildCircuitGrass(circuit,recipe));
  const cells=new Map(),materials={concrete,gravel};
  const cellAt=p=>`${Math.floor(p.x/80)},${Math.floor(p.z/80)}`;
  const batch=(key,kind)=>{
    if(!cells.has(key))cells.set(key,{});const cell=cells.get(key);
    return cell[kind]||=( {positions:[],uvs:[],colors:[],indices:[],routes:[]} );
  };
  function strip(from,to,side,inner,outer,height,kind,color){
    const mid=circuit.at((from+to)/2),b=batch(cellAt(mid),kind),steps=Math.max(1,Math.ceil((to-from)*circuit.length/1.2));
    const base=b.positions.length/3;
    for(let i=0;i<=steps;i++){
      const u=from+(to-from)*i/steps;
      for(const [edge,offset] of [inner,outer].entries()){const p=circuit.at(u,side*(circuit.widthAt(u)/2+offset));
        b.positions.push(p.x,p.y+(Array.isArray(height)?height[edge]:height),p.z);b.uvs.push(p.x/3,p.z/3);b.routes.push(u);
        if(color)b.colors.push(color.r,color.g,color.b);
      }
      if(i<steps){const a=base+i*2;const indices=side>0?[a,a+2,a+1,a+1,a+2,a+3]:[a,a+1,a+2,a+1,a+3,a+2];b.indices.push(...indices);}
    }
  }
  for(const [from,to,side,width,curved,runoff] of recipe.segments){
    strip(from,to,side,0,runoff?width:1.25,.012,'gravel');
    if(!runoff)strip(from,to,side,0,.75,.018,'concrete');
    // A narrow weathered shoulder separates the asphalt and the loose aggregate.
    if(runoff)strip(from,to,side,0,.6,.018,'concrete');
  }

  for(const [key,cell] of cells)for(const [kind,b] of Object.entries(cell)){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));
    if(b.colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));g.setIndex(b.indices);g.computeVertexNormals();g.computeBoundingSphere();
    const mesh=markPlayerOccluder(new THREE.Mesh(g,materials[kind]),b.routes);mesh.name=`club-${kind}-${key}`;mesh.receiveShadow=true;root.add(mesh);
  }
  const tireParts=[];
  for(let i=0;i<3;i++){const profile=[[.25,0],[.44,0],[.5,.045],[.5,.24],[.44,.29],[.25,.29],[.25,0]].map(([r,y])=>new THREE.Vector2(r,y));const g=new THREE.LatheGeometry(profile,12);g.translate(0,.015+i*.3,0);tireParts.push(g);}
  const stack=mergeGeometries(tireParts);tireParts.forEach(g=>g.dispose());
  const rubber=material('#ffffff'),board=advertisingMaterial(),steel=material('#686e68',{metalness:.35,roughness:.7});
  rubber.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 tireLocal;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntireLocal=position;');
    shader.fragmentShader='varying vec3 tireLocal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float ring=.5+.5*sin(tireLocal.y*180.0);
      float tread=.5+.5*sin(atan(tireLocal.z,tireLocal.x)*48.0+tireLocal.y*22.0);
      diffuseColor.rgb*=.82+.12*smoothstep(.2,.5,ring)+.06*tread;
    `);
  };rubber.customProgramCacheKey=()=> 'club-painted-tires-v2';
  const transform=new THREE.Object3D();
  function instances(records,geometry,m,name,height,scale=[1,1,1]){
    const groups=new Map();
    for(const [index,[u,offset]] of records.entries()){const p=circuit.at(u,offset),key=cellAt(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({u,p,offset,color:Math.floor(index/3)%2?'#bd2028':'#e8e6dc'});}
    for(const [key,rows]of groups){
      // Separate geometry carries per-instance route values for underpass visibility.
      const mesh=new THREE.InstancedMesh(geometry.clone(),m,rows.length),routes=[];
      rows.forEach(({u,p,offset,color},i)=>{transform.position.set(p.x,p.y+height,p.z);transform.rotation.set(0,p.heading+Math.PI/2+(offset>0?Math.PI:0),0);transform.scale.fromArray(scale);if(name==='advertising')transform.translateZ(.04);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);if(name==='tires')mesh.setColorAt(i,new THREE.Color(color));routes.push(u);});
      mesh.name=`club-${name}-${key}`;mesh.receiveShadow=true;mesh.castShadow=!name.startsWith('tire');mesh.computeBoundingSphere();root.add(markPlayerOccluder(mesh,routes));
    }
    geometry.dispose();if(!records.length)m.dispose();
  }
  instances(recipe.tires,stack,rubber,'tires',.02);
  const contact=new THREE.CircleGeometry(.56,12);contact.rotateX(-Math.PI/2);
  instances(recipe.tires,contact,new THREE.MeshBasicMaterial({color:'#171c15',transparent:true,opacity:.24,depthWrite:false}),'tire-contact',.025);
  const legacyBoards=recipe.infrastructure?(recipe.options?.advertising&&!recipe.infrastructure.rails.length&&!recipe.infrastructure.fences.length?recipe.boards.filter((_,i)=>(i%10)/10<recipe.options.advertisingDensity):[]):recipe.boards;
  root.add(buildCircuitInfrastructure(circuit,recipe.infrastructure),buildCircuitMarkers(circuit,recipe.markers));
  instances(legacyBoards,new THREE.PlaneGeometry(4.8,1.15),board,'advertising',1.05);
  instances(legacyBoards,new THREE.BoxGeometry(4.8,1.15,.06),material('#59605d',{metalness:.25,roughness:.8}),'board-back',1.05);
  instances(legacyBoards,new THREE.BoxGeometry(4.9,.12,.16),steel,'board-rail',.46);
  const posts=legacyBoards.flatMap(([u,offset])=>[-1,1].map(side=>[u+side*1.9/circuit.length,offset]));
  instances(posts,new THREE.BoxGeometry(.12,1.55,.12),material('#686e68',{metalness:.35,roughness:.7}),'board-post',.7);
  // Release materials with no geometry; shared texture cache remains owned by the loader.
  for(const [kind,m]of Object.entries(materials))if(![...cells.values()].some(cell=>cell[kind]))m.dispose();
  root.userData.recipe=recipe;root.updateMatrixWorld(true);root.traverse(o=>{o.matrixAutoUpdate=false;});return root;
}
