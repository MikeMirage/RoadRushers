export const PREFERENCES_KEY='roadrushers.preferences.v1';
export const GRAPHICS_PRESETS={
  performance:{name:'Fluidez',maxRatio:1.25,minRatio:.75,samples:0,effects:true,shadows:'medium'},
  balanced:{name:'Equilibrado',maxRatio:1.5,minRatio:1,samples:2,effects:true,shadows:'medium'},
  high:{name:'Nitidez',maxRatio:2,minRatio:1.25,samples:4,effects:true,shadows:'high'},
};
export const DEFAULT_PREFERENCES={quality:'performance',resolution:'auto',samples:0,
  targetFPS:120,effects:true,shadows:'medium',showMinimap:true,showSpeed:true,showStats:true,statsDetailed:false,touchMode:'buttons',sensitivity:1,
  soundEnabled:true,masterVolume:.8,musicVolume:.5,engineVolume:.8,effectsVolume:.8,ambientVolume:.6,uiVolume:.55};
export function normalizePreferences(input={}){
  const p={...DEFAULT_PREFERENCES},choices={quality:Object.keys(GRAPHICS_PRESETS),resolution:['auto','1','1.5','2','native'],
    samples:[0,2,4],
    targetFPS:[60,120],effects:[true,false],shadows:['off','medium','high'],showMinimap:[true,false],showSpeed:[true,false],showStats:[true,false],statsDetailed:[true,false],touchMode:['buttons','trackpad'],sensitivity:[.7,1,1.4]};
  for(const [key,values]of Object.entries(choices))if(values.includes(input?.[key]))p[key]=input[key];
  if(typeof input?.soundEnabled==='boolean')p.soundEnabled=input.soundEnabled;
  for(const key of ['masterVolume','musicVolume','engineVolume','effectsVolume','ambientVolume','uiVolume'])if(typeof input?.[key]==='number'&&Number.isFinite(input[key]))p[key]=Math.round(Math.max(0,Math.min(1,input[key]))*100)/100;
  return p;
}
export function loadPreferences(storage){
  try{
    const saved=JSON.parse(storage?.getItem(PREFERENCES_KEY)||'null');
    if(saved?.version===3)return normalizePreferences(saved.options);
    if(saved?.version===2)return normalizePreferences({...saved.options,effects:true,shadows:'medium',showStats:true,statsDetailed:false});
    // Move the previous scenery-heavy defaults to the basic profile, preserving input preferences.
    return normalizePreferences({touchMode:saved?.options?.touchMode,sensitivity:saved?.options?.sensitivity});
  }catch{return {...DEFAULT_PREFERENCES};}
}
export function savePreferences(storage,options){try{storage?.setItem(PREFERENCES_KEY,JSON.stringify({version:3,options:normalizePreferences(options)}));return Boolean(storage);}catch{return false;}}
export function selectGraphicsPreset(options,id){const p=GRAPHICS_PRESETS[id];return p?normalizePreferences({...options,quality:id,resolution:'auto',samples:p.samples,effects:p.effects,shadows:p.shadows}):normalizePreferences(options);}
export function graphicsPolicy(options,deviceRatio=1){
  const p=normalizePreferences(options),preset=GRAPHICS_PRESETS[p.quality],native=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  const maximum=p.resolution==='native'?native:Math.min(native,p.resolution==='auto'?preset.maxRatio:Number(p.resolution));
  return {maximum,minimum:p.resolution==='auto'?Math.min(maximum,preset.minRatio):maximum,adaptive:p.resolution==='auto',
    targetFPS:p.targetFPS,effects:p.effects,shadowSize:{off:0,medium:1024,high:2048}[p.shadows],shadowHz:p.shadows==='high'?120:60,samples:p.samples,postProcessing:false};
}
