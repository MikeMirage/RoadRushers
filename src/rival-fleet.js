import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { buildCollectionVehicle } from './vehicle-modeler.js';

/** All opponents share geometry: one instanced draw per car part, rather than per rival. */
export class RivalFleet {
  constructor(scene,session,glowTexture){
    this.scene=scene;this.session=session;this.group=new THREE.Group();this.group.name='rival-fleet';scene.add(this.group);
    const source=session.vehicle.design?buildCollectionVehicle(session.vehicle):buildVehicle(session.vehicle),count=session.rivals.length,ghost=session.interaction==='ghost';
    (source.wheels||[]).forEach((o,i)=>o.userData.raceRoll=i);(source.frontWheels||[]).forEach((o,i)=>o.userData.raceSteer=i);
    this.source=source;this.parts=[];this.materials=new Set();this.brakes=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
    const sources=[];source.group.traverse(o=>{if(o.isMesh)sources.push(o);});
    const materialCache=new Map();
    for(const part of sources){
      const paint=part.material.name==='exterior-paint'||part.name==='body';
      let material=materialCache.get(part.material);
      if(!material){
        material=part.material.clone();material.transparent=ghost||material.transparent;material.opacity=ghost ? .38 : material.opacity;material.depthWrite=!ghost&&!material.transparent;material.forceSinglePass=true;
        if(paint)material.color.set('#ffffff');
        if(part.name==='body'&&session.vehicle.id==='coda'){
          // Recolour the yellow palette region, preserving glass, trim and lights.
          material.onBeforeCompile=shader=>{
            shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
              vec3 palette=texture2D(map,vMapUv).rgb;
              bool paintPixel=palette.r>.2&&palette.g>.16&&palette.g>palette.b*1.35&&palette.r>palette.g*.9;
              diffuseColor.rgb=paintPixel?vColor.rgb*.88:palette;`);
          };
          material.customProgramCacheKey=()=>`rival-truck-paint-${ghost?'ghost':'solid'}`;
        }
        if((source.brakeMaterials||[]).includes(part.material)){
          material.onBeforeCompile=shader=>{
            shader.vertexShader='attribute float aBrake;\nvarying float vRaceBrake;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('void main() {','void main() {\nvRaceBrake=aBrake;');
            shader.fragmentShader='varying float vRaceBrake;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(2.0,0.012,0.003)*vRaceBrake;');
          };
          material.customProgramCacheKey=()=>`race-brakes-${ghost?'ghost':'solid'}`;
        }
        materialCache.set(part.material,material);this.materials.add(material);
      }
      if((source.brakeMaterials||[]).includes(part.material))part.geometry.setAttribute('aBrake',this.brakes);
      const mesh=new THREE.InstancedMesh(part.geometry,material,count);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.receiveShadow=true;
      mesh.castShadow=!ghost&&!material.transparent;
      if(paint)for(let i=0;i<count;i++){const color=new THREE.Color(session.rivals[i].color);if(session.vehicle.id==='coda')color.lerp(new THREE.Color('#ffffff'),.1);mesh.setColorAt(i,color);}
      this.parts.push(mesh);this.group.add(mesh);
    }
    this.actors=session.rivals.map(()=>{
      const model=source.group.clone(true),pose=new THREE.Group(),wheels=[],steering=[],nodes=[];pose.add(model);
      model.traverse(n=>{if(n.isMesh)nodes.push(n);if(n.userData.raceRoll!=null)wheels[n.userData.raceRoll]=n;if(n.userData.raceSteer!=null)steering[n.userData.raceSteer]=n;});
      return {pose,model,wheels,steering,nodes};
    });
    const shadowMaterial=new THREE.MeshBasicMaterial({color:'#18382c',transparent:true,opacity:ghost ? .06 : .13,depthWrite:false});
    this.shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(1.4,16),shadowMaterial,count);this.shadows.frustumCulled=false;this.group.add(this.shadows);this.materials.add(shadowMaterial);
    const glowMaterial=new THREE.MeshBasicMaterial({map:glowTexture,color:'#ff1305',transparent:true,opacity:ghost ? .28 : .65,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
    this.glows=new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6,4.8),glowMaterial,count);this.glows.frustumCulled=false;this.glows.renderOrder=2;this.group.add(this.glows);this.materials.add(glowMaterial);
    this.temp=new THREE.Object3D();this.color=new THREE.Color();
  }
  update(dt,alpha,running){
    const c=this.session.circuit,temp=this.temp;
    for(let i=0;i<this.actors.length;i++){
      const actor=this.actors[i],drive=this.session.rivals[i].drive.interpolated(alpha);
      actor.pose.position.set(drive.x,drive.y+.075,drive.z);actor.pose.rotation.y=drive.heading;
      actor.model.rotation.x=-(drive.pitch||0);actor.model.rotation.z=(drive.roll||0)+drive.steer*drive.speed*.003;
      actor.wheels.forEach(w=>w.rotation.x+=running?drive.speed*dt*3.3:0);actor.steering.forEach(w=>w.rotation.y=-drive.steer*.35);
      actor.pose.updateMatrixWorld(true);actor.nodes.forEach((node,j)=>this.parts[j].setMatrixAt(i,node.matrixWorld));
      this.brakes.setX(i,(running&&drive.braking) ? .5+.5*drive.brake : 0);
      temp.position.set(drive.x,drive.groundY+.095,drive.z);temp.rotation.set(-drive.pitch,drive.heading,drive.roll,'YXZ');temp.rotateX(-Math.PI/2);temp.scale.set(1,1.2,1);temp.updateMatrix();this.shadows.setMatrixAt(i,temp.matrix);
      const fx=Math.sin(drive.heading),fz=Math.cos(drive.heading),rear=(this.source.brakeRearZ??-1.6)-1.9,p=c.at(drive.progress+rear/c.length);
      temp.position.set(drive.x+fx*rear,p.y+.09,drive.z+fz*rear);temp.rotation.set(-p.pitch,drive.heading,p.bank,'YXZ');temp.rotateX(Math.PI/2);
      const amount=this.brakes.getX(i);temp.scale.setScalar(amount>0?1:0);temp.updateMatrix();this.glows.setMatrixAt(i,temp.matrix);this.glows.setColorAt(i,this.color.setScalar(amount/(1+Math.max(0,drive.y-drive.groundY)*2)));
    }
    this.parts.forEach(p=>p.instanceMatrix.needsUpdate=true);this.brakes.needsUpdate=true;this.shadows.instanceMatrix.needsUpdate=true;this.glows.instanceMatrix.needsUpdate=true;if(this.glows.instanceColor)this.glows.instanceColor.needsUpdate=true;
  }
  dispose(){
    this.group.removeFromParent();const geometries=new Set();this.group.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.isInstancedMesh)n.dispose();});geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.source.group.traverse(n=>n.material?.dispose());
  }
}
