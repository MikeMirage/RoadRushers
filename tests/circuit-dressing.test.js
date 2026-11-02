import test from 'node:test';
import assert from 'node:assert/strict';
import { Circuit } from '../src/circuit.js';
import { KIT_PRESETS,kitConfig } from '../src/track-pieces.js';
import { addCircuitInfrastructure,generateCircuitDressing,normalizeCircuitDressing,activeCircuitDressing,DRESSING_LIMITS,corridorIndex } from '../src/circuit-dressing.js';
import { buildCircuitDressing } from '../src/circuit-dressing-view.js';
import { TrackEditorDocument,editorTrackConfig,parseEditorFile,readEditorDocument } from '../src/track-editor-state.js';
import { trackCurbs } from '../src/road-geometry.js';
import { disposeSceneGroup } from '../src/basic-scene.js';
import { resolvePlayground,playgroundTracks,DEFAULT_PLAYGROUND } from '../src/playground.js';

const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('resolved dressing survives save, reload, export and launching the saved track',()=>{
  const doc=new TrackEditorDocument(),storage=memory(),c=new Circuit(editorTrackConfig(doc.value));
  const recipe=generateCircuitDressing(c);assert.deepEqual(generateCircuitDressing(c),recipe);
  doc.change(d=>{d.circuitDressing=recipe;});assert.ok(doc.save(storage));
  assert.deepEqual(readEditorDocument(storage).circuitDressing,recipe);
  assert.deepEqual(parseEditorFile(JSON.stringify(doc.value)).circuitDressing,recipe);
  const tracks=playgroundTracks(undefined,storage),id=editorTrackConfig(doc.value).id;
  const result=resolvePlayground({...DEFAULT_PLAYGROUND,theme:'grass',trackId:id},tracks);
  assert.deepEqual(activeCircuitDressing(new Circuit(result.settings.track)),recipe);
  doc.change(d=>{d.name='Renamed';});assert.deepEqual(doc.value.circuitDressing,recipe);
  doc.change(d=>{d.startHeight=4;});assert.equal(doc.value.circuitDressing,undefined);
  doc.undo();assert.deepEqual(doc.value.circuitDressing,recipe);
  const wider=new Circuit({...editorTrackConfig(doc.value),width:14});assert.equal(activeCircuitDressing(wider),null);
});
test('all presets obey hard budgets, preserve gaps and keep props outside driving corridors',()=>{
  for(const preset of KIT_PRESETS){
    const c=new Circuit(kitConfig(preset.pieces)),d=generateCircuitDressing(c),clear=corridorIndex(c);
    assert.deepEqual(normalizeCircuitDressing(d),d);
    for(const key of ['segments','tires','boards'])assert.ok(d[key].length<=DRESSING_LIMITS[key],preset.name);
    for(const [a,b] of d.segments)assert.ok(c.hasRoad((a+b)/2),preset.name);
    for(const [u,offset]of d.tires){const p=c.at(u,offset);assert.ok(clear(p,.5,1.05),`${preset.name} tire ${u}`);assert.ok(Math.abs(p.y)<.5);}
    for(const [u,offset]of d.boards)assert.ok(clear(c.at(u,offset),2.5,1.6),`${preset.name} board`);
    assert.ok(JSON.stringify(d).length<400000);
  }
});
test('generated geometry has finite bounds, correct route attributes, instancing and a bounded triangle count',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[0].pieces)),d=generateCircuitDressing(c),group=buildCircuitDressing(c,d);
  let triangles=0,batches=0;
  group.traverse(o=>{
    if(!o.isMesh)return;
    const positions=o.geometry.attributes.position;
    for(const n of positions.array)assert.ok(Number.isFinite(n));
    if(o.userData.playerOccluder)assert.equal(o.geometry.attributes.occlusionRoute.count,o.isInstancedMesh?o.count:positions.count);
    triangles+=(o.geometry.index?.count??positions.count)/3*(o.isInstancedMesh?o.count:1);
    if(o.isInstancedMesh){batches++;assert.ok(o.boundingSphere.radius>0);assert.equal(o.frustumCulled,true);}
  });
  assert.ok(batches>0);assert.ok(triangles<65000,`Environment: ${triangles} triangles`);
  disposeSceneGroup(group);
});
test('malformed or unbounded saved environment records are rejected',()=>{
  const d=generateCircuitDressing(new Circuit(kitConfig(KIT_PRESETS[0].pieces)));
  for(const broken of [{...d,version:99},{...d,tires:[[NaN,3]]},{...d,boards:[[.3,1000]]},{...d,segments:[[.8,.2,1,3,0,0]]},{...d,tires:Array(145).fill([.2,12])}])assert.throws(()=>normalizeCircuitDressing(broken));
});

