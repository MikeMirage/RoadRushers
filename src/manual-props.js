import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PROP_CATALOG, normalizeProps, normalizeProp } from './prop-catalog.js';

/** Shared prefabs, baked by material; per-type instancing keeps dense manual decoration cheap. */
export function buildPropPrefab(type){
  const definition=PROP_CATALOG.find(p=>p.id===type);if(!definition)throw new Error('Prop desconocido.');
  const buckets=new Map(),materials=new Map();
  const material=(key,color,roughness=.8,metalness=0)=>{if(!materials.has(key)){const m=new THREE.MeshStandardMaterial({color,roughness,metalness});m.name=`prop-${key}`;if(key==='light'){m.emissive.set(color);m.emissiveIntensity=.8;}materials.set(key,m);}return materials.get(key);};
  const primary=material('primary','#ffffff'),wood=material('wood','#77634b'),dark=material('dark','#34453f'),glass=material('glass','#668d96',.24,.25),stone=material('stone','#d6d9c7');
  const add=(geometry,m,x=0,y=0,z=0,rx=0,ry=0,rz=0,scale=[1,1,1])=>{
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(...scale));
    const g=geometry.index?geometry.toNonIndexed():geometry;g.applyMatrix4(matrix);if(g!==geometry)geometry.dispose();const list=buckets.get(m)||[];list.push(g);buckets.set(m,list);
  };
  const box=(x,y,z,w,h,l,m=primary,ry=0,rz=0)=>add(new THREE.BoxGeometry(w,h,l),m,x,y,z,0,ry,rz);
  const cylinder=(x,y,z,r,h,m=primary)=>add(new THREE.CylinderGeometry(r,r,h,10),m,x,y,z);
  const rock=(x,y,z,w,h,l,m=primary,ry=0)=>add(new THREE.IcosahedronGeometry(1,1),m,x,y,z,0,ry,0,[w,h,l]);
  if(type==='pine'){
    cylinder(0,1.5,0,.2,3,wood);add(new THREE.ConeGeometry(1.8,4,9),primary,0,3.2,0);add(new THREE.ConeGeometry(1.25,3.6,9),primary,0,5.2,0);
  }else if(type==='broadleaf'){
    cylinder(0,1.8,0,.25,3.6,wood);rock(0,4.8,0,2.2,2.3,2.1);rock(-1.3,4.6,.2,1.6,1.6,1.7);rock(1.3,5,.2,1.5,1.7,1.6);
  }else if(type==='palm'){
    cylinder(0,3.5,0,.23,7,wood);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;rock(Math.cos(a)*1.6,7.05,Math.sin(a)*1.6,2.4,.25,.7,primary,-a);}
  }else if(type==='rock'||type==='boulder'){
    const k=type==='boulder'?2:1;rock(0,k*.9,0,1.5*k,1.1*k,1.2*k);rock(k*.7,k*.45,k*.35,.8*k,.6*k,.7*k,primary,.7);
  }else if(type==='shrub'){
    for(let i=0;i<3;i++)rock((i-1)*.65,.6+i%2*.2,0,.85,.7,.8,primary,i);
  }else if(type==='flowers'){
    for(let i=0;i<9;i++){const a=i*2.4,r=.25+(i%3)*.28,x=Math.cos(a)*r,z=Math.sin(a)*r;cylinder(x,.23,z,.025,.46,wood);rock(x,.48,z,.13,.1,.13);}
  }else if(type==='cone'){
    box(0,.06,0,.65,.12,.65,dark);add(new THREE.ConeGeometry(.27,.9,12),primary,0,.55,0);add(new THREE.CylinderGeometry(.16,.2,.14,12),stone,0,.47,0);
  }else if(type==='barrier'){
    box(0,.12,0,4,.24,.95,dark);box(0,.55,0,3.8,.95,.55);for(const x of [-1.1,0,1.1])box(x,.63,.286,.36,.19,.03,material('stripe','#df9a54'),0,-.35);
  }else if(type==='tires'){
    for(const x of [-.6,.6])for(let i=0;i<3;i++)add(new THREE.TorusGeometry(.43,.16,6,14),primary,x,.19+i*.35,0,Math.PI/2);
  }else if(type==='arrow'){
    cylinder(0,1,0,.065,2,wood);box(0,2,0,1.8,1,.12);
    const shape=new THREE.Shape();shape.moveTo(-.55,-.3);shape.lineTo(-.1,-.3);shape.lineTo(.55,0);shape.lineTo(-.1,.3);shape.lineTo(-.55,.3);shape.lineTo(.06,0);shape.closePath();add(new THREE.ShapeGeometry(shape),dark,0,2,.067);
  }else if(type==='lamp'){
    cylinder(0,.1,0,.45,.2,dark);cylinder(0,3.85,0,.09,7.7);box(.6,7.65,0,1.3,.12,.12);box(1.15,7.6,0,.75,.2,.8,material('light','#f6e6bf',.3));
  }else if(type==='grandstand'){
    for(let i=0;i<4;i++){box(0,.45+i*.65,-2.4+i*1.5,11,.9,2.8);for(let j=0;j<8;j++)box(-4.6+j*1.3,1+i*.65,-2.4+i*1.5,.8,.25,.7,stone);}
    for(const x of [-5.3,5.3])for(const z of [-3.1,3.1])box(x,2.4,z,.18,4.8,.18,dark);
    box(0,4.8,0,12,.25,8,stone);
  }else if(type==='chalet'){
    box(0,1.75,0,6,3.5,5);
    for(const side of [-1,1])box(side*1.6,4.3,0,3.6,.2,6.3,wood,0,-side*.5);
    box(0,1,2.53,1.1,2,.06,dark);for(const x of [-1.9,1.9])box(x,2.2,2.54,.9,1,.07,glass);
  }else if(type==='med-house'){
    box(0,3,0,6,6,5);box(0,6.15,0,6.6,.3,5.6,material('roof','#b47c5e'));
    for(const y of [1.6,4.3])for(const x of [-1.7,1.7]){box(x,y,2.53,1.1,1.45,.08,glass);for(const side of [-1,1])box(x+side*.72,y,2.56,.25,1.45,.08,wood);}
    box(0,1.1,2.54,1,2.2,.08,dark);box(0,3.3,2.77,6.4,.16,.75,stone);
  }else if(type==='tower'){
    box(0,10,0,6.5,20,6.5);box(0,20.6,0,5.5,1.2,5.5,dark);cylinder(0,21.8,0,.08,1.2,stone);
    for(const z of [-3.27,3.27])for(let row=0;row<8;row++)for(let col=0;col<3;col++)box(-2+col*2,1.8+row*2.2,z,1,.85,.04,(row+col)%3?glass:material('light','#d3ddca'));
  }else if(type==='kiosk'){
    box(0,1.5,0,4,3,4);box(0,3.1,0,4.6,.2,4.6,stone);box(0,1.8,2.03,2.8,1.1,.06,glass);box(0,.65,2.06,1,1.3,.08,dark);
  }
  const parts=[],bounds=new THREE.Box3();
  for(const [m,geometries]of buckets){const g=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());g.computeBoundingBox();bounds.union(g.boundingBox);parts.push({geometry:g,material:m,primary:m===primary});}
  const ground=bounds.min.y;parts.forEach(p=>p.geometry.translate(0,-ground,0));bounds.translate(new THREE.Vector3(0,-ground,0));
  for(const [key,m]of materials)if(!buckets.has(m))m.dispose();
  return {type,definition,parts,bounds};
}

