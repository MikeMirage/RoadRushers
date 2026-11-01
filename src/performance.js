/** Resolution changes affect only rendering, never the driving simulation. */
export class AdaptiveResolution {
  constructor(deviceRatio = 1,policy={maximum:Math.min(deviceRatio,2),minimum:Math.min(deviceRatio,1.5),adaptive:true}) {
    this.configure(policy);
  }
  configure({maximum,minimum=maximum,adaptive=true}){
    this.maximum=Math.max(.5,maximum);this.minimum=Math.max(.5,Math.min(minimum,this.maximum));this.adaptive=adaptive;
    this.ratio=this.maximum;
    this.elapsed = 0; this.frames = 0; this.slowWindows = 0; this.fastWindows = 0;
  }
  sample(dt) {
    if(!this.adaptive)return this.ratio;
    if (dt <= 0 || dt > 0.25) return this.ratio;
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 1.5) return this.ratio;
    const fps = this.frames / this.elapsed;
    this.slowWindows = fps < 48 ? this.slowWindows + 1 : 0;
    this.fastWindows = fps > 58 ? this.fastWindows + 1 : 0;
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

/** Opt-in local diagnostics: append ?stats=1 to compare rendering conditions. */
export class PerformanceStats {
  constructor() {
    this.elapsed = 0; this.frames = 0; this.samples = []; this.cpu = 0;
    if (new URLSearchParams(location.search).has('stats')) {
      this.output = document.createElement('output');
      this.output.id = 'performance-stats';
      this.output.setAttribute('aria-label', 'Estadísticas de rendimiento');
      this.output.style.cssText = 'position:fixed;left:28px;bottom:110px;z-index:30;padding:10px 13px;border:1px solid #d9ff8066;border-radius:6px;background:#142a22ed;color:#d9ff80;font:11px/1.6 monospace;white-space:pre;pointer-events:none';
      this.output.textContent = 'Midiendo rendimiento…';
      document.body.appendChild(this.output);
    }
  }

  sample(dt, cpuMs, renderer) {
    if (!this.output || dt <= 0 || dt > 0.5) return;
    this.elapsed += dt; this.frames++; this.cpu += cpuMs; this.samples.push(dt * 1000);
    if (this.elapsed < 1) return;
    this.samples.sort((a, b) => a - b);
    const p95 = this.samples[Math.min(this.samples.length - 1, Math.floor(this.samples.length * 0.95))];
    this.output.textContent = `${(this.frames / this.elapsed).toFixed(0)} FPS · p95 ${p95.toFixed(1)} ms · CPU ${(this.cpu / this.frames).toFixed(1)} ms\n${renderer.info.render.calls} llamadas · ${(renderer.info.render.triangles / 1000).toFixed(1)}k triángulos · DPR ${renderer.getPixelRatio().toFixed(2)}`;
    this.elapsed = 0; this.frames = 0; this.cpu = 0; this.samples.length = 0;
  }
}
