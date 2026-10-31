import { ENVIRONMENT_THEMES, CLIMATES, ENVIRONMENT_KEY, normalizeEnvironment, solarPosition, themePreset } from './environment-config.js';

export class EnvironmentStudio{
  constructor(onChange,onClose,onCamera,initial){
    Object.assign(this,{onChange,onClose,onCamera});this.visible=false;this.state=normalizeEnvironment(initial);
    try{const saved=JSON.parse(localStorage.getItem(ENVIRONMENT_KEY)||'null');if(saved?.version===1)this.state=normalizeEnvironment(saved.state);}catch{}
  }
  mount(host){
    this.host=host;this.visible=true;this.render();
    host.oninput=e=>{const key=e.target.dataset.env;if(e.target.type!=='range'||!key||key==='grassDensity')return;this.update(key,e.target.value,false);};
    host.onchange=e=>{const key=e.target.dataset.env;if(!key)return;this.update(key,e.target.value,true);};
    host.onclick=e=>{const action=e.target.closest('[data-env-action]')?.dataset.envAction;if(action==='close')this.onClose();if(action==='camera')this.onCamera();if(action==='reset'){this.state=themePreset(this.state.theme);this.render();this.emit(true);}};
    this.emit(true);
  }
  update(key,value,final){
    if(key==='theme'){this.state=normalizeEnvironment({...themePreset(value),quality:this.state.quality});this.render();}
    else if(key==='climate'){this.state=normalizeEnvironment({...this.state,...CLIMATES[value],climate:value});this.render();}
    else{
      const numeric=!['quality','weather','solarMode'].includes(key),patch={[key]:numeric?Number(value):value};
      if(key==='solarMode'&&value==='manual'){const sun=solarPosition(this.state);patch.sunAzimuth=sun.azimuth;patch.sunElevation=sun.elevation;}
      if(key==='weather')Object.assign(patch,{precipitation:['rain','snow'].includes(value)?.75:0,wetness:value==='rain'?.9:0,snow:value==='snow'?.8:0,clouds:['rain','snow','fog'].includes(value)?.8:.25,fog:value==='fog'?.7:.2});
      this.state=normalizeEnvironment({...this.state,...patch});
      if(['weather','solarMode','quality'].includes(key))this.render();else this.updateLabels();
    }
    this.emit(final);
  }
  emit(final){
    try{localStorage.setItem(ENVIRONMENT_KEY,JSON.stringify({version:1,state:this.state}));}catch{}
    this.onChange(this.state,final);
  }
  hide(){this.visible=false;}
  updateLabels(){
    for(const o of this.host.querySelectorAll('[data-env-output]'))o.textContent=this.format(o.dataset.envOutput,this.state[o.dataset.envOutput]);
    const sun=solarPosition(this.state);this.host.querySelector('#env-sun-readout').textContent=`Azimut ${sun.azimuth.toFixed(0)}° · Elevación ${sun.elevation.toFixed(1)}°`;
  }
  format(key,value){if(key==='hour'){const minutes=Math.round(value*60);return `${String(Math.floor(minutes/60)%24).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}if(['sunAzimuth','sunElevation','windDirection','latitude'].includes(key))return `${Math.round(value)}°`;if(key==='day')return `${Math.round(value)}`;if(key==='temperature')return `${Math.round(value)} °C`;if(key==='wind')return `${value.toFixed(1)} m/s`;return value.toFixed(2);}
  render(){
    const s=this.state,options=(obj,key)=>Object.entries(obj).map(([id,v])=>`<option value="${id}" ${s[key]===id?'selected':''}>${v.name??v}</option>`).join('');
    const range=(key,label,min,max,step,disabled=false)=>`<label class="env-range"><span>${label}<output data-env-output="${key}">${this.format(key,s[key])}</output></span><input type="range" aria-label="${label}" data-env="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}" ${disabled?'disabled':''}></label>`;
    const sun=solarPosition(s);
    this.host.innerHTML=`<div class="environment-heading"><div><span class="eyebrow">ROADRUSHERS / DIRECCIÓN DE ARTE</span><h2>El mundo de tu pista.</h2></div><button class="icon-button" data-env-action="close" aria-label="Cerrar estudio de entornos">×</button></div><p class="environment-intro">Arrastra para orbitar · Pellizca para acercar · Entrenamiento</p><label class="env-select">ENTORNO<select data-env="theme">${options(ENVIRONMENT_THEMES,'theme')}</select></label><p class="environment-description">${ENVIRONMENT_THEMES[s.theme].description}</p><div class="env-inline"><label class="env-select">CALIDAD<select data-env="quality">${options({mobile:'Móvil',balanced:'Equilibrada',high:'Alta'},'quality')}</select></label><button data-env-action="camera">Encuadrar entorno ↗</button></div><details open><summary>Sol y hora del día</summary><label class="env-select">CONTROL DEL SOL<select data-env="solarMode">${options({time:'Por hora solar',manual:'Azimut y elevación manuales'},'solarMode')}</select></label>${range('hour','Hora solar',0,23.9,.1,s.solarMode==='manual')}${range('sunAzimuth','Azimut del sol',0,360,1,s.solarMode==='time')}${range('sunElevation','Elevación del sol',-12,85,1,s.solarMode==='time')}<p id="env-sun-readout">Azimut ${sun.azimuth.toFixed(0)}° · Elevación ${sun.elevation.toFixed(1)}°</p></details><details><summary>Climatología y tiempo</summary><label class="env-select">CLIMATOLOGÍA<select data-env="climate">${options(CLIMATES,'climate')}</select></label><label class="env-select">TIEMPO ACTUAL<select data-env="weather">${options({clear:'Despejado',rain:'Lluvia',fog:'Niebla',snow:'Nieve',sunset:'Atardecer'},'weather')}</select></label>${range('clouds','Nubosidad',0,1,.05)}${range('fog','Bruma y niebla',0,1,.02)}${range('precipitation','Intensidad de precipitación',0,1,.05)}${range('wind','Viento',0,20,.5)}${range('windDirection','Dirección del viento',0,360,5)}${range('temperature','Temperatura',-20,45,1)}${range('wetness','Humedad del terreno',0,1,.05)}${range('snow','Cobertura de nieve',0,1,.05)}</details><details><summary>Color y acabado</summary>${range('exposure','Exposición',.4,2,.02)}${range('contrast','Contraste',.75,1.35,.02)}${range('saturation','Saturación',0,1.6,.02)}${range('warmth','Temperatura de color',-1,1,.05)}${range('tint','Tinte',-1,1,.05)}${range('vignette','Viñeta',0,.5,.02)}</details><details><summary>Vegetación y estación</summary>${range('grassDensity','Densidad de hierba',0,1,.05)}${range('latitude','Latitud solar',-60,60,1)}${range('day','Día del año',1,365,1)}</details><div class="environment-footer"><span>Ajustes guardados por navegador.<br>El clima y la superficie afectan a la conducción.</span><button data-env-action="reset">Restablecer entorno</button></div>`;
  }
}
