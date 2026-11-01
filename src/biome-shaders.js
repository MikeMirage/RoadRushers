import * as THREE from 'three';
import { BIOMES, solarPosition } from './environment-config.js';
import { applyEnvironmentPbr, groundPbrId } from './environment-assets.js';

// Original GLSL, using Shadertoy-style iTime and world-space noise. No remote shaders.
const noiseGLSL=`
float rrHash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float rrNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(rrHash(i),rrHash(i+vec2(1,0)),f.x),mix(rrHash(i+vec2(0,1)),rrHash(i+vec2(1)),f.x),f.y);}
float rrFbm(vec2 p){return rrNoise(p)*.57+rrNoise(p*2.03+17.0)*.28+rrNoise(p*4.07+31.0)*.15;}
`;
const uniforms=state=>({iTime:{value:0},rrWind:{value:state.wind},rrWet:{value:state.wetness},rrSnow:{value:state.snow},rrCloud:{value:state.clouds},rrMode:{value:BIOMES[state.biome].mode}});
export function groundMaterial(state){
  const m=new THREE.MeshStandardMaterial({color:BIOMES[state.biome].ground,roughness:.95});m.name='biome-ground';m.userData.envUniforms=uniforms(state);
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,m.userData.envUniforms);
    shader.vertexShader='varying vec3 rrWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrrWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 rrWorld;uniform float iTime,rrWind,rrWet,rrSnow,rrMode,rrCloud;\n'+noiseGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 q=rrWorld.xz;float rrPatch=rrFbm(q*.045);float fine=rrNoise(q*2.3);
      float ripple=sin(q.x*.9+sin(q.y*.15)*2.0)*.5+.5;
      float grain=mix(fine,ripple,step(.5,rrMode)*(1.0-step(1.5,rrMode)));
      diffuseColor.rgb*=.77+rrPatch*.32+grain*.12;
      float cloudShadow=rrFbm(q*.012+vec2(iTime*rrWind*.003));
      diffuseColor.rgb*=1.0-rrCloud*.22*smoothstep(.35,.65,cloudShadow);
      diffuseColor.rgb*=1.0-rrWet*.24;
      float snowMask=smoothstep(.27,.8,rrPatch+rrSnow*.75);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.9,.92),rrSnow*snowMask);`);
  };m.customProgramCacheKey=()=> 'roadrushers-ground-v1';
  const asset=groundPbrId(state);if(asset)applyEnvironmentPbr(m,asset,{worldMeters:4,normalStrength:.65});
  return m;
}

export function waterfallMaterial(state){
  const m=waterMaterial(state),compile=m.onBeforeCompile;m.name='biome-waterfall';m.color.set('#c2dfe0');m.emissive.set('#4e757a');m.emissiveIntensity=.12;m.side=THREE.DoubleSide;
  m.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('rrWorld.xz*.34+vec2(iTime*.06,-iTime*.04)','rrWorld.xy*vec2(.7,.18)+vec2(0.0,-iTime*.9)');};m.customProgramCacheKey=()=> 'roadrushers-waterfall-v1';return m;
}

export function waterMaterial(state){
  const m=new THREE.MeshPhysicalMaterial({color:'#226d77',roughness:.16,metalness:0,ior:1.333,clearcoat:1,clearcoatRoughness:.12});m.name='biome-water';m.userData.envUniforms=uniforms(state);
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,m.userData.envUniforms);
    shader.vertexShader='varying vec3 rrWorld;uniform float iTime,rrWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      rrWorld=(modelMatrix*vec4(transformed,1.0)).xyz;
      transformed.z+=sin(position.x*.12+iTime*.65)*cos(position.y*.17-iTime*.5)*(.025+rrWind*.003);`);
    shader.fragmentShader='varying vec3 rrWorld;uniform float iTime,rrWind,rrWet,rrSnow,rrMode;\n'+noiseGLSL+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float wave=rrFbm(rrWorld.xz*.34+vec2(iTime*.06,-iTime*.04));
      float rrCrest=pow(max(0.0,sin(rrWorld.x*.31+rrWorld.z*.23+iTime*.8)),12.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.08,.29,.30),wave*.45);
      diffuseColor.rgb+=vec3(.08,.13,.11)*rrCrest*min(rrWind*.04,.35);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float rrWaveX=sin(rrWorld.x*.74+rrWorld.z*.29+iTime*.8)*.11+sin(rrWorld.x*1.91-rrWorld.z*.43-iTime*1.2)*.045;
      float rrWaveZ=cos(rrWorld.z*.67-rrWorld.x*.21-iTime*.65)*.1+cos(rrWorld.z*2.13+rrWorld.x*.49+iTime*1.1)*.04;
      normal=normalize(normal+mat3(viewMatrix)*vec3(rrWaveX,0.0,rrWaveZ));`);
  };m.customProgramCacheKey=()=> 'roadrushers-water-v2';return m;
}

export function buildGrass(group,circuit,state){
  const vegetation=BIOMES[state.biome].vegetation;if(!vegetation||!state.grassDensity)return;
  const count=Math.floor((state.quality==='mobile'?1200:state.quality==='high'?8000:4200)*state.grassDensity*vegetation);
  const blades=[];for(let i=0;i<3;i++){const a=i/3*Math.PI,dx=Math.cos(a)*.1,dz=Math.sin(a)*.1;blades.push(-dx,0,-dz,dx,0,dz,Math.sin(a)*.12,.38+i*.07,Math.cos(a)*.12);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));g.computeVertexNormals();
  const m=new THREE.MeshStandardMaterial({color:BIOMES[state.biome].grass,roughness:1,side:THREE.DoubleSide,forceSinglePass:true});m.name='biome-grass';m.userData.envUniforms=uniforms(state);
  m.emissive.copy(m.color).multiplyScalar(.1);
  m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,m.userData.envUniforms);
    shader.vertexShader='varying float rrBlade;uniform float iTime,rrWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      rrBlade=position.y/.65;vec3 rrRoot=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
      float rrFade=1.0-smoothstep(65.0,115.0,distance(cameraPosition.xz,rrRoot.xz));
      transformed.y*=rrFade;
      transformed.x+=sin(iTime*(.8+rrWind*.12)+rrRoot.x*.25+rrRoot.z*.33)*rrBlade*rrBlade*(.025+rrWind*.012);`);
    shader.fragmentShader='varying float rrBlade;uniform float rrSnow;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(.7,1.25,rrBlade);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.86,.85),rrSnow*.8);');
  };m.customProgramCacheKey=()=> 'roadrushers-grass-v1';
  const grass=new THREE.InstancedMesh(g,m,count),o=new THREE.Object3D(),color=new THREE.Color();grass.name='biome-grass';grass.receiveShadow=true;grass.frustumCulled=false;
  let seed=789123,placed=0;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  for(let i=0;i<count*3&&placed<count;i++){
    const u=rng(),side=rng()<.5?-1:1,p=circuit.at(u,side*(circuit.widthAt(u)/2+2+rng()*32));
    if(state.biome==='coast'&&p.z>70)continue;
    if(circuit.nearest(p.x,p.z).distance<circuit.widthAt(u)/2+1.6)continue;
    o.position.set(p.x,-.045,p.z);o.rotation.y=rng()*Math.PI*2;const scale=.45+rng()*.8;o.scale.set(scale,scale,scale);o.updateMatrix();grass.setMatrixAt(placed,o.matrix);grass.setColorAt(placed,color.setHSL(.2+rng()*.06,.31,.55+rng()*.17));placed++;
  }
  grass.count=placed;group.add(grass);
}

export function updateBiomeMaterials(group,state,time){
  const day=THREE.MathUtils.smoothstep(solarPosition(state).elevation,-7,12),light=day*(1-state.clouds*.22);
  group.traverse(o=>{if(!o.material)return;const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){
    if(m.userData.treeImpostor)m.color.setRGB(.035+light*.965,.055+light*.945,.085+light*.915);
    const u=m.userData.envUniforms;if(!u)continue;u.iTime.value=time;u.rrWind.value=state.wind;u.rrWet.value=state.wetness;u.rrSnow.value=state.snow;u.rrCloud.value=state.clouds;if(m.name==='biome-ground')m.roughness=.95-state.wetness*.32;
  }});
}
