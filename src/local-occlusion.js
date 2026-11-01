import * as THREE from 'three';

const LAYER=31,ATTRIBUTE='occlusionRoute',CLEARANCE=1.8,PROTECTED_ROUTE=24;

/** Road progress distinguishes the drivable branch from another deck above it. */
export function markPlayerOccluder(mesh,progress=-1){
  const count=mesh.isInstancedMesh?mesh.count:mesh.geometry.attributes.position.count;
  const values=typeof progress==='number'?new Float32Array(count).fill(progress):new Float32Array(progress);
  if(values.length!==count)throw new Error('Occlusion progress must match the geometry.');
  const Attribute=mesh.isInstancedMesh?THREE.InstancedBufferAttribute:THREE.BufferAttribute;
  mesh.geometry.setAttribute(ATTRIBUTE,new Attribute(values,1));
  mesh.userData.playerOccluder=true;return mesh;
}

export function isOverheadPoint(y,route,ground,progress,length,closed=true){
  if(y<=ground+CLEARANCE)return false;
  if(route<0)return true;
  let difference=Math.abs(route-progress);
  if(closed)difference=Math.min(difference,1-difference);
  return difference*length>PROTECTED_ROUTE;
}

const vertexHeader=`
attribute float occlusionRoute;
varying vec3 vOcclusionWorld;
varying float vOcclusionRoute;
`;
const worldVertex=`
#include <project_vertex>
vec4 occlusionWorld=vec4(transformed,1.0);
#ifdef USE_BATCHING
occlusionWorld=batchingMatrix*occlusionWorld;
#endif
#ifdef USE_INSTANCING
occlusionWorld=instanceMatrix*occlusionWorld;
#endif
vOcclusionWorld=(modelMatrix*occlusionWorld).xyz;
vOcclusionRoute=occlusionRoute;
`;
const fragmentHeader=`
varying vec3 vOcclusionWorld;
varying float vOcclusionRoute;
uniform vec4 uOcclusionRoute;
uniform vec2 uOcclusionCenter,uOcclusionForward,uOcclusionRadius;
uniform float uOcclusionAmount;
uniform vec3 uOcclusionRim;
bool isOcclusionOverhead(){
  float difference=abs(vOcclusionRoute-uOcclusionRoute.y);
  if(uOcclusionRoute.w>0.5)difference=min(difference,1.0-difference);
  return vOcclusionWorld.y>uOcclusionRoute.x+1.8 &&
    (vOcclusionRoute<0.0 || difference*uOcclusionRoute.z>24.0);
}
`;

/** Local transparency with a nearest-surface depth pass, never through an opaque deck. */
export class LocalOcclusion {
  constructor(){
    this.records=[];this.variants=new Map();this.strength=0;this.covered=false;this.elapsed=0;this.hold=0;this.ready=false;
    this.uniforms={uOcclusionRoute:{value:new THREE.Vector4()},uOcclusionCenter:{value:new THREE.Vector2()},
      uOcclusionForward:{value:new THREE.Vector2(0,1)},uOcclusionRadius:{value:new THREE.Vector2(1,1)},
      uOcclusionAmount:{value:0},uOcclusionRim:{value:new THREE.Color('#d6eee1')}};
    this.raycaster=new THREE.Raycaster();this.lastQuery=new THREE.Vector3(Infinity,Infinity,Infinity);
    this.position=new THREE.Vector3();this.forward=new THREE.Vector3();this.right=new THREE.Vector3();
    this.target=new THREE.Vector3();this.direction=new THREE.Vector3();this.projected=new THREE.Vector3();
    this.projectedAhead=new THREE.Vector3();this.projectedRight=new THREE.Vector3();this.bufferSize=new THREE.Vector2();
  }

