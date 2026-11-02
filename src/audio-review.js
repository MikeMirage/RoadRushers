import './audio-driving-review.js';
const catalogue=[
  ['menu-lounge','Salón / colección','Música','ElevenLabs Music v2','Rhodes, bajo eléctrico y batería con intención lounge. Referencia propuesta para menú y colección.'],
  ['coastal-velocity-r2','Coastal Velocity · revisión 2','Música','ElevenLabs Music v2','Tu feedback: demasiado disonante. Nueva propuesta con armonía diatónica, motivo pentatónico y timbre suave; conserva el pulso de carrera.'],
  ['neon-surge','Neon Surge','Música','ElevenLabs Music v2','Breakbeat líquido y armonía menor. Propuesta para carreras nocturnas o lluvia.'],
  ['v8-steady','V8 · escape en carga','FX','ElevenLabs SFX','Toma solicitada a régimen constante. Revisar combustión, estabilidad del régimen y unión del loop.'],
  ['tire-scrub-r4','Neumáticos · goma sobre asfalto · revisión','FX','ElevenLabs SFX','Nueva toma para sustituir el chirrido de tiza. Aquí se escucha aislada; en el juego lleva recorte de agudos y entra progresivamente con el derrape, solo en asfalto. Compara con la anterior.'],
  ['gravel-roll','Rodadura · grava','FX','ElevenLabs SFX','Textura granular y pequeñas piedras en el paso de rueda. Revisar cuerpo y sensación de velocidad.'],
  ['guardrail-a','Guardarraíl · toma A','FX','ElevenLabs SFX','Impacto y cola de vibración metálica. Revisar el golpe inicial y su escala física.'],
  ['guardrail-b','Guardarraíl · toma B','FX','ElevenLabs SFX','Segunda variación del impacto para comparar y evitar repeticiones idénticas.'],
];
catalogue.push(
  ['ui-navigate','UI · navegación','FX','ElevenLabs SFX','Click táctil breve para mover el foco entre opciones.'],
  ['ui-confirm-r3','UI · aceptar · agudo','FX','Síntesis digital original','Una sola nota de 1320 Hz, seca y breve. Simplificada según tu feedback.'],
  ['ui-back-r3','UI · volver · grave','FX','Síntesis digital original','Una sola nota de 660 Hz; mismo carácter que aceptar, una octava más grave.'],
  ['race-countdown-preview','Salida · 3–2–1 · ¡Ya!','FX','Síntesis digital original','Tres bocinazos digitales a 440 Hz, uno por segundo. Salida a 880 Hz con mayor duración. En el juego se sincronizan con los números.'],
  ['ui-notify','UI · aviso','FX','ElevenLabs SFX','Aviso corto para resultados y notificaciones.'],
);
const status=document.querySelector('#status'),led=document.querySelector('#led'),volume=document.querySelector('#volume');
let notes={};try{notes=JSON.parse(localStorage.getItem('roadrushers.audio-review.v2')||'{}');}catch{}
let syncTimer;
const sync=()=>fetch('/__audio-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(notes)}).catch(()=>{});
const save=()=>{try{localStorage.setItem('roadrushers.audio-review.v2',JSON.stringify(notes));}catch{}clearTimeout(syncTimer);syncTimer=setTimeout(sync,400);};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function mount(){
  const response=await fetch('./audio/magnific-v2/sources.json',{cache:'no-store'});if(!response.ok)throw new Error('No se ha podido cargar el catálogo');
  const sources=await response.json();
  for(const [id,title,kind,model,description] of catalogue){
    const source=sources.find(x=>x.id===id),entry=notes[id]||{rating:source.reviewStatus==='approved'?'approve':'pending'};
    const badge=source.reviewStatus==='approved'?'APROBADO POR TI':source.replaces?'REVISIÓN · PENDIENTE':'PENDIENTE';
    const card=document.createElement('article');card.className='card';card.dataset.id=id;
    card.innerHTML=`<div class="card-top"><span class="number">${kind==='Música'?'MUSIC':'SFX'}</span><span class="badge">${badge}</span></div><h3>${title}</h3><p>${description}</p><div class="meta">${model}</div><audio controls preload="metadata" src="${source.file?'.'+source.file:source.previewUrl}" aria-label="Escuchar ${title}"></audio><label class="review-label">Valoración<select aria-label="Valoración de ${title}"><option value="pending">Pendiente</option><option value="approve">Aprobar dirección</option><option value="adjust">Ajustar</option><option value="reject">Descartar</option></select></label><textarea rows="2" aria-label="Notas sobre ${title}" placeholder="Qué funciona / qué cambiar…">${escape(entry.text||'')}</textarea>`;
    if(source.replaces){const previous=sources.find(x=>x.id===source.replaces),comparison=document.createElement('details');comparison.innerHTML=`<summary>Comparar versión anterior</summary><p>${escape(previous.reviewNote||'Versión anterior')}</p><audio controls preload="none" src="${previous.file?'.'+previous.file:previous.previewUrl}" aria-label="${escape(title)} · versión anterior"></audio>`;card.append(comparison);}
    const link=document.createElement('a');link.href=source.sourcePage||'.'+source.file;link.target='_blank';link.rel='noopener';link.textContent=source.sourcePage?(source.previewTemporary?'Abrir en Magnific · escucha temporal':'Abrir en Magnific'):'Archivo original local · WAV';card.append(link);
    const player=card.querySelector('audio'),select=card.querySelector('select'),textarea=card.querySelector('textarea');select.value=entry.rating||'pending';player.volume=Number(volume.value);
    for(const player of card.querySelectorAll('audio')){player.volume=Number(volume.value);
    player.addEventListener('play',()=>{document.querySelectorAll('audio').forEach(x=>{if(x!==player)x.pause();});document.querySelectorAll('.playing').forEach(x=>x.classList.remove('playing'));card.classList.add('playing');status.textContent=`Escuchando · ${title}`;led.classList.add('on');});
    player.addEventListener('pause',()=>{card.classList.remove('playing');if(!Array.from(document.querySelectorAll('audio')).some(x=>!x.paused)){status.textContent='Audio detenido';led.classList.remove('on');}});
    player.addEventListener('error',()=>{status.textContent=`No se ha podido cargar ${title}. Puedes abrirlo en Magnific.`;});
    }
    const update=()=>{notes[id]={rating:select.value,text:textarea.value};save();};select.addEventListener('change',update);textarea.addEventListener('input',update);
    document.querySelector(kind==='Música'?'#music-grid':'#fx-grid').append(card);
  }
}
document.querySelector('#stop').addEventListener('click',()=>{document.querySelectorAll('audio').forEach(x=>{x.pause();x.currentTime=0;});status.textContent='Audio detenido';led.classList.remove('on');});
volume.addEventListener('input',()=>{document.querySelector('#volume-value').textContent=`${Math.round(Number(volume.value)*100)}%`;document.querySelectorAll('audio').forEach(x=>x.volume=Number(volume.value));});
mount().then(()=>{if(Object.keys(notes).length)sync();}).catch(error=>{status.textContent=error.message;});


async function mountSuno(){
  const response=await fetch('./audio/suno/catalogue.json',{cache:'no-store'});if(!response.ok)throw Error('No se ha podido cargar la biblioteca Suno');
  const songs=await response.json();
  for(const song of songs){
    const card=document.createElement('article');card.className='card';
    const duration=`${Math.floor(song.duration/60)}:${String(Math.round(song.duration%60)).padStart(2,'0')}`;
    card.innerHTML=`<div class="card-top"><span class="number">SUNO · ${escape(song.variant)}</span><span class="badge">SELECCIONADA POR TI</span></div><h3>${escape(song.title)} · ${escape(song.variant)}</h3><p>${escape(song.use)}${song.duration<45?' · Tema corto, incluido también en una lista con otros temas.':''}</p><div class="meta">${duration} · ${song.normalization.outputLUFS.toFixed(1)} LUFS</div><audio controls preload="none" src=".${encodeURI(song.file)}" aria-label="Escuchar ${escape(song.title)} ${escape(song.variant)}"></audio>`;
    const player=card.querySelector('audio');player.volume=Number(volume.value);
    player.addEventListener('play',()=>{document.querySelectorAll('audio').forEach(other=>{if(other!==player)other.pause();});document.querySelectorAll('.playing').forEach(other=>other.classList.remove('playing'));card.classList.add('playing');status.textContent=`Escuchando · ${song.title} · ${song.variant}`;led.classList.add('on');});
    player.addEventListener('pause',()=>{card.classList.remove('playing');if(![...document.querySelectorAll('audio')].some(other=>!other.paused)){status.textContent='Audio detenido';led.classList.remove('on');}});
    player.addEventListener('error',()=>{status.textContent=`No se ha podido cargar ${song.title} ${song.variant}`;});
    document.querySelector('#suno-grid').append(card);
  }
}
mountSuno().catch(error=>{status.textContent=error.message;});
