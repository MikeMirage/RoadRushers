import { EXTRA_PIECES, MAX_TRACK_PIECES } from './track-library.js';
import { THEMED_LAYOUTS } from './track-presets.js';
import { themePreset } from './environment-config.js';
import { GAP_JUMPS,configureGapJump,jumpProfile } from './jump-pieces.js';
export { MAX_TRACK_PIECES, mirrorPiece } from './track-library.js';

/** Metres, +Y up, +Z forward. Every piece starts at (0,0,0), tangent +Z. */
export const PIECE_CATALOG = [
  {id:'straight-short',name:'Recta corta',family:'Rectas',kind:'straight',length:12,description:'Conector para ajustar distancias y preparar una curva.'},
  {id:'straight',name:'Recta estándar',family:'Rectas',kind:'straight',length:24,description:'Un tramo de referencia, con entrada y salida planas.'},
  {id:'straight-long',name:'Recta larga',family:'Rectas',kind:'straight',length:40,description:'Zona de velocidad y preparación de la siguiente maniobra.'},
  ...[['wide',40,'Abierta'],['medium',24,'Media'],['tight',12,'Cerrada']].flatMap(([key,radius,label])=>['left','right'].map(direction=>({id:`curve-${key}-${direction}`,name:`${label} 90° ${direction==='left'?'izq.':'dcha.'}`,family:'Curvas',kind:'curve',radius,angle:90,direction,description:radius===12?'Giro cerrado: exige anticipar el derrape.':`Radio de ${radius} m, con tangente continua en las conexiones.`}))),
  ...['left','right'].map(direction=>({id:`hairpin-${direction}`,name:`Horquilla 180° ${direction==='left'?'izq.':'dcha.'}`,family:'Curvas',kind:'curve',radius:12,angle:180,direction,description:'Retorno de 180° sin invertir el sentido de conducción.'})),
  ...['left','right'].map(direction=>({id:`curve-45-${direction}`,name:`Enlace 45° ${direction==='left'?'izq.':'dcha.'}`,family:'Curvas',kind:'curve',radius:24,angle:45,direction,description:'Medio giro de enlace para abrir diagonales y variar el trazado.'})),
  {id:'chicane',name:'Chicane enlazada',family:'Técnicos',kind:'chicane',length:40,amplitude:4.5,description:'Dos cambios de apoyo. Vuelve al mismo eje y orientación.'},
  {id:'bank-left',name:'Peralte 90° izq.',family:'Técnicos',kind:'curve',radius:24,angle:90,direction:'left',bank:.14,description:'Peralte progresivo de 8°; las dos conexiones quedan sin inclinación lateral.'},
  {id:'bank-right',name:'Peralte 90° dcha.',family:'Técnicos',kind:'curve',radius:24,angle:90,direction:'right',bank:-.14,description:'Peralte progresivo de 8°; las dos conexiones quedan sin inclinación lateral.'},
  {id:'ramp-up',name:'Rampa de subida',family:'Verticales',kind:'ramp',length:28,rise:6,description:'Sube 6 m. Transición suave desde y hacia una conexión horizontal.'},
  {id:'bridge',name:'Tablero de puente',family:'Verticales',kind:'bridge',length:24,description:'Tablero con espesor y apoyos. Se monta después de una subida, a 6 m o más.'},
  {id:'ramp-down',name:'Rampa de bajada',family:'Verticales',kind:'ramp',length:28,rise:-6,description:'Recupera 6 m de altura y termina en horizontal.'},
  {id:'bumps',name:'Badenes encadenados',family:'Relieve',kind:'bumps',length:30,height:.32,waves:3,description:'Tres ondulaciones físicas de 32 cm. Sin vibración artificial de cámara.'},
  {id:'jump',name:'Cresta de salto',family:'Relieve',kind:'bumps',length:16,height:1.4,waves:1,description:'Una cresta que descarga el coche y permite un salto según la velocidad.'},
  ...GAP_JUMPS,
  ...EXTRA_PIECES,
];
export const PIECE_FAMILIES=['Rectas','Curvas','Técnicos','Peraltes','Verticales','Espirales','Estructuras','Relieve','Anchuras','Superficies','Saltos'];
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const specOf=piece=>{
  const base=PIECE_CATALOG.find(p=>p.id===(typeof piece==='string'?piece:piece.id));
  if(!base)throw new Error('Tramo desconocido');
  const spec={...base};
  if(typeof piece==='object'){
    for(const key of ['length','radius','bank','rise','height','waves','amplitude','angle','widthFactorTo','launchLength','gapLength','landingLength'])if(piece[key]!=null)spec[key]=piece[key];
    if(piece.surface!=null){if(!['asphalt','gravel','dirt','ice','mud'].includes(piece.surface))throw new Error('Superficie de tramo no válida');spec.surface=piece.surface;}
    if(piece.tunnel!=null){if(typeof piece.tunnel!=='boolean')throw new Error('Cubierta de tramo no válida');spec.tunnel=piece.tunnel;}
    if(piece.mirrored){spec.direction=spec.direction==='left'?'right':'left';if(spec.amplitude)spec.amplitude*=-1;if(spec.bank)spec.bank*=-1;}
    if(spec.kind==='curve'&&(piece.radius!=null||piece.angle!=null))spec.name=`${Number(spec.angle.toFixed(3))}° · R${Number(spec.radius.toFixed(1))} ${spec.direction==='left'?'izq.':'dcha.'}`;
  }
  return spec.kind==='gap-jump'?configureGapJump(spec):spec;
};

