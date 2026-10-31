import { VEHICLES, SURFACES, WEATHER, PACES } from './config.js';
import { AI_LEVELS } from './race-driver.js';
import { ENVIRONMENT_THEMES } from './environment-config.js';
import { makeRaceTrack } from './race.js';
import { Circuit } from './circuit.js';
import { carIllustration } from './vehicles.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function circuitPreview(track){
  const circuit=new Circuit(track),points=circuit.samples.filter((_,i)=>i%4===0);
  const xs=points.map(p=>p.x),zs=points.map(p=>p.z),minX=Math.min(...xs),minZ=Math.min(...zs);
  const width=Math.max(...xs)-minX,height=Math.max(...zs)-minZ,scale=Math.min(154/Math.max(1,width),94/Math.max(1,height));
  const project=p=>`${((p.x-minX)*scale+(180-width*scale)/2).toFixed(2)},${((p.z-minZ)*scale+(120-height*scale)/2).toFixed(2)}`;
  const start=project(points[0]).split(',');
  return {length:(circuit.length/1000).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}),svg:`<svg viewBox="0 0 180 120" fill="none" aria-hidden="true"><polyline points="${points.map(project).join(' ')} ${project(points[0])}" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${start[0]}" cy="${start[1]}" r="4" fill="currentColor"/></svg>`};
}
export function renderPlayground(options,tracks,ready=true){
  const vehicle=VEHICLES.find(v=>v.id===options.vehicleId)||VEHICLES[0],track=tracks.find(t=>t.id===options.trackId)||tracks[0];
  const widths=['original',12,14,16].map(width=>({width,...makeRaceTrack(track,width)})),chosen=widths.find(v=>v.width===options.width)||widths[0];
  const preview=circuitPreview(chosen.config||track),weather=WEATHER[options.weather==='track'?track.weather:options.weather]?.name||'Del circuito',surface=options.surface==='track'?'Sectores':SURFACES[options.surface]?.name;
  const select=(key,label,values)=>`<label class="play-field">${label}<select data-playground="${key}">${values.map(([id,name,disabled])=>`<option value="${esc(id)}" ${options[key]===id?'selected':''} ${disabled?'disabled':''}>${esc(name)}</option>`).join('')}</select></label>`;
  const disclosure=(id,title,description,content)=>`<details class="play-disclosure" data-play-details="${id}"><summary><span>${title}<small>${esc(description)}</small></span><b aria-hidden="true">+</b></summary>${content}</details>`;
  return `<div class="play-intro"><span class="eyebrow">CONDUCE. DERRAPA. SUPÉRATE.</span><h1>A por tu<br><em>récord.</em></h1><p>Elige coche y circuito.<br>El resto se decide en pista.</p><div class="play-car">${carIllustration(vehicle)}<span><small>TU COCHE</small><strong>${esc(vehicle.name)}</strong><em>${esc(vehicle.category)}</em></span><button type="button" data-play-action="garage">Garaje <b aria-hidden="true">↗</b></button></div><div class="play-access"><span>${VEHICLES.length} coches disponibles</span><span>${tracks.length} circuitos</span></div><p class="play-input-hint"><span>← →</span> Girar <i></i><span>← + →</span> Frenar</p></div>
  <form id="playground-form" class="play-config"><div class="play-mode" role="group" aria-label="Tipo de sesión"><button type="button" data-play-mode="practice" aria-pressed="${options.mode==='practice'}"><strong>Entrenamiento</strong><small>Tu mejor vuelta</small></button><button type="button" data-play-mode="race" aria-pressed="${options.mode==='race'}"><strong>Carrera IA</strong><small>Disputa la posición</small></button></div>
  <div class="play-track-choice"><div>${select('trackId','CIRCUITO',tracks.map(t=>[t.id,t.name]))}<p class="play-track-meta">${preview.length} km <span>·</span> ${chosen.minWidth.toFixed(1)}–${chosen.maxWidth.toFixed(1)} m</p></div><div class="play-track-preview">${preview.svg}</div></div>
  ${options.mode==='race'?disclosure('grid','Parrilla',`${options.count} coches · ${options.laps} ${options.laps===1?'vuelta':'vueltas'} · ${AI_LEVELS[options.difficulty]?.name}`,`<div class="play-grid">${select('count','COCHES',[4,8,12].map(n=>[n,`${n} coches`]))}${select('laps','VUELTAS',[1,3,5].map(n=>[n,`${n} ${n===1?'vuelta':'vueltas'}`]))}${select('difficulty','DIFICULTAD IA',Object.entries(AI_LEVELS).map(([id,l])=>[id,l.name]))}${select('fieldLevels','NIVELES',[['mixed','Variados'],['uniform','Mismo nivel']])}${select('interaction','INTERACCIÓN',[['ghost','Ghosts · sin contacto'],['contact','Contacto físico']])}</div>`):''}
  ${disclosure('driving','Pista y conducción',`${surface} · ${weather}`,`<div class="play-grid">${select('surface','SUPERFICIE',[['track','Sectores del circuito'],...Object.entries(SURFACES).map(([id,s])=>[id,s.name])])}${select('weather','CLIMA',[['track','Clima del circuito'],...Object.entries(WEATHER).map(([id,w])=>[id,w.name])])}${select('theme','ENTORNO',[['track','Entorno del circuito'],...Object.entries(ENVIRONMENT_THEMES).map(([id,e])=>[id,e.name])])}${select('width','ANCHURA',widths.map(w=>[w.width,w.width==='original'?'Original':`${w.width} m`,Boolean(w.error)]))}${select('pace','RITMO',Object.entries(PACES).map(([id,p])=>[id,p.name]))}${select('camera','CÁMARA',[['topdown','Aérea'],['chase','3ª persona']])}</div>`)}
  ${disclosure('tools','Crear y editar','Circuitos y entornos',`<div class="play-tools"><button type="button" data-play-action="kit">Editor de pistas <b aria-hidden="true">↗</b></button><button type="button" data-play-action="environment">Entorno y luz <b aria-hidden="true">↗</b></button></div>`)}
  <div class="play-config-footer">${chosen.error?`<p class="play-width-note invalid" role="alert">${esc(chosen.error)}</p>`:''}<button type="submit" class="primary-button" ${!ready||chosen.error?'disabled':''}>${ready?'Salir a pista':'Preparando pista…'} <span aria-hidden="true">→</span></button><small>${options.mode==='race'?`${options.count} coches · ${options.laps} ${options.laps===1?'vuelta':'vueltas'} · ${options.interaction==='contact'?'Contacto':'Ghosts'}`:'Tú y el cronómetro'}</small></div></form>`;
}
