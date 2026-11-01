import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** The default path renders straight to the canvas, without offscreen buffers. */
export class GameplayRenderer {
  constructor(renderer,scene,camera){Object.assign(this,{renderer,scene,camera,samples:0});this.size=new THREE.Vector2();}
  setGraphics({samples=0}){
    const count=Math.min(samples,this.renderer.capabilities.maxSamples);
    if(count===this.samples)return;
    this.composer?.dispose();this.output?.dispose();this.composer=null;this.samples=count;this.lastSize='';
    if(!count)return;
    const target=new THREE.WebGLRenderTarget(1,1,{samples:count});
    this.composer=new EffectComposer(this.renderer,target);
    this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.output=new OutputPass();this.composer.addPass(this.output);
  }
  render(dt){
    const renderer=this.renderer,autoReset=renderer.info.autoReset;
    renderer.info.autoReset=false;renderer.info.reset();
    if(this.composer){
      renderer.getSize(this.size);const ratio=renderer.getPixelRatio(),key=`${this.size.x},${this.size.y},${ratio}`;
      if(key!==this.lastSize){this.composer.setPixelRatio(ratio);this.composer.setSize(this.size.x,this.size.y);this.lastSize=key;}
      this.composer.render(dt);
    }else renderer.render(this.scene,this.camera);
    renderer.info.autoReset=autoReset;
  }
}
