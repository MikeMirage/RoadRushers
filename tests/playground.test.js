import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLES,TRACKS } from '../src/config.js';
import { Career,CAREER_KEY } from '../src/career.js';
import { DEFAULT_PLAYGROUND,PLAYGROUND_KEY,loadPlayground,savePlayground,normalizePlayground,resolvePlayground,playgroundTracks } from '../src/playground.js';
import { renderPlayground } from '../src/playground-ui.js';
import { renderGarageDetail } from '../src/vehicle-collection-ui.js';
import { kitConfig,KIT_PRESETS } from '../src/track-pieces.js';
import { COMMUNITY_TRACKS } from '../src/community-tracks.js';
import { availableEligibleVehicles } from '../src/vehicle-regulations.js';
const memory=()=>{const values=new Map();return {values,getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};

test('every car can be selected and driven in testing without changing saved championship progression',()=>{
  const storage=memory(),career=new Career(storage);assert.deepEqual(career.unlocked,['coda']);
  for(const vehicle of VEHICLES){
    const result=resolvePlayground({...DEFAULT_PLAYGROUND,vehicleId:vehicle.id});assert.equal(result.settings.vehicle,vehicle);assert.equal(result.settings.mode,'practice');
    const html=renderGarageDetail(null,vehicle.id,'overview',undefined,{testing:true});
    assert.ok(html.includes(`data-pilot="${vehicle.id}"`));assert.ok(!html.includes(' disabled'));assert.ok(!html.includes(vehicle.unlock));
  }
  assert.equal(storage.getItem(CAREER_KEY),null);assert.deepEqual(career.unlocked,['coda']);
});
test('changing cars preserves all driving and race choices',()=>{
  const options={...DEFAULT_PLAYGROUND,mode:'race',surface:'ice',weather:'rain',pace:'calm',camera:'chase',theme:'tokyo',width:14,difficulty:'expert',count:8,laps:5,interaction:'contact'};
  const before=resolvePlayground(options),after=resolvePlayground({...options,vehicleId:'velo'});
  assert.deepEqual(before.settings.track,after.settings.track);
  for(const key of ['mode','surface','weather','pace','camera'])assert.equal(before.settings[key],after.settings[key]);
  assert.deepEqual(before.settings.raceRules,after.settings.raceRules);assert.equal(after.settings.track.biome,'workshop');
});
test('all presets and a custom assembly are available together without duplicating a current track',()=>{
  const tracks=playgroundTracks();assert.equal(tracks.length,TRACKS.length+KIT_PRESETS.length+COMMUNITY_TRACKS.length);
  const custom=kitConfig(KIT_PRESETS[0].pieces,'Mi test','custom-test');assert.equal(playgroundTracks(custom).at(-1).id,custom.id);
  assert.equal(playgroundTracks(TRACKS[0]).length,tracks.length);
  const prepared=resolvePlayground({...DEFAULT_PLAYGROUND,trackId:custom.id},playgroundTracks(custom));assert.equal(prepared.settings.track.id,custom.id);
});
test('preferences survive reload independently of career data and invalid input falls back safely',()=>{
  const storage=memory(),careerData='preserved';storage.setItem(CAREER_KEY,careerData);
  const options={...DEFAULT_PLAYGROUND,vehicleId:'velo',surface:'gravel',weather:'snow',mode:'race'};
  assert.equal(savePlayground(storage,options),true);assert.deepEqual(loadPlayground(storage),options);assert.equal(storage.getItem(CAREER_KEY),careerData);
  storage.setItem(PLAYGROUND_KEY,'invalid');assert.deepEqual(loadPlayground(storage),DEFAULT_PLAYGROUND);
  assert.deepEqual(normalizePlayground({vehicleId:'bad',weather:'bad',mode:'career',count:100}),DEFAULT_PLAYGROUND);
  assert.equal(savePlayground({setItem(){throw Error();}},options),false);
});
test('the start screen exposes the complete test setup and no championship gates',()=>{
  const html=renderPlayground({...DEFAULT_PLAYGROUND,mode:'race'},playgroundTracks());
  for(const key of ['trackId','surface','weather','width','pace','camera','count','laps','difficulty','interaction'])assert.ok(html.includes(`data-playground="${key}"`));
  assert.ok(html.includes(`${availableEligibleVehicles(VEHICLES).length} coches disponibles`));assert.ok(!html.includes('data-event='));assert.ok(!html.includes('desbloque'));
  assert.equal(resolvePlayground({...DEFAULT_PLAYGROUND,trackId:TRACKS[2].id,width:16}).error!==null,true);
});
test('the home screen enters ordered preparation and leaves the session mode to rules',()=>{
  const html=renderPlayground(DEFAULT_PLAYGROUND,playgroundTracks());
  assert.ok(html.includes('home-studio'));assert.ok(html.includes('>Jugar '));
  assert.ok(!html.includes('data-play-mode='));assert.ok(html.includes('data-playground="mode"'));
  assert.ok(html.includes('data-play-action="tracks"'));assert.ok(html.includes('data-play-action="garage"'));
});

test('saved visual themes always resolve to basic while driving and race settings survive',()=>{
 const storage=memory();storage.setItem(PLAYGROUND_KEY,JSON.stringify({version:1,options:{...DEFAULT_PLAYGROUND,theme:'tokyo',weather:'rain',vehicleId:'velo',count:8,mode:'race'}}));
 const options=loadPlayground(storage),resolved=resolvePlayground(options);
 assert.equal(options.theme,'basic');assert.equal(resolved.settings.track.environmentTheme,'basic');assert.equal(resolved.settings.track.biome,'workshop');
 assert.equal(options.weather,'rain');assert.equal(options.vehicleId,'velo');assert.equal(options.count,8);assert.equal(options.mode,'race');
 const html=renderPlayground(options,playgroundTracks());assert.ok(!html.includes('data-playground="theme"'));assert.ok(!html.includes('data-play-action="environment"'));assert.ok(html.includes('data-play-action="preferences"'));
});

test('all camera views survive saving, loading and launching a session',async()=>{
  const {CAMERA_VIEWS,nextCameraMode}=await import('../src/camera-views.js'),storage=memory(),tracks=playgroundTracks();
  assert.deepEqual(CAMERA_VIEWS.map(v=>v.id),['topdown','topdown-1.2','topdown-1.4','chase','chase-high']);
  let mode='topdown';
  for(const view of CAMERA_VIEWS){
    assert.equal(mode,view.id);
    const options={...DEFAULT_PLAYGROUND,camera:mode};savePlayground(storage,options);
    assert.equal(loadPlayground(storage).camera,mode);assert.equal(resolvePlayground(options).settings.camera,mode);
    assert.ok(renderPlayground(options,tracks).includes(view.label));mode=nextCameraMode(mode);
  }
  assert.equal(mode,'topdown');assert.equal(normalizePlayground({camera:'unknown'}).camera,'topdown');
});
