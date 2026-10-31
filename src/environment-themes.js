import * as THREE from 'three';
import { groundMaterial, waterMaterial, waterfallMaterial } from './biome-shaders.js';

/** Landmarks are original miniature interpretations, positioned outside the driving corridor. */
export function addEnvironmentTheme(group,circuit,s,rng,state){
  const bounds=new THREE.Box3().setFromPoints(circuit.samples),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const glows=[],object=new THREE.Object3D();
  const glow=(x,y,z,w,h,l,color,angle=0)=>{object.position.set(x,y,z);object.scale.set(w,h,l);object.rotation.set(0,angle,0);object.updateMatrix();glows.push([object.matrix.clone(),new THREE.Color(color)]);};
  const site=(u,side,extra,radius=3)=>{const p=circuit.at(u,side*(circuit.widthAt(u)/2+extra));return circuit.nearest(p.x,p.z).distance>circuit.widthAt(u)/2+radius?p:null;};
  const palm=(x,z,h=9)=>{s.add('cylinder',x,h/2,z,.35,h,.35,'#907254');for(let i=0;i<7;i++){const a=i/7*Math.PI*2;s.add('rock',x+Math.sin(a)*2,h+.5,z+Math.cos(a)*2,4.8,.35,1.4,'#557c44',a);}};
  const cabin=(p,color='#934e3a')=>{
    s.box(p.x,2,p.z,7,4,5,color,p.heading);for(const side of [-1,1])s.add('box',p.x+side*1.75,4.6,p.z,3.8,.3,6,'#e0e7df',p.heading,side*.45);
    glow(p.x,2.1,p.z+2.52,1.3,1.6,.05,'#ffd3a0');
  };
  if(state.theme==='grandprix'){
    for(const side of [-1,1])for(const u of [.08,.3,.58]){
      const p=site(u,side,18,9);if(!p)continue;
      for(let tier=0;tier<4;tier++)s.box(p.x,1+tier*.8,p.z+tier*1.6,23,.8,3.8,'#a9b4ac',p.heading);
      s.box(p.x,6,p.z+4,25,.3,10,'#d9e0d2',p.heading);
      for(let row=0;row<3;row++)for(let col=0;col<14;col++)s.box(p.x-10+col*1.5,2+row*.8,p.z+row*1.6,.8,.45,.7,col%3?'#4c796f':'#cfbc7f',p.heading);
    }
    for(const u of [.02,.12,.48,.62]){const p=site(u,-1,13,2);if(p){s.add('cylinder',p.x,6,p.z,.15,12,.15,'#a5b3b0');glow(p.x,12,p.z,3,.4,1,'#fff2d2',p.heading);}}
    for(let i=0;i<6;i++){const p=site(.82+i*.015,-1,17,5);if(p){s.box(p.x,2,p.z,6,4,8,i%2?'#b5bfb0':'#c6cbb8',p.heading);s.box(p.x,2,p.z+4.03,4,2,.06,'#4e6e72',p.heading);}}
  }
  if(state.theme==='woodland'||state.theme==='reunion'){
    for(let i=0;i<160;i++){
      const p=site(rng(),i%2?1:-1,5+rng()*24,2);if(!p)continue;
      const tropical=state.theme==='reunion',h=tropical?8+rng()*7:6+rng()*6;
      s.add('cylinder',p.x,h/2,p.z,.35,h,.35,'#695c43');
      for(let j=0;j<3;j++)s.add('rock',p.x+(j-1)*1.8,h+j%2,p.z,3.5,2.3,3.2,tropical?'#3e7048':'#497149');
      if(tropical&&i%4===0)palm(p.x+3,p.z+2,h*.75);
      for(let j=0;j<3;j++)s.add('rock',p.x+Math.sin(j*2.1)*2,.4,p.z+Math.cos(j*2.1)*2,2,.2,.45,'#568342',j*2.1);
    }
    if(state.theme==='reunion'){
      const p=site(.42,1,45,14);if(p){
        s.add('rock',p.x,10,p.z,18,23,10,'#535e57');
        const waterfall=new THREE.Mesh(new THREE.PlaneGeometry(3,19,1,12),waterfallMaterial(state));waterfall.position.set(p.x,10,p.z+9);group.add(waterfall);
        const pool=new THREE.Mesh(new THREE.CircleGeometry(9,40),waterMaterial(state));pool.rotation.x=-Math.PI/2;pool.position.set(p.x,-.02,p.z+12);group.add(pool);
        for(let i=0;i<6;i++)s.add('rock',p.x-12+i*4,1,p.z+17,3,2,2,'#58665a');
      }
    }
  }
  if(state.theme==='sahara'){
    const oasis=site(.53,1,45,18)||{x:center.x+size.x/2+55,z:center.z};
    const dune=new THREE.PlaneGeometry(Math.max(700,size.x+500),Math.max(700,size.z+500),64,64);dune.rotateX(-Math.PI/2);const a=dune.attributes.position;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i)+center.x,z=a.getZ(i)+center.z,road=circuit.nearest(x,z),roadMask=THREE.MathUtils.smoothstep(road.distance,circuit.widthAt(road.progress)/2+5,34),oasisMask=THREE.MathUtils.smoothstep(Math.hypot(x-oasis.x,z-oasis.z),18,35);
      const wave=Math.sin(x*.022+Math.sin(z*.011)*1.5)*Math.cos(z*.018)+Math.sin(x*.041+z*.025)*.35;
      a.setXYZ(i,x,-.065+Math.max(0,wave+.8)*11*roadMask*oasisMask,z);
    }
    dune.computeVertexNormals();const sand=new THREE.Mesh(dune,groundMaterial(state));sand.receiveShadow=true;group.add(sand);
    const pond=new THREE.Mesh(new THREE.CircleGeometry(13,48),waterMaterial(state));pond.rotation.x=-Math.PI/2;pond.scale.y=.68;pond.position.set(oasis.x,-.025,oasis.z);group.add(pond);
    for(let i=0;i<11;i++){const angle=i/11*Math.PI*2;palm(oasis.x+Math.sin(angle)*17,oasis.z+Math.cos(angle)*13,6+rng()*5);}
    for(let i=0;i<14;i++)s.add('rock',oasis.x+Math.sin(i)*22,1.5,oasis.z+Math.cos(i)*18,4,3,3,'#b18a5c',rng()*6);
  }
  if(state.theme==='norway'||state.theme==='pyrenees'){
    for(let i=0;i<32;i++){
      const p=site(i/32,i%2?1:-1,14+rng()*20,3);if(!p)continue;
      const snow=state.theme==='norway';s.add('cylinder',p.x,2,p.z,.25,4,.25,'#777269');
      s.add('cone',p.x,5,p.z,2.2,6,2.2,snow?'#c5d1ca':'#4c705b');s.add('cone',p.x,7,p.z,1.4,4.5,1.4,snow?'#e6e9e1':'#60775d');
      if(i%7===0)cabin({x:p.x+6,z:p.z,heading:p.heading},snow?'#a45644':'#a29d85');
    }
    if(state.theme==='norway'){
      const water=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(700,size.x+400),100),waterMaterial(state));water.rotation.x=-Math.PI/2;water.position.set(center.x,-.025,bounds.max.z+70);group.add(water);
      for(let i=0;i<15;i++)s.add('rock',center.x-230+i*34,8,bounds.max.z+130,32,32+rng()*30,30,'#aab7b4',rng()*6);
    }else{
      for(let i=0;i<100;i++){const p=circuit.at(i/100,-circuit.widthAt(i/100)/2-1.5);s.box(p.x,p.y-.35,p.z,.9,1.7,4,'#90938a',p.heading);}
    }
  }
  if(state.theme==='amalfi'){
    for(let i=0;i<30;i++){
      const p=site(i/30,-1,17+rng()*18,5);if(!p||p.z>65)continue;
      const terrace=1+Math.floor(rng()*4),h=4+rng()*7;
      s.add('rock',p.x,1,p.z,9,6,8,'#b5ad92');s.box(p.x,terrace+h/2,p.z,5,h,5,['#e1cba6','#d7ad8a','#d1be9f','#e8dfc5'][i%4],p.heading);
      s.box(p.x,terrace+h+.15,p.z,5.6,.3,5.6,'#b97f64',p.heading);
      for(let floor=0;floor<3;floor++)s.box(p.x,terrace+1.2+floor*2,p.z+2.55,1.2,1.25,.1,'#4a7774',p.heading);
      if(i%3===0)palm(p.x+5,p.z-4,6);
    }
    for(let i=0;i<45;i++){const p=site(i/45,1,1.9,0);if(p)s.box(p.x,p.y+.4,p.z,.7,.8,3,'#c6bfa9',p.heading);}
  }
  if(state.theme==='tokyo'||state.theme==='bund'){
    const tokyo=state.theme==='tokyo';
    for(let i=0;i<42;i++){
      const p=site(i/42,i%2?1:-1,24+rng()*45,8);if(!p)continue;const h=12+rng()*(tokyo?48:35),w=8+rng()*7;
      s.box(p.x,h/2,p.z,w,h,w,tokyo?'#4f6069':'#7c7f77',p.heading);
      for(let row=0;row<Math.min(12,Math.floor(h/3));row++)for(let col=0;col<4;col++)if(rng()>.25)glow(p.x-w*.32+col*w*.21,2+row*3,p.z+w*.51,w*.12,1.1,.04,tokyo?(i%3?'#a3d6e4':'#eebd9d'):'#f2d1a1');
      if(tokyo&&i%4===0){glow(p.x+w*.51,h*.6,p.z,.08,h*.45,2.2,i%8?'#67d7cd':'#d68cae');s.box(p.x,h+.3,p.z,2,.6,2,'#9fadb0');}
    }
    if(tokyo){
      for(const u of [.08,.32,.6,.85]){const p=circuit.at(u),w=circuit.widthAt(u);for(const side of [-1,1])s.box(p.x+Math.cos(p.heading)*side*(w/2+1.4),p.y+5.5,p.z-Math.sin(p.heading)*side*(w/2+1.4),.28,11,.28,'#9aa9a7',p.heading);s.box(p.x,p.y+10.5,p.z,w+3,.3,.4,'#98a7a6',p.heading);s.box(p.x,p.y+9.7,p.z,w*.6,1.2,.2,'#42776a',p.heading);glow(p.x,p.y+9.7,p.z+.13,w*.35,.12,.03,'#ddf3de',p.heading);}
    }else{
      const riverZ=bounds.max.z+90,river=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(900,size.x+500),110),waterMaterial(state));river.rotation.x=-Math.PI/2;river.position.set(center.x,-.025,riverZ);group.add(river);
      const x=center.x+30,z=riverZ+92;
      for(const side of [-1,1])s.add('cylinder',x+side*4,27,z,.8,54,.8,'#c4c4b5');s.add('rock',x,40,z,8,8,8,'#b6a7a5');s.add('rock',x,72,z,5.5,5.5,5.5,'#b7b4b4');s.add('cylinder',x,56,z,1.4,44,1.4,'#b9c2c0');s.add('cylinder',x,87,z,.45,24,.45,'#b9c2c0');glow(x,40,z+7.4,5,4,.1,'#df8bb9');
      for(let i=0;i<18;i++)s.box(x+35,2.5+i*5,z-9,17-i*.35,5,17-i*.35,'#748f9c',i*.09);
      for(let i=0;i<8;i++){const bx=center.x-80+i*20,bz=bounds.max.z+18;s.box(bx,9,bz,17,18,9,'#b4ad97');s.box(bx,19,bz,18,.8,10,'#d1c9b0');for(let c=0;c<4;c++)s.box(bx-6+c*4,8,bz-4.6,.5,14,.5,'#d0c7ad');glow(bx,8,bz-4.7,9,1,.05,'#e9c88c');}
    }
  }
  if(glows.length){const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'#ffffff'}),glows.length);mesh.name='architectural-lights';glows.forEach(([m,c],i)=>{mesh.setMatrixAt(i,m);mesh.setColorAt(i,c);});group.add(mesh);}
}
