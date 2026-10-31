import * as THREE from 'three';
import { BIOMES, trackEnvironment } from './environment-config.js';
import { groundMaterial, waterMaterial, buildGrass } from './biome-shaders.js';
import { addEnvironmentTheme } from './environment-themes.js';

const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 1 });
const object = new THREE.Object3D();
const seeded = seed => () => { seed = (Math.imul(seed,1664525)+1013904223)|0; return (seed>>>0)/4294967296; };

class Scenery {
  constructor(group) {
    this.group = group; this.batches = {};
    this.geometries = { box:new THREE.BoxGeometry(1,1,1), cone:new THREE.ConeGeometry(1,1,7), cylinder:new THREE.CylinderGeometry(1,1,1,8), rock:new THREE.IcosahedronGeometry(1,0) };
  }
  add(shape,x,y,z,sx,sy,sz,color,angle=0,tilt=0) {
    object.position.set(x,y,z); object.scale.set(sx,sy,sz); object.rotation.set(tilt,angle,0); object.updateMatrix();
    (this.batches[shape] ||= []).push([object.matrix.clone(),new THREE.Color(color)]);
  }
  box(x,y,z,sx,sy,sz,color,angle=0) { this.add('box',x,y,z,sx,sy,sz,color,angle); }
  flush() {
    for (const [shape,instances] of Object.entries(this.batches)) {
      const mesh = new THREE.InstancedMesh(this.geometries[shape],mat('#ffffff'),instances.length);
      instances.forEach(([matrix,color],i) => { mesh.setMatrixAt(i,matrix); mesh.setColorAt(i,color); });
      mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    }
    for (const [name,geometry] of Object.entries(this.geometries)) if (!this.batches[name]) geometry.dispose();
  }
}

function groundRibbon(points,width,y,color) {
  const positions=[],indices=[];
  for(let i=0;i<points.length;i++) {
    const a=points[Math.max(0,i-1)], b=points[Math.min(points.length-1,i+1)], dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz);
    for(const side of [-1,1]) positions.push(points[i][0]+dz/len*width/2*side,y,points[i][1]-dx/len*width/2*side);
    if(i<points.length-1){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:0.65,side:THREE.DoubleSide}));mesh.receiveShadow=true;return mesh;
}

function house(s,x,z,width=6,height=5,angle=0,forest=false) {
  const wall=forest?'#b96e52':'#eee4c8', roof=forest?'#374d42':'#bd7759';
  s.box(x,height/2,z,width,height,width*.8,wall,angle);
  // Two sloping roof halves made from ordinary boxes, batched with all buildings.
  for(const side of [-1,1]) {
    const dx=Math.cos(angle)*side*width*.25, dz=-Math.sin(angle)*side*width*.25;
    object.position.set(x+dx,height+.7,z+dz); object.rotation.set(0,angle,side*.34); object.scale.set(width*.58,.35,width*.98); object.updateMatrix();
    (s.batches.box ||= []).push([object.matrix.clone(),new THREE.Color(roof)]);
  }
  for(const side of [-1,1]) {
    const fx=Math.sin(angle),fz=Math.cos(angle),rx=Math.cos(angle),rz=-Math.sin(angle);
    s.box(x+rx*side*width*.23+fx*(width*.405),height*.61,z+rz*side*width*.23+fz*(width*.405),width*.19,height*.27,.1,'#486e69',angle);
    s.box(x+rx*side*width*.23-fx*(width*.405),height*.61,z+rz*side*width*.23-fz*(width*.405),width*.19,height*.27,.1,'#486e69',angle);
  }
  s.box(x+Math.sin(angle)*width*.41,height*.22,z+Math.cos(angle)*width*.41,width*.18,height*.44,.12,forest?'#593e2e':'#739a92',angle);
  s.box(x+width*.2,height+1.2,z-width*.15,.65,1.7,.7,'#e1d3b4',angle);
}

