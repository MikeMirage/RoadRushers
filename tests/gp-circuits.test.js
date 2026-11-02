import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PerspectiveCamera,Raycaster,Vector3} from 'three';
import {GP_CIRCUITS} from '../src/gp-circuits.js';
import {findBundledEditorTrack} from '../src/community-tracks.js';
import {Circuit} from '../src/circuit.js';
import {makeRaceTrack} from '../src/race.js';
import {DEFAULT_PLAYGROUND,playgroundTracks,resolvePlayground} from '../src/playground.js';
import {renderPlayground} from '../src/playground-ui.js';
import {TrackEditorDocument,normalizeEditorDocument,editorTrackConfig,parseEditorFile} from '../src/track-editor-state.js';
import {trackStructures} from '../src/road-geometry.js';
import {LocalOcclusion} from '../src/local-occlusion.js';
import {disposeSceneGroup} from '../src/basic-scene.js';
import {trackPanel} from '../src/track-editor-ui.js';

const references=JSON.parse(readFileSync(new URL('../art/gp-circuits/reference.json',import.meta.url),'utf8'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} differs from ${b}`);
const distanceToPath=(point,path)=>{
  let nearest=Infinity;
  for(let i=0;i<path.length;i++){
    const a=path[i],b=path[(i+1)%path.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/(dx*dx+dz*dz||1)));
    nearest=Math.min(nearest,Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dz));
  }
  return nearest;
};

for(const track of GP_CIRCUITS)test(`${track.gp.inspiration}: a recognizable, closed 1–2 km circuit that launches and round-trips through the editor`,()=>{
  const circuit=new Circuit(track),layout=circuit.layout;
  assert.ok(circuit.length>=1000&&circuit.length<=2000);assert.equal(circuit.closed,true);
  assert.deepEqual(layout.errors,[]);assert.ok(layout.maxGrade<=.36);assert.ok(layout.minHeight>-.001);
  assert.ok(track.editorDocument.pieces.length<=128&&track.editorDocument.pieces.length>=60);
  assert.ok(layout.gap<1e-5&&layout.heightGap<1e-5&&layout.angleGap<1e-5);
  assert.equal(makeRaceTrack(track).error,null);
  for(const mode of ['practice','race'])assert.equal(resolvePlayground({...DEFAULT_PLAYGROUND,mode,trackId:track.id}).error,null);
  const draft=new TrackEditorDocument(parseEditorFile(JSON.stringify(track.editorDocument))),restored=new Circuit(editorTrackConfig(draft.value));
  near(restored.length,circuit.length);assert.deepEqual(restored.layout.errors,[]);
  for(const u of [0,.1,.3,.5,.8,.999]){
    const a=circuit.at(u),b=restored.at(u);near(a.x,b.x);near(a.y,b.y);near(a.z,b.z);
  }
  assert.equal(findBundledEditorTrack(draft.value).id,track.id);
  const sourceBefore=JSON.stringify(track.editorDocument);draft.change(doc=>{doc.name+=' personal';});
  assert.equal(findBundledEditorTrack(draft.value),undefined);assert.equal(JSON.stringify(track.editorDocument),sourceBefore);
  const reference=references.find(item=>item.id===track.id),angle=reference.heading;
  const path=circuit.samples.filter((_,index)=>index%4===0).map(p=>[
    p.x*Math.cos(angle)+p.z*Math.sin(angle)+reference.startPoint[0],
    -p.x*Math.sin(angle)+p.z*Math.cos(angle)+reference.startPoint[1],
  ]);
  const distances=[...reference.reference.map(p=>distanceToPath(p,path)),...path.map(p=>distanceToPath(p,reference.reference))];
  assert.ok(Math.max(...distances)<12,`${track.name}: adaptation strayed from the geographic silhouette`);
  assert.ok(distances.reduce((sum,n)=>sum+n,0)/distances.length<3,`${track.name}: average geographic deviation is too large`);
});

test('the eight GP circuits are available without browser saves and include grouped choices and driving guides',()=>{
  assert.equal(GP_CIRCUITS.length,8);
  assert.equal(new Set(GP_CIRCUITS.map(track=>track.id)).size,8);
  const tracks=playgroundTracks(undefined,{getItem:()=>null});
  for(const track of GP_CIRCUITS){
    assert.equal(tracks.filter(t=>t.id===track.id).length,1);
    const html=renderPlayground({...DEFAULT_PLAYGROUND,trackId:track.id},tracks);
    assert.ok(html.includes('<optgroup label="GP mundiales · 1–2 km">'));
    assert.ok(html.includes('Guía de trazada'));assert.ok(html.includes('Editar este circuito'));
    assert.ok(!html.includes('class="primary-button" disabled'));
    assert.equal(track.gp.guide.length,3);assert.ok(track.gp.sources.every(url=>url.startsWith('https://')));
  }
});

test('Suzuka crosses over itself on distinct levels with sufficient driving clearance',()=>{
  const circuit=new Circuit(GP_CIRCUITS.find(track=>track.gp.slug==='suzuka'));
  assert.equal(circuit.layout.crossings.length,1);
  const crossing=circuit.layout.crossings[0];assert.ok(crossing.clearance>6);
  near(circuit.at(crossing.upperProgress).y-circuit.at(crossing.lowerProgress).y,crossing.clearance);
});

test('Monaco has one continuous curved tunnel with open driving clearance and working overhead visibility',()=>{
  const circuit=new Circuit(GP_CIRCUITS.find(track=>track.gp.slug==='monaco')),structures=trackStructures(circuit);
  structures.updateMatrixWorld(true);
  assert.equal(structures.children.filter(child=>child.name==='tunnel').length,1);
  const sections=circuit.layout.sections.filter(section=>section.spec.tunnel),from=sections[0].from/circuit.length,to=sections.at(-1).to/circuit.length;
  assert.ok((to-from)*circuit.length>200);
  const effect=new LocalOcclusion();effect.bind(structures,circuit);
  for(const fraction of [.15,.4,.65,.85]){
    const progress=from+(to-from)*fraction,p=circuit.at(progress);
    const ray=new Raycaster(new Vector3(p.x,p.y+1,p.z),new Vector3(0,1,0));
    const hits=ray.intersectObject(structures,true);
    assert.ok(hits.length&&hits[0].distance>3.5&&hits[0].distance<4.1,'the roof must follow the bend without blocking the lane');
    const camera=new PerspectiveCamera(45,1.5,.1,700);camera.position.set(p.x+24,p.y+48,p.z+24);camera.lookAt(p.x,p.y+.5,p.z);camera.updateMatrixWorld();
    effect.reset();effect.update(1/60,{...p,progress,groundY:p.y,vx:0,vz:16},camera,{getDrawingBufferSize:size=>size.set(1200,800)});
    assert.equal(effect.covered,true);
  }
  effect.clear();disposeSceneGroup(structures);
});

test('elevated starting datums and curved covers survive import while malformed definitions are rejected',()=>{
  const track=GP_CIRCUITS.find(t=>t.gp.slug==='spa'),doc=normalizeEditorDocument(track.editorDocument);
  assert.equal(doc.startHeight,6);near(new Circuit(editorTrackConfig(doc)).at(0).y,6);
  assert.throws(()=>normalizeEditorDocument({...doc,startHeight:-1}));
  assert.throws(()=>normalizeEditorDocument({...doc,startHeight:Infinity}));
  assert.throws(()=>normalizeEditorDocument({...doc,pieces:[{id:'straight',tunnel:'yes'}]}));
  const editor=new TrackEditorDocument(doc);editor.closeCircuit();
  near(editor.value.startHeight,6);assert.deepEqual(new Circuit(editorTrackConfig(editor.value)).layout.errors,[]);
});

test('the editor controls represent imported long straights, broad radii and small curve angles without clamping',()=>{
  const cases=[];
  for(const track of GP_CIRCUITS)for(const [index,piece]of track.editorDocument.pieces.entries()){
    if(piece.radius>100||piece.angle<5||piece.length>160||piece.length<4)cases.push({track,index,piece});
  }
  assert.ok(cases.length>10);
  for(const {track,index,piece}of cases){
    const editor={document:new TrackEditorDocument(track.editorDocument),compiled:new Circuit(track).layout,focusSection:index,palettePiece:'straight-short'};
    const html=trackPanel(editor),label=piece.angle!=null?'Giro (°), valor':'Longitud (m), valor';
    const input=html.match(/<input[^>]+>/g).find(tag=>tag.includes(`aria-label="${label}"`));
    const attribute=name=>Number(input.match(new RegExp(`${name}="([^"]+)"`))[1]);
    assert.ok(attribute('value')>=attribute('min')&&attribute('value')<=attribute('max'),`${track.name}: ${input}`);
    if(piece.radius!=null){
      const radiusInput=html.match(/<input[^>]+>/g).find(tag=>tag.includes('aria-label="Radio (m), valor"'));
      assert.ok(Number(radiusInput.match(/max="([^"]+)"/)[1])>=piece.radius);
    }
    assert.ok(html.includes('Cota de salida (m)'));
  }
});
