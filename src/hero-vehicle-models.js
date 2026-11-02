import * as THREE from 'three';
import {AutomotiveBody,surface} from './automotive-body.js';
import {buildStarterVehicle} from './starter-vehicle-models.js';

export const HERO_DESIGNS={
  'c7-sport':{length:3.80,width:1.59,radius:.285,tireWidth:.235,wheelbase:2.28,track:1.355,sill:.155,fender:.105,splitSpokes:true,
    inspiration:'Corvette C7 · proporciones y paneles a partir de las cuatro vistas aportadas',
    stations:[[-1.90,.74,.60],[-1.79,.745,.64],[-1.45,.795,.63],[-1.14,.795,.625],[-.65,.749,.60],[0,.735,.58],[.65,.747,.55],[1.14,.79,.565],[1.52,.73,.48],[1.79,.64,.415],[1.90,.70,.45]],
    roof:[[-1.90,.605],[-1.46,.65],[-1.17,.76],[-.88,.965],[-.65,1.035],[-.22,1.04],[.12,1.015],[.32,.915],[.66,.625],[.85,.565],[1.20,.55],[1.60,.46],[1.90,.46]],
    windshield:[.73,.13,.84,.69],rearGlass:[-1.39,-.77,.78,.70]},
};

function mirrors(b,z,y,width=.80){
  const m=b.materials;
  for(const s of [-1,1]){
    b.beam([s*(width-.10),y-.045,z],[s*(width+.035),y,z-.025],.018,m.trim);
    b.sphere(s*(width+.075),y+.012,z-.028,.10,.042,.070,m.paint);
    b.box(s*(width+.08),y+.01,z-.087,.13,.048,.007,m.chrome,.014);
  }
}
function exhaust(b,x,y,z,r=.038){
  b.add(new THREE.CylinderGeometry(r,r,.105,24),b.materials.chrome,x,y,z,Math.PI/2);
  b.add(new THREE.CylinderGeometry(r*.76,r*.76,.006,24),b.materials.trim,x,y,z-.055,Math.PI/2);
}
function upperSeam(b,points){b.line(points.map(([x,z])=>[x,b.upper(x,z)+.003,z]),.0022,b.materials.trim);}
function sideSeam(b,side,points){b.line(points.map(([z,y])=>[side*b.side(y,z,.003),y,z]),.0022,b.materials.trim,false);}
function modernCabin(b,windows){
  b.upperGlass(...b.d.windshield);b.upperGlass(...b.d.rearGlass);
  for(const s of [-1,1])for(const points of windows)b.sideWindow(s,points);
}

function corvette(b){
  const m=b.materials;
  modernCabin(b,[ [[.62,.835],[.12,.715],[-.61,.715],[-.90,.905]], [[-.68,.728],[-.87,.75],[-1.13,.91],[-.94,.91]] ]);
  // Removable dark roof panel between the factory-painted rails.
  b.topPanel(-.66,.105,v=>.49,m.trim,.004);
  for(const s of [-1,1]){
    // Long, raked light housings, with a recessed projector and angular DRL.
    const lamp=[[s*.43,1.80],[s*.70,1.58],[s*.715,1.19],[s*.625,1.24],[s*.52,1.54]];
    b.topInset(lamp,m.trim,.006);
    const lens=lamp.map(([x,z])=>[x-s*.012,z-.004]);b.topInset(lens,m.headlights,.010);
    const led=[[s*.451,1.754],[s*.655,1.56],[s*.680,1.285]];b.line(led.map(([x,z])=>[x,b.upper(x,z)+.017,z]),.008,m.leds,false);
    b.sphere(s*.607,b.upper(s*.607,1.48)+.011,1.48,.039,.012,.048,m.chrome);
    // The C7's crossed gill behind the front wheel is part of the side mass.
    b.sideInset(s,[[.78,.57],[.34,.58],[.47,.31],[.69,.36]],m.trim,.008);
    b.sideInset(s,[[.70,.57],[.46,.57],[.59,.39],[.64,.40]],m.paint,.014);
    b.sideInset(s,[[.41,.29],[.16,.23],[-.79,.23],[-.57,.29]],m.trim,.007);
    sideSeam(b,s,[[.37,.58],[.30,.32],[.13,.24],[-.76,.24],[-.91,.59]]);
    b.box(s*.745,.612,-.72,.013,.025,.09,m.trim,.004);
    upperSeam(b,[[s*.425,.77],[s*.397,1.01],[s*.365,1.34],[s*.36,1.65],[s*.28,1.81]]);
    b.sideInset(s,[[-1.65,.59],[-1.37,.59],[-1.36,.55],[-1.68,.545]],m.trim,.006);
    // Four chamfered rear lamps rather than flat rectangular stickers.
    for(const x of [.37,.61]){
      const outline=[[s*(x-.105),.655],[s*(x+.09),.66],[s*(x+.105),.535],[s*(x+.025),.51],[s*(x-.105),.54]];
      b.fascia(outline,-1.916,m.trim,.014);
      const cx=s*x,cy=.588,inside=outline.map(([px,py])=>[cx+(px-cx)*.82,cy+(py-cy)*.78]);
      b.fascia(inside,-1.923,m.brakes,.010);
      const edge=inside.map(([px,py])=>[px,py,-1.926]);edge.push(edge[0]);b.line(edge,.006,m.brakes,false);
    }
    b.box(s*.62,.27,-1.923,.25,.026,.01,m.brakes,.004);
  }
  // Bonnet extractor: nested mouth, ribs and painted raised shoulders.
  b.topInset([[-.25,1.12],[.25,1.12],[.22,.90],[-.22,.90]],m.trim,.007);
  for(let j=0;j<5;j++){const z=.94+j*.033;b.line([[-.20,b.upper(-.20,z)+.012,z],[.20,b.upper(.20,z)+.012,z]],.004,m.grille,false);}
  b.fascia([[-.56,.435],[.56,.435],[.49,.266],[-.49,.266]],1.908,m.trim,.012);
  for(let j=0;j<5;j++)b.box(0,.29+j*.026,1.925,1.00,.005,.006,m.grille,.001);
  b.box(0,.257,1.905,1.35,.025,.065,m.trim,.008);
  b.fascia([[-.72,.43],[.72,.43],[.66,.18],[.25,.16],[-.25,.16],[-.66,.18]],-1.925,m.trim,.015);
  for(const x of [-.48,-.28,.28,.48])b.box(x,.238,-1.96,.018,.14,.10,m.trim,.003);
  for(const x of [-.135,-.045,.045,.135])exhaust(b,x,.235,-1.965);
  b.box(0,.445,-1.941,.28,.09,.014,m.trim,.005);
  // Small integrated trailing lip, with no oversized racing wing.
  b.add(surface((u,v)=>{const x=(u-.5)*1.42,z=-1.79-v*.10;return [x,.68+.018*Math.sin(u*Math.PI)+v*.025,z];},20,3),m.paint);
  mirrors(b,.38,.825,.715);
}

export function buildHeroVehicle(vehicle){
  const d=HERO_DESIGNS[vehicle.id];if(!d)return buildStarterVehicle(vehicle);
  const b=new AutomotiveBody(vehicle,d);b.shell();b.runningGear();
  if(vehicle.id==='c7-sport')corvette(b);
  return b.finish();
}
