import { TRACKS, VEHICLES, SURFACES, WEATHER, PACES } from './config.js';
import { availableRaceTracks } from './race-ui.js';
import { makeRaceTrack } from './race.js';
import { AI_LEVELS } from './race-driver.js';
import { savedEditorTracks } from './track-editor-state.js';
import { CAMERA_VIEWS } from './camera-views.js';
import { CAR_CATEGORIES,eligibleVehicles,opponentVehicles,availableEligibleVehicles } from './vehicle-regulations.js';
import { Circuit } from './circuit.js';
import { activeCircuitDressing,generateCircuitDressing,dressingSourceKey,normalizeDressingOptions } from './circuit-dressing.js';

export const PLAYGROUND_KEY='roadrushers.playground.v1';
export const CIRCUIT_THEMES={basic:'Basic',grass:'Grass'};
const grassRecipes=new Map();
function applyCircuitTheme(track,theme){
  track.environmentTheme=theme;track.biome=theme==='grass'?'meadow':'workshop';
  if(theme==='basic'){delete track.circuitDressing;return;}
  if(activeCircuitDressing({config:track}))return;
  const options=normalizeDressingOptions(track.circuitDressingOptions||track.circuitDressing?.options);
  const key=JSON.stringify([dressingSourceKey(track),options,track.manualProps||[]]);
  if(!grassRecipes.has(key)){
    const recipe=generateCircuitDressing(new Circuit(track),options);
    if(grassRecipes.size>=32)grassRecipes.delete(grassRecipes.keys().next().value);
    grassRecipes.set(key,recipe);
  }
  track.circuitDressing=grassRecipes.get(key);
}
export const DEFAULT_PLAYGROUND={mode:'practice',vehicleId:VEHICLES[0].id,trackId:TRACKS[0].id,
  surface:'track',weather:'clear',theme:'basic',pace:'normal',camera:'topdown',width:'original',
  count:12,laps:3,interaction:'ghost',difficulty:'club',fieldLevels:'mixed',carCategory:'any'};
export const playgroundTracks=(current=TRACKS[0],storage)=>{
  const saved=savedEditorTracks(storage),ids=new Set(saved.map(t=>t.id));
  return [...availableRaceTracks(current).filter(t=>!ids.has(t.id)&&!(t.id.startsWith('saved-')&&saved.some(s=>s.name===t.name))),...saved];
};

export function normalizePlayground(input={},tracks=playgroundTracks()){
  const options={...DEFAULT_PLAYGROUND};
  const choices={mode:['practice','race'],vehicleId:VEHICLES.map(v=>v.id),trackId:tracks.map(t=>t.id),
    surface:['track',...Object.keys(SURFACES)],weather:['track',...Object.keys(WEATHER)],theme:Object.keys(CIRCUIT_THEMES),
    pace:Object.keys(PACES),camera:CAMERA_VIEWS.map(view=>view.id),width:['original',12,14,16],count:[4,8,12],laps:[1,3,5],
    interaction:['ghost','contact'],difficulty:Object.keys(AI_LEVELS),fieldLevels:['mixed','uniform'],carCategory:CAR_CATEGORIES.map(c=>c.id)};
  for(const [key,values]of Object.entries(choices))if(values.includes(input?.[key]))options[key]=input[key];
  if(!tracks.some(t=>t.id===options.trackId))options.trackId=tracks[0].id;
  return options;
}
export function loadPlayground(storage){
  try{
    const saved=JSON.parse(storage?.getItem(PLAYGROUND_KEY)||'null'),options=normalizePlayground(saved?.version===1?saved.options:{},playgroundTracks(undefined,storage));
    const available=availableEligibleVehicles(VEHICLES,options.carCategory);
    if(!available.some(v=>v.id===options.vehicleId))options.vehicleId=available[0].id;
    if(resolvePlayground(options,playgroundTracks(undefined,storage)).error)options.width='original';return options;
  }catch{return {...DEFAULT_PLAYGROUND};}
}
export function savePlayground(storage,options){
  try{storage?.setItem(PLAYGROUND_KEY,JSON.stringify({version:1,options}));return Boolean(storage);}catch{return false;}
}
export function resolvePlayground(input,tracks=playgroundTracks()){
  const options=normalizePlayground(input,tracks),base=tracks.find(t=>t.id===options.trackId);
  const variant=makeRaceTrack(base,options.width);
  const eligible=eligibleVehicles(VEHICLES,options.carCategory),vehicle=eligible.find(v=>v.id===options.vehicleId)||eligible[0];
  options.vehicleId=vehicle.id;
  const track={...(options.width==='original'?base:variant.config)};
  applyCircuitTheme(track,options.theme);
  return {...variant,error:base.editorError||variant.error,options,settings:{mode:options.mode,vehicle,track,
    surface:options.surface,weather:options.weather==='track'?base.weather:options.weather,pace:options.pace,camera:options.camera,
    raceRules:{count:options.count,laps:options.laps,interaction:options.interaction,difficulty:options.difficulty,fieldLevels:options.fieldLevels,
      carCategory:options.carCategory,vehiclePool:opponentVehicles(VEHICLES,options.carCategory,vehicle)}}};
}
