import * as THREE from 'three';
import {applyEnvironmentPbr} from './environment-assets.js';

/** Legacy foliage never competes visually with the scanned vegetation. Rock
 * masses retain their placement, but lose the twenty-face primitive surface. */
export function polishScenery(group){
  let stone=null,cylinder=null,cone=null;const previous=new Set();
  for(const mesh of group.children){
    if(mesh.userData.assetFallback){mesh.visible=false;continue;}
    const geometry=mesh.geometry;
    if(!geometry||!mesh.isInstancedMesh)continue;
    if(geometry.type==='IcosahedronGeometry'&&geometry.parameters.detail===0){
      if(!stone){stone=new THREE.IcosahedronGeometry(1,3);const positions=stone.attributes.position;
        for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=1+.085*Math.sin(x*9+y*5)*Math.cos(z*7-y*4);positions.setXYZ(i,x*r,y*r,z*r);}
        stone.normalizeNormals();stone.computeBoundingSphere();}
      previous.add(geometry);mesh.geometry=stone;mesh.userData.refinedScenery='stone';
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){m.flatShading=false;applyEnvironmentPbr(m,'rock_face_03',{repeat:[2,2],normalStrength:.45});}
    }else if(geometry.type==='CylinderGeometry'&&geometry.parameters.radialSegments<16){cylinder??=new THREE.CylinderGeometry(1,1,1,20);previous.add(geometry);mesh.geometry=cylinder;mesh.userData.refinedScenery='round';}
    else if(geometry.type==='ConeGeometry'&&geometry.parameters.radialSegments<16){cone??=new THREE.ConeGeometry(1,1,20);previous.add(geometry);mesh.geometry=cone;mesh.userData.refinedScenery='round';}
  }
  group.traverse(node=>{if(node.geometry)previous.delete(node.geometry);});previous.forEach(g=>g.dispose());
  return group;
}