export function samplePiece(piece, steps) {
  const spec=specOf(piece);
  if(!spec.kind)throw new Error('Tramo desconocido');
  const length=spec.kind==='curve'?spec.radius*spec.angle*Math.PI/180:spec.length;
  if(!Number.isFinite(length)||length<2||length>500||[spec.rise,spec.height,spec.bank,spec.amplitude,spec.waves,spec.angle,spec.widthFactorTo].some(v=>v!=null&&!Number.isFinite(v))||spec.radius!=null&&spec.radius<7||spec.angle!=null&&(spec.angle<=0||spec.angle>360)||Math.abs(spec.bank||0)>.6||Math.abs(spec.rise||0)>24||spec.widthFactorTo!=null&&(spec.widthFactorTo<.8||spec.widthFactorTo>2))throw new Error('Medidas de tramo no válidas');
  const count=steps??Math.max(24,Math.ceil(length/.45));
  if(!Number.isInteger(count)||count<2||count>8192)throw new Error('Muestreo de tramo no válido');
  const points=[];
  let samples=Array.from({length:count+1},(_,i)=>i/count);
  if(spec.kind==='gap-jump')samples=[...new Set([...samples,spec.launchLength/length,(spec.launchLength+spec.gapLength)/length])].sort((a,b)=>a-b);
  for(const u of samples){let x=0,y=0,z=length*u,heading=0,grade=0,bank=0;
    if(spec.kind==='curve'){
      const sign=spec.direction==='right'?-1:1,a=sign*spec.angle*Math.PI/180*u;
      x=sign*spec.radius*(1-Math.cos(a));z=sign*spec.radius*Math.sin(a);heading=a;
      bank=(spec.bank||0)*Math.sin(Math.PI*u)**2;
    }else if(spec.kind==='chicane'){
      const a=Math.PI*u;
      x=spec.amplitude*Math.sin(2*a)*Math.sin(a)**2;
      const dx=spec.amplitude*Math.PI*(2*Math.cos(2*a)*Math.sin(a)**2+Math.sin(2*a)*Math.sin(2*a));
      heading=Math.atan2(dx,length);
    }else if(spec.kind==='offset'){
      x=spec.amplitude*(10*u**3-15*u**4+6*u**5);
      heading=Math.atan2(spec.amplitude*30*u*u*(1-u)**2,length);
    }else if(spec.kind==='ramp'){
      y=spec.rise*(.5-.5*Math.cos(Math.PI*u));grade=spec.rise*Math.PI/2/length*Math.sin(Math.PI*u);
    }else if(spec.kind==='bumps'){
      const a=2*Math.PI*spec.waves*u;
      y=spec.height*(.5-.5*Math.cos(a));grade=spec.height*Math.PI*spec.waves/length*Math.sin(a);
    }
    if(spec.kind==='gap-jump')({y,grade}=jumpProfile(spec,z));
    if(['curve','offset'].includes(spec.kind)&&spec.rise){y=spec.rise*(.5-.5*Math.cos(Math.PI*u));grade=spec.rise*Math.PI/2/length*Math.sin(Math.PI*u);}
    points.push({x,y,z,heading,grade,bank});
  }
  let arcLength=0;const distances=[0];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];arcLength+=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);distances.push(arcLength);}
  const gaps=spec.kind==='gap-jump'?[{from:distances[points.findIndex(p=>Math.abs(p.z-spec.launchLength)<1e-7)],to:distances[points.findIndex(p=>Math.abs(p.z-spec.launchLength-spec.gapLength)<1e-7)]}]:[];
  return {spec,points,length:arcLength,advance:length,gaps};
}

