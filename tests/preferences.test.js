import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PREFERENCES,loadPreferences,savePreferences,normalizePreferences,graphicsPolicy,selectGraphicsPreset} from '../src/preferences.js';
import {AdaptiveResolution} from '../src/performance.js';
import {EnvironmentSystem} from '../src/environment-system.js';
import {renderPreferences} from '../src/preferences-ui.js';
import {Group,InstancedMesh,IcosahedronGeometry,CylinderGeometry,MeshStandardMaterial} from 'three';
import {polishScenery} from '../src/scenery-polish.js';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};};
test('graphics and touch preferences persist independently and reject corrupt choices',()=>{
 const storage=memory(),p={...DEFAULT_PREFERENCES,resolution:'native',touchMode:'trackpad',sensitivity:.7};assert.equal(savePreferences(storage,p),true);assert.deepEqual(loadPreferences(storage),p);
 assert.deepEqual(normalizePreferences({resolution:'broken',samples:100,touchMode:'bad',sensitivity:NaN}),DEFAULT_PREFERENCES);
 assert.deepEqual(loadPreferences({getItem(){throw Error();}}),DEFAULT_PREFERENCES);assert.equal(savePreferences({setItem(){throw Error();}},p),false);
});
test('native and fixed resolutions never drop silently under sustained GPU load',()=>{
 for(const resolution of ['native','2','1.5','1']){const policy=graphicsPolicy({...DEFAULT_PREFERENCES,resolution},3),scaler=new AdaptiveResolution(3,policy),initial=scaler.ratio;for(let i=0;i<5000;i++)scaler.sample(1/15);assert.equal(scaler.ratio,initial);assert.equal(policy.minimum,policy.maximum);}
 assert.equal(graphicsPolicy({...DEFAULT_PREFERENCES,resolution:'native'},3).maximum,3);assert.equal(graphicsPolicy({...DEFAULT_PREFERENCES,resolution:'2'},1).maximum,1);
});
test('the default targets 120 fps and adaptive profiles honour their declared minimum',()=>{
 const scaler=new AdaptiveResolution(3,graphicsPolicy(DEFAULT_PREFERENCES,3));assert.equal(scaler.ratio,1.25);for(let i=0;i<5000;i++)scaler.sample(1/20);assert.equal(scaler.ratio,.75);
 const p=selectGraphicsPreset({...DEFAULT_PREFERENCES,touchMode:'trackpad'},'high');assert.equal(p.touchMode,'trackpad');assert.equal(p.samples,4);assert.equal(graphicsPolicy(p,3).maximum,2);
 const eco=selectGraphicsPreset(p,'performance');assert.equal(graphicsPolicy(eco,3).shadowSize,1024);assert.equal(eco.effects,true);
});
test('MSAA changes respect hardware limits and release the previous render targets',()=>{
 let disposed=0;const targets=[{samples:2,dispose(){disposed++;}},{samples:2,dispose(){disposed++;}}],system={renderer:{capabilities:{maxSamples:4}},grade:{enabled:true},composer:{renderTarget1:targets[0],renderTarget2:targets[1]}};
 EnvironmentSystem.prototype.setGraphics.call(system,{samples:8,postProcessing:true});assert.equal(disposed,2);assert.equal(targets[0].samples,4);
 EnvironmentSystem.prototype.setGraphics.call(system,{samples:4,postProcessing:false});assert.equal(disposed,2);assert.equal(system.postProcessing,false);assert.equal(system.grade.enabled,false);assert.equal(targets[0].samples,4);
});
test('legacy tree fallback meshes stay hidden and old rock masses gain smooth detailed geometry',()=>{
 const g=new Group(),tree=new InstancedMesh(new IcosahedronGeometry(1,0),new MeshStandardMaterial(),1),rock=new InstancedMesh(tree.geometry,new MeshStandardMaterial(),3),round=new InstancedMesh(new CylinderGeometry(1,1,1,8),new MeshStandardMaterial(),1);
 tree.userData.assetFallback='broadleaf';g.add(tree,rock,round);polishScenery(g);assert.equal(tree.visible,false);assert.equal(rock.count,3);assert.ok(rock.geometry.attributes.position.count>tree.geometry.attributes.position.count);assert.equal(round.geometry.parameters.radialSegments,20);assert.ok(rock.geometry.attributes.position.array.every(Number.isFinite));
 const geometry=rock.geometry;polishScenery(g);assert.equal(rock.geometry,geometry);
 const geometries=new Set(),materials=new Set();g.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)materials.add(n.material);});geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());
});
test('settings disclose adaptive resolution and both ways of braking',()=>{
 assert.ok(renderPreferences(DEFAULT_PREFERENCES).includes('Nativa · Máxima nitidez'));assert.ok(renderPreferences(DEFAULT_PREFERENCES).includes('Las resoluciones fijas se mantienen'));
 assert.ok(renderPreferences({...DEFAULT_PREFERENCES,touchMode:'trackpad'},'controls').includes('Segundo dedo: freno progresivo'));assert.ok(renderPreferences(DEFAULT_PREFERENCES,'controls').includes('Ambas para frenar'));
});