function pine(s,x,z,scale,color='#456955') {
  s.add('cylinder',x,1.3*scale,z,.24*scale,2.6*scale,.24*scale,'#8b7155');
  s.add('cone',x,3.6*scale,z,2*scale,5*scale,2*scale,color);
  s.add('cone',x,5.5*scale,z,1.4*scale,3.9*scale,1.4*scale,color);
}

const shore = x => 90 + Math.sin(x*.024)*6 + Math.sin(x*.065)*3;

function coast(group,circuit,s,rng,state) {
  const water=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000,48,48),waterMaterial(state));
  water.rotation.x=-Math.PI/2;water.position.y=-.32;group.add(water);
  const land=new THREE.Shape();land.moveTo(-650,650);land.lineTo(650,650);
  for(let x=650;x>=-650;x-=10)land.lineTo(x,-shore(x)+15);
  land.closePath();
  const ground=new THREE.Mesh(new THREE.ShapeGeometry(land),groundMaterial(state));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;group.add(ground);
  const shoreline=[];for(let x=-650;x<=650;x+=10)shoreline.push([x,shore(x)-7]);
  group.add(groundRibbon(shoreline,18,-.1,'#e7d6ae'));
  const foam=shoreline.map(([x,z])=>[x,z+10]); group.add(groundRibbon(foam,1.1,-.24,'#cce6da'));
  // The harbor is a recognisable destination alongside the southern straight.
  for(const x of [-20,5,30]) {
    s.box(x,-.05,99,4,.45,26,'#aa8c65');
    for(const side of [-1,1])for(let z=89;z<113;z+=5)s.add('cylinder',x+side*1.8,.45,z,.18,1.5,.18,'#7f7058');
    s.add('rock',x+7,.05,102,2.3,.65,5,'#e9e1c9');s.box(x+7,.65,102,2.2,.8,2.5,'#faf0d9');
    s.box(x+7,1.4,101.8,.12,2.7,.12,'#7e8e7a');
  }
  // The lighthouse and its stone apron anchor each coastal circuit.
  const [lx,lz]=circuit.config.landmark||[110,100];
  s.add('cylinder',lx+4,-.1,lz,18,.22,18,'#d6c6a0');
  s.add('cylinder',lx,.1,lz,5,.35,5,'#c2b89b');
  s.add('cylinder',lx,6.1,lz,2.1,12,2.1,'#eee8d1');
  s.add('cylinder',lx,9,lz,2.14,1.3,2.14,'#d88666');
  s.add('cylinder',lx,12.7,lz,2.7,.35,2.7,'#647b70');
  s.add('cylinder',lx,13.7,lz,1.6,1.7,1.6,'#c4d7c9');
  s.add('cone',lx,15,lz,2.5,1.8,2.5,'#b96f52');
  s.box(lx,2,lz+2.12,.9,2,.09,'#58796e');
  house(s,lx+10,lz-1,6,3.7,Math.PI*.1);
  // A compact village fills the infield, with shutters, chimneys and terraces.
  const sites=[[6,45,6,5],[22,43,7,6],[39,41,6,5],[-15,32,6,5],[-10,8,7,6],[9,15,6,5],[15,-13,7,6],[-25,-18,6,4.5],[-34,42,5,4],[-1,-32,7,5.5],[31,36,6,4]];
  for(const [x,z,w,h] of sites)if(circuit.nearest(x,z).distance>w*.8+4){house(s,x,z,w,h,Math.floor(rng()*4)*Math.PI/2);s.box(x,0,z+7,w+3,.15,4,'#d5c9a6');}
  for(let i=0;i<360;i++) {
    const x=(rng()-.5)*420,z=(rng()-.5)*400;
    if(z>shore(x)-20||circuit.nearest(x,z).distance<14||Math.hypot(x-lx,z-lz)<19||Math.abs(x)<42&&z>-42&&z<48)continue;
    const scale=.65+rng()*.75;
    if(i%3===0) {s.add('cylinder',x,2*scale,z,.25*scale,4*scale,.25*scale,'#a38760');for(let j=0;j<4;j++){const a=j*Math.PI/2;s.add('rock',x+Math.sin(a)*1.5*scale,4.4*scale,z+Math.cos(a)*1.5*scale,2.2*scale,.3*scale,.9*scale,'#769a69',a);}}
    else pine(s,x,z,scale,i%2?'#63856b':'#82956a');
    if(i%5===0)s.add('rock',x+3,.7,z+2,2.5,1.2,1.8,'#c3bea5',rng()*6);
  }
  for(let x=-160;x<180;x+=13)s.add('rock',x,-.7,shore(x)+3,8,2.2,5,'#c4bda3',rng()*6);
}