export function compileLayout(pieces, width=10, baseHeight=0) {
  if(!Array.isArray(pieces)||pieces.length>MAX_TRACK_PIECES||!Number.isFinite(width)||width<6||width>24||!Number.isFinite(baseHeight))throw new Error('Montaje o anchura no válidos');
  const points=[],sections=[],gaps=[];let x=0,y=baseHeight,z=0,heading=0,total=0,currentWidth=width;
  for(const [index,piece]of pieces.entries()){
    const {spec,points:local,gaps:localGaps}=samplePiece(piece),begin=total;
    const c=Math.cos(heading),s=Math.sin(heading),targetWidth=spec.widthFactorTo?width*spec.widthFactorTo:currentWidth,startWidth=currentWidth;
    for(let i=0;i<local.length;i++){
      if(index&&i===0)continue;
      const p=local[i],u=i/(local.length-1),smooth=u*u*(3-2*u),q={x:x+p.x*c+p.z*s,y:y+p.y,z:z-p.x*s+p.z*c,heading:heading+p.heading,grade:p.grade,bank:p.bank,section:index,width:startWidth+(targetWidth-startWidth)*smooth};
      if(points.length){const last=points.at(-1);total+=Math.hypot(q.x-last.x,q.y-last.y,q.z-last.z);}
      q.distance=total;points.push(q);
    }
    const end=points.at(-1);
    sections.push({index,spec,from:begin,to:total,startHeight:y,endHeight:end.y,startWidth,endWidth:targetWidth});
    for(const gap of localGaps)gaps.push({from:begin+gap.from,to:begin+gap.to,section:index,launchFrom:begin,landingTo:total});
    x=end.x;y=end.y;z=end.z;heading=end.heading;currentWidth=targetWidth;
  }
  const gap=Math.hypot(x,z),heightGap=Math.abs(y-baseHeight),angleGap=Math.abs(wrap(heading));
  const closed=pieces.length>1&&gap<.08&&heightGap<.03&&angleGap<.003;
  let minHeight=Infinity,maxHeight=-Infinity,maxGrade=0,minRadius=Infinity;
  for(const p of points){minHeight=Math.min(minHeight,p.y);maxHeight=Math.max(maxHeight,p.y);maxGrade=Math.max(maxGrade,Math.abs(p.grade));}
  for(const section of sections)if(section.spec.kind==='curve')minRadius=Math.min(minRadius,section.spec.radius);
  const errors=[],warnings=[];
  if(!pieces.length)errors.push('Añade un primer tramo.');
  if(closed&&Math.abs(currentWidth-width)>.01)errors.push('La anchura final debe coincidir con la inicial; añade una transición a 10 m.');
  if(minHeight<-.02)errors.push('Hay tramos por debajo de la cota de salida.');
  if(maxGrade>.36)warnings.push('La pendiente supera el 36 %; puede provocar saltos.');
  if(sections.some(s=>s.spec.kind==='curve'&&s.spec.radius<Math.max(s.startWidth,s.endWidth)/2+1))errors.push('El radio interior no deja espacio para los bordes.');
  if(sections.some(s=>s.spec.kind==='bridge'&&s.startHeight<5.9))errors.push('El tablero de puente necesita una cota mínima de 6 m.');
  if(gaps.length)warnings.push(`${gaps.length===1?'Salto con hueco':'Saltos con hueco'}: necesitas velocidad para alcanzar el aterrizaje.`);
  const crossings=[];let overlap=false;
  // Spatial broad phase keeps editing long assemblies responsive.
  const pairs=[],cells=new Map(),cellSize=points.reduce((max,p)=>Math.max(max,p.width),width)*2;
  for(let i=0;i<points.length-1;i+=4){
    const a=points[i],b=points[Math.min(i+4,points.length-1)];
    if(gaps.some(g=>a.distance<g.to&&b.distance>g.from))continue;
    const pad=Math.max(a.width,b.width),seen=new Set();
    for(let gx=Math.floor((Math.min(a.x,b.x)-pad)/cellSize);gx<=Math.floor((Math.max(a.x,b.x)+pad)/cellSize);gx++)for(let gz=Math.floor((Math.min(a.z,b.z)-pad)/cellSize);gz<=Math.floor((Math.max(a.z,b.z)+pad)/cellSize);gz++){
      const key=`${gx},${gz}`,entries=cells.get(key)||[];for(const j of entries)if(i-j>=8&&!seen.has(j)){pairs.push([j,i]);seen.add(j);}entries.push(i);cells.set(key,entries);
    }
  }
  // Coarse segments are under 2 m long; actual crossing heights interpolate the same path.
  for(const [i,j]of pairs){
    const a=points[i],b=points[Math.min(i+4,points.length-1)],c=points[j],d=points[Math.min(j+4,points.length-1)];
    const separation=Math.abs(c.distance-a.distance);
    if(separation<width*2||(closed&&total-separation<width*2))continue;
    const rx=b.x-a.x,rz=b.z-a.z,sx=d.x-c.x,sz=d.z-c.z,den=rx*sz-rz*sx;
    const close=(p,q,r)=>{
      const dx=r.x-q.x,dz=r.z-q.z,t=Math.max(0,Math.min(1,((p.x-q.x)*dx+(p.z-q.z)*dz)/(dx*dx+dz*dz||1)));
      return Math.hypot(p.x-q.x-dx*t,p.z-q.z-dz*t)<((p.width||width)+(q.width||width))*.45&&Math.abs(p.y-q.y-(r.y-q.y)*t)<4;
    };
    if(close(a,c,d)||close(b,c,d)||close(c,a,b)||close(d,a,b))overlap=true;
    if(Math.abs(den)<1e-7)continue;
    const t=((c.x-a.x)*sz-(c.z-a.z)*sx)/den,v=((c.x-a.x)*rz-(c.z-a.z)*rx)/den;
    if(t<0||t>1||v<0||v>1)continue;
    const x=a.x+t*rx,z=a.z+t*rz,ay=a.y+(b.y-a.y)*t,by=c.y+(d.y-c.y)*v;
    if(crossings.some(p=>Math.hypot(p.x-x,p.z-z)<2))continue;
    const pa=(a.distance+(b.distance-a.distance)*t)/total,pb=(c.distance+(d.distance-c.distance)*v)/total;
    crossings.push({x,z,clearance:Math.abs(ay-by),upperY:Math.max(ay,by),lowerY:Math.min(ay,by),upperProgress:ay>by?pa:pb,lowerProgress:ay>by?pb:pa});
  }
  if(overlap&&!crossings.some(c=>c.clearance<4))errors.push('Dos tramos invaden el mismo espacio: sepáralos en planta o altura.');
  if(crossings.some(c=>c.clearance<4))errors.push('Un cruce necesita al menos 4 m de separación vertical.');
  return {points,sections,length:total,width,endWidth:currentWidth,closed,gap,heightGap,angleGap,minHeight,maxHeight,maxGrade,minRadius,crossings,errors,warnings,gaps};
}

