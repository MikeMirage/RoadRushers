import * as THREE from 'three';
import { setBrakeLights } from './vehicles.js';

function glowTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  for(const x of [83,173]){
    ctx.save();ctx.translate(x,75);ctx.scale(.68,1.25);
    const gradient=ctx.createRadialGradient(0,0,0,0,0,122);
    gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.22,'rgba(255,255,255,.65)');
    gradient.addColorStop(.58,'rgba(255,255,255,.18)');gradient.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gradient;ctx.fillRect(-130,-130,260,260);ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

/** Two luminous rear lenses and one pooled, projected gradient. No dynamic lights. */
export class BrakeEffects {
  constructor(scene, texture=glowTexture()) {
    const geometry=new THREE.PlaneGeometry(3.6,4.8,2,6);
    this.localPositions=geometry.attributes.position.array.slice();
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    this.glow=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({
      map:texture,color:'#ff1305',transparent:true,opacity:0,blending:THREE.AdditiveBlending,
      depthWrite:false,depthTest:true,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
    }));
    this.glow.name='brake-ground-glow';this.glow.frustumCulled=false;this.glow.visible=false;this.glow.renderOrder=2;
    scene.add(this.glow);this.materials=[];this.rearZ=-1.6;
  }
  bind(model) {setBrakeLights(this.materials,0);this.materials=model.brakeMaterials||[];this.rearZ=model.brakeRearZ??-1.6;this.reset();}
  reset() {setBrakeLights(this.materials,0);this.glow.visible=false;this.glow.material.opacity=0;}
  update(drive,circuit,running) {
    const amount=(running&&drive.braking) ? .5+.5*(drive.brake||0) : 0;
    setBrakeLights(this.materials,amount);
    const height=Math.max(0,(drive.y||0)-(drive.groundY??drive.y??0));
    this.glow.visible=amount>0&&height<2.5;
    if(!this.glow.visible)return;
    this.glow.material.opacity=.78*amount/(1+height*2);
    const fx=Math.sin(drive.heading),fz=Math.cos(drive.heading),root=circuit.at(drive.progress||0),positions=this.glow.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const lx=this.localPositions[i*3],lz=this.localPositions[i*3+1]+this.rearZ-1.9;
      const x=drive.x+lx*fz+lz*fx,z=drive.z-lx*fx+lz*fz;
      const along=(x-drive.x)*Math.sin(root.heading)+(z-drive.z)*Math.cos(root.heading);
      const p=circuit.at((drive.progress||0)+along*Math.hypot(1,root.grade)/circuit.length);
      const lateral=(x-p.x)*p.normal.x+(z-p.z)*p.normal.z;
      positions.setXYZ(i,x,p.y+Math.tan(p.bank)*lateral+.085,z);
    }
    positions.needsUpdate=true;
  }
}
