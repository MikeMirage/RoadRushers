export const BIOMES={
  meadow:{name:'Pradera',ground:'#739459',grass:'#81a958',rock:'#899181',sky:'#bfd7e5',mode:0,vegetation:1},
  forest:{name:'Bosque',ground:'#536e43',grass:'#648a48',rock:'#7c897b',sky:'#b7cfd7',mode:0,vegetation:1},
  coast:{name:'Costa',ground:'#b3b786',grass:'#97a366',rock:'#c5bda2',sky:'#c6dfeb',mode:0,vegetation:.6},
  desert:{name:'Desierto',ground:'#c3a06a',grass:'#a69359',rock:'#a97d54',sky:'#d5d8ce',mode:1,vegetation:0},
  alpine:{name:'Alpino',ground:'#8d9585',grass:'#84956d',rock:'#929b98',sky:'#b8d1e0',mode:2,vegetation:.25},
  autumn:{name:'Otoño',ground:'#8c8350',grass:'#a19352',rock:'#97917e',sky:'#c7d3d2',mode:0,vegetation:.7},
  city:{name:'Urbano',ground:'#717d7d',grass:'#7c8b6a',rock:'#738487',sky:'#aebecb',mode:2,vegetation:0},
  jungle:{name:'Selva',ground:'#50673a',grass:'#639044',rock:'#657065',sky:'#b3cbd0',mode:0,vegetation:1},
  workshop:{name:'Banco neutro',ground:'#8faaa1',grass:'#8faaa1',rock:'#7c8e87',sky:'#ccdcd7',mode:2,vegetation:0},
};
export const CLIMATES={
  temperate:{name:'Templado',temperature:20,clouds:.25,fog:.12,wind:3},
  maritime:{name:'Marítimo',temperature:18,clouds:.45,fog:.25,wind:7},
  arid:{name:'Árido',temperature:34,clouds:.08,fog:.07,wind:4},
  mountain:{name:'Montaña',temperature:5,clouds:.35,fog:.22,wind:6},
  tropical:{name:'Tropical',temperature:29,clouds:.55,fog:.27,wind:4},
};
export const ENVIRONMENT_PRESETS={
  club:{name:'Club · Mediodía',biome:'meadow',climate:'temperate',weather:'clear',hour:13,clouds:.28,exposure:1.05,saturation:1.08},
  golden:{name:'Costa · Hora dorada',biome:'coast',climate:'maritime',weather:'sunset',hour:18.2,clouds:.22,warmth:.18,exposure:1.08},
  rain:{name:'Bosque · Lluvia',biome:'forest',climate:'maritime',weather:'rain',hour:15,clouds:.9,fog:.35,precipitation:.8,wetness:.95,wind:8,saturation:.9,exposure:1.1},
  dunes:{name:'Dunas · Calima',biome:'desert',climate:'arid',weather:'clear',hour:16,clouds:.05,fog:.32,warmth:.15,wind:6},
  alpine:{name:'Alpino · Nieve',biome:'alpine',climate:'mountain',weather:'snow',hour:11,clouds:.72,snow:.8,precipitation:.65,temperature:-3,exposure:1},
  autumn:{name:'Otoño · Amanecer',biome:'autumn',climate:'temperate',weather:'fog',hour:7.3,clouds:.3,fog:.5,warmth:.12,saturation:1.05},
  night:{name:'Club · Noche azul',biome:'meadow',climate:'temperate',weather:'clear',hour:22,clouds:.15,exposure:1.4,warmth:-.15},
};
export const ENVIRONMENT_KEY='roadrushers.environment.v1';
export const ENVIRONMENT_THEMES={
  woodland:{name:'Bosque frondoso',biome:'forest',climate:'temperate',hour:14,clouds:.35,fog:.2,latitude:47,description:'Dosel denso, helechos, claros y luz filtrada.'},
  grandprix:{name:'Circuito & hierba',biome:'meadow',climate:'temperate',hour:13,clouds:.22,fog:.08,description:'Césped cortado, escapatorias, tribunas y paddock.'},
  sahara:{name:'Dunas & oasis',biome:'desert',climate:'arid',hour:16,clouds:.03,fog:.24,warmth:.14,description:'Dunas onduladas, roca erosionada, palmeras y agua.'},
  norway:{name:'Invierno noruego',biome:'alpine',climate:'mountain',hour:12,latitude:60,day:35,weather:'snow',snow:.9,precipitation:.6,clouds:.7,fog:.25,temperature:-8,warmth:-.1,description:'Coníferas nevadas, fiordo, cabañas y luz invernal baja.'},
  amalfi:{name:'Costa amalfitana',biome:'coast',climate:'maritime',hour:17.5,latitude:40,clouds:.18,fog:.12,warmth:.12,description:'Acantilados, terrazas, fachadas cálidas y mar mediterráneo.'},
  tokyo:{name:'Autopistas de Tokio',biome:'city',climate:'temperate',hour:21,latitude:35,clouds:.5,wetness:.55,exposure:1.45,warmth:-.12,description:'Vías urbanas, señales elevadas, torres y acentos de neón.'},
  bund:{name:'El Bund · Shanghái',biome:'city',climate:'maritime',hour:20,latitude:31,clouds:.25,wetness:.3,exposure:1.45,warmth:.05,description:'Paseo del río, fachadas históricas y skyline iluminado.'},
  pyrenees:{name:'Puerto de los Pirineos',biome:'alpine',climate:'mountain',hour:10,latitude:42,clouds:.3,fog:.18,snow:.18,description:'Cumbres, laderas de roca, abetos y muros de piedra.'},
  reunion:{name:'Selva · Isla de Reunión',biome:'jungle',climate:'tropical',hour:15,latitude:-21,weather:'rain',clouds:.85,fog:.35,precipitation:.7,wetness:.95,temperature:28,description:'Vegetación tropical, roca volcánica, cascadas y barro.'},
};
const ranges={hour:[0,24],latitude:[-60,60],day:[1,365],sunAzimuth:[0,360],sunElevation:[-12,85],clouds:[0,1],fog:[0,1],precipitation:[0,1],wind:[0,20],windDirection:[0,360],temperature:[-20,45],wetness:[0,1],snow:[0,1],exposure:[.4,2],contrast:[.75,1.35],saturation:[0,1.6],warmth:[-1,1],tint:[-1,1],vignette:[0,.5],grassDensity:[0,1]};
export function normalizeEnvironment(input={},base={}){
  const state={theme:'grandprix',biome:'meadow',climate:'temperate',weather:'clear',solarMode:'time',hour:13,latitude:35,day:172,sunAzimuth:225,sunElevation:48,clouds:.25,fog:.12,precipitation:0,wind:3,windDirection:70,temperature:20,wetness:0,snow:0,exposure:1.05,contrast:1.04,saturation:1.06,warmth:0,tint:0,vignette:.1,grassDensity:.7,quality:'balanced',...base};
  for(const [key,[min,max]]of Object.entries(ranges))if(typeof input[key]==='number'&&Number.isFinite(input[key]))state[key]=Math.max(min,Math.min(max,input[key]));
  for(const [key,choices]of [['theme',Object.keys(ENVIRONMENT_THEMES)],['biome',Object.keys(BIOMES)],['climate',Object.keys(CLIMATES)],['weather',['clear','rain','fog','snow','sunset']],['quality',['mobile','balanced','high']],['solarMode',['time','manual']]])if(choices.includes(input[key]))state[key]=input[key];
  return state;
}
export function trackEnvironment(config,weather='clear'){
  const biome=BIOMES[config.biome]?config.biome:'meadow',climate=biome==='desert'?'arid':biome==='alpine'?'mountain':biome==='coast'?'maritime':'temperate';
  const theme=config.environmentTheme||({forest:'woodland',coast:'amalfi',desert:'sahara',alpine:'pyrenees',city:'tokyo',jungle:'reunion'}[biome]||'grandprix');
  const preset=themePreset(theme);
  return normalizeEnvironment({...preset,biome,weather,hour:weather==='sunset'?18.2:preset.hour,...(weather===preset.weather?{}:{clouds:weather==='rain'||weather==='snow'?.86:weather==='fog'?.6:preset.clouds,fog:weather==='fog'?.7:preset.fog,precipitation:['rain','snow'].includes(weather)?.75:0,wetness:weather==='rain'?.9:preset.wetness,snow:weather==='snow'?.7:preset.snow})});
}
/** Local solar time; no location permission, timezone or weather service is involved. */
export function solarPosition(state){
  const rad=Math.PI/180;
  if(state.solarMode==='manual')return {azimuth:state.sunAzimuth,elevation:state.sunElevation};
  const latitude=state.latitude*rad,declination=23.44*rad*Math.sin(TAU*(284+state.day)/365),hourAngle=(state.hour-12)*15*rad;
  const elevation=Math.asin(Math.sin(latitude)*Math.sin(declination)+Math.cos(latitude)*Math.cos(declination)*Math.cos(hourAngle));
  const azimuth=Math.atan2(Math.sin(hourAngle),Math.cos(hourAngle)*Math.sin(latitude)-Math.tan(declination)*Math.cos(latitude))+Math.PI;
  return {azimuth:(azimuth/rad+360)%360,elevation:elevation/rad};
}
const TAU=Math.PI*2;
export function sunDirection({azimuth,elevation}){const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;return {x:Math.sin(a)*Math.cos(e),y:Math.sin(e),z:Math.cos(a)*Math.cos(e)};}
export function environmentPreset(id){const preset=ENVIRONMENT_PRESETS[id];return normalizeEnvironment({...CLIMATES[preset?.climate],...preset});}
export function themePreset(id){const theme=ENVIRONMENT_THEMES[id]||ENVIRONMENT_THEMES.grandprix;return normalizeEnvironment({...CLIMATES[theme.climate],...theme,theme:id});}
