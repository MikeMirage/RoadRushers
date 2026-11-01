import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { normalizeEnvironment, solarPosition, sunDirection, BIOMES } from './environment-config.js';
import { updateBiomeMaterials } from './biome-shaders.js';

const grading={uniforms:{tDiffuse:{value:null},contrast:{value:1},saturation:{value:1},warmth:{value:0},tint:{value:0},vignette:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`
uniform sampler2D tDiffuse;uniform float contrast,saturation,warmth,tint,vignette;varying vec2 vUv;
void main(){vec4 src=texture2D(tDiffuse,vUv);vec3 c=src.rgb;
float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);
c=pow(max(c,vec3(.00001)),vec3(contrast));c*=vec3(1.0+warmth*.16,1.0+tint*.09,1.0-warmth*.16);
vec2 q=vUv-.5;c*=1.0-vignette*smoothstep(.16,.72,length(q));gl_FragColor=vec4(max(c,vec3(0)),src.a);}`};

export class EnvironmentSystem{
  constructor(renderer,scene,camera,sun,ambient){
    Object.assign(this,{renderer,scene,camera,sun,ambient});this.time=0;this.state=normalizeEnvironment();
    this.sky=new Sky();this.sky.name='procedural-sky';this.sky.scale.setScalar(4500);this.sky.frustumCulled=false;scene.add(this.sky);
    this.pmrem=new THREE.PMREMGenerator(renderer);
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:Math.min(2,renderer.capabilities.maxSamples)});
    this.composer=new EffectComposer(renderer,target);this.composer.addPass(new RenderPass(scene,camera));this.grade=new ShaderPass(grading);this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());
    this.size=new THREE.Vector2();this.lastSize='';
  }
  configure(input,circuit){
    this.state=normalizeEnvironment(input);const s=this.state,position=solarPosition(s),direction=sunDirection(position),day=THREE.MathUtils.smoothstep(position.elevation,-7,12);
    const bounds=new THREE.Box3().setFromPoints(circuit.samples),center=bounds.getCenter(new THREE.Vector3()),span=Math.min(320,Math.max(110,bounds.getSize(new THREE.Vector3()).length()*.65));
    this.sun.target.position.copy(center);this.sun.position.set(center.x+direction.x*250,center.y+direction.y*250,center.z+direction.z*250);
    this.sun.intensity=day*(3.5-s.clouds*2.4);this.sun.color.set(position.elevation<18?'#ffd0a1':'#fff2dc');
    this.sun.shadow.camera.left=-span;this.sun.shadow.camera.right=span;this.sun.shadow.camera.top=span;this.sun.shadow.camera.bottom=-span;this.sun.shadow.camera.far=750;this.sun.shadow.camera.updateProjectionMatrix();
    this.ambient.intensity=.95+day*(.78+s.clouds*.35);this.ambient.color.set(day>.3?'#d9e8ef':'#a0b5cf');this.ambient.groundColor.set(BIOMES[s.biome].ground);
    const u=this.sky.material.uniforms;u.sunPosition.value.set(direction.x,direction.y,direction.z);u.turbidity.value=2+s.fog*8+s.clouds*3;u.rayleigh.value=1.8;u.mieCoefficient.value=.004+s.fog*.012;
    if(u.cloudCoverage)u.cloudCoverage.value=s.clouds;if(u.cloudDensity)u.cloudDensity.value=.3+s.clouds*.6;if(u.cloudSpeed)u.cloudSpeed.value=.00001+s.wind*.000006;
    this.sky.visible=position.elevation>-9;
    const fogColor=new THREE.Color(BIOMES[s.biome].sky).lerp(new THREE.Color('#b8c3c3'),s.clouds*.6).lerp(new THREE.Color('#18263e'),1-day);
    if(position.elevation>0&&position.elevation<15)fogColor.lerp(new THREE.Color('#d2ad8e'),.3);
    this.fogDensity=.0009+s.fog*.009;this.scene.background=fogColor;this.scene.fog=new THREE.FogExp2(fogColor,this.fogDensity);
    this.scene.environmentIntensity=.012+day*.065;this.renderer.toneMappingExposure=s.exposure;
    for(const key of ['contrast','saturation','warmth','tint','vignette'])this.grade.uniforms[key].value=s[key];
    this.renderer.shadowMap.needsUpdate=true;this.solar=position;
  }
  refreshReflections(){
    if(this.state.quality==='mobile'&&this.environmentTarget)return;
    const scene=new THREE.Scene(),sky=this.sky.clone();sky.position.set(0,0,0);scene.add(sky);if(this.sky.material.uniforms.showSunDisc)this.sky.material.uniforms.showSunDisc.value=false;
    const target=this.pmrem.fromScene(scene,.04,.1,10000);if(this.sky.material.uniforms.showSunDisc)this.sky.material.uniforms.showSunDisc.value=true;
    this.scene.environment=target.texture;this.environmentTarget?.dispose();this.environmentTarget=target;
  }
  update(dt,landscape,inspectionDistance=0){
    this.time+=dt;const u=this.sky.material.uniforms;if(u.time)u.time.value=this.time;
    // Keep sky precision stable while cameras move through large modular tracks.
    this.sky.position.copy(this.camera.position);updateBiomeMaterials(landscape,this.state,this.time);
    // Preserve the same atmospheric readability when portrait inspection needs more distance.
    this.scene.fog.density=this.fogDensity*(inspectionDistance?Math.min(1,160/inspectionDistance):1);
  }
  setGraphics({samples,postProcessing}){
    const count=Math.min(samples,this.renderer.capabilities.maxSamples);
    for(const target of [this.composer.renderTarget1,this.composer.renderTarget2])if(target.samples!==count){target.dispose();target.samples=count;}
    this.postProcessing=postProcessing;
    this.grade.enabled=postProcessing;
  }
  render(dt){
    this.renderer.getSize(this.size);const ratio=this.renderer.getPixelRatio(),key=`${this.size.x},${this.size.y},${ratio}`;
    if(key!==this.lastSize){this.composer.setPixelRatio(ratio);this.composer.setSize(this.size.x,this.size.y);this.lastSize=key;}
    const autoReset=this.renderer.info.autoReset;this.renderer.info.autoReset=false;this.renderer.info.reset();this.composer.render(dt);this.renderer.info.autoReset=autoReset;
  }
}