export function propPreview(type){
  const prefab=buildPropPrefab(type),group=new THREE.Group();for(const part of prefab.parts){const m=part.material;m.transparent=true;m.opacity=.5;m.depthWrite=false;if(part.primary)m.color.set(prefab.definition.color);group.add(new THREE.Mesh(part.geometry,m));}return group;
}

export class ManualPropLayer{
  constructor(parent,records=[]){this.group=new THREE.Group();this.group.name='manual-props';parent.add(this.group);this.templates=new Map();this.nodes=new Map();this.batches=[];this.setRecords(records);}
  template(type){if(!this.templates.has(type))this.templates.set(type,buildPropPrefab(type));return this.templates.get(type);}
  setRecords(records){
    this.records=normalizeProps(records);for(const batch of this.batches){batch.mesh.removeFromParent();batch.mesh.dispose();}this.batches=[];
    for(const node of this.nodes.values())node.removeFromParent();this.nodes.clear();
    const groups=new Map();
    for(const p of this.records){const node=new THREE.Object3D();node.name=p.id;node.userData.propId=p.id;this.group.add(node);this.nodes.set(p.id,node);this.applyNode(node,p);const list=groups.get(p.type)||[];list.push(p);groups.set(p.type,list);}
    for(const [type,props]of groups)for(const part of this.template(type).parts){
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,props.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.name=`manual-${type}`;mesh.userData.propIds=props.map(p=>p.id);mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;
      const batch={mesh,props,primary:part.primary};this.batches.push(batch);this.group.add(mesh);
      props.forEach((p,i)=>{this.nodes.get(p.id).updateMatrix();mesh.setMatrixAt(i,this.nodes.get(p.id).matrix);if(part.primary)mesh.setColorAt(i,new THREE.Color(p.color));});
    }
  }
  applyNode(node,p){node.position.fromArray(p.position);node.rotation.set(0,p.rotation*Math.PI/180,0);node.scale.setScalar(p.scale);node.updateMatrixWorld(true);}
  updateRecord(record){
    const p=normalizeProp(record),i=this.records.findIndex(v=>v.id===p.id);if(i<0)return;this.records[i]=p;const node=this.nodes.get(p.id);this.applyNode(node,p);
    for(const b of this.batches){const index=b.mesh.userData.propIds.indexOf(p.id);if(index<0)continue;b.mesh.setMatrixAt(index,node.matrix);b.mesh.instanceMatrix.needsUpdate=true;b.mesh.boundingSphere=null;b.mesh.boundingBox=null;if(b.primary){b.mesh.setColorAt(index,new THREE.Color(p.color));b.mesh.instanceColor.needsUpdate=true;}}
  }
  boundsFor(id){const p=this.records.find(p=>p.id===id);if(!p)return new THREE.Box3();const node=this.nodes.get(id);node.updateMatrixWorld(true);return this.template(p.type).bounds.clone().applyMatrix4(node.matrixWorld);}
  pick(raycaster){const hit=raycaster.intersectObjects(this.batches.map(b=>b.mesh),false)[0];return hit?{id:hit.object.userData.propIds[hit.instanceId],distance:hit.distance}:null;}
  dispose(){for(const b of this.batches)b.mesh.dispose();for(const t of this.templates.values())for(const p of t.parts){p.geometry.dispose();p.material.dispose();}this.group.removeFromParent();this.templates.clear();this.nodes.clear();}
}