export const KIT_PRESETS = [
  {id:'kit-club-v1',name:'Club técnico',description:'Dos horquillas y dos chicanes: practicar entrada, apoyo y salida.',pieces:['straight','chicane','straight','hairpin-right','straight','chicane','straight','hairpin-right']},
  {id:'kit-eight-v1',name:'Ocho elevado',description:'Un cruce real a 6 m: recta inferior, subida, tablero y bajada.',pieces:['straight-long','straight-long','curve-wide-left','curve-wide-left','curve-wide-left','ramp-up','bridge','ramp-down','curve-wide-right','curve-wide-right','curve-wide-right']},
  {id:'kit-rally-v1',name:'Rally de crestas',description:'Badenes, salto en recta, escapatoria de aterrizaje y chicane.',pieces:['straight','bumps',{id:'straight-short',length:6},'jump','straight','curve-medium-right','curve-medium-right',{id:'straight',length:30},'chicane',{id:'straight',length:30},'curve-medium-right','curve-medium-right']},
  {id:'kit-speedway-v2',name:'Speedway',description:'Rectas de 120 m y curvas de radio 64 m.',pieces:['straight-120','arc-64-90-right','arc-64-90-right','straight-120','arc-64-90-right','arc-64-90-right']},
  {id:'kit-granprix-v2',name:'Gran Premio',description:'Cuatro sectores con una S larga y enlaces de 30° + 60°.',pieces:Array.from({length:4},()=>['straight-32','sweep-left','arc-40-30-right','arc-24-60-right']).flat()},
  {id:'kit-mountain-v2',name:'Puerto elevado',description:'Subida y bajada de 6 m con dos cotas y curvas amplias.',pieces:['ramp-up-6','straight-64','curve-wide-right','curve-wide-right','ramp-down-6','straight-64','curve-wide-right','curve-wide-right']},
  {id:'kit-gallery-v2',name:'Galerías',description:'Dos galerías de 48 m conectadas por grandes retornos.',pieces:['straight-64','tunnel-48','arc-64-180-right','straight-64','tunnel-48','arc-64-180-right']},
  {id:'kit-mixed-v2',name:'Club mixto',description:'Asfalto, grava y tierra con cambios de anchura y agarre.',pieces:['width-14','surface-gravel-24','width-10','hairpin-right','width-14','surface-dirt-24','width-10','hairpin-right']},
  ...THEMED_LAYOUTS,
  {id:'kit-jump-school-v3',name:'Escuela de saltos',description:'Un salto con hueco de 6 m, recta de aceleración y recepción separada.',pieces:['straight-64','gap-jump-short','straight-32','arc-64-180-right',{id:'straight',length:132},'arc-64-180-right']},
];

export function kitConfig(pieces,name='Mi montaje',id) {
  const signature='kit-v2:'+JSON.stringify(pieces);let hash=2166136261;
  for(const c of signature)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return {id:id||`kit-${(hash>>>0).toString(16)}`,name,subtitle:'Montaje modular · Banco de tramos',region:'KIT DE TRAMOS',difficulty:'Modular',biome:'workshop',width:10,surface:'asphalt',weather:'clear',zones:[],ground:'#8faaa1',sky:'#ccdcd7',layout:pieces,closed:true};
}

export function presetConfig(preset){
  const config=kitConfig(preset.pieces,preset.name,preset.id);if(!preset.environmentTheme)return config;
  const visual=themePreset(preset.environmentTheme);
  return {...config,biome:visual.biome,environmentTheme:preset.environmentTheme,weather:visual.weather,surface:preset.environmentTheme==='reunion'?'mud':'asphalt'};
}