test('original curbs retain their transforms with or without dressing and use red and white',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[0].pieces)),before=trackCurbs(c);
  c.config.circuitDressing=generateCircuitDressing(c);const after=trackCurbs(c);
  assert.deepEqual(after.instanceMatrix.array,before.instanceMatrix.array);
  assert.equal(after.count,Math.floor(c.length/2.3)*2);
  const colors=after.instanceColor.array;
  assert.ok(colors[0]>.8&&colors[1]>.8&&colors[2]>.8);
  assert.ok(colors[6]>colors[7]*8&&colors[6]>colors[8]*8);
  const group=buildCircuitDressing(c,c.config.circuitDressing);
  assert.ok(!group.children.some(o=>o.name.includes('curb')));
  for(const [u,offset]of c.config.circuitDressing.tires)assert.ok(Math.abs(Math.abs(offset)-c.widthAt(u)/2-1.65)<.001);
  const tireBatches=group.children.filter(o=>o.name.startsWith('club-tires-'));
  assert.ok(tireBatches.length);assert.ok(tireBatches.every(o=>o.instanceColor));
  disposeSceneGroup(group);before.geometry.dispose();before.material.dispose();before.dispose();after.geometry.dispose();after.material.dispose();after.dispose();
});

test('infrastructure controls persist and never move the existing curbs, margins or tires',()=>{
  const doc=new TrackEditorDocument(),c=new Circuit(editorTrackConfig(doc.value)),base=generateCircuitDressing(c);
  const enabled=addCircuitInfrastructure(c,base,{railDensity:1,fenceDensity:1,advertisingDensity:1});
  assert.ok(enabled.infrastructure.rails.length);assert.ok(enabled.infrastructure.fences.length);assert.ok(enabled.infrastructure.ads.length);
  for(const kind of ['segments','tires','boards'])assert.deepEqual(enabled[kind],base[kind]);
  const disabled=addCircuitInfrastructure(c,enabled,{rails:false,fences:false,advertising:false});
  assert.deepEqual(disabled.infrastructure,{rails:[],fences:[],ads:[]});
  doc.change(d=>{d.circuitDressing=enabled;d.circuitDressingOptions=enabled.options;});
  const exported=parseEditorFile(JSON.stringify(doc.value));assert.deepEqual(exported.circuitDressing,enabled);assert.deepEqual(exported.circuitDressingOptions,enabled.options);
  const clear=corridorIndex(c);
  for(const [kind,offset,height]of [['rails',3.8,1],['fences',4.5,2.7]])for(const [a,b,side]of enabled.infrastructure[kind])for(const u of [a,(a+b)/2,b])assert.ok(clear(c.at(u,side*(c.widthAt(u)/2+offset)),.4,height));
  const sparse=addCircuitInfrastructure(c,base,{railDensity:.2,fenceDensity:.2,advertisingDensity:.2});assert.ok(sparse.infrastructure.rails.length<enabled.infrastructure.rails.length);
});

test('braking markers store real along-track distances and preserve existing safety elements',()=>{
  const c=new Circuit(kitConfig(KIT_PRESETS[4].pieces)),d=generateCircuitDressing(c),clear=corridorIndex(c);
  assert.ok(d.markers.braking.length>0);assert.ok(d.markers.start.length>0);
  assert.deepEqual(normalizeCircuitDressing(d),d);
  for(const [u,offset,meters,target]of d.markers.braking){
    const distance=((target-u+1)%1)*c.length;assert.ok(Math.abs(distance-meters)<.02);
    assert.ok(clear(c.at(u,offset),.8,2));
    for(const [v,o]of d.tires){const p=c.at(u,offset),t=c.at(v,o);assert.ok(Math.hypot(p.x-t.x,p.z-t.z)>1.4);}
  }
  const updated=addCircuitInfrastructure(c,d,{rails:false});assert.deepEqual(updated.markers,d.markers);assert.deepEqual(updated.tires,d.tires);
  const doc=new TrackEditorDocument({...new TrackEditorDocument().value,pieces:KIT_PRESETS[4].pieces});doc.change(v=>{v.circuitDressing=d;});
  assert.deepEqual(parseEditorFile(JSON.stringify(doc.value)).circuitDressing.markers,d.markers);
  const bad=structuredClone(d);bad.markers.braking[0][2]=999;assert.throws(()=>normalizeCircuitDressing(bad));
});
