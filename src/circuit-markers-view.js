import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {markPlayerOccluder} from './local-occlusion.js';
let signAtlas;
function atlas(){
  if(signAtlas||typeof document==='undefined')return signAtlas;
  const c=document.createElement('canvas');c.width=1792;c.height=256;const x=c.getContext('2d');
  ['10','20','30','50','100','150','SALIDA / META'].forEach((text,i)=>{
    x.fillStyle=i===6?'#17373b':'#f3f0df';x.fillRect(i*256,0,256,256);x.fillStyle=i===6?'#f3f0df':'#19282b';
    x.textAlign='center';x.font=i===6?'bold 29px sans-serif':'bold 106px sans-serif';x.fillText(text,i*256+128,145);
    if(i!==6){x.font='bold 25px sans-serif';x.fillText('METROS',i*256+128,193);}
    for(let k=0;k<8;k++){x.fillStyle=k%2?'#f1eee0':'#16262a';x.fillRect(i*256+k*32,224,32,32);}
  });signAtlas=new THREE.CanvasTexture(c);signAtlas.colorSpace=THREE.SRGBColorSpace;signAtlas.anisotropy=4;return signAtlas;
}
export function buildCircuitMarkers(circuit,markers){
  const group=new THREE.Group();group.name='circuit-markers';if(!markers)return group;
  const posts=[],paint=[],signs=[],routes=[],pose=new THREE.Object3D(),local=new THREE.Matrix4(),map=atlas();
  function box(target,p,width,height,depth,x,y,z){
    const g=new THREE.BoxGeometry(width,height,depth);local.makeTranslation(x,y,z);g.applyMatrix4(local);g.applyMatrix4(p.matrix);target.push(g);
  }
  const signGeometry=new THREE.PlaneGeometry(1,1);
  const labels=[10,20,30,50,100,150];
  for(const [rows,isStart]of [[markers.braking,false],[markers.start,true]])for(const row of rows){
    const [u,offset]=row,p=circuit.at(u,offset),index=isStart?6:labels.indexOf(row[2]);
    pose.position.set(p.x,p.y,p.z);pose.rotation.set(0,p.heading+Math.PI,0);pose.scale.set(1,1,1);pose.updateMatrix();
    box(posts,pose,.09,isStart?2.7:1.9,.09,0,(isStart?2.7:1.9)/2,0);
    const g=signGeometry.clone(),width=isStart?1.65:1.1,height=isStart?.95:1.05;
    g.scale(width,height,1);g.translate(0,isStart?2.15:1.4,.065);g.applyMatrix4(pose.matrix);
    const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setX(i,(index+.012+uv.getX(i)*.976)/7);
    signs.push(g);routes.push(...Array(g.attributes.position.count).fill(u));
  }
  signGeometry.dispose();
  for(const [u,offset]of markers.grid){
    const p=circuit.at(u,offset);pose.position.set(p.x,p.y+.06,p.z);pose.rotation.set(-p.pitch,p.heading,p.bank,'YXZ');pose.updateMatrix();
    box(paint,pose,1.8,.012,.07,0,0,-1.4);for(const side of [-1,1])box(paint,pose,.065,.012,2.8,side*.9,0,0);
  }
  function mesh(parts,material,name,progress=-1){
    if(!parts.length){material.dispose();return;}
    const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();
    const object=markPlayerOccluder(new THREE.Mesh(geometry,material),progress);object.name=name;object.castShadow=false;object.receiveShadow=true;group.add(object);
  }
  mesh(posts,new THREE.MeshStandardMaterial({color:'#899697',metalness:.25,roughness:.8}),'marker-posts');
  mesh(signs,new THREE.MeshStandardMaterial({...(map?{map}:{}),color:'#ffffff',roughness:1}),'braking-and-finish-signs',routes);
  mesh(paint,new THREE.MeshStandardMaterial({color:'#e5e3d5',roughness:1}),'starting-grid');return group;
}
