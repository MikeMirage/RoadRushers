import { NEW_VEHICLES } from './vehicle-catalog.js';
import { vehicleStats } from './vehicle-performance.js';

export const TRACKS = [
  {
    id: 'puerto', name: 'Curvas del Puerto', subtitle: 'La chicane del mercado y la curva del muelle', region: 'COSTA · 01',
    cornerSmoothing: 2, biome: 'coast', difficulty: 'Técnico', width: 11.5, surface: 'asphalt', weather: 'clear',
    points: [[0,66],[39,66],[65,52],[73,29],[54,13],[40,-2],[53,-23],[38,-48],[5,-57],[-37,-52],[-66,-28],[-62,5],[-37,17],[-42,40],[-25,63]],
    widthProfile: [[0,1],[0.16,0.95],[0.3,0.8],[0.48,1],[0.65,0.9],[0.8,0.85],[1,1]],
    zones: [{from:0.63,to:0.78,surface:'gravel'}],
    ground: '#b4bc8b', sky: '#cadfdc', accent: '#eec591',
    landmark: [-68,65], medals: { gold: 31, silver: 41, bronze: 62 },
  },
  {
    id: 'aserradero', name: 'Lazos del Aserradero', subtitle: 'Puentes, grava y curvas que se preparan antes', region: 'BOSQUE · 02',
    cornerSmoothing: 2, biome: 'forest', difficulty: 'Mixto', width: 12, surface: 'asphalt', weather: 'clear',
    points: [[0,66],[38,66],[68,45],[70,17],[43,5],[29,-15],[54,-32],[42,-62],[2,-73],[-39,-61],[-66,-38],[-63,-8],[-36,4],[-51,29],[-37,55]],
    widthProfile: [[0,1],[0.18,0.9],[0.28,0.83],[0.46,1.1],[0.6,0.95],[0.74,0.85],[0.9,1],[1,1]],
    zones: [{from:0.18,to:0.43,surface:'gravel'},{from:0.58,to:0.81,surface:'dirt'}],
    ground: '#71866b', sky: '#bbcfc3', accent: '#bcd6ab',
    landmark: [-10,-12], medals: { gold: 34, silver: 45, bronze: 68 },
  },
  {
    id: 'faro', name: 'Horquillas del Faro', subtitle: 'Dos horquillas y una salida que decide la vuelta', region: 'COSTA · 03',
    cornerSmoothing: 2, biome: 'coast', difficulty: 'Experto', width: 11.5, surface: 'asphalt', weather: 'sunset',
    points: [[0,70],[47,70],[81,49],[82,16],[52,5],[24,6],[15,-13],[42,-25],[69,-29],[69,-55],[34,-70],[-8,-72],[-52,-53],[-76,-24],[-66,5],[-40,16],[-55,37],[-36,63]],
    widthProfile: [[0,1],[0.15,0.95],[0.29,0.82],[0.42,0.95],[0.58,1.05],[0.72,0.9],[0.86,0.83],[1,1]],
    zones: [], ground: '#aab584', sky: '#dfd0b6', accent: '#f5b579',
    landmark: [46,94], medals: { gold: 39, silver: 52, bronze: 78 },
  },
];

