import test from 'node:test';
import assert from 'node:assert/strict';
import { closeTrackLayout } from '../src/track-closure.js';
import { compileLayout,KIT_PRESETS,samplePiece,MAX_TRACK_PIECES } from '../src/track-pieces.js';
import { TrackEditorDocument,defaultEditorDocument,parseEditorFile,editorTrackConfig } from '../src/track-editor-state.js';
import { Circuit } from '../src/circuit.js';
import { resolvePlayground,playgroundTracks,DEFAULT_PLAYGROUND } from '../src/playground.js';
import { renderPlayground } from '../src/playground-ui.js';
const closed=value=>{const c=compileLayout(value);assert.equal(c.closed,true);assert.ok(c.gap<1e-6);assert.ok(c.heightGap<1e-6);assert.ok(c.angleGap<1e-6);assert.equal(c.endWidth,10);return c;};

test('automatic closure joins position, heading, height and width using normal editable modules',()=>{
  for(const pieces of [
    ['straight'],['straight','curve-wide-left'],['ramp-up','curve-wide-right'],
    ['straight','curve-wide-right','straight'],['straight','curve-medium-left','straight','curve-medium-left'],
    ['width-16','ramp-up','curve-medium-left'],['climb-360-right-up'],
  ]){
    const before=structuredClone(pieces),value=closeTrackLayout(pieces),c=closed(value);
    assert.deepEqual(pieces,before);assert.deepEqual(c.errors,[]);assert.ok(c.maxGrade<=.36);
    for(const p of value)samplePiece(p);
    const circuit=new Circuit(editorTrackConfig({...defaultEditorDocument(),pieces:value}));assert.ok(circuit.closed);
    const start=circuit.at(0),end=circuit.at(1-1e-8);assert.ok(Math.hypot(start.x-end.x,start.z-end.z,start.y-end.y)<1e-3);
  }
});
test('a small final misalignment fits the last connector instead of adding an unnecessary loop',()=>{
  const pieces=['straight-long','curve-medium-left','straight-long','curve-medium-left',{id:'straight',length:80},'curve-medium-left',{id:'straight',length:39.5},'curve-medium-left',{id:'ramp-up',length:39.5,rise:.5}];
  const value=closeTrackLayout(pieces);closed(value);assert.equal(value.length,pieces.length);assert.match(value.at(-1).id,/offset/);
  assert.deepEqual(value.slice(0,-1),pieces.slice(0,-1));assert.deepEqual(compileLayout(value).errors,[]);
});
test('closure is one undoable gesture, survives JSON export, and is a no-op once closed',()=>{
  const doc=new TrackEditorDocument({...defaultEditorDocument(),name:'Cierre',pieces:['ramp-up','curve-wide-left']}),before=structuredClone(doc.value);
  assert.equal(doc.closeCircuit(),true);const after=structuredClone(doc.value);closed(after.pieces);
  assert.deepEqual(parseEditorFile(JSON.stringify(after)),after);assert.equal(doc.undoStack.length,1);
  assert.equal(doc.closeCircuit(),false);assert.equal(doc.undoStack.length,1);
  doc.undo();assert.deepEqual(doc.value,before);doc.redo();assert.deepEqual(doc.value,after);
});
test('empty or full assemblies fail without modifying existing pieces, and width-only closure fits in place',()=>{
  assert.throws(()=>closeTrackLayout([]),/al menos/);
  const full=Array(MAX_TRACK_PIECES).fill('straight');assert.throws(()=>closeTrackLayout(full),/límite/);assert.equal(full.length,MAX_TRACK_PIECES);
  const pieces=structuredClone(KIT_PRESETS[0].pieces);pieces[pieces.length-1]={id:pieces.at(-1),widthFactorTo:1.4};
  assert.equal(compileLayout(pieces).closed,true);const value=closeTrackLayout(pieces);assert.equal(value.length,pieces.length);closed(value);
});

test('steep closed circuits show a warning and remain playable in practice and races',()=>{
  const pieces=closeTrackLayout([{id:'ramp-up',length:16,rise:6},'curve-wide-left']);
  const layout=closed(pieces);assert.ok(layout.maxGrade>.36);assert.deepEqual(layout.errors,[]);
  assert.equal(layout.warnings.length,1);assert.match(layout.warnings[0],/36 %/);
  const config=editorTrackConfig({...defaultEditorDocument(),name:'Pendientes y saltos',pieces});
  for(const mode of ['practice','race']){
    const tracks=playgroundTracks(config),options={...DEFAULT_PLAYGROUND,trackId:config.id,mode},result=resolvePlayground(options,tracks);
    assert.equal(result.error,null);assert.deepEqual(result.warnings,layout.warnings);
    const html=renderPlayground(options,tracks);assert.match(html,/role="status">Aviso:.*36 %/);
    assert.doesNotMatch(html,/<button type="submit" class="primary-button" disabled>/);
  }
});

test('a slope warning does not suppress genuine errors or force an open track to close',()=>{
  const pieces=[{id:'ramp-up',length:16,rise:6}],before=structuredClone(pieces),layout=compileLayout(pieces);
  assert.equal(layout.closed,false);assert.equal(layout.warnings.length,1);assert.deepEqual(pieces,before);
  assert.throws(()=>editorTrackConfig({...defaultEditorDocument(),pieces}),/cerrado/);
  const below=compileLayout([{id:'ramp-down',length:16,rise:-6}]);assert.equal(below.warnings.length,1);
  assert.ok(below.errors.some(e=>e.includes('debajo')));
});
