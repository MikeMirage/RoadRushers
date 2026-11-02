import { clubIcon } from './club-ui.js';

let sequence=0,active=null,observer;
const escaped=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function closeStyledSelect(focus=false){
  if(!active)return;const {trigger,list}=active;active=null;list.remove();trigger.setAttribute('aria-expanded','false');
  if(focus&&trigger.isConnected)trigger.focus({preventScroll:true});
}
export const styledSelectOpen=()=>Boolean(active);
export const styledSelectRoot=()=>active?.list;
function open(select,trigger,direction=1){
  if(active?.select===select){closeStyledSelect(true);return;}
  closeStyledSelect();
  const list=document.createElement('div'),id=`prl-options-${++sequence}`;
  list.id=id;list.className='prl-select-menu';list.setAttribute('role','listbox');list.setAttribute('aria-label',trigger.getAttribute('aria-label'));
  for(const child of select.children){
    if(child.tagName==='OPTGROUP'){
      const heading=document.createElement('div');heading.className='prl-select-group';heading.textContent=child.label;list.append(heading);
      for(const option of child.children)append(option);
    }else append(child);
  }
  function append(option){
    const button=document.createElement('button');button.type='button';button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.selected));button.disabled=option.disabled||option.parentElement.disabled;
    button.innerHTML=`<span>${escaped(option.label)}</span>${option.selected?clubIcon('check'):''}`;
    button.addEventListener('click',()=>{
      const key=['playground','custom','preference'].find(key=>select.dataset[key]);
      const selector=key?`select[data-${key}="${CSS.escape(select.dataset[key])}"]`:select.hasAttribute('data-collection-category')?'select[data-collection-category]':null;
      select.value=option.value;closeStyledSelect();select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
      enhanceStyledSelects(document);const replacement=select.isConnected?select:selector?document.querySelector(selector):null;
      replacement?.parentElement.querySelector('.prl-select-trigger')?.focus({preventScroll:true});
    });list.append(button);
  }
  document.body.append(list);trigger.setAttribute('aria-expanded','true');trigger.setAttribute('aria-controls',id);
  const rect=trigger.getBoundingClientRect(),width=Math.min(innerWidth-24,Math.max(rect.width,270)),below=innerHeight-rect.bottom-12,above=rect.top-12;
  const placeBelow=below>=180||below>=above,height=Math.max(100,Math.min(330,placeBelow?below:above));
  Object.assign(list.style,{width:`${width}px`,maxHeight:`${height}px`,left:`${Math.max(12,Math.min(rect.left,innerWidth-width-12))}px`,[placeBelow?'top':'bottom']:`${placeBelow?rect.bottom+5:innerHeight-rect.top+5}px`});
  active={select,trigger,list,typeahead:'',typedAt:0};
  const options=[...list.querySelectorAll('[role=option]:not(:disabled)')],selected=options.find(o=>o.getAttribute('aria-selected')==='true');
  (selected||(direction>0?options[0]:options.at(-1)))?.focus({preventScroll:true});selected?.scrollIntoView({block:'nearest'});
}
export function enhanceStyledSelects(root=document){
  if(active&&!active.select.isConnected)closeStyledSelect();
  const selects=[...(root.matches?.('select')?[root]:[]),...root.querySelectorAll('select')];
  for(const select of selects){
    // Editors retain their own compact property controls; use this on player menus.
    if(select.dataset.prlStyled||!select.closest('#playground-hub,#garage-content,#preferences-content'))continue;
    select.dataset.prlStyled='true';select.classList.add('prl-native-select');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
    const label=select.labels?.[0]?.cloneNode(true);label?.querySelectorAll('select').forEach(el=>el.remove());
    const name=select.getAttribute('aria-label')||label?.textContent.trim()||'Elegir opción';
    const wrapper=document.createElement('div');wrapper.className='prl-select-control';select.before(wrapper);wrapper.append(select);
    const trigger=document.createElement('button');trigger.type='button';trigger.className='prl-select-trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label',name);
    trigger.innerHTML=`<span>${escaped(select.selectedOptions[0]?.label??'Elegir')}</span>${clubIcon('caret-down')}`;trigger.disabled=select.disabled;wrapper.append(trigger);
    trigger.addEventListener('click',e=>{e.preventDefault();open(select,trigger);});
    trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();e.stopPropagation();open(select,trigger,e.key==='ArrowDown'?1:-1);}});
    select.addEventListener('change',()=>{if(trigger.isConnected)trigger.querySelector('span').textContent=select.selectedOptions[0]?.label??'Elegir';});
  }
}
export function initStyledSelects(){
  enhanceStyledSelects();if(observer)return;
  observer=new MutationObserver(records=>{if(active&&!active.select.isConnected)closeStyledSelect();for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)enhanceStyledSelects(node);});
  observer.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('pointerdown',e=>{if(active&&!active.list.contains(e.target)&&!active.trigger.contains(e.target))closeStyledSelect();},true);
  document.addEventListener('keydown',e=>{
    if(!active)return;
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeStyledSelect(true);return;}
    if(e.key==='Tab'){closeStyledSelect(true);return;}
    const options=[...active.list.querySelectorAll('[role=option]:not(:disabled)')],index=options.indexOf(document.activeElement);
    let next;
    if(e.key==='ArrowDown')next=options[(index+1)%options.length];
    if(e.key==='ArrowUp')next=options[(index-1+options.length)%options.length];
    if(e.key==='Home')next=options[0];if(e.key==='End')next=options.at(-1);
    if(e.key.length===1&&e.key!==' '&&!e.ctrlKey&&!e.metaKey){
      const now=performance.now();active.typeahead=now-active.typedAt<700?active.typeahead+e.key:e.key;active.typedAt=now;
      next=options.find(o=>o.textContent.trim().toLocaleLowerCase().startsWith(active.typeahead.toLocaleLowerCase()));
    }
    if(next){e.preventDefault();e.stopImmediatePropagation();next.focus();}
  },true);
  window.addEventListener('resize',()=>closeStyledSelect());
}