// Balanced at the same pace. These are game setups, not homologation figures.
// Distances use the same metre scale as the wheel pivots in starter-vehicle-models.js.
export const ORIGINAL_VEHICLES = [
  { id: 'coda', name: 'Truck Classic', category: 'PICK-UP · FR', description: 'Pick-up clásica: dirección progresiva, frenada segura y derrape fácil de recoger. Balancea más y cede velocidad en curvas largas.', color: '#c9a45d',
    speed: .99, grip: 1.03, acceleration: 1, turn: 1.04, response: 1.1, yawResponse: 1.05, drift: .55, looseGrip: 1.32,
    bodyWidth: 1.6, stats: [3,5,3], unlock: 'Tu primera miniatura. Disponible desde el inicio.',
    handling: { mass: 1420, frontWeight: .55, wheelbase: 2.05, track: 1.33, cgHeight: .51,
      drive: 'RWD', engineForce: 17400, brakeForce: 20200, brakeBias: .68, frontGrip: 1.04, rearGrip: 1.08,
      steeringRate: 10.5, releaseRate: 12, yawRate: 5.7, speedSensitivity: .15,
      driftEntry: 4.8, driftBuild: 3.5, recovery: 3.8, rearSlip: .52, cornerDrag: .045,
      springFrequency: 1.65, dampingRatio: .83, rollStiffness: 1.05, pitchStiffness: 1.1, suspensionTravel: .095 },
    character: { strength: 'Recuperación y frenada previsibles', compromise: 'Más balanceo y menor velocidad en apoyo', technique: 'Frena antes, entra suave y deja que se asiente.' } },
  { id: 'apex', name: 'Evo Rally', category: 'RALLY · AWD', description: 'Sedán de rally inspirado en el Lancer Evolution: respuesta precisa y tracción integral. Entra limpio; forzarlo abre la trayectoria.', color: '#a92831',
    speed: 1.01, grip: 1.07, acceleration: 1.1, turn: 1, response: 1.2, yawResponse: 1.16, drift: .48, looseGrip: 1.48,
    bodyWidth: 1.64, stats: [3,5,2], unlock: 'Consigue bronce en Curvas del Puerto.',
    handling: { mass: 1360, frontWeight: .59, wheelbase: 2.22, track: 1.36, cgHeight: .36,
      drive: 'AWD', engineForce: 18800, brakeForce: 17300, brakeBias: .65, frontGrip: 1.08, rearGrip: 1.14,
      steeringRate: 12, releaseRate: 13.5, yawRate: 6.2, speedSensitivity: .20,
      driftEntry: 6.4, driftBuild: 3.7, recovery: 4.5, rearSlip: .40, cornerDrag: .028,
      springFrequency: 2.2, dampingRatio: .88, rollStiffness: 1.65, pitchStiffness: 1.6, suspensionTravel: .065 },
    character: { strength: 'Salida de curva y terreno suelto', compromise: 'Subviraje si entras demasiado rápido', technique: 'Recorta la entrada y aprovecha su tracción al salir.' } },
  { id: 'velo', name: 'Cobra 427', category: 'ROADSTER · FR', description: 'Roadster inspirado en el Cobra 427: ligero, capó largo y propulsión. Más punta y giro con el gas; exige un contravolante fino.', color: '#225c8d',
    speed: 1.07, grip: .98, acceleration: 1.08, turn: .98, response: 1.06, yawResponse: .96, drift: .62, looseGrip: 1.08,
    bodyWidth: 1.64, stats: [4,3,5], unlock: 'Completa las tres pruebas de la Copa de Iniciación.',
    handling: { mass: 1080, frontWeight: .48, wheelbase: 2.02, track: 1.34, cgHeight: .29,
      drive: 'RWD', engineForce: 14100, brakeForce: 12800, brakeBias: .61, frontGrip: 1.06, rearGrip: .95,
      steeringRate: 11.2, releaseRate: 12.5, yawRate: 5.2, speedSensitivity: .12,
      driftEntry: 4.6, driftBuild: 4.5, recovery: 3.1, rearSlip: .61, cornerDrag: .018,
      springFrequency: 2.05, dampingRatio: .78, rollStiffness: 1.55, pitchStiffness: 1.45, suspensionTravel: .055 },
    character: { strength: 'Velocidad punta y rotación en curva', compromise: 'Trasera sensible y menos agarre fuera del asfalto', technique: 'Anticipa el contravolante y evita mantener el giro a fondo.' } },
];

