import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {markPlayerOccluder} from './local-occlusion.js';
let map;
function atlas(){
  if(map||typeof document==='undefined')return map;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;const c=canvas.getContext('2d');
  for(let i=0;i<4;i++){
    c.fillStyle=i===3?'#d45c23':'#f0d65a';c.fillRect(i*256,0,256,256);c.strokeStyle='#202b2e';c.lineWidth=12;c.strokeRect(i*256+8,8,240,240);
    c.fillStyle='#202b2e';c.strokeStyle='#202b2e';c.lineWidth=28;c.lineJoin='round';
    if(i<2){const direction=i===0?-1:1;c.beginPath();c.moveTo(i*256+128-direction*48,200);c.lineTo(i*256+128-direction*48,110);c.lineTo(i*256+128+direction*48,110);c.stroke();c.beginPath();c.moveTo(i*256+128+direction*15,66);c.lineTo(i*256+128+direction*73,110);c.lineTo(i*256+128+direction*15,154);c.fill();}
    else{c.textAlign='center';c.font=i===2?'bold 150px sans-serif':'bold 27px sans-serif';c.fillText(i===2?'!':'COMISARIOS',i*256+128,i===2?188:145);}
  }
  map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;return map;
}
/** Shared static sector batches, with route attributes for existing underpass visibility. */
export function buildCircuitFacilities(circuit,facilities){
  const root=new THREE.Group();root.name='circuit-facilities';if(!facilities)return root;
  const texture=atlas(),materials={steel:new THREE.MeshStandardMaterial({color:'#a4afb0',roughness:.6,metalness:.25}),concrete:new THREE.MeshStandardMaterial({color:'#a7aca3',roughness:1}),orange:new THREE.MeshStandardMaterial({color:'#df752e',roughness:.85}),label:new THREE.MeshStandardMaterial({...(texture?{map:texture}:{}),color:'#ffffff',roughness:1})},batches=new Map();
  function add(g,kind,u){
    const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position),p=box.getCenter(new THREE.Vector3()),key=`${kind}:${Math.floor(p.x/80)},${Math.floor(p.z/80)}`;
    if(!batches.has(key))batches.set(key,{kind,parts:[],routes:[]});const b=batches.get(key);b.parts.push(g);b.routes.push(...Array(g.attributes.position.count).fill(u));
  }
  const pose=new THREE.Object3D();
  function position(u,offset){const p=circuit.at(u,offset);pose.position.set(p.x,p.y,p.z);pose.rotation.set(0,p.heading,0);pose.scale.set(1,1,1);pose.updateMatrix();return p;}
  function box(kind,u,size,center){const g=new THREE.BoxGeometry(...size);g.translate(...center);g.applyMatrix4(pose.matrix);add(g,kind,u);}
  function label(u,offset,index,height,width=1.2,tall=1.2){
    const p=circuit.at(u,offset),g=new THREE.PlaneGeometry(width,tall),uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(index+.012+uv.getX(i)*.976)/4);
    g.rotateY(p.heading+Math.PI);g.translate(p.x,p.y+height,p.z);add(g,'label',u);
  }
  for(const [u,offset]of facilities.marshals){
    position(u,offset);box('concrete',u,[3.6,1.1,3.2],[0,.55,0]);
    for(const x of [-1.5,1.5])for(const z of [-1.25,1.25])box('steel',u,[.12,2.2,.12],[x,2.2,z]);
    box('orange',u,[3.7,.18,3.3],[0,3.4,0]);
    for(const x of [-1.5,1.5])box('steel',u,[.08,.08,2.5],[x,1.9,0]);
    box('steel',u,[3,.08,.08],[0,1.9,1.25]);
    // Small stair and orange safety cabinet identify an accessible marshal platform.
    for(let i=0;i<3;i++)box('concrete',u,[1,.28*(i+1),.4],[0,.14*(i+1),-2+i*.4]);
    box('orange',u,[.4,.7,.35],[1,1.45,0]);
    const p=circuit.at(u,offset),front={x:p.x-Math.sin(p.heading)*1.68,z:p.z-Math.cos(p.heading)*1.68};
    const g=new THREE.PlaneGeometry(2.7,.5),uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(3+.012+uv.getX(i)*.976)/4);g.rotateY(p.heading+Math.PI);g.translate(front.x,p.y+3.05,front.z);add(g,'label',u);
  }
  for(const [u,offset,direction]of facilities.turnSigns){position(u,offset);box('steel',u,[.085,2,.085],[0,1,0]);label(u,offset,direction<0?0:direction>0?1:2,1.75);}
  function railPoint(u,side,height){const p=circuit.at(u,side*(circuit.widthAt(u)/2+.72));return new THREE.Vector3(p.x,p.y+height,p.z);}
  for(const [a,b,side]of facilities.bridgeRails){
    const steps=Math.max(1,Math.ceil((b-a)*circuit.length/1.5));
    for(let i=0;i<steps;i++){
      const from=a+(b-a)*i/steps,to=a+(b-a)*(i+1)/steps;
      for(const [bottom,top]of [[.28,.59],[.76,1.04]]){
        const points=[railPoint(from,side,bottom),railPoint(to,side,bottom),railPoint(from,side,top),railPoint(to,side,top)];
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Array(4).fill([side,0,0]).flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.setIndex([0,1,2,2,1,3]);g.computeVertexNormals();
        add(g,'steel',from);
      }
    }
    for(const u of [a,b]){position(u,side*(circuit.widthAt(u)/2+.72));box('steel',u,[.1,1.15,.1],[0,.575,0]);}
  }
  materials.steel.side=THREE.DoubleSide;
  const used=new Set();for(const [key,b]of batches){
    const geometry=mergeGeometries(b.parts);b.parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
    const mesh=markPlayerOccluder(new THREE.Mesh(geometry,materials[b.kind]),b.routes);mesh.name=`facility-${key}`;mesh.receiveShadow=true;mesh.castShadow=false;root.add(mesh);used.add(materials[b.kind]);
  }
  for(const m of Object.values(materials))if(!used.has(m))m.dispose();return root;
}
