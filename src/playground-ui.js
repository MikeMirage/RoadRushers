import { VEHICLES } from './config.js';
import { makeRaceTrack } from './race.js';
import { circuitPreview } from './circuit-preview.js';
import { renderRaceSetup } from './race-setup-ui.js';
import { clubIcon,renderClubNavigation } from './club-ui.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderPlayground(options,tracks,ready=true,setupStep='circuit'){
  const vehicle=VEHICLES.find(v=>v.id===options.vehicleId)||VEHICLES[0],track=tracks.find(t=>t.id===options.trackId)||tracks[0];
  const widths=['original',12,14,16].map(width=>({width,...makeRaceTrack(track,width)})),chosen=widths.find(v=>v.width===options.width)||widths[0];
  if(track.editorError)chosen.error=track.editorError;
  const preview=circuitPreview(chosen.config||track);
  return `<form id="playground-form" class="club-home" aria-label="Preparar carrera">
    <section class="club-home-hero" aria-label="Circuito y coche seleccionados">
      <div class="club-track-identity"><span class="eyebrow">CIRCUITO ACTUAL</span><h1>${esc(track.name)}</h1><p>${preview.length} km</p><div class="club-track-map">${preview.svg}</div></div>
      <div id="home-car-stage" class="club-car-stage" aria-label="Vista 3D de tu coche"><span class="club-car-loading" role="status">Preparando miniatura…</span></div>
      <div class="club-selected-car"><div><strong>${esc(vehicle.name)}</strong><small>${esc(vehicle.category)}</small></div><button type="button" data-play-action="garage" aria-label="Ver garaje" title="Ver garaje">${clubIcon('garage')}</button></div>
    </section>
    <section class="club-home-controls" aria-label="Tu próxima salida">
      <div class="club-mode" role="group" aria-label="Tipo de sesión">
        <button type="button" data-play-mode="practice" aria-pressed="${options.mode==='practice'}">${clubIcon('timer')}<span><strong>Entrenamiento</strong><small>Tú y el cronómetro</small></span>${clubIcon('caret-right','club-mode-chevron')}</button>
        <button type="button" data-play-mode="race" aria-pressed="${options.mode==='race'}">${clubIcon('flag-checkered')}<span><strong>Carrera IA</strong><small>${options.count} coches · ${options.laps} ${options.laps===1?'vuelta':'vueltas'}</small></span>${clubIcon('caret-right','club-mode-chevron')}</button>
      </div>

      ${chosen.error?`<p class="play-width-note invalid" role="alert">${esc(chosen.error)}</p>`:''}
      <button type="submit" class="primary-button club-launch" ${!ready||chosen.error?'disabled':''}>${ready?'Preparar salida':'Preparando pista…'} ${clubIcon('caret-right')}</button>
    </section>
  </form>
  ${renderClubNavigation('race')}
  ${renderRaceSetup(options,tracks,{step:setupStep,ready})}`;
}
