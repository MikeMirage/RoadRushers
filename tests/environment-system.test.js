import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, ShaderLib } from 'three';
import { ENVIRONMENT_THEMES, normalizeEnvironment, solarPosition, sunDirection, themePreset } from '../src/environment-config.js';
import { buildEnvironment } from '../src/environments.js';
import { groundMaterial } from '../src/biome-shaders.js';
import { Circuit } from '../src/circuit.js';
import { TRACKS } from '../src/config.js';
import { KIT_PRESETS, MAX_TRACK_PIECES, compileLayout, samplePiece, mirrorPiece, presetConfig, kitConfig } from '../src/track-pieces.js';

test('nine named environments retain their own biome, climate and visual settings',()=>{
  assert.equal(Object.keys(ENVIRONMENT_THEMES).length,9);
  for(const id of Object.keys(ENVIRONMENT_THEMES)){const s=themePreset(id);assert.equal(s.theme,id);assert.equal(s.biome,ENVIRONMENT_THEMES[id].biome);assert.deepEqual(normalizeEnvironment(JSON.parse(JSON.stringify(s))),s);}
  assert.equal(themePreset('norway').weather,'snow');assert.equal(themePreset('reunion').weather,'rain');assert.equal(themePreset('tokyo').hour,21);
});
test('solar controls obey azimuth and elevation and local solar time',()=>{
  for(const azimuth of [0,90,180,270])for(const elevation of [-10,0,45,80]){
    const p=solarPosition(normalizeEnvironment({solarMode:'manual',sunAzimuth:azimuth,sunElevation:elevation})),v=sunDirection(p);
    assert.equal(p.azimuth,azimuth);assert.equal(p.elevation,elevation);assert.ok(Math.abs(Math.hypot(v.x,v.y,v.z)-1)<1e-10);
  }
  assert.ok(solarPosition(themePreset('norway')).elevation<20);assert.ok(solarPosition(themePreset('grandprix')).elevation>60);assert.ok(solarPosition(themePreset('tokyo')).elevation<0);
  const s=normalizeEnvironment({sunAzimuth:Infinity,exposure:50,grassDensity:-1,theme:'missing',quality:'broken'});assert.equal(s.exposure,2);assert.equal(s.grassDensity,0);assert.equal(s.theme,'grandprix');assert.equal(s.quality,'balanced');
});
test('every theme builds finite native geometry, with dedicated landscape materials',()=>{
  const circuit=new Circuit(TRACKS[0]);
  for(const id of Object.keys(ENVIRONMENT_THEMES)){
    const group=new Group(),s=normalizeEnvironment({...themePreset(id),quality:'mobile',grassDensity:.25});buildEnvironment(group,circuit,s);
    const gs=new Set(),ms=new Set();let meshes=0,ground=false;
    group.traverse(o=>{if(!o.isMesh)return;meshes++;gs.add(o.geometry);ms.add(o.material);if(o.material.name==='biome-ground')ground=true;assert.ok(o.geometry.attributes.position.array.every(Number.isFinite),id);assert.ok(o.matrix.elements.every(Number.isFinite),id);});
    assert.ok(meshes>=5,id);assert.ok(ground,id);
    if(['tokyo','bund'].includes(id))assert.ok(group.getObjectByName('architectural-lights'));
    gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());
  }
});
test('procedural terrain injects GLSL with explicit uniforms into the installed Three.js shader',()=>{
  const material=groundMaterial(themePreset('grandprix')),shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);
  assert.ok(shader.uniforms.iTime);assert.ok(shader.vertexShader.includes('rrWorld='));assert.ok(shader.fragmentShader.includes('rrFbm'));assert.equal(/float\s+patch\b/.test(shader.fragmentShader),false);material.dispose();
});
test('width transitions carry their width forward and share physics/rendering values',()=>{
  const c=new Circuit(kitConfig(['width-14','straight','width-10']));assert.equal(c.widthAt(0),10);assert.equal(c.widthAt(1),10);
  const middle=c.layout.sections[1];assert.ok(Math.abs(c.widthAt((middle.from+middle.to)/2/c.length)-14)<1e-6);
  const bad=compileLayout(['width-14','hairpin-right',{id:'straight',length:32},'hairpin-right']);assert.ok(bad.closed);assert.ok(bad.errors.some(s=>s.includes('anchura')));
});
test('module surfaces and theme metadata survive into playable circuit configs',()=>{
  const c=new Circuit(kitConfig(['surface-mud-24','straight']));assert.equal(c.surfaceAt(.2),'mud');assert.equal(c.surfaceAt(.8),'asphalt');assert.equal(c.surfaceAt(.2,'ice'),'ice');
  for(const p of KIT_PRESETS.filter(p=>p.environmentTheme)){const config=presetConfig(p);assert.equal(config.environmentTheme,p.environmentTheme);assert.equal(config.biome,ENVIRONMENT_THEMES[p.environmentTheme].biome);assert.ok(new Circuit(config).closed);}
  assert.equal(presetConfig(KIT_PRESETS.find(p=>p.environmentTheme==='reunion')).surface,'mud');
});
test('mirror operations preserve endpoints and long layouts support 128 modules',()=>{
  const source=samplePiece('arc-24-60-left').points.at(-1),mirrored=samplePiece(mirrorPiece('arc-24-60-left')).points.at(-1);
  assert.ok(Math.abs(source.x+mirrored.x)<1e-8);assert.equal(source.z,mirrored.z);assert.equal(source.heading,-mirrored.heading);
  const layout=compileLayout(Array.from({length:MAX_TRACK_PIECES},()=> 'straight-120'));assert.equal(layout.sections.length,128);assert.deepEqual(layout.errors,[]);assert.ok(layout.length>15000);
  assert.throws(()=>compileLayout(Array.from({length:MAX_TRACK_PIECES+1},()=> 'straight')));
});
