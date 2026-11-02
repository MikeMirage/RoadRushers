import * as THREE from 'three';
import {markPlayerOccluder} from './local-occlusion.js';
let advertisingAtlas;
function atlas(){
  if(advertisingAtlas||typeof document==='undefined')return advertisingAtlas;
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=128;const ctx=canvas.getContext('2d');
  [['#183b40','#f0ede0','PRL  MOTORSPORT'],['#d7df67','#172b32','APEX  RACING'],['#eee8d8','#a72230','ROAD RUSHERS']].forEach(([bg,fg,label],i)=>{ctx.fillStyle=bg;ctx.fillRect(i*512,0,512,128);ctx.fillStyle=fg;ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText(label,i*512+256,80);ctx.fillRect(i*512,114,512,8);});
  advertisingAtlas=new THREE.CanvasTexture(canvas);advertisingAtlas.colorSpace=THREE.SRGBColorSpace;advertisingAtlas.anisotropy=4;return advertisingAtlas;
}
/** Thin opaque geometry and cutout mesh; fixed spatial batches, no animation or new lights. */
export function buildCircuitInfrastructure(circuit,infrastructure){
  const root=new THREE.Group();root.name='circuit-infrastructure';if(!infrastructure)return root;
  const metal=new THREE.MeshStandardMaterial({color:'#a8b1b4',metalness:.65,roughness:.48,side:THREE.DoubleSide});
  const fence=new THREE.MeshStandardMaterial({color:'#515d60',roughness:.85,side:THREE.DoubleSide});
  fence.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 fenceGrid;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nfenceGrid=uv;');
    shader.fragmentShader='varying vec2 fenceGrid;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      vec2 grid=vec2(fenceGrid.x+fenceGrid.y,fenceGrid.x-fenceGrid.y)/.16;
      vec2 edge=abs(fract(grid+.5)-.5);
      vec2 thickness=min(vec2(.18),max(vec2(.032),fwidth(grid)*.45));
      if(all(greaterThan(edge,thickness)))discard;
    `);
  };fence.customProgramCacheKey=()=> 'club-chainlink-v1';
  const map=atlas(),ad=new THREE.MeshStandardMaterial({...(map?{map}:{}),color:'#ffffff',roughness:1});
  const materials={rail:metal,post:metal,fence,ad},batches=new Map();
  function quad(kind,points,routes,uvs,side=1){
    const p=points[0],key=`${kind}:${Math.floor(p.x/80)},${Math.floor(p.z/80)}`;
    if(!batches.has(key))batches.set(key,{kind,positions:[],indices:[],uvs:[],routes:[]});const b=batches.get(key),n=b.positions.length/3;
    points.forEach((p,i)=>{b.positions.push(p.x,p.y,p.z);b.routes.push(routes[i]);b.uvs.push(...uvs[i]);});
    b.indices.push(...(side>0?[n,n+1,n+2,n+2,n+1,n+3]:[n,n+2,n+1,n+2,n+3,n+1]));
  }
  const at=(u,side,offset,h)=>{const p=circuit.at(u,side*(circuit.widthAt(u)/2+offset));return {x:p.x,y:p.y+h,z:p.z};};
  function panel(kind,a,b,side,offset,bottom,top,uv){quad(kind,[at(a,side,offset,bottom),at(b,side,offset,bottom),at(a,side,offset,top),at(b,side,offset,top)],[a,b,a,b],uv||[[a*circuit.length,bottom],[b*circuit.length,bottom],[a*circuit.length,top],[b*circuit.length,top]],side);}
  function post(u,side,offset,height){
    // Square posts built into the same spatial batch, four faces each.
    const p=at(u,side,offset,0),r=.055;
    for(const [a,b]of [[[r,r],[-r,r]],[[-r,r],[-r,-r]],[[-r,-r],[r,-r]],[[r,-r],[r,r]]])quad('post',[{x:p.x+a[0],y:p.y,z:p.z+a[1]},{x:p.x+b[0],y:p.y,z:p.z+b[1]},{x:p.x+a[0],y:p.y+height,z:p.z+a[1]},{x:p.x+b[0],y:p.y+height,z:p.z+b[1]}],[u,u,u,u],[[0,0],[1,0],[0,1],[1,1]]);
  }
  for(const [kind,rows,offset]of [['rail',infrastructure.rails,3.8],['fence',infrastructure.fences,4.5]])for(const [from,to,side]of rows){
    const steps=Math.max(1,Math.ceil((to-from)*circuit.length/1.5));
    for(let i=0;i<steps;i++){
      const a=from+(to-from)*i/steps,b=from+(to-from)*(i+1)/steps;
      if(kind==='fence')panel(kind,a,b,side,offset,.15,2.5);
      else for(let j=0;j<6;j++){
        const y=.38+j*.085,z=offset+(j%2?.065:0),next=offset+((j+1)%2?.065:0);
        quad(kind,[at(a,side,z,y),at(b,side,z,y),at(a,side,next,y+.085),at(b,side,next,y+.085)],[a,b,a,b],[[0,0],[1,0],[0,1],[1,1]],side);
      }
    }
    post(from,side,offset,kind==='fence'?2.6:1.02);post(to,side,offset,kind==='fence'?2.6:1.02);
    if(kind==='rail')for(const u of [from,to])quad('rail',[at(u,side,offset-.02,.38),at(u,side,offset+.075,.38),at(u,side,offset-.02,.89),at(u,side,offset+.075,.89)],[u,u,u,u],[[0,0],[1,0],[0,1],[1,1]],side);
  }
  for(const [a,b,side,offset]of infrastructure.ads){
    const design=(Math.floor(a*circuit.length/24)+ (side>0?1:0))%3,left=design/3+.003,right=(design+1)/3-.003;
    panel('ad',a,b,side,offset-.10,offset===4.5?1.15:.43,offset===4.5?2.15:.93,[[left,0],[right,0],[left,1],[right,1]]);
  }
  const used=new Set();for(const [key,b]of batches){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));geometry.setIndex(b.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=markPlayerOccluder(new THREE.Mesh(geometry,materials[b.kind]),b.routes);mesh.name=`club-${key}`;mesh.receiveShadow=b.kind!=='fence';mesh.castShadow=false;root.add(mesh);used.add(materials[b.kind]);
  }
  for(const m of new Set(Object.values(materials)))if(!used.has(m))m.dispose();return root;
}
