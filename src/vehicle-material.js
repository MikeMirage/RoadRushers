import { Color, MeshPhysicalMaterial, MeshDepthMaterial, RGBADepthPacking, NoColorSpace, SRGBColorSpace, ShaderChunk } from 'three';

const finishes={gloss:[.24,1,.12],satin:[.43,.4,.3],matte:[.72,.08,.6]};

/** Production atlas contract: body mask RGB = paint/brake/glass;
 * wheel mask RG = rim/rubber. Images are shared; uniforms belong to one car.
 * The source albedo has white paint, authored trim/glass and no reflections. */
export function createVehicleMaterial({role='body',baseColor,normal,orm,mask,emission,environment,instanced=false}={}) {
  if(!mask)throw new Error('Vehicle material needs its authored customization mask');
  for(const texture of [normal,orm,mask].filter(Boolean))texture.colorSpace=NoColorSpace;
  for(const texture of [baseColor,emission].filter(Boolean))texture.colorSpace=SRGBColorSpace;
  const body=role==='body';
  const material=new MeshPhysicalMaterial({
    name:`vehicle-atlas-${role}`,color:0xffffff,map:baseColor||null,normalMap:normal||null,
    aoMap:orm||null,roughnessMap:orm||null,metalnessMap:orm||null,roughness:1,metalness:1,
    clearcoat:body?1:0,clearcoatMap:body?mask:null,clearcoatRoughness:.12,
    clearcoatNormalMap:body?(normal||null):null,
    emissive:emission?0xffffff:0x000000,emissiveMap:emission||null,
    envMap:environment||null,envMapIntensity:1,
  });
  const uniforms={
    vehicleMask:{value:mask},vehicleTint:{value:new Color(body?'#045d91':'#252b31')},
    vehicleBrake:{value:0},vehiclePaintRoughness:{value:.24},vehicleSkin:{value:baseColor||mask},
    vehicleHasSkin:{value:0},vehicleWrap:{value:0},vehicleRubberRoughness:{value:.8},
    vehicleTireWidth:{value:1},vehicleTreadStrength:{value:1},
  };
  material.userData.vehicleAtlas={role,uniforms,instanced};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=`varying vec2 vVehicleUv;\nvarying vec3 vVehiclePosition;\nvarying vec3 vVehicleTint;\nvarying float vVehicleBrake;\nuniform vec3 vehicleTint;\nuniform float vehicleBrake;\n${instanced?'attribute float aBrake;\n':''}`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vVehicleUv=uv; vVehiclePosition=position;
      vVehicleTint=vehicleTint; vVehicleBrake=vehicleBrake;
      ${instanced?`vVehicleBrake=aBrake;
      #ifdef USE_INSTANCING_COLOR
        vVehicleTint=instanceColor;
      #endif`:''}`);
    if(!body){
      shader.vertexShader='uniform sampler2D vehicleMask;\nuniform float vehicleTireWidth;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        float vehicleVertexWidth=mix(1.,vehicleTireWidth,texture2D(vehicleMask,uv).g);
        objectNormal.x/=vehicleVertexWidth;
        #ifdef USE_TANGENT
          objectTangent.x*=vehicleVertexWidth;
        #endif`);
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
        transformed.x*=vehicleVertexWidth;
        #include <project_vertex>`);
    }
    shader.fragmentShader=`varying vec2 vVehicleUv;\nvarying vec3 vVehiclePosition;\nvarying vec3 vVehicleTint;\nvarying float vVehicleBrake;\nuniform sampler2D vehicleMask;\nuniform sampler2D vehicleSkin;\nuniform float vehicleHasSkin;\nuniform float vehicleWrap;\nuniform float vehiclePaintRoughness;\nuniform float vehicleRubberRoughness;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      vec3 vehicleRegion=texture2D(vehicleMask,vVehicleUv).rgb;
      vec3 vehiclePaint=vVehicleTint;
      ${body?`if(vehicleHasSkin>.5)vehiclePaint*=texture2D(vehicleSkin,vVehicleUv).rgb;
      if(vehicleWrap>.5){
        float stripe=step(.045,abs(vVehiclePosition.x))*(1.-step(.14,abs(vVehiclePosition.x)));
        vehiclePaint=mix(vehiclePaint,vec3(.012,.017,.023),stripe);
        if(vehicleWrap>1.5)vehiclePaint=mix(vehiclePaint,vec3(.8,.035,.012),1.-step(.018,abs(vVehiclePosition.x)));
      }`:''}
      diffuseColor.rgb*=mix(vec3(1.),vehiclePaint,vehicleRegion.r);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,${body?'vehiclePaintRoughness':'vehicleRubberRoughness'},vehicleRegion.${body?'r':'g'});`);
    if(body)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(2.0,.012,.003)*clamp(vVehicleBrake,0.,1.)*vehicleRegion.g;`);
    else {
      shader.fragmentShader='uniform float vehicleTreadStrength;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;',
        'mapN.xy *= normalScale * mix(1.,vehicleTreadStrength,vehicleRegion.g);'));
    }
  };
  material.customProgramCacheKey=()=>`vehicle-atlas-v1-${role}-${instanced?'instances':'single'}`;
  return material;
}

export function customizeVehicleMaterial(material,configuration={}) {
  const state=material.userData.vehicleAtlas;
  if(!state)throw new Error('Expected vehicle atlas material');
  const u=state.uniforms,body=state.role==='body';
  const tint=body?(configuration.paint||configuration.color):configuration.rimColor;
  if(tint)u.vehicleTint.value.set(tint);
  if(body&&configuration.finish){
    const [roughness,clearcoat,coatRoughness]=finishes[configuration.finish]||finishes.gloss;
    u.vehiclePaintRoughness.value=roughness;
    // Keep the clearcoat shader feature active even for matte finishes.
    material.clearcoat=clearcoat;material.clearcoatRoughness=coatRoughness;
  }
  if(body&&Object.hasOwn(configuration,'texture')){
    const texture=configuration.texture;
    if(texture&&u.vehicleSkin.value!==texture){texture.colorSpace=SRGBColorSpace;texture.flipY=false;texture.needsUpdate=true;u.vehicleSkin.value=texture;}
    u.vehicleHasSkin.value=texture?1:0;
  }
  if(body&&configuration.wrap)u.vehicleWrap.value={none:0,stripes:1,race:2}[configuration.wrap]||0;
  if(!body&&configuration.tire){
    u.vehicleRubberRoughness.value={street:.8,sport:.72,slick:.88}[configuration.tire]??.8;
    u.vehicleTireWidth.value={street:1,sport:1.055,slick:1.1}[configuration.tire]??1;
    u.vehicleTreadStrength.value={street:1,sport:.6,slick:0}[configuration.tire]??1;
  }
}

export function setVehicleMaterialBrake(material,amount) {
  const state=material.userData.vehicleAtlas;
  if(state)state.uniforms.vehicleBrake.value=Math.max(0,Math.min(1,amount));
}

/** Keep shadow silhouette consistent with the tire's masked width adjustment. */
export function createVehicleDepthMaterial(wheelMaterial){
  const uniforms=wheelMaterial.userData.vehicleAtlas.uniforms;
  const material=new MeshDepthMaterial({depthPacking:RGBADepthPacking});
  material.onBeforeCompile=shader=>{
    shader.uniforms.vehicleMask=uniforms.vehicleMask;shader.uniforms.vehicleTireWidth=uniforms.vehicleTireWidth;
    shader.vertexShader='uniform sampler2D vehicleMask;\nuniform float vehicleTireWidth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.x*=mix(1.,vehicleTireWidth,texture2D(vehicleMask,uv).g);`);
  };
  material.customProgramCacheKey=()=> 'vehicle-tire-depth-v1';return material;
}

/** Material.clone omits onBeforeCompile; always reconstruct this material. */
export function cloneVehicleMaterial(source,{instanced=false}={}) {
  const state=source.userData.vehicleAtlas;
  if(!state)throw new Error('Expected vehicle atlas material');
  const material=createVehicleMaterial({role:state.role,baseColor:source.map,normal:source.normalMap,
    orm:source.roughnessMap,mask:state.uniforms.vehicleMask.value,emission:source.emissiveMap,
    environment:source.envMap,instanced});
  for(const [name,u] of Object.entries(state.uniforms)){
    const target=material.userData.vehicleAtlas.uniforms[name];
    if(u.value?.isColor)target.value.copy(u.value);else target.value=u.value;
  }
  material.clearcoat=source.clearcoat;material.clearcoatRoughness=source.clearcoatRoughness;
  return material;
}