const riverZ = x => 3 + Math.sin(x*.032)*13;

function forest(group,circuit,s,rng,state) {
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(1500,1500),groundMaterial(state));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;group.add(ground);
  const river=[];for(let x=-450;x<=450;x+=5)river.push([x,riverZ(x)]);
  group.add(groundRibbon(river,13,-.025,'#a5a481')); group.add(groundRibbon(river,9,-.012,'#6aaba9'));
  // Bridge planks and timber handrails at the actual river/road crossings.
  const crossings=[];
  for(let i=0;i<720;i++){
    const p=circuit.at(i/720);
    if(Math.abs(p.z-riverZ(p.x))<.8 && crossings.every(u=>Math.abs(u-i/720)>.05))crossings.push(i/720);
  }
  for(const u of crossings)for(let i=-7;i<=7;i++) {
    const p=circuit.at(u+i*.0015), width=circuit.widthAt(u);
    s.box(p.x,.046,p.z,width,.02,.66,'#b4a17b',p.heading);
    if(i%3===0)for(const side of [-1,1]){const q=circuit.at(u+i*.0015,side*(width/2+.6));s.box(q.x,.7,q.z,.24,1.5,.3,'#795e43',q.heading);}
  }
  for(const u of crossings)for(const side of [-1,1]) {const p=circuit.at(u,side*(circuit.widthAt(u)/2+.6));s.box(p.x,1.1,p.z,.18,.18,15,'#ab9066',p.heading);}
  // A red timber mill, stacked logs, a pond-side camp and a clearing.
  house(s,-9,-17,9,5.2,.08,true);house(s,6,-23,7,4.5,-.12,true);
  s.box(-4,.02,-27,29,.06,23,'#a79c78');
  for(let row=0;row<3;row++)for(let col=0;col<6;col++)s.add('cylinder',-13+col*.85,.6+row*.7,-28, .38,6,.38,'#9b7954',Math.PI/2,Math.PI/2);
  for(let i=0;i<7;i++)s.box(11+i*.8,.55,-31,.55,1.1,4.8,'#d2b78a');
  for(let i=0;i<2;i++){const x=-24+i*8,z=36;if(circuit.nearest(x,z).distance>10){s.add('cone',x,1.5,z,3,3,3,i?'#d5ae70':'#c68059',Math.PI/4);s.add('cylinder',x+4,.3,z+3,1.1,.3,1.1,'#776d50');}}
  for(let i=0;i<600;i++) {
    const x=(rng()-.5)*440,z=(rng()-.5)*440;
    if(circuit.nearest(x,z).distance<13||Math.abs(z-riverZ(x))<10||Math.abs(x)<27&&z>-44&&z<1)continue;
    const scale=.65+rng()*1.1;
    if(i%4)pine(s,x,z,scale,i%2?'#3e6553':'#55785e');
    else {s.add('cylinder',x,2*scale,z,.3,4*scale,.3,'#8f7554');for(let j=0;j<3;j++)s.add('rock',x+(j-1)*1.3,5*scale+j%2,z,2.8*scale,2.5*scale,2.7*scale,j%2?'#77916a':'#5e805e');}
    if(i%4===0)s.add('rock',x+2,.8,z+2,2,1.4,2.7,'#8b9981',rng()*6);
    if(i%5===0)s.add('rock',x-2,.25,z-2,2,.6,2,'#8ba26c');
  }
  for(let x=-130;x<=140;x+=12){const z=riverZ(x);s.add('rock',x,.2,z-6,2.5,.7,1.5,'#a7ad8d');s.add('rock',x+5,.2,z+6,1.6,.6,2,'#899b78');}
}

