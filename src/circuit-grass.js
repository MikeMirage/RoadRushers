import * as THREE from 'three';
import {corridorIndex} from './circuit-dressing.js';

export const CIRCUIT_GRASS_BUDGET={tufts:2400,trianglesPerTuft:3,cells:24};
const noise=`
float clubHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float clubNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(clubHash(i),clubHash(i+vec2(1,0)),f.x),mix(clubHash(i+vec2(0,1)),clubHash(i+vec2(1,1)),f.x),f.y);}
`;
/** A texture-free mown lawn: broad green variation and screen-filtered fine detail. */
export function circuitGrassMaterial(){
  const material=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,emissive:'#315c20',emissiveIntensity:.09});
  const dark=new THREE.Color('#307b36'),light=new THREE.Color('#529444');
  material.name='club-procedural-lawn';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{clubGreenDark:{value:dark},clubGreenLight:{value:light}});
    shader.vertexShader='varying vec2 clubLawn;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nclubLawn=(modelMatrix*vec4(position,1.0)).xz;');
    shader.fragmentShader='varying vec2 clubLawn;uniform vec3 clubGreenDark,clubGreenLight;\n'+noise+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float broad=clubNoise(clubLawn*.075);
      float soft=clubNoise(clubLawn*.37+13.0);
      float mowing=.5+.5*sin(clubLawn.x*.36+clubLawn.y*.12);
      float fineFade=1.0-smoothstep(.1,.4,max(fwidth(clubLawn.x),fwidth(clubLawn.y)));
      float grain=clubHash(floor(clubLawn*19.0));
      diffuseColor.rgb=mix(clubGreenDark,clubGreenLight,.30+broad*.38+soft*.16);
      diffuseColor.rgb*=.96+mowing*.055+(grain-.5)*.075*fineFade;
    `);
  };material.customProgramCacheKey=()=> 'club-procedural-lawn-v1';return material;
}
/** Small opaque triangles give the grass a silhouette without layered alpha cards. */
export function buildCircuitGrass(circuit,recipe){
  const root=new THREE.Group();root.name='club-short-grass';
  const cells=new Map(),clear=corridorIndex(circuit);let seed=918733;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  let placed=0,patch=null;
  for(let i=0;i<CIRCUIT_GRASS_BUDGET.tufts*4&&placed<CIRCUIT_GRASS_BUDGET.tufts;i++){
    // Nearby tufts share a 5 × 3 m patch rather than reading as isolated specks.
    if(i%24===0)patch={u:random(),side:random()<.5?-1:1,offset:3.4+random()*6};
    const u=((patch.u+(random()-.5)*5/circuit.length)%1+1)%1,side=patch.side;
    const p=circuit.at(u,side*(circuit.widthAt(u)/2+patch.offset+(random()-.5)*3));
    if(Math.abs(p.y)>.3)continue;p.y=-.075;
    if(!clear(p,.45,.65))continue;
    const road=circuit.nearest(p.x,p.z,{y:0}),half=circuit.widthAt(road.progress)/2;
    const margin=recipe.segments.filter(s=>road.progress>=s[0]&&road.progress<=s[1]&&Math.sign(road.offset)===s[2]).reduce((w,s)=>Math.max(w,s[5]?s[3]:1.25),0);
    if(road.distance<half+Math.max(.7,margin)+.6)continue;
    const key=`${Math.floor(p.x/80)},${Math.floor(p.z/80)}`;
    if(!cells.has(key)){if(cells.size>=CIRCUIT_GRASS_BUDGET.cells)continue;cells.set(key,[]);}
    cells.get(key).push({x:p.x,y:p.y,z:p.z,angle:random()*Math.PI*2,size:1+random()*.45});placed++;
  }
  if(!placed)return root;
  const positions=[];
  for(let i=0;i<3;i++){const a=i*Math.PI/3,dx=Math.cos(a)*.18,dz=Math.sin(a)*.18;positions.push(-dx,0,-dz,dx,0,dz,dx*.6,.32+i*.025,dz*.6);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  const time={value:0},material=new THREE.MeshStandardMaterial({color:'#5f9d42',roughness:1,side:THREE.DoubleSide,emissive:'#396b25',emissiveIntensity:.25});
  material.onBeforeCompile=shader=>{
    shader.uniforms.clubGrassTime=time;
    shader.vertexShader='varying float clubTip;uniform float clubGrassTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      clubTip=clamp(position.y/.38,0.0,1.0);
      vec3 grassRoot=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
      float grassFade=1.0-smoothstep(45.0,85.0,distance(cameraPosition.xz,grassRoot.xz));
      transformed.y*=grassFade;
      transformed.x+=sin(clubGrassTime*1.3+grassRoot.x*.22+grassRoot.z*.31)*.055*clubTip*clubTip*grassFade;
    `);
    shader.fragmentShader='varying float clubTip;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.82,1.12,clubTip);');
  };material.customProgramCacheKey=()=> 'club-short-grass-v2';
  const transform=new THREE.Object3D();
  for(const [key,rows]of cells){
    const mesh=new THREE.InstancedMesh(geometry,material,rows.length);mesh.name=`club-grass-${key}`;
    rows.forEach((p,i)=>{transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.angle,0);transform.scale.setScalar(p.size);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
    mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.12;mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.onBeforeRender=()=>{time.value=performance.now()*.001;};root.add(mesh);
  }
  return root;
}