  bind(root,circuit){
    this.clear();this.circuit=circuit;
    // Flat circuits keep the original single-draw rendering path and materials.
    this.enabled=Boolean(circuit.layout&&(circuit.layout.maxHeight-circuit.layout.minHeight>CLEARANCE ||
      circuit.layout.sections.some(s=>s.spec.kind==='tunnel')));
    if(!this.enabled)return;
    root.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.userData.playerOccluder)return;
      this.records.push({mesh,original:mesh.material,layers:mesh.layers.mask});
      mesh.layers.enable(LAYER);
    });
    this.meshes=this.records.map(record=>record.mesh);
  }

  reset(){this.strength=0;this.covered=false;this.elapsed=0;this.hold=0;this.ready=false;}

  invalidateMaterials(){
    for(const variants of this.variants.values())for(const material of Object.values(variants))material.dispose();
    this.variants.clear();
  }

  clear(){
    for(const record of this.records){record.mesh.material=record.original;record.mesh.layers.mask=record.layers;}
    this.invalidateMaterials();
    this.records=[];this.meshes=[];this.enabled=false;this.reset();
  }

  hitIsOverhead(hit,drive){
    const attribute=hit.object.geometry.getAttribute(ATTRIBUTE);
    const route=hit.instanceId!=null?attribute.getX(hit.instanceId):
      (attribute.getX(hit.face.a)+attribute.getX(hit.face.b)+attribute.getX(hit.face.c))/3;
    return isOverheadPoint(hit.point.y,route,drive.groundY??drive.y??0,drive.progress??drive.road?.progress??0,
      this.circuit.length,this.circuit.closed);
  }

  detect(camera,drive,width){
    const origin=camera.getWorldPosition(this.direction);
    // Probe the body and the next few metres, including both sides of the lane.
    for(const [ahead,side]of [[0,0],[7,0],[3,-width*.42],[3,width*.42],[0,1]]){
      this.target.copy(this.position).addScaledVector(this.forward,ahead).addScaledVector(this.right,side);
      this.projected.copy(this.target).sub(origin);
      const distance=this.projected.length();if(distance<.1)continue;
      this.raycaster.set(origin,this.projected.multiplyScalar(1/distance));this.raycaster.far=distance-.1;
      if(this.raycaster.intersectObjects(this.meshes,false).some(hit=>this.hitIsOverhead(hit,drive)))return true;
    }
    return false;
  }

  update(dt,drive,camera,renderer){
    if(!this.enabled||!this.records.length)return;
    const progress=drive.progress??drive.road?.progress??0,width=this.circuit.widthAt(progress);
    const speed=Math.hypot(drive.vx||0,drive.vz||0);
    this.forward.set(drive.vx||0,0,drive.vz||0);
    if(speed<.5)this.forward.set(Math.sin(drive.heading),0,Math.cos(drive.heading));
    this.forward.normalize();this.right.set(this.forward.z,0,-this.forward.x);
    this.position.set(drive.x,(drive.y||0)+.7,drive.z);
    camera.updateMatrixWorld();this.elapsed+=dt;
    if(!this.ready||this.elapsed>=.09||this.position.distanceToSquared(this.lastQuery)>4){
      this.covered=this.detect(camera,drive,width);this.lastQuery.copy(this.position);this.elapsed=0;
      if(!this.ready)this.strength=this.covered?1:0;
      this.ready=true;
    }
    this.hold=this.covered ? .22 : Math.max(0,this.hold-dt);
    this.strength=THREE.MathUtils.damp(this.strength,this.hold>0?1:0,9,Math.min(dt,.1));
    this.uniforms.uOcclusionAmount.value=this.strength;
    this.uniforms.uOcclusionRoute.value.set(drive.groundY??drive.y??0,progress,this.circuit.length,this.circuit.closed?1:0);
    renderer.getDrawingBufferSize(this.bufferSize);
    const w=this.bufferSize.x,h=this.bufferSize.y;
    this.target.copy(this.position).addScaledVector(this.forward,Math.min(3.2,2+speed*.03));
    this.projected.copy(this.target).project(camera);
    this.projectedAhead.copy(this.target).add(this.forward).project(camera);
    this.uniforms.uOcclusionCenter.value.set((this.projected.x*.5+.5)*w,(this.projected.y*.5+.5)*h);
    this.uniforms.uOcclusionForward.value.set((this.projectedAhead.x-this.projected.x)*w,(this.projectedAhead.y-this.projected.y)*h).normalize();
    this.direction.setFromMatrixColumn(camera.matrixWorld,0);
    this.projectedRight.copy(this.target).add(this.direction).project(camera);
    const pixelsPerMetre=Math.abs(this.projectedRight.x-this.projected.x)*w*.5;
    this.uniforms.uOcclusionRadius.value.set(Math.max(5.4,width*.67)*pixelsPerMetre,Math.min(13.5,9+speed*.1)*pixelsPerMetre);
  }

  variant(original){
    if(this.variants.has(original))return this.variants.get(original);
    const patch=(material,mode,inherit=false)=>{
      const compile=original.onBeforeCompile,key=original.customProgramCacheKey();
      material.onBeforeCompile=shader=>{
        if(inherit)compile.call(original,shader);
        Object.assign(shader.uniforms,this.uniforms);
        shader.vertexShader=vertexHeader+shader.vertexShader.replace('#include <project_vertex>',worldVertex);
        shader.fragmentShader=fragmentHeader+shader.fragmentShader.replace('#include <clipping_planes_fragment>',
          `#include <clipping_planes_fragment>\nif(${mode==='base'?'':'!'}isOcclusionOverhead())discard;`);
        if(mode==='reveal'){
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>',`
            #include <alphamap_fragment>
            vec2 point=gl_FragCoord.xy-uOcclusionCenter;
            vec2 side=vec2(uOcclusionForward.y,-uOcclusionForward.x);
            float distanceToWindow=length(vec2(dot(point,side)/uOcclusionRadius.x,dot(point,uOcclusionForward)/uOcclusionRadius.y));
            float opening=(1.0-smoothstep(.64,1.0,distanceToWindow))*uOcclusionAmount;
            float softContour=exp(-pow((distanceToWindow-.84)/.065,2.0))*uOcclusionAmount;
            diffuseColor.a*=mix(1.0,.035,opening);
          `).replace('#include <opaque_fragment>',`
            outgoingLight=mix(outgoingLight,uOcclusionRim,softContour*.18);
            #include <opaque_fragment>
          `);
        }
      };
      material.customProgramCacheKey=()=>`${key}/local-occlusion-v1/${mode}`;
      return material;
    };
    const base=patch(original.clone(),'base',true);
    const depth=patch(new THREE.MeshDepthMaterial({side:original.side,colorWrite:false,depthWrite:true}), 'depth');
    const reveal=patch(original.clone(),'reveal',true);
    reveal.transparent=true;reveal.depthWrite=false;reveal.depthFunc=THREE.EqualDepth;reveal.forceSinglePass=true;
    const variants={base,depth,reveal};this.variants.set(original,variants);return variants;
  }

  use(mode){
    for(const record of this.records){
      const select=material=>this.variant(material)[mode];
      record.mesh.material=Array.isArray(record.original)?record.original.map(select):select(record.original);
    }
  }

  render(renderer,scene,camera){
    if(!this.enabled||this.strength<.002){renderer.render(scene,camera);return;}
    const autoClear=renderer.autoClear,background=scene.background,layers=camera.layers.mask;
    const shadowAuto=renderer.shadowMap.autoUpdate;let shadowPending=renderer.shadowMap.needsUpdate;
    const lights=[];scene.traverse(object=>{if(object.isLight){lights.push([object,object.layers.mask]);object.layers.enable(LAYER);}});
    try{
      this.use('base');renderer.render(scene,camera);
      // The original depth shaders cast complete bridge shadows in the base pass.
      shadowPending=renderer.shadowMap.needsUpdate;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
      renderer.autoClear=false;scene.background=null;camera.layers.set(LAYER);
      this.use('depth');renderer.render(scene,camera);
      this.use('reveal');renderer.render(scene,camera);
    }finally{
      for(const record of this.records)record.mesh.material=record.original;
      for(const [light,mask]of lights)light.layers.mask=mask;
      camera.layers.mask=layers;scene.background=background;renderer.autoClear=autoClear;
      renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowPending;
    }
  }
}