function openBiome(group,circuit,s,rng,state){
  const biome=BIOMES[state.biome],ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),groundMaterial(state));ground.rotation.x=-Math.PI/2;ground.position.y=-.06;ground.receiveShadow=true;group.add(ground);
  const bounds=new THREE.Box3().setFromPoints(circuit.samples),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  for(let i=0;i<440;i++){
    const x=center.x+(rng()-.5)*(size.x+180),z=center.z+(rng()-.5)*(size.z+180);
    if(circuit.nearest(x,z).distance<17)continue;
    const scale=.5+rng()*1.4;
    if(state.biome==='desert'){
      if(i%3===0)s.add('rock',x,.5,z,scale*4,scale*2.5,scale*3,biome.rock,rng()*6);
      if(i%11===0){s.add('cylinder',x,1.6,z,.35,3.2,.35,'#698363');s.add('cylinder',x+.6,2,z,.2,1.2,.2,'#698363');s.box(x+.35,1.5,z,.65,.22,.22,'#698363');}
    }else if(state.biome==='alpine'){
      if(i%2===0)s.add('rock',x,scale,z,scale*5,scale*4,scale*4,biome.rock,rng()*6);
      else pine(s,x,z,scale*.9,'#5a796c');
    }else if(state.biome==='autumn'){
      s.add('cylinder',x,2*scale,z,.25,4*scale,.25,'#7c644a');s.add('rock',x,5*scale,z,2.4*scale,2.7*scale,2.4*scale,['#b97036','#c59d4d','#9b693e'][i%3]);
    }else if(state.biome==='forest')pine(s,x,z,scale,i%2?'#3f6d51':'#63835a');
    else if(i%3===0){s.add('cylinder',x,1.8*scale,z,.24,3.6*scale,.24,'#8a7350');s.add('rock',x,4.6*scale,z,2.8*scale,2.5*scale,2.8*scale,i%2?'#789258':'#63884d');}
    else if(i%7===0)s.add('rock',x,.6,z,2,1.4,2.5,biome.rock);
  }
  for(let i=0;i<24;i++){
    const a=i/24*Math.PI*2,radius=Math.max(size.x,size.z)*.65+120,x=center.x+Math.sin(a)*radius,z=center.z+Math.cos(a)*radius;
    const hill=state.biome==='desert'?45:state.biome==='alpine'?100:28;
    s.add('rock',x,hill*.18,z,55+rng()*45,hill,65,biome.rock,rng()*6);
    if(state.biome==='alpine')s.add('rock',x,hill*.7,z,25,35,25,'#dfe5e0',rng()*6);
  }
}

export function buildEnvironment(group,circuit,state=trackEnvironment(circuit.config)) {
  if(state.biome==='workshop'){
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),mat('#8faaa1'));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;group.add(floor);
    const grid=new THREE.GridHelper(1000,100,'#7a9890','#91ada4');grid.position.y=-.07;group.add(grid);return;
  }
  const s=new Scenery(group),rng=seeded(circuit.config.id.length*251);
  if(state.biome==='coast')coast(group,circuit,s,rng,state);
  else if(state.biome==='forest'&&!circuit.layout)forest(group,circuit,s,rng,state);
  else openBiome(group,circuit,s,rng,state);
  // Low hills frame the diorama without covering the driving line.
  for(let i=0;i<18;i++) {
    const a=i/18*Math.PI*2,x=Math.cos(a)*300,z=Math.sin(a)*300;
    if(state.biome!=='coast'&&state.biome!=='forest'||state.biome==='coast'&&z>70)continue;
    s.add('rock',x,4,z,45,20+rng()*35,38,state.biome==='coast'?'#9ca78c':'#6d8978',rng()*6);
  }
  addEnvironmentTheme(group,circuit,s,rng,state);
  s.flush();
  buildGrass(group,circuit,state);
}
