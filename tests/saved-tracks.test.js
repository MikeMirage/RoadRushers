import test from 'node:test';
import assert from 'node:assert/strict';
import { TrackEditorDocument,TRACK_EDITOR_KEY,SAVED_TRACKS_KEY,defaultEditorDocument,readSavedEditorDocuments,savedEditorTrackId,readSavedEditorDocument } from '../src/track-editor-state.js';
import { playgroundTracks,resolvePlayground,loadPlayground,savePlayground,DEFAULT_PLAYGROUND } from '../src/playground.js';
import { renderPlayground } from '../src/playground-ui.js';

const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('the existing editor draft appears in the game list without needing another save',()=>{
  const storage=memory(),doc={...defaultEditorDocument(),name:'LawsonSuperstar'};
  storage.setItem(TRACK_EDITOR_KEY,JSON.stringify(doc));
  const tracks=playgroundTracks(undefined,storage),saved=tracks.find(t=>t.name===doc.name);
  assert.ok(saved);assert.equal(saved.editorError,null);
  assert.deepEqual(readSavedEditorDocument(storage,saved.id),doc);
  const options={...DEFAULT_PLAYGROUND,trackId:saved.id};savePlayground(storage,options);
  assert.equal(loadPlayground(storage).trackId,saved.id);
  const result=resolvePlayground(loadPlayground(storage),tracks);
  assert.equal(result.error,null);assert.equal(result.settings.track.name,doc.name);
});
test('saving another named circuit retains previous circuits and updating a name replaces it',()=>{
  const storage=memory(),doc=new TrackEditorDocument();doc.change(d=>{d.name='Primero';});assert.equal(doc.save(storage),true);
  const first=structuredClone(doc.value);doc.change(d=>{d.name='Segundo';d.pieces=['straight'];});doc.save(storage);
  let documents=readSavedEditorDocuments(storage);assert.equal(documents.length,2);assert.deepEqual(documents.find(d=>d.name==='Primero'),first);
  doc.change(d=>{d.pieces=['straight-long'];});doc.save(storage);
  documents=readSavedEditorDocuments(storage);assert.equal(documents.length,2);assert.deepEqual(documents.find(d=>d.name==='Segundo').pieces,['straight-long']);
  const tracks=playgroundTracks(undefined,storage);assert.equal(new Set(tracks.map(t=>t.id)).size,tracks.length);
  doc.change(d=>{d.name='Nuevo';d.pieces=[];});doc.save(storage);assert.equal(readSavedEditorDocuments(storage).length,2);
});
test('open or invalid saved circuits stay visible with a reason and cannot be launched',()=>{
  const storage=memory(),doc=new TrackEditorDocument({...defaultEditorDocument(),name:'<Lawson>',pieces:['straight']});doc.save(storage);
  const tracks=playgroundTracks(undefined,storage),id=savedEditorTrackId(doc.value),options={...DEFAULT_PLAYGROUND,trackId:id};
  const result=resolvePlayground(options,tracks);assert.match(result.error,/cerrado/);
  const html=renderPlayground(options,tracks);assert.ok(html.includes('&lt;Lawson&gt; · Revisar en editor'));assert.ok(html.includes('Editar este circuito'));
  assert.match(html,/<button type="submit" class="primary-button" disabled>/);
  savePlayground(storage,options);assert.equal(loadPlayground(storage).trackId,id);
});
test('corrupted saved records do not hide healthy circuits or overwrite their draft',()=>{
  const storage=memory(),doc={...defaultEditorDocument(),name:'Conservado'};
  storage.setItem(SAVED_TRACKS_KEY,JSON.stringify({version:1,documents:[{pieces:['bad']},doc]}));
  storage.setItem(TRACK_EDITOR_KEY,'broken');assert.deepEqual(readSavedEditorDocuments(storage),[doc]);
  assert.equal(new TrackEditorDocument(doc).save({getItem:()=>null,setItem(){throw Error('quota');}}),false);
  assert.equal(new TrackEditorDocument(doc).save(null),false);
  assert.deepEqual(playgroundTracks(),playgroundTracks(undefined,{getItem(){throw Error();}}));
});
