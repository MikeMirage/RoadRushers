import * as THREE from 'three';
import { animateVehicle } from './vehicle-pose.js';
import { cloneVehicleMaterial, createVehicleDepthMaterial } from './vehicle-material.js';
import { selectVehicleLOD, vehicleProjectedDiameter } from './vehicle-lod.js';

function instanceGeometry(source,brakes){
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
  geometry.setIndex(source.index);geometry.groups=source.groups.map(g=>({...g}));
  geometry.boundingBox=source.boundingBox?.clone()||null;geometry.boundingSphere=source.boundingSphere?.clone()||null;
  geometry.setAttribute('aBrake',brakes);return geometry;
}
function releaseInstanceGeometry(geometry){
  // Attributes/index are borrowed from the asset cache. Detach them before
  // disposing the wrapper so Three does not delete another car's GPU buffers.
  for(const name of Object.keys(geometry.attributes))if(name!=='aBrake')geometry.deleteAttribute(name);
  geometry.setIndex(null);geometry.dispose();
}

/** One instanced draw per primitive and occupied LOD bucket, never per rival. */
export class ProductionRivalFleet {
  constructor(scene,session,glowTexture,source){
    this.scene=scene;this.session=session;this.source=source;this.group=new THREE.Group();this.group.name='rival-fleet';scene.add(this.group);
    this.parts=[];this.materials=new Set();this.buckets={};
    const count=session.rivals.length,ghost=session.interaction==='ghost';
    const sphere=new THREE.Box3().setFromObject(source.representations.race.group).getBoundingSphere(new THREE.Sphere());
    this.radius=sphere.radius;this.center=sphere.center;
    for(const [quality,model]of Object.entries(source.representations)){
      const brakes=new THREE.InstancedBufferAttribute(new Float32Array(count),1).setUsage(THREE.DynamicDrawUsage);
      const nodes=[];model.group.traverse(o=>{if(o.isMesh)nodes.push(o);});
      const cache=new Map(),depthCache=new Map(),parts=[];
      for(const node of nodes){
        let material=cache.get(node.material);
        if(!material){
          material=cloneVehicleMaterial(node.material,{instanced:true});material.envMap=scene.userData.vehicleEnvironment||material.envMap;
          material.transparent=ghost;material.opacity=ghost ? .38 : 1;material.depthWrite=!ghost;material.forceSinglePass=true;
          cache.set(node.material,material);this.materials.add(material);
        }
        const mesh=new THREE.InstancedMesh(instanceGeometry(node.geometry,brakes),material,count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=!ghost;mesh.receiveShadow=true;
        const paint=material.userData.vehicleAtlas.role==='body';
        if(!paint){
          if(!depthCache.has(material)){const depth=createVehicleDepthMaterial(material);depthCache.set(material,depth);this.materials.add(depth);}
          mesh.customDepthMaterial=depthCache.get(material);
        }
        if(paint)for(let i=0;i<count;i++)mesh.setColorAt(i,new THREE.Color(session.rivals[i].color));
        parts.push({mesh,paint});this.parts.push(mesh);this.group.add(mesh);
      }
      this.buckets[quality]={brakes,parts,count:0};
    }
    this.actors=session.rivals.map(()=>{
      const pose=new THREE.Group(),representations={};
      for(const [quality,model]of Object.entries(source.representations)){
        const group=model.group.clone(true);group.visible=true;pose.add(group);
        const nodes=[];group.traverse(o=>{if(o.isMesh)nodes.push(o);});
        representations[quality]={nodes,animation:{group,bodyRig:group.getObjectByName(model.bodyRig.name),
          wheels:model.wheels.map(w=>group.getObjectByName(w.name)),frontWheels:model.frontWheels.map(w=>group.getObjectByName(w.name)),
          wheelRadius:model.wheelRadius,visualScale:model.visualScale,restBodyY:model.restBodyY,
          customization:{rideHeight:model.customization.rideHeight}}};
      }
      return {pose,representations,quality:'race'};
    });
    const shadowMaterial=new THREE.MeshBasicMaterial({color:'#18382c',transparent:true,opacity:ghost ? .06 : .13,depthWrite:false});
    this.shadows=new THREE.InstancedMesh(new THREE.CircleGeometry(1.4,16),shadowMaterial,count);this.shadows.frustumCulled=false;this.group.add(this.shadows);this.materials.add(shadowMaterial);
    const glowMaterial=new THREE.MeshBasicMaterial({map:glowTexture,color:'#ff1305',transparent:true,opacity:ghost ? .28 : .65,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
    this.glows=new THREE.InstancedMesh(new THREE.PlaneGeometry(3.6,4.8),glowMaterial,count);this.glows.frustumCulled=false;this.glows.renderOrder=2;this.group.add(this.glows);this.materials.add(glowMaterial);
    this.temp=new THREE.Object3D();this.color=new THREE.Color();this.worldCenter=new THREE.Vector3();
  }
  update(dt,alpha,running,camera,viewportHeight){
    const c=this.session.circuit,temp=this.temp;
    for(const bucket of Object.values(this.buckets))bucket.count=0;
    for(let i=0;i<this.actors.length;i++){
      const actor=this.actors[i],rival=this.session.rivals[i],drive=rival.drive.interpolated(alpha);
      actor.pose.position.set(drive.x,drive.y+.075,drive.z);actor.pose.rotation.y=drive.heading;
      for(const level of Object.values(actor.representations))animateVehicle(level.animation,drive,dt,running);
      actor.pose.updateMatrixWorld(true);
      if(camera){
        this.worldCenter.copy(this.center).applyMatrix4(actor.pose.matrixWorld);
        actor.quality=selectVehicleLOD(vehicleProjectedDiameter(camera,this.worldCenter,this.radius,viewportHeight),actor.quality);
      }
      const bucket=this.buckets[actor.quality],slot=bucket.count++,nodes=actor.representations[actor.quality].nodes;
      const brake=running&&drive.braking ? .5+.5*drive.brake : 0;
      this.color.set(rival.color);
      nodes.forEach((node,j)=>{const part=bucket.parts[j];part.mesh.setMatrixAt(slot,node.matrixWorld);if(part.paint)part.mesh.setColorAt(slot,this.color);});
      bucket.brakes.setX(slot,brake);
      temp.position.set(drive.x,drive.groundY+.095,drive.z);temp.rotation.set(-drive.pitch,drive.heading,drive.roll,'YXZ');temp.rotateX(-Math.PI/2);temp.scale.set(1,1.2,1);temp.updateMatrix();this.shadows.setMatrixAt(i,temp.matrix);
      const fx=Math.sin(drive.heading),fz=Math.cos(drive.heading),rear=(this.source.brakeRearZ??-1.6)-1.9,p=c.at(drive.progress+rear/c.length);
      temp.position.set(drive.x+fx*rear,p.y+.09,drive.z+fz*rear);temp.rotation.set(-p.pitch,drive.heading,p.bank,'YXZ');temp.rotateX(Math.PI/2);
      temp.scale.setScalar(brake>0?1:0);temp.updateMatrix();this.glows.setMatrixAt(i,temp.matrix);this.glows.setColorAt(i,this.color.setScalar(brake/(1+Math.max(0,drive.y-drive.groundY)*2)));
    }
    for(const bucket of Object.values(this.buckets)){
      for(const {mesh}of bucket.parts){mesh.count=bucket.count;mesh.visible=bucket.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
      bucket.brakes.needsUpdate=true;
    }
    this.shadows.instanceMatrix.needsUpdate=true;this.glows.instanceMatrix.needsUpdate=true;if(this.glows.instanceColor)this.glows.instanceColor.needsUpdate=true;
  }
  dispose(){
    this.group.removeFromParent();
    for(const part of this.parts){part.dispose();releaseInstanceGeometry(part.geometry);}
    for(const mesh of [this.shadows,this.glows]){mesh.dispose();mesh.geometry.dispose();}
    this.materials.forEach(m=>m.dispose());this.source.dispose();
  }
}
