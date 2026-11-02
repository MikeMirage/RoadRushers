export const AUDIO_LEVELS=[['masterVolume','General'],['musicVolume','Música'],['engineVolume','Motor'],['effectsVolume','Efectos'],['ambientVolume','Ambiente'],['uiVolume','Interfaz']];
export function renderAudioSettings(p,prefix='audio'){
  return `<div class="audio-settings"><button type="button" data-sound-toggle aria-pressed="${p.soundEnabled}">Sonido: ${p.soundEnabled?'activado':'silenciado'}</button>${AUDIO_LEVELS.map(([key,label])=>`<label class="audio-level" for="${prefix}-${key}"><span>${label}</span><input id="${prefix}-${key}" data-audio-level="${key}" aria-label="Volumen ${label.toLowerCase()}" type="range" min="0" max="100" step="1" value="${Math.round(p[key]*100)}"><output for="${prefix}-${key}">${Math.round(p[key]*100)}%</output></label>`).join('')}</div>`;
}
