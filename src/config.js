import { NEW_VEHICLES } from './vehicle-catalog.js';

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

export const ORIGINAL_VEHICLES = [
  { id: 'coda', name: 'Truck Classic', category: 'PICK-UP', description: 'El truck original: compacto, noble y fácil de recuperar.', color: '#e8ce7d',
    speed: 0.94, grip: 1.04, acceleration: 1, turn: 1.04, response: 1.1, yawResponse: 1.1, drift: 0.65, looseGrip: 1,
    stats: [3,5,2], unlock: 'Tu primera miniatura. Disponible desde el inicio.' },
  { id: 'apex', name: 'Evo Rally', category: 'RALLY', description: 'Inspirado en el Lancer Evo: estable, ágil y con mucho agarre.', color: '#c44d43',
    speed: 1.02, grip: 1, acceleration: 1.12, turn: 0.96, response: 0.95, yawResponse: 0.95, drift: 0.61, looseGrip: 1.7,
    stats: [4,4,3], unlock: 'Consigue bronce en Curvas del Puerto.' },
  { id: 'velo', name: 'Cobra 427', category: 'ROADSTER', description: 'Inspirado en el Shelby Cobra: capó largo, propulsión y carácter.', color: '#377daa',
    speed: 1.18, grip: 0.83, acceleration: 1.18, turn: 0.94, response: 0.82, yawResponse: 0.7, drift: 0.76, looseGrip: 0.9,
    stats: [5,2,5], unlock: 'Completa las tres pruebas de la Copa de Iniciación.' },
];

export const VEHICLES = [...ORIGINAL_VEHICLES, ...NEW_VEHICLES];

export const CHAMPIONSHIP = {
  name: 'Copa de Iniciación', subtitle: 'Costa & Pinar',
  events: [
    { id:'puerto-coda', track:'puerto', vehicle:'coda', weather:'clear', name:'La primera trazada' },
    { id:'aserradero-apex', track:'aserradero', vehicle:'apex', weather:'clear', name:'Cambio de terreno' },
    { id:'faro-apex', track:'faro', vehicle:'apex', weather:'sunset', name:'La hora dorada' },
  ],
};

export const SURFACES = {
  asphalt: { name: 'Asfalto', color: '#41494a', grip: 9.5, speed: 21, roughness: 0.92, label: 'Preciso y estable', symbol: '▰' },
  dirt: { name: 'Tierra', color: '#b47b4d', grip: 3.4, speed: 18, roughness: 1, label: 'Suelto y juguetón', symbol: '⁙' },
  gravel: { name: 'Grava', color: '#8b9087', grip: 4.5, speed: 19, roughness: 1, label: 'Agarre intermedio', symbol: '⠿' },
  ice: { name: 'Hielo', color: '#9bcbd3', grip: 1.25, speed: 16, roughness: 0.22, label: 'Anticipa cada curva', symbol: '◇' },
  mud: { name: 'Barro', color: '#65513b', grip: 2.7, speed: 16.5, roughness: .4, label: 'Húmedo, lento y deslizante', symbol: '≋' },
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
