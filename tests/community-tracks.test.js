import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMUNITY_TRACKS} from '../src/community-tracks.js';
import {Circuit} from '../src/circuit.js';
import {NEW_VEHICLES} from '../src/vehicle-catalog.js';
import {DEFAULT_PLAYGROUND,playgroundTracks,resolvePlayground,loadPlayground,savePlayground} from '../src/playground.js';
import {renderPlayground} from '../src/playground-ui.js';
import {TrackEditorDocument,editorTrackConfig} from '../src/track-editor-state.js';

const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};};
const lawson=COMMUNITY_TRACKS.find(track=>track.id==='lawson-superstar-v1');

test('Lawson Superstar is bundled for fresh players with its complete, closed 81-section layout',()=>{
  const tracks=playgroundTracks(undefined,storage());
  assert.equal(tracks.filter(track=>track.id===lawson.id).length,1);
  assert.equal(lawson.name,'Lawson Superstar');assert.equal(lawson.layout.length,81);
  const circuit=new Circuit(lawson);
  assert.equal(circuit.closed,true);assert.deepEqual(circuit.layout.errors,[]);
  assert.ok(circuit.length>4271&&circuit.length<4273);
  assert.ok(circuit.layout.gap<1e-6&&circuit.layout.heightGap<1e-6);
  assert.ok(circuit.layout.crossings.every(crossing=>crossing.clearance>=4));
});

test('Lawson can be selected, saved and launched in practice or races with collection cars',()=>{
  for(const mode of ['practice','race']){
    const memory=storage(),options={...DEFAULT_PLAYGROUND,mode,vehicleId:NEW_VEHICLES.at(-1).id,trackId:lawson.id};
    savePlayground(memory,options);
    const loaded=loadPlayground(memory),result=resolvePlayground(loaded,playgroundTracks(undefined,memory));
    assert.equal(loaded.trackId,lawson.id);assert.equal(result.error,null);
    assert.equal(result.settings.mode,mode);assert.equal(result.settings.vehicle.id,options.vehicleId);
    assert.equal(result.settings.track.name,lawson.name);
    const html=renderPlayground(loaded,playgroundTracks(undefined,memory));
    assert.ok(html.includes(`value="${lawson.id}" selected`));
    assert.ok(html.includes('Editar este circuito'));
    assert.ok(!html.includes('class="primary-button" disabled'));
  }
});

test('the bundled Lawson track retains an editable document with the same route',()=>{
  const editor=new TrackEditorDocument(lawson.editorDocument),config=editorTrackConfig(editor.value);
  assert.deepEqual(config.layout,lawson.layout);assert.equal(config.name,lawson.name);
  assert.equal(config.editorError,null);
});
