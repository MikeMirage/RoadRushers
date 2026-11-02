import {EngineAudio} from './audio.js';
const root=document.querySelector('#driving-audio-lab');
if(root){
  const audio=new EngineAudio(),button=root.querySelector('[data-driving-toggle]'),status=root.querySelector('[data-driving-status]');
  const speed=root.querySelector('[data-driving-speed]'),slip=root.querySelector('[data-driving-slip]'),throttle=root.querySelector('[data-driving-throttle]'),surface=root.querySelector('[data-driving-surface]'),rain=root.querySelector('[data-driving-rain]');
  let active=false,frame;
  const levels=()=>audio.setOptions({soundEnabled:true,musicVolume:0,masterVolume:Number(document.querySelector('#volume').value)*.8});
  const state=()=>({running:active,speed:Number(speed.value)/3.6,slip:Number(slip.value)/100,throttle:Number(throttle.value)/100,surface:surface.value,weather:rain.checked?'rain':'clear',wetness:rain.checked ? .8 : 0,grounded:true,scene:{screen:'loading'}});
  const labels=()=>{for(const input of [speed,slip,throttle])input.closest('label').querySelector('output').textContent=input.value+(input===speed?' km/h':'%');};
  const update=()=>{audio.update(state());if(active)frame=requestAnimationFrame(update);};
  const stop=()=>{active=false;cancelAnimationFrame(frame);audio.update(state());button.textContent='Escuchar mezcla del coche';button.setAttribute('aria-pressed','false');status.textContent='Prueba detenida';};
  button.addEventListener('click',()=>{
    if(active){stop();return;}
    document.querySelectorAll('audio').forEach(player=>player.pause());levels();if(!audio.unlock()){status.textContent='Audio no disponible en este navegador';return;}
    active=true;button.textContent='Detener mezcla del coche';button.setAttribute('aria-pressed','true');status.textContent='Motor, neumáticos, suelo y ambiente · sin música';update();
  });
  root.addEventListener('input',labels);labels();
  document.querySelector('#volume').addEventListener('input',levels);
  document.querySelector('#stop').addEventListener('click',stop);
  document.addEventListener('play',e=>{if(e.target.matches('audio'))stop();},true);
  document.addEventListener('visibilitychange',()=>{audio.setHidden(document.hidden);if(document.hidden)stop();});
}
