import { KIT_PRESETS,MAX_TRACK_PIECES,samplePiece,compileLayout,kitConfig } from './track-pieces.js';
import { themePreset,normalizeEnvironment } from './environment-config.js';
import { normalizeProps } from './prop-catalog.js';
import { closeTrackLayout } from './track-closure.js';

export const TRACK_EDITOR_KEY='roadrushers.track-editor.v2';
export const SAVED_TRACKS_KEY='roadrushers.saved-tracks.v1';
const clone=value=>structuredClone(value);
const pieceKeys=['length','radius','bank','rise','height','waves','amplitude','angle','widthFactorTo','surface','mirrored','launchLength','gapLength','landingLength'];
export function normalizeEditorDocument(input){
  if(!input||typeof input!=='object')throw new Error('El archivo no contiene un circuito.');
  const pieces=input.pieces??input.layout;if(!Array.isArray(pieces)||pieces.length>MAX_TRACK_PIECES)throw new Error(`El circuito admite hasta ${MAX_TRACK_PIECES} tramos.`);
  const clean=pieces.map(p=>{
    if(typeof p==='string'){samplePiece(p);return p;}
    if(!p||typeof p!=='object')throw new Error('Definición de tramo no válida.');
    if(p.mirrored!=null&&typeof p.mirrored!=='boolean')throw new Error('El reflejo del tramo debe ser booleano.');
    const item={id:p.id};for(const key of pieceKeys)if(p[key]!=null){if(!['surface','mirrored'].includes(key)&&(typeof p[key]!=='number'||!Number.isFinite(p[key])))throw new Error('Las medidas del tramo deben ser números finitos.');item[key]=Object.is(p[key],-0)?0:p[key];}samplePiece(item);return item;
  });
  const environment=normalizeEnvironment(input.environment||themePreset(input.theme||'grandprix'));
  return {version:2,name:typeof input.name==='string'?input.name.slice(0,60):'Mi circuito',pieces:clean,environment,props:normalizeProps(input.props||input.manualProps||[])};
}
export function defaultEditorDocument(){return normalizeEditorDocument({name:KIT_PRESETS[1].name,pieces:clone(KIT_PRESETS[1].pieces),theme:'grandprix'});}
export function readEditorDocument(storage){
  try{const saved=storage?.getItem(TRACK_EDITOR_KEY);if(saved)return normalizeEditorDocument(JSON.parse(saved));}catch{/* Keep an older draft available if the new document cannot be read. */}
  try{const legacy=storage?.getItem('roadrushers.track-kit.v1');if(legacy)return normalizeEditorDocument(JSON.parse(legacy));}catch{}
  return defaultEditorDocument();
}
export function parseEditorFile(text){if(typeof text!=='string'||text.length>1024*1024)throw new Error('Usa un archivo de circuito de hasta 1 MB.');return normalizeEditorDocument(JSON.parse(text));}
const nameKey=doc=>doc.name.trim().toLocaleLowerCase('es');
export function savedEditorTrackId(doc){
  let hash=2166136261;for(const c of JSON.stringify([nameKey(doc),doc.pieces]))hash=Math.imul(hash^c.charCodeAt(0),16777619);
  return `saved-${(hash>>>0).toString(16)}`;
}
export function readSavedEditorDocuments(storage){
  const documents=new Map(),add=value=>{try{const doc=normalizeEditorDocument(value);if(doc.pieces.length)documents.set(nameKey(doc),doc);}catch{}};
  try{const saved=JSON.parse(storage?.getItem?.(SAVED_TRACKS_KEY)||'null');if(saved?.version===1&&Array.isArray(saved.documents))saved.documents.forEach(add);}catch{}
  for(const key of ['roadrushers.track-kit.v1',TRACK_EDITOR_KEY])try{const saved=storage?.getItem?.(key);if(saved)add(JSON.parse(saved));}catch{}
  return [...documents.values()];
}
export const readSavedEditorDocument=(storage,id)=>readSavedEditorDocuments(storage).find(doc=>savedEditorTrackId(doc)===id);
export const savedEditorTracks=storage=>readSavedEditorDocuments(storage).map(doc=>({...editorTrackConfig(doc,{allowInvalid:true}),savedEditor:true}));
export function editorTrackConfig(document,{allowInvalid=false}={}){
  const doc=normalizeEditorDocument(document),layout=compileLayout(doc.pieces);
  const editorError=layout.errors[0]||(!layout.closed?'El circuito debe estar cerrado antes de probarlo.':null);
  if(editorError&&!allowInvalid)throw new Error(editorError);
  return {...kitConfig(clone(doc.pieces),doc.name,savedEditorTrackId(doc)),editorError,biome:doc.environment.biome,environmentTheme:doc.environment.theme,weather:doc.environment.weather,surface:doc.environment.theme==='reunion'?'mud':'asphalt',editorEnvironment:clone(doc.environment),manualProps:clone(doc.props)};
}

/** One history entry per gesture, including changes made with sliders or 3D handles. */
export class TrackEditorDocument{
  constructor(document=defaultEditorDocument()){this.value=normalizeEditorDocument(document);this.undoStack=[];this.redoStack=[];this.pending=null;}
  begin(){this.pending??=clone(this.value);}
  commit(){
    if(!this.pending)return false;const before=this.pending;this.pending=null;
    if(JSON.stringify(before)===JSON.stringify(this.value))return false;
    this.undoStack.push(before);if(this.undoStack.length>64)this.undoStack.shift();this.redoStack=[];return true;
  }
  cancel(){if(!this.pending)return false;this.value=this.pending;this.pending=null;return true;}
  change(callback){this.begin();try{callback(this.value);this.value=normalizeEditorDocument(this.value);return this.commit();}catch(error){this.cancel();throw error;}}
  patchPiece(index,patch){
    const previous=this.value.pieces[index];if(previous==null)throw new Error('Selecciona un tramo.');
    const p={...(typeof previous==='string'?{id:previous}:previous),...patch};
    for(const key of Object.keys(p))if(p[key]===undefined)delete p[key];samplePiece(p);this.value.pieces[index]=p;
  }
  patchEnvironment(patch){this.value.environment=normalizeEnvironment({...this.value.environment,...patch});}
  patchProp(id,patch){const index=this.value.props.findIndex(p=>p.id===id);if(index<0)throw new Error('Prop no encontrado.');const props=[...this.value.props];props[index]={...props[index],...patch};this.value.props=normalizeProps(props);return this.value.props[index];}
  addProp(type,position){
    let n=1;while(this.value.props.some(p=>p.id===`prop-${n}`))n++;
    const id=`prop-${n}`;this.change(doc=>{doc.props.push({id,type,position,rotation:0,scale:1,grounded:true});});return id;
  }
  undo(){this.commit();if(!this.undoStack.length)return false;this.redoStack.push(clone(this.value));this.value=this.undoStack.pop();return true;}
  redo(){if(!this.redoStack.length)return false;this.undoStack.push(clone(this.value));this.value=this.redoStack.pop();return true;}
  closeCircuit(){const pieces=closeTrackLayout(this.value.pieces);return this.change(doc=>{doc.pieces=pieces;});}
  save(storage){
    try{
      if(!storage)return false;
      const documents=readSavedEditorDocuments(storage).filter(doc=>nameKey(doc)!==nameKey(this.value));
      if(this.value.pieces.length)documents.push(clone(this.value));
      storage.setItem(TRACK_EDITOR_KEY,JSON.stringify(this.value));
      storage.setItem(SAVED_TRACKS_KEY,JSON.stringify({version:1,documents}));return true;
    }catch{return false;}
  }
}
