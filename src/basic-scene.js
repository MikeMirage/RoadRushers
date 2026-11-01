import * as THREE from 'three';

/** Shared neutral floor: one opaque draw, with derivative-antialiased grid lines. */
export function basicFloor(circuit) {
  const bounds=new THREE.Box3().setFromPoints(circuit.samples),center=bounds.getCenter(new THREE.Vector3());
  const size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.z,400)+1200;
  const material=new THREE.ShaderMaterial({
    lights:true,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.lights,{ground:{value:new THREE.Color('#8faaa1')},line:{value:new THREE.Color('#78958d')}}]),
    vertexShader:'varying vec2 gridPosition;\n'+THREE.ShaderLib.shadow.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\ngridPosition=(modelMatrix*vec4(transformed,1.0)).xz;'),
    fragmentShader:`uniform vec3 ground,line;varying vec2 gridPosition;
      #include <common>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      void main(){vec2 p=gridPosition/10.0;vec2 width=max(fwidth(p),vec2(.0001));
        vec2 distanceToLine=abs(fract(p-.5)-.5)/width;
        float grid=1.0-min(min(distanceToLine.x,distanceToLine.y),1.0);
        float fade=1.0-smoothstep(.04,.3,max(width.x,width.y));
        gl_FragColor=vec4(mix(ground,line,grid*fade*.55)*mix(.60,1.0,getShadowMask()),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(span,span),material);
  floor.name='basic-grid';floor.receiveShadow=true;floor.rotation.x=-Math.PI/2;floor.position.set(center.x,-.08,center.z);
  return floor;
}

export function disposeSceneGroup(group) {
  if(!group)return;
  const geometries=new Set(),materials=new Set();
  group.traverse(node=>{
    if(node.geometry)geometries.add(node.geometry);
    if(node.isInstancedMesh)node.dispose();
    for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);
  });
  geometries.forEach(value=>value.dispose());materials.forEach(value=>value.dispose());group.removeFromParent();
}