// Only completed reference bodies enter the playable catalog.
const sportBase=ORIGINAL_VEHICLES[2],suvBase=ORIGINAL_VEHICLES[0];
ORIGINAL_VEHICLES.push(
  {...sportBase,id:'c7-sport',name:'Stingray GT',category:'SPORTS · FR',color:'#1167a4',description:'Coupé deportivo inspirado en el Corvette C7: capó bajo, aletas anchas y habitáculo retrasado.',
    speed:1.06,grip:1.04,stats:[4,4,3],unlock:'Disponible en pruebas libres.',bodyWidth:1.66,
    handling:{...sportBase.handling,mass:1320,frontWeight:.51,wheelbase:2.28,track:1.355,engineForce:17300,brakeForce:17000,rearGrip:1.06,rearSlip:.48,rollStiffness:1.8},
    character:{strength:'Punta y apoyo en asfalto',compromise:'Menos cómodo sobre terreno suelto',technique:'Busca una entrada limpia y abre dirección al salir.'}}
);
// Keep the brief available without routing an unimplemented body into gameplay.
export const VEHICLE_PROTOTYPES = [
  {...suvBase,id:'stelvio-suv',name:'Stelvio Sport',category:'SUV · AWD',color:'#80212c',description:'SUV deportivo inspirado en el Stelvio: techo arqueado, cintura alta y postura ancha.',
    speed:1,grip:1.04,looseGrip:1.42,stats:[3,4,3],unlock:'Disponible en pruebas libres.',bodyWidth:1.72,
    handling:{...suvBase.handling,mass:1610,frontWeight:.53,wheelbase:2.29,track:1.43,drive:'AWD',engineForce:21000,brakeForce:21300,cgHeight:.48,rollStiffness:1.35},
    character:{strength:'Tracción y estabilidad en condiciones mixtas',compromise:'Más peso y balanceo',technique:'Apóyalo antes de pedir todo el giro.'}}
];

for(const vehicle of ORIGINAL_VEHICLES)vehicle.stats=vehicleStats(vehicle);
export const VEHICLES = [...ORIGINAL_VEHICLES, ...NEW_VEHICLES];

export const CHAMPIONSHIP = {
  name: 'Copa de Iniciación', subtitle: 'Costa & Pinar',
  events: [
    { id:'puerto-coda', track:'puerto', vehicle:'coda', weather:'clear', name:'La primera trazada' },
    { id:'aserradero-apex', track:'aserradero', vehicle:'apex', weather:'clear', name:'Cambio de terreno' },
    { id:'faro-apex', track:'faro', vehicle:'apex', weather:'sunset', name:'La hora dorada' },
  ],
};

// Physical cruise speeds in m/s. Normal asphalt puts the three starter cars at 146–158 km/h.
export const SURFACES = {
  asphalt: { name: 'Asfalto', color: '#41494a', grip: 9.5, speed: 41, roughness: 0.92, label: 'Preciso y estable', symbol: '▰' },
  dirt: { name: 'Tierra', color: '#b47b4d', grip: 3.4, speed: 35.1, roughness: 1, label: 'Suelto y juguetón', symbol: '⁙' },
  gravel: { name: 'Grava', color: '#8b9087', grip: 4.5, speed: 37.1, roughness: 1, label: 'Agarre intermedio', symbol: '⠿' },
  ice: { name: 'Hielo', color: '#9bcbd3', grip: 1.25, speed: 31.2, roughness: 0.22, label: 'Anticipa cada curva', symbol: '◇' },
  mud: { name: 'Barro', color: '#65513b', grip: 2.7, speed: 32.2, roughness: .4, label: 'Húmedo, lento y deslizante', symbol: '≋' },
};

export const WEATHER = {
  clear: { name: 'Despejado', icon: '☀', grip: 1, visibility: 1, sky: null },
  rain: { name: 'Lluvia', icon: '☂', grip: 0.64, visibility: 0.72, sky: '#8caaae' },
  fog: { name: 'Niebla', icon: '≋', grip: 0.88, visibility: 0.4, sky: '#c0cfcb' },
  snow: { name: 'Nieve', icon: '❄', grip: 0.72, visibility: 0.66, sky: '#becfd6' },
  sunset: { name: 'Atardecer', icon: '◒', grip: 1, visibility: 1, sky: '#e5c3a5' },
};

export const PACES = {
  calm: { name: 'Paseo', speed: 0.73 },
  normal: { name: 'Ágil', speed: 1 },
  fast: { name: 'A fondo', speed: 1.2 },
};
