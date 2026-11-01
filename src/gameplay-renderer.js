import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

class GameplayScenePass extends RenderPass {
  constructor(scene,camera,draw){super(scene,camera);this.draw=draw;}
  render(renderer,writeBuffer,readBuffer){
    const autoClear=renderer.autoClear;
    renderer.setRenderTarget(this.renderToScreen?null:readBuffer);renderer.autoClear=this.clear;
    try{this.draw();}finally{renderer.autoClear=autoClear;}
  }
}

/** The default path renders straight to the canvas, without offscreen buffers. */
export class GameplayRenderer {
  constructor(renderer,scene,camera){Object.assign(this,{renderer,scene,camera,samples:0});this.size=new THREE.Vector2();}
  setOcclusion(occlusion){this.occlusion=occlusion;}
  drawScene(){if(this.occlusion)this.occlusion.render(this.renderer,this.scene,this.camera);else this.renderer.render(this.scene,this.camera);}
  setGraphics({samples=0}){
    const count=Math.min(samples,this.renderer.capabilities.maxSamples);
    if(count===this.samples)return;
    this.composer?.dispose();this.output?.dispose();this.composer=null;this.samples=count;this.lastSize='';
    if(!count)return;
    const target=new THREE.WebGLRenderTarget(1,1,{samples:count});
    this.composer=new EffectComposer(this.renderer,target);
    this.composer.addPass(new GameplayScenePass(this.scene,this.camera,()=>this.drawScene()));
    this.output=new OutputPass();this.composer.addPass(this.output);
  }
  render(dt){
    const renderer=this.renderer,autoReset=renderer.info.autoReset;
    renderer.info.autoReset=false;renderer.info.reset();
    if(this.composer){
      renderer.getSize(this.size);const ratio=renderer.getPixelRatio(),key=`${this.size.x},${this.size.y},${ratio}`;
      if(key!==this.lastSize){this.composer.setPixelRatio(ratio);this.composer.setSize(this.size.x,this.size.y);this.lastSize=key;}
      this.composer.render(dt);
    }else this.drawScene();
    renderer.info.autoReset=autoReset;
  }
}
