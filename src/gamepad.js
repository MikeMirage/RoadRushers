const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:0));
export function gamepadAxis(value,deadZone=.16){const n=clamp(value,-1,1);return Math.abs(n)<=deadZone?0:Math.sign(n)*(Math.abs(n)-deadZone)/(1-deadZone);}
const value=(pad,index)=>clamp(pad.buttons?.[index]?.value??(pad.buttons?.[index]?.pressed?1:0),0,1);
export function readStandardGamepad(pad){
  if(!pad||pad.connected===false||pad.mapping!=='standard')return null;
  const buttons=Array.from({length:17},(_,i)=>value(pad,i));
  const x=gamepadAxis(pad.axes?.[0]),y=gamepadAxis(pad.axes?.[1]);
  return {index:pad.index,family:/dualsense|dualshock|playstation|sony|054c/i.test(pad.id||'')?'playstation':'standard',buttons,
    steer:buttons[14]||buttons[15]?Number(buttons[15]>.5)-Number(buttons[14]>.5):x,
    brake:buttons[6],throttle:buttons[7],orbitX:gamepadAxis(pad.axes?.[2]),orbitY:gamepadAxis(pad.axes?.[3]),
    direction:buttons[12]>.5?'up':buttons[13]>.5?'down':buttons[14]>.5?'left':buttons[15]>.5?'right':Math.abs(x)>Math.abs(y)&&Math.abs(x)>.45?(x<0?'left':'right'):Math.abs(y)>.45?(y<0?'up':'down'):null};
}

/** Snapshot polling preserves button edges and pauses safely on loss of a pad. */
export class GamepadReader{
  constructor(){this.previous=null;this.direction=null;this.repeatAt=0;this.index=null;}
  sample(pads,now=0){
    const all=Array.from(pads||[]),pad=all.find(p=>p?.index===this.index&&p.connected!==false&&p.mapping==='standard')||all.find(p=>p?.connected!==false&&p?.mapping==='standard');
    const current=readStandardGamepad(pad),disconnected=this.previous!==null&&(!current||current.index!==this.previous.index);
    if(!current){this.previous=null;this.index=null;this.direction=null;return {pad:null,actions:[],active:false,disconnected};}
    const prior=disconnected?null:this.previous,actions=[];
    for(const [index,action]of [[0,'confirm'],[1,'back'],[2,'reset'],[3,'camera'],[4,'previousTab'],[5,'nextTab'],[9,'pause']])if(current.buttons[index]>.5&&(!prior||prior.buttons[index]<=.5))actions.push(action);
    if(current.direction){
      if(current.direction!==this.direction){actions.push(current.direction);this.repeatAt=now+350;}
      else if(now>=this.repeatAt){actions.push(current.direction);this.repeatAt=now+130;}
    }
    const changed=!prior||current.direction!==prior.direction||Math.abs(current.steer-prior.steer)>.025||Math.abs(current.orbitX-prior.orbitX)>.025||Math.abs(current.orbitY-prior.orbitY)>.025||current.buttons.some((n,i)=>Math.abs(n-prior.buttons[i])>.05);
    const engaged=current.buttons.some(n=>n>.1)||current.direction!==null||Math.abs(current.steer)>.05||Math.abs(current.orbitX)>.05||Math.abs(current.orbitY)>.05;
    this.previous=current;this.index=current.index;this.direction=current.direction;
    return {pad:current,actions:disconnected?[]:actions,active:changed&&engaged,disconnected};
  }
}

export function directionalTarget(items,active,direction){
  const origin=items.find(item=>item.id===active);if(!origin)return items[0]?.id??null;
  const horizontal=direction==='left'||direction==='right',sign=direction==='left'||direction==='up'?-1:1;
  return items.filter(item=>item!==origin).map(item=>{
    const forward=(horizontal?item.x-origin.x:item.y-origin.y)*sign,side=Math.abs(horizontal?item.y-origin.y:item.x-origin.x);
    return {id:item.id,score:forward>2?forward+side*2.5:Infinity};
  }).sort((a,b)=>a.score-b.score).find(item=>Number.isFinite(item.score))?.id??null;
}

/** Native DOM controls remain usable by mouse and Tab; arrows and the pad add
 * console-style focus navigation without replacing those controls. */
export function createMenuNavigation({root,onBack,onConfirm,onTab,onDevice}){
  const controls=()=>[...root().querySelectorAll('button:not(:disabled),a[href],select:not(:disabled),input:not(:disabled):not([type=hidden]),summary,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden],.hidden,[inert]'));
  function focus(el){if(!el)return;el.focus({preventScroll:true});el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});}
  function move(direction){
    const active=document.activeElement,horizontal=['left','right'].includes(direction),sign=direction==='left'?-1:1;
    if(horizontal&&active?.tagName==='SELECT'){
      let index=active.selectedIndex;
      do{index+=sign;}while(index>=0&&index<active.options.length&&active.options[index].disabled);
      if(index>=0&&index<active.options.length){active.selectedIndex=index;active.dispatchEvent(new Event('change',{bubbles:true}));}return;
    }
    if(horizontal&&active?.matches('input[type=range],input[type=number]')){if(sign>0)active.stepUp();else active.stepDown();active.dispatchEvent(new Event('input',{bubbles:true}));active.dispatchEvent(new Event('change',{bubbles:true}));return;}
    const list=active?.closest('[data-nav-list]');
    if(list&&horizontal){const items=[...list.querySelectorAll('button:not(:disabled)')],index=items.indexOf(active);focus(items[Math.max(0,Math.min(items.length-1,index+sign))]);return;}
    const items=controls(),positions=items.map((el,id)=>{const r=el.getBoundingClientRect();return {id,x:r.left+r.width/2,y:r.top+r.height/2};});
    const id=directionalTarget(positions,items.indexOf(active),direction);focus(items[id]);
  }
  function confirm(){
    let active=document.activeElement;
    if(!root().contains(active)||!active?.matches('button,a[href],summary,select,input')){active=root().querySelector('[data-default-focus],.primary-button:not(:disabled)')||controls()[0];focus(active);}
    if(!active||active.disabled)return;
    if(onConfirm?.(active))return;
    if(active.tagName==='SELECT'){move('right');return;}
    active.click();
  }
  function action(name){if(['up','down','left','right'].includes(name))move(name);else if(name==='confirm')confirm();else if(name==='back')onBack();else if(name==='previousTab'||name==='nextTab')onTab(name==='nextTab'?1:-1);}
  const keyboard=event=>{
    onDevice('keyboard');if(!root()||root().id==='track-kit-content')return;
    const el=document.activeElement;
    if(['INPUT','TEXTAREA','SELECT'].includes(el?.tagName))return;
    const directions={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'};
    const name=directions[event.code]||(['Enter','Space'].includes(event.code)?'confirm':event.code==='Escape'?'back':null);
    if(!name)return;
    event.preventDefault();event.stopImmediatePropagation();if(event.repeat&&['confirm','back'].includes(name))return;action(name);
  };
  window.addEventListener('keydown',keyboard,true);
  window.addEventListener('pointerdown',event=>onDevice(event.pointerType==='touch'?'touch':'mouse'),true);
  return {action,dispose(){window.removeEventListener('keydown',keyboard,true);}};
}