test('legacy scenery preferences migrate to the basic profile without losing touch controls',()=>{
 const storage=memory();storage.setItem('roadrushers.preferences.v1',JSON.stringify({version:1,options:{quality:'high',samples:4,shadows:'high',touchMode:'trackpad',sensitivity:.7}}));
 const p=loadPreferences(storage);assert.equal(p.quality,'performance');assert.equal(p.targetFPS,120);assert.equal(p.samples,0);assert.equal(p.touchMode,'trackpad');assert.equal(p.sensitivity,.7);
});
test('120 fps scaling responds to an 80 fps bottleneck that a 60 fps target would tolerate',()=>{
 const highRefresh=new AdaptiveResolution(3,graphicsPolicy(DEFAULT_PREFERENCES,3)),standard=new AdaptiveResolution(3,graphicsPolicy({...DEFAULT_PREFERENCES,targetFPS:60},3));
 for(let i=0;i<500;i++){highRefresh.sample(1/80);standard.sample(1/80);}
 assert.ok(highRefresh.ratio<1.25);assert.equal(standard.ratio,1.25);
 const fixed=new AdaptiveResolution(3,graphicsPolicy({...DEFAULT_PREFERENCES,resolution:'native'},3));for(let i=0;i<1000;i++)fixed.sample(1/80);assert.equal(fixed.ratio,3);
});
test('options group display and sound, controls and performance without environment customization',()=>{
 const game=renderPreferences(DEFAULT_PREFERENCES,'game'),graphics=renderPreferences(DEFAULT_PREFERENCES);
 assert.ok(game.includes('data-sound-toggle'));assert.ok(game.includes('data-preference="showMinimap"'));assert.ok(game.includes('data-preference="showSpeed"'));
 assert.ok(graphics.includes('data-preference="targetFPS"'));assert.ok(graphics.includes('data-preference="showStats"'));assert.ok(!graphics.includes('Detalle del entorno'));assert.ok(graphics.includes('data-preference="shadows"'));
});

test('FPS, smoke, tyre marks and soft shadows are enabled for new and existing players',()=>{
 for(const version of [null,2]){
  const storage=memory();if(version)storage.setItem('roadrushers.preferences.v1',JSON.stringify({version,options:{...DEFAULT_PREFERENCES,effects:false,showStats:false,touchMode:'trackpad'}}));
  const p=loadPreferences(storage);assert.equal(p.effects,true);assert.equal(p.showStats,true);assert.equal(p.statsDetailed,false);assert.equal(p.shadows,'medium');
  if(version)assert.equal(p.touchMode,'trackpad');
 }
 for(const id of ['performance','balanced','high']){const p=selectGraphicsPreset(DEFAULT_PREFERENCES,id);assert.equal(p.effects,true);assert.ok(graphicsPolicy(p,3).shadowSize>=1024);}
 const storage=memory(),custom={...DEFAULT_PREFERENCES,effects:false,showStats:false,shadows:'off'};savePreferences(storage,custom);assert.deepEqual(loadPreferences(storage),custom);
});
