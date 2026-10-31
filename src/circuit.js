import { CatmullRomCurve3, Vector3 } from 'three';
import { compileLayout } from './track-pieces.js';

class ModularCurve {
  constructor(layout) { this.layout=layout; }
  frame(u) {
    const data=this.layout,distance=Math.max(0,Math.min(1,u))*data.length,points=data.points;
    let low=0,high=points.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(points[mid].distance<=distance)low=mid;else high=mid;}
    const a=points[low],b=points[high],t=(distance-a.distance)/Math.max(1e-9,b.distance-a.distance);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,heading:a.heading+Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*t,grade:a.grade+(b.grade-a.grade)*t,bank:a.bank+(b.bank-a.bank)*t,width:a.width+(b.width-a.width)*t,section:t<1?a.section:b.section};
  }
  getPointAt(u){const p=this.frame(u);return new Vector3(p.x,p.y,p.z);}
  getTangentAt(u){const p=this.frame(u);return new Vector3(Math.sin(p.heading),p.grade,Math.cos(p.heading)).normalize();}
  getLength(){return this.layout.length;}
  getSpacedPoints(count){return Array.from({length:count+1},(_,i)=>this.getPointAt(i/count));}
}


/** Shared centerline for rendering, wall collisions, minimap and lap gates. */
export class Circuit {
  constructor(config) {
    this.config = config;
    this.closed=config.closed!==false;
    if(config.layout){
      this.layout=compileLayout(config.layout,config.width,config.startHeight||0);
      if(!this.layout.points.length)throw new Error('El montaje está vacío');
      this.closed=this.layout.closed;
      this.curve=new ModularCurve(this.layout);this.length=this.layout.length;
      this.count=Math.max(720,Math.ceil(this.length/.6));this.samples=this.curve.getSpacedPoints(this.count);
      return;
    }
    let points = config.points;
    // Round the authored control polygon so inner curbs never fold over themselves.
    for (let pass = 0; pass < (config.cornerSmoothing || 0); pass++) {
      const rounded = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        rounded.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      points = rounded;
    }
    this.curve = new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), true, 'centripetal');
    this.curve.arcLengthDivisions = 2048;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    this.count = 720;
    this.samples = this.curve.getSpacedPoints(this.count);
  }

  at(progress, offset = 0) {
    const u = this.closed ? ((progress % 1) + 1) % 1 : Math.max(0,Math.min(1,progress));
    const point = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u);
    const normal = new Vector3(tangent.z, 0, -tangent.x).normalize();
    const frame=this.layout?this.curve.frame(u):null;
    const grade=frame?.grade??tangent.y/Math.max(.001,Math.hypot(tangent.x,tangent.z)),bank=frame?.bank||0;
    point.addScaledVector(normal, offset);point.y+=Math.tan(bank)*offset;
    return { x: point.x, y:point.y, z: point.z, grade, bank, pitch:Math.atan(grade), heading: Math.atan2(tangent.x, tangent.z), tangent, normal };
  }

  widthAt(progress) {
    const u = this.closed?((progress % 1) + 1) % 1:Math.max(0,Math.min(1,progress)), profile = this.config.widthProfile;
    if(this.layout)return this.curve.frame(u).width;
    if (!profile) return this.config.width;
    for (let i = 1; i < profile.length; i++) {
      if (u <= profile[i][0]) {
        const a = profile[i - 1], b = profile[i];
        const t = (u - a[0]) / (b[0] - a[0]);
        const smooth = t * t * (3 - 2 * t);
        return this.config.width * (a[1] + (b[1] - a[1]) * smooth);
      }
    }
    return this.config.width;
  }

  surfaceAt(progress, override = 'track') {
    if (override !== 'track') return override;
    const u = this.closed?((progress % 1) + 1) % 1:Math.max(0,Math.min(1,progress));
    if(this.layout){const section=this.layout.sections[this.curve.frame(u).section];if(section?.spec.surface)return section.spec.surface;}
    return this.config.zones?.find(zone => u >= zone.from && u < zone.to)?.surface || this.config.surface;
  }

  nearest(x, z, options = {}) {
    let best = Infinity, bestX = 0, bestY = 0, bestZ = 0, bestDx = 0, bestDz = 1, bestProgress = 0, bestDistance=0;
    const difference=(a,b)=>{const d=Math.abs(a-b);return this.closed?Math.min(d,1-d):d;};
    for (let i = 0; i < this.count; i++) {
      const progress=(i+.5)/this.count;
      if(options.progress!=null&&difference(progress,options.progress)>(options.window??.08))continue;
      if(options.exclude!=null&&difference(progress,options.exclude)<(options.window??.07))continue;
      const a = this.samples[i], b = this.samples[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      const px = a.x + dx * t, pz = a.z + dz * t;
      const py=a.y+(b.y-a.y)*t,d2 = (x - px) ** 2 + (z - pz) ** 2;
      const score=d2+(options.y==null?0:(options.y-py)**2*.5);
      if (score < best) {
        best = score;bestDistance=d2;bestY=py;
        bestX = px; bestZ = pz; bestDx = dx; bestDz = dz; bestProgress = (i + t) / this.count;
      }
    }
    // Allocate once per query, rather than once for each improving candidate.
    const len = Math.hypot(bestDx, bestDz), nx = bestDz / len, nz = -bestDx / len;
    const frame=this.layout?this.curve.frame(bestProgress):null;
    const offset=(x-bestX)*nx+(z-bestZ)*nz;
    return { x: bestX, y: bestY+Math.tan(frame?.bank||0)*offset, z: bestZ, grade:frame?.grade||0, bank:frame?.bank||0, distance: Math.sqrt(bestDistance), offset: (x - bestX) * nx + (z - bestZ) * nz,
      nx, nz, tx: bestDx / len, tz: bestDz / len, progress: bestProgress };
  }
}
