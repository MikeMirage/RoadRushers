import * as THREE from 'three';
import { markPlayerOccluder } from './local-occlusion.js';

/** The same banked, elevated surface is used in the workbench and in the game. */
export function roadRibbon(circuit,from,to,height,material,range=[0,1]) {
  const positions=[],uvs=[],indices=[],progress=[],routes=[];
  for(const span of circuit.roadRanges(range)){
    const count=Math.max(2,Math.ceil(circuit.count*(span[1]-span[0]))),base=positions.length/3;
    for(let i=0;i<=count;i++){
      const u=span[0]+(span[1]-span[0])*i/count;
      for(const edge of [from,to]){
        const offset=typeof edge==='function'?edge(u):edge,p=circuit.at(u,offset);
        positions.push(p.x,p.y+height,p.z);uvs.push(offset/8,u*circuit.length/8);routes.push(u);
      }
      if(i<count){const n=base+i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);progress.push(span[0]+(span[1]-span[0])*(i+.5)/count);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.roadProgress=progress;
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;return markPlayerOccluder(mesh,routes);
}

export function trackStructures(circuit) {
  const group=new THREE.Group();if(!circuit.layout)return group;
  const deck=new THREE.MeshStandardMaterial({color:'#728a86',roughness:.85,side:THREE.DoubleSide});
  const positions=[],indices=[],routes=[];
  for(const side of [-1,1])for(const span of circuit.roadRanges()){
    const count=Math.max(2,Math.ceil(circuit.count*(span[1]-span[0])));
    for(let i=0;i<=count;i++){
      const u=span[0]+(span[1]-span[0])*i/count,p=circuit.at(u,side*(circuit.widthAt(u)/2+1));
      const n=positions.length/3;positions.push(p.x,p.y-.02,p.z,p.x,p.y-.65,p.z);routes.push(u,u);
      if(i<count)indices.push(n,n+2,n+1,n+1,n+2,n+3);
    }
  }
  const walls=new THREE.BufferGeometry();walls.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));walls.setIndex(indices);walls.computeVertexNormals();
  const edges=markPlayerOccluder(new THREE.Mesh(walls,deck),routes);edges.castShadow=edges.receiveShadow=true;group.add(edges);
  const bottom=roadRibbon(circuit,u=>-circuit.widthAt(u)/2-1,u=>circuit.widthAt(u)/2+1,-.65,deck);bottom.castShadow=true;group.add(bottom);
  const supports=[],beam=new THREE.Object3D();
  for(let distance=7;distance<circuit.length;distance+=12){
    const u=distance/circuit.length;if(!circuit.hasRoad(u))continue;const center=circuit.at(u);
    if(center.y<2.8)continue;
    for(const side of [-1,1]){
      const p=circuit.at(u,side*(circuit.widthAt(u)/2-.8));
      const lower=circuit.nearest(p.x,p.z,{exclude:u,window:.06});
      // Never place a pier in the lower carriageway.
      if(lower.distance<circuit.config.width/2+1.3&&p.y-lower.y>3)continue;
      const height=p.y-.65;beam.position.set(p.x,height/2-.04,p.z);beam.scale.set(.85,height,.85);beam.rotation.set(0,p.heading,0);beam.updateMatrix();supports.push(beam.matrix.clone());
    }
  }
  if(supports.length){const piers=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#c4c9b5',roughness:1}),supports.length);supports.forEach((m,i)=>piers.setMatrixAt(i,m));piers.castShadow=piers.receiveShadow=true;group.add(piers);}
  // Mark both solid lips without leaving a deck, rail, or support across the void.
  if(circuit.gaps.length){
    const markers=new THREE.Group();markers.name='jump-markers';
    const material=new THREE.MeshStandardMaterial({color:'#ffd85a',roughness:.8});
    for(const gap of circuit.gaps)for(const [u,sign] of [[gap.from,-1],[gap.to,1]]){
      const at=u+sign*.22/circuit.length,p=circuit.at(at),width=circuit.widthAt(at);
      const lip=new THREE.Mesh(new THREE.BoxGeometry(width,.06,.35),material);
      lip.name=sign<0?'takeoff-lip':'landing-lip';lip.position.set(p.x,p.y+.055,p.z);lip.rotation.set(-p.pitch,p.heading,0,'YXZ');markers.add(markPlayerOccluder(lip,at));
    }
    group.add(markers);
  }
  const tunnelMaterial=new THREE.MeshStandardMaterial({color:'#7a827e',roughness:.95}),portalMaterial=new THREE.MeshStandardMaterial({color:'#bdc3b1',roughness:.9});
  let tunnelCount=0;
  const tunnelSpans=[];
  for(const section of circuit.layout.sections){
    if(section.spec.kind!=='tunnel'&&!section.spec.tunnel)continue;
    const previous=tunnelSpans.at(-1);
    if(previous&&Math.abs(previous.to-section.from)<1e-6)previous.to=section.to;
    else tunnelSpans.push({from:section.from,to:section.to});
  }
  for(const span of tunnelSpans){
    const shell=new THREE.Group();shell.name='tunnel';
    const positions=[],indices=[],steps=Math.max(2,Math.ceil((span.to-span.from)/1.5));
    // Extrude an open-bottom concrete shell along the actual road, including bends.
    for(let i=0;i<=steps;i++){
      const u=(span.from+(span.to-span.from)*i/steps)/circuit.length,half=circuit.widthAt(u)/2;
      for(const [offset,height]of [[-half-1.55,0],[-half-1.55,5.4],[half+1.55,5.4],[half+1.55,0],[half+1,0],[half+1,4.8],[-half-1,4.8],[-half-1,0]]){
        const point=circuit.at(u,offset);positions.push(point.x,point.y+height,point.z);
      }
      if(i<steps)for(let j=0;j<8;j++){const a=i*8+j,b=i*8+(j+1)%8;indices.push(a,a+8,b,b,a+8,b+8);}
    }
    for(const ring of [0,steps*8])for(const [a,b,c,d]of [[0,1,6,7],[1,2,5,6],[2,3,4,5]]){
      const cap=[a,b,c,a,c,d].map(index=>ring+index);if(ring)cap.reverse();indices.push(...cap);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const roof=markPlayerOccluder(new THREE.Mesh(geometry,tunnelMaterial));roof.castShadow=roof.receiveShadow=true;shell.add(roof);
    for(const distance of [span.from,span.to]){
      const u=distance/circuit.length,p=circuit.at(u),width=circuit.widthAt(u),portal=new THREE.Mesh(new THREE.BoxGeometry(width+3.2,.45,.5),portalMaterial);
      portal.position.set(p.x,p.y+4.9,p.z);portal.rotation.y=p.heading;portal.castShadow=true;shell.add(markPlayerOccluder(portal));
    }
    group.add(shell);tunnelCount++;
  }
  if(!tunnelCount){tunnelMaterial.dispose();portalMaterial.dispose();}
  return group;
}

/** Existing curb positions and dimensions, shared unchanged by editor and gameplay. */
export function trackCurbs(circuit){
  const count=Math.floor(circuit.length/2.3),temp=new THREE.Object3D();
  const curbs=new THREE.InstancedMesh(new THREE.BoxGeometry(.65,.16,2.36),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.92}),count*2);
  const routes=new Float32Array(count*2),red=new THREE.Color('#bd2028'),white=new THREE.Color('#f4f3ed');
  for(let i=0;i<count;i++)for(let side=0;side<2;side++){
    const u=i/count,p=circuit.at(u,(side?1:-1)*(circuit.widthAt(u)/2+.07));
    temp.position.set(p.x,p.y+.09,p.z);temp.rotation.set(-p.pitch,p.heading,p.bank,'YXZ');
    const offset=(side?1:-1)*(circuit.widthAt(u)/2+.07),a=circuit.at(u-.5/count,offset),b=circuit.at(u+.5/count,offset);
    const angle=Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading));
    // Keep the authored band and cadence, but leave a joint instead of overlapping coplanar boxes.
    const length=Math.max(.05,Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)-.65*Math.abs(Math.sin(angle/2))-.015);
    const supported=circuit.hasRoad(u-1.2/circuit.length)&&circuit.hasRoad(u+1.2/circuit.length);
    temp.scale.set(supported?1:0,supported?1:0,supported?length/2.36:0);temp.updateMatrix();
    curbs.setMatrixAt(i*2+side,temp.matrix);curbs.setColorAt(i*2+side,i%2?red:white);routes[i*2+side]=u;
  }
  curbs.name='track-curbs';curbs.castShadow=true;curbs.receiveShadow=false;curbs.computeBoundingSphere();return markPlayerOccluder(curbs,routes);
}
