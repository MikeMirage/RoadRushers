/** Resolution changes affect only rendering, never the driving simulation. */
export class AdaptiveResolution {
  constructor(deviceRatio = 1,policy={maximum:Math.min(deviceRatio,2),minimum:Math.min(deviceRatio,1.5),adaptive:true}) {
    this.configure(policy);
  }
  configure({maximum,minimum=maximum,adaptive=true,targetFPS=60}){
    this.maximum=Math.max(.5,maximum);this.minimum=Math.max(.5,Math.min(minimum,this.maximum));this.adaptive=adaptive;
    this.ratio=this.maximum;this.targetFPS=targetFPS;
    this.elapsed = 0; this.frames = 0; this.slowWindows = 0; this.fastWindows = 0;
  }
  sample(dt) {
    if(!this.adaptive)return this.ratio;
    if (dt <= 0 || dt > 0.25) return this.ratio;
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 1.5) return this.ratio;
    const fps = this.frames / this.elapsed;
    this.slowWindows = fps < this.targetFPS*.9 ? this.slowWindows + 1 : 0;
    this.fastWindows = fps > this.targetFPS*.97 ? this.fastWindows + 1 : 0;
    if (this.slowWindows >= 2) {
      this.ratio = Math.max(this.minimum, this.ratio - 0.15);
      this.slowWindows = 0;
    } else if (this.fastWindows >= 8) {
      this.ratio = Math.min(this.maximum, this.ratio + 0.1);
      this.fastWindows = 0;
    }
    this.elapsed = 0; this.frames = 0;
    return this.ratio;
  }
}

/** Compact FPS by default; detailed local diagnostics are opt-in. CPU measures JS submission. */
export class PerformanceStats {
  constructor() {
    this.reset();
    this.forced=new URLSearchParams(location.search).has('stats');
    this.setEnabled(false);
  }

  reset(){this.elapsed=0;this.frames=0;this.samples=[];this.cpu=0;}

  setEnabled(enabled,{detailed=false}={}) {
    this.detailed=this.forced||detailed;
    if(!(enabled||this.forced)){this.output?.remove();this.output=null;this.reset();return;}
    if (!this.output) {
      this.output=document.createElement('output');
      this.output.id='performance-stats';
      this.output.setAttribute('aria-label','Fotogramas por segundo');
      this.output.setAttribute('aria-live','off');
      this.output.textContent='— FPS';
      document.body.appendChild(this.output);
    }
    this.output.dataset.detailed=String(this.detailed);
    this.reset();
  }

  sample(dt,cpuMs,renderer) {
    if(!this.output||dt<=0||dt>.5)return;
    this.elapsed+=dt;this.frames++;
    if(this.detailed){this.cpu+=cpuMs;this.samples.push(dt*1000);}
    if(this.elapsed<1)return;
    const fps=this.frames/this.elapsed;
    if(this.detailed){
      this.samples.sort((a,b)=>a-b);
      const p95=this.samples[Math.min(this.samples.length-1,Math.floor(this.samples.length*.95))];
      this.output.textContent=`${fps.toFixed(0)} FPS · p95 ${p95.toFixed(1)} ms · CPU ${(this.cpu/this.frames).toFixed(1)} ms\n${renderer.info.render.calls} llamadas · ${(renderer.info.render.triangles/1000).toFixed(1)}k triángulos · DPR ${renderer.getPixelRatio().toFixed(2)}`;
    }else this.output.textContent=`${fps.toFixed(0)} FPS`;
    this.elapsed=0;this.frames=0;this.cpu=0;this.samples.length=0;
  }
}
