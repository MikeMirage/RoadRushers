import * as THREE from 'three';

/** The same banked, elevated surface is used in the workbench and in the game. */
export function roadRibbon(circuit,from,to,height,material,range=[0,1]) {
  const positions=[],uvs=[],indices=[],progress=[];
  for(const span of circuit.roadRanges(range)){
    const count=Math.max(2,Math.ceil(circuit.count*(span[1]-span[0]))),base=positions.length/3;
    for(let i=0;i<=count;i++){
      const u=span[0]+(span[1]-span[0])*i/count;
      for(const edge of [from,to]){
        const offset=typeof edge==='function'?edge(u):edge,p=circuit.at(u,offset);
        positions.push(p.x,p.y+height,p.z);uvs.push(offset/8,u*circuit.length/8);
      }
      if(i<count){const n=base+i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);progress.push(span[0]+(span[1]-span[0])*(i+.5)/count);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.roadProgress=progress;
  const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;return mesh;
}

export function trackStructures(circuit) {
  const group=new THREE.Group();if(!circuit.layout)return group;
  const deck=new THREE.MeshStandardMaterial({color:'#728a86',roughness:.85,side:THREE.DoubleSide});
  const positions=[],indices=[];
  for(const side of [-1,1])for(const span of circuit.roadRanges()){
    const count=Math.max(2,Math.ceil(circuit.count*(span[1]-span[0])));
    for(let i=0;i<=count;i++){
      const u=span[0]+(span[1]-span[0])*i/count,p=circuit.at(u,side*(circuit.widthAt(u)/2+1));
      const n=positions.length/3;positions.push(p.x,p.y-.02,p.z,p.x,p.y-.65,p.z);
      if(i<count)indices.push(n,n+2,n+1,n+1,n+2,n+3);
    }
  }
  const walls=new THREE.BufferGeometry();walls.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));walls.setIndex(indices);walls.computeVertexNormals();
  const edges=new THREE.Mesh(walls,deck);edges.castShadow=edges.receiveShadow=true;group.add(edges);
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
      lip.name=sign<0?'takeoff-lip':'landing-lip';lip.position.set(p.x,p.y+.055,p.z);lip.rotation.set(-p.pitch,p.heading,0,'YXZ');markers.add(lip);
    }
    group.add(markers);
  }
  const tunnelMaterial=new THREE.MeshStandardMaterial({color:'#7a827e',roughness:.95}),portalMaterial=new THREE.MeshStandardMaterial({color:'#bdc3b1',roughness:.9});
  let tunnelCount=0;
  for(const section of circuit.layout.sections.filter(s=>s.spec.kind==='tunnel')){
    const mid=circuit.at((section.from+section.to)/2/circuit.length),length=section.to-section.from,width=circuit.widthAt((section.from+section.to)/2/circuit.length),shell=new THREE.Group();
    shell.name='tunnel';shell.position.set(mid.x,mid.y,mid.z);shell.rotation.y=mid.heading;
    for(const side of [-1,1]){const wall=new THREE.Mesh(new THREE.BoxGeometry(.55,5.4,length),tunnelMaterial);wall.position.set(side*(width/2+1.25),2.7,0);wall.castShadow=wall.receiveShadow=true;shell.add(wall);}
    const roof=new THREE.Mesh(new THREE.BoxGeometry(width+3.1,.6,length),tunnelMaterial);roof.position.y=5.1;roof.castShadow=roof.receiveShadow=true;shell.add(roof);
    for(const sign of [-1,1]){const portal=new THREE.Mesh(new THREE.BoxGeometry(width+3.2,.45,.5),portalMaterial);portal.position.set(0,4.9,sign*length/2);portal.castShadow=true;shell.add(portal);}
    group.add(shell);tunnelCount++;
  }
  if(!tunnelCount){tunnelMaterial.dispose();portalMaterial.dispose();}
  return group;
}
