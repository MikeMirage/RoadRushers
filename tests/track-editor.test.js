import test from 'node:test';
import assert from 'node:assert/strict';
import { Group,Raycaster,Vector3 } from 'three';
import { TrackEditorDocument,TRACK_EDITOR_KEY,defaultEditorDocument,normalizeEditorDocument,readEditorDocument,parseEditorFile,editorTrackConfig } from '../src/track-editor-state.js';
import { PROP_CATALOG,MAX_MANUAL_PROPS,normalizeProps,propRoadWarnings } from '../src/prop-catalog.js';
import { buildPropPrefab,ManualPropLayer } from '../src/manual-props.js';
import { themePreset,environmentForTrack } from '../src/environment-config.js';
import { Circuit } from '../src/circuit.js';
import { resolvePlayground,playgroundTracks } from '../src/playground.js';
import { escapeHTML } from '../src/track-editor-ui.js';

const prop=(id='prop-1',type='pine',position=[30,0,20])=>({id,type,position,rotation:0,scale:1,grounded:true});
const memory=()=>{const items=new Map();return {getItem:key=>items.get(key)||null,setItem:(key,value)=>items.set(key,value)};};
test('editor migrates old kits and round trips complete manual documents',()=>{
  const storage=memory(),base=defaultEditorDocument();storage.setItem('roadrushers.track-kit.v1',JSON.stringify({...base,theme:'sahara',environment:undefined,biome:'desert'}));
  const legacy=readEditorDocument(storage);assert.equal(legacy.environment.theme,'sahara');assert.deepEqual(legacy.pieces,base.pieces);
  const doc=new TrackEditorDocument(legacy);doc.addProp('chalet',[40,3,20]);doc.change(()=>doc.patchEnvironment({solarMode:'manual',sunAzimuth:78,sunElevation:24,wetness:.4}));
  assert.equal(doc.save(storage),true);assert.deepEqual(readEditorDocument(storage),doc.value);assert.deepEqual(parseEditorFile(storage.getItem(TRACK_EDITOR_KEY)),doc.value);
  storage.setItem(TRACK_EDITOR_KEY,'broken JSON');assert.deepEqual(readEditorDocument(storage),legacy);
  assert.equal(doc.save({setItem(){throw new Error('quota');}}),false);
});
test('history groups a slider or 3D gesture, branches on new edits and rolls failures back',()=>{
  const doc=new TrackEditorDocument();doc.addProp('pine',[10,0,10]);const before=structuredClone(doc.value),count=doc.undoStack.length;
  doc.begin();for(let x=11;x<30;x++)doc.patchProp('prop-1',{position:[x,0,10]});doc.patchEnvironment({hour:18});doc.commit();assert.equal(doc.undoStack.length,count+1);
  const after=structuredClone(doc.value);doc.undo();assert.deepEqual(doc.value,before);doc.redo();assert.deepEqual(doc.value,after);
  doc.undo();doc.change(()=>doc.patchEnvironment({hour:8}));assert.equal(doc.redo(),false);
  const saved=structuredClone(doc.value);assert.throws(()=>doc.change(d=>{d.pieces=['unknown-piece'];}));assert.deepEqual(doc.value,saved);
  doc.begin();doc.patchProp('prop-1',{scale:2});doc.cancel();assert.deepEqual(doc.value,saved);
  doc.begin();assert.equal(doc.commit(),false);
});
test('import rejects malformed layouts and duplicate or excessive props without losing a draft',()=>{
  const base=defaultEditorDocument();for(const pieces of [['unknown'],[{id:'straight',length:'20'}],Array(129).fill('straight')])assert.throws(()=>normalizeEditorDocument({...base,pieces}));
  assert.throws(()=>parseEditorFile('x'.repeat(1024*1024+1)));assert.throws(()=>normalizeProps([prop(),prop()]));assert.throws(()=>normalizeProps(Array.from({length:MAX_MANUAL_PROPS+1},(_,i)=>prop(`p${i}`))));
  assert.throws(()=>normalizeProps([prop('p','unknown')]));assert.throws(()=>normalizeProps([prop('p','pine',[NaN,0,0])]));assert.equal(escapeHTML('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');
});
test('playing an editor track uses the basic theme and preserves the authored document',()=>{
  const doc=new TrackEditorDocument();doc.addProp('chalet',[40,0,30]);doc.change(d=>{d.environment={...themePreset('amalfi'),solarMode:'manual',sunAzimuth:97,sunElevation:19,contrast:1.2,weather:'sunset',hour:17.3};});
  const before=structuredClone(doc.value),config=editorTrackConfig(doc.value),resolved=resolvePlayground({trackId:config.id,weather:'rain',width:'original'},playgroundTracks(config));
  assert.equal(resolved.settings.track.environmentTheme,'basic');assert.equal(resolved.settings.weather,'rain');assert.ok(new Circuit(resolved.settings.track).closed);
  assert.deepEqual(doc.value,before);assert.deepEqual(environmentForTrack(config),doc.value.environment);
  doc.change(d=>d.pieces.pop());assert.throws(()=>editorTrackConfig(doc.value));
});
test('all manual prop prefabs have finite geometry and their base on the ground',()=>{
  for(const d of PROP_CATALOG){const prefab=buildPropPrefab(d.id);assert.ok(prefab.parts.length>0,d.id);assert.ok(Math.abs(prefab.bounds.min.y)<1e-6,d.id);assert.ok(prefab.bounds.max.y>.3,d.id);
    for(const p of prefab.parts){assert.ok(p.geometry.attributes.position.array.every(Number.isFinite),d.id);assert.ok(p.geometry.attributes.normal.array.every(Number.isFinite),d.id);assert.ok(p.geometry.attributes.position.count>0);p.geometry.dispose();p.material.dispose();}
  }
});
test('manual props instance by type and remain pickable after moving beyond their cached bounds',()=>{
  const parent=new Group(),layer=new ManualPropLayer(parent,[prop('a','pine',[0,0,0]),prop('b','pine',[10,0,0])]),draws=layer.batches.length;
  assert.ok(draws<=3);for(const b of layer.batches)assert.equal(b.mesh.count,2);parent.updateMatrixWorld(true);
  assert.equal(layer.pick(new Raycaster(new Vector3(0,20,0),new Vector3(0,-1,0))).id,'a');
  layer.updateRecord({...prop('a','pine',[500,0,500]),scale:2,rotation:45});parent.updateMatrixWorld(true);
  const hit=layer.pick(new Raycaster(new Vector3(500,30,500),new Vector3(0,-1,0)));assert.equal(hit.id,'a');assert.ok(layer.boundsFor('a').max.y>12);
  layer.setRecords([prop('a'),prop('b'),prop('c')]);assert.equal(layer.batches.length,draws);for(const b of layer.batches)assert.equal(b.mesh.count,3);
  layer.dispose();assert.equal(parent.children.length,0);
});
test('decorative prop warnings account for elevated road clearance',()=>{
  const config=editorTrackConfig(defaultEditorDocument()),c=new Circuit(config),p=c.at(.1),grounded=prop('under','cone',[p.x,p.y-10,p.z]),inLane=prop('lane','pine',[p.x,p.y,p.z]);
  assert.deepEqual(propRoadWarnings([grounded,inLane],c),['lane']);
});
