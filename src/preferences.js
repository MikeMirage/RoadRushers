export const PREFERENCES_KEY='roadrushers.preferences.v1';
export const GRAPHICS_PRESETS={
  performance:{name:'Ahorro',maxRatio:1,minRatio:1,detail:'mobile',shadows:'off',samples:0,postProcessing:false},
  balanced:{name:'Equilibrada',maxRatio:2,minRatio:1.5,detail:'balanced',shadows:'medium',samples:2,postProcessing:true},
  high:{name:'Alta',maxRatio:3,minRatio:2,detail:'high',shadows:'high',samples:4,postProcessing:true},
};
export const DEFAULT_PREFERENCES={quality:'balanced',resolution:'auto',detail:'balanced',shadows:'medium',samples:2,postProcessing:true,touchMode:'buttons',sensitivity:1};
export function normalizePreferences(input={}){
  const p={...DEFAULT_PREFERENCES},choices={quality:Object.keys(GRAPHICS_PRESETS),resolution:['auto','1','1.5','2','native'],detail:['mobile','balanced','high'],shadows:['off','medium','high'],samples:[0,2,4],postProcessing:[true,false],touchMode:['buttons','trackpad'],sensitivity:[.7,1,1.4]};
  for(const [key,values]of Object.entries(choices))if(values.includes(input?.[key]))p[key]=input[key];return p;
}
export function loadPreferences(storage){try{const v=JSON.parse(storage?.getItem(PREFERENCES_KEY)||'null');return normalizePreferences(v?.version===1?v.options:{});}catch{return {...DEFAULT_PREFERENCES};}}
export function savePreferences(storage,options){try{storage?.setItem(PREFERENCES_KEY,JSON.stringify({version:1,options:normalizePreferences(options)}));return Boolean(storage);}catch{return false;}}
export function selectGraphicsPreset(options,id){const p=GRAPHICS_PRESETS[id];return p?normalizePreferences({...options,quality:id,resolution:'auto',detail:p.detail,shadows:p.shadows,samples:p.samples,postProcessing:p.postProcessing}):normalizePreferences(options);}
export function graphicsPolicy(options,deviceRatio=1){
  const p=normalizePreferences(options),preset=GRAPHICS_PRESETS[p.quality],native=Number.isFinite(deviceRatio)&&deviceRatio>0?deviceRatio:1;
  const maximum=p.resolution==='native'?native:Math.min(native,p.resolution==='auto'?preset.maxRatio:Number(p.resolution));
  return {maximum,minimum:p.resolution==='auto'?Math.min(maximum,preset.minRatio):maximum,adaptive:p.resolution==='auto',detail:p.detail,shadowSize:{off:0,medium:1024,high:2048}[p.shadows],samples:p.samples,postProcessing:p.postProcessing};
}
