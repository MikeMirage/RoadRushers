import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {MUSIC_TRACKS,MusicDirector,musicPlan} from '../src/music-library.js';
import {EngineAudio} from '../src/audio.js';

test('all nine user selections have preserved originals and prepared playback files',()=>{
 const catalogue=JSON.parse(readFileSync(new URL('../public/audio/suno/catalogue.json',import.meta.url)));
 assert.equal(catalogue.length,9);assert.equal(Object.keys(MUSIC_TRACKS).length,9);
 for(const song of catalogue){
  assert.equal(song.userSelected,true);assert.ok(MUSIC_TRACKS[song.id]);
  assert.equal(MUSIC_TRACKS[song.id].file,'.'+song.file);
  for(const file of [song.file.slice(1),'audio/suno/'+song.original])assert.ok(existsSync(new URL('../public/'+file,import.meta.url)),file);
  assert.ok(Math.abs(song.normalization.outputLUFS+18)<.25,song.id);assert.ok(song.duration>20);assert.equal(song.originalSha256.length,64);
 }
});

test('screens, circuits and weather select their intended songs',()=>{
 const group=scene=>musicPlan(scene).tracks.map(id=>MUSIC_TRACKS[id].group);
 assert.deepEqual(group({screen:'menu'}),['lounge']);assert.deepEqual(group({screen:'garage'}),['lounge']);
 assert.deepEqual(group({screen:'results'}),['sunset']);
 assert.deepEqual(group({screen:'race',trackId:'puerto'}),['coast','coast']);
 assert.deepEqual(group({screen:'race',trackId:'aserradero'}),['forest','forest']);
 assert.deepEqual(group({screen:'race',trackId:'faro'}),['sunset','coast','coast']);
 assert.deepEqual(group({screen:'race',trackId:'aserradero',weather:'rain'}),['night','night']);
 assert.ok(group({screen:'race',mode:'practice'}).includes('practice'));
 const reachable=new Set();for(const scene of [{screen:'menu'},{screen:'results'},...['puerto','aserradero','faro'].map(trackId=>({screen:'race',trackId,mode:'practice'})),{screen:'race',weather:'rain'}])for(const id of musicPlan(scene).tracks)reachable.add(id);
 assert.equal(reachable.size,9);assert.equal(musicPlan({screen:'loading'}),null);
});

test('A/B alternates on re-entry and remains stable across render frames and menus',()=>{
 const d=new MusicDirector(),scene={screen:'race',trackId:'puerto'};
 const a=d.select(scene);assert.ok(a.endsWith('-a'));
 for(let i=0;i<100;i++)assert.equal(d.select(scene),a);
 d.select({screen:'menu'});const b=d.select(scene);assert.ok(b.endsWith('-b'));
 assert.equal(d.advance(),a);assert.equal(d.select(scene),a);assert.equal(d.advance(),b);
 const menu=d.select({screen:'menu'});assert.equal(d.select({screen:'garage'}),menu);
});

test('player advances at the end and routes Suno sources through the music bus',async()=>{
 const previousAudio=globalThis.Audio;const created=[];
 class FakeAudio{constructor(src){this.src=src;this.duration=100;this.currentTime=0;this.paused=true;created.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 globalThis.Audio=FakeAudio;
 try{
  const audio=new EngineAudio();audio.musicBus={gain:{setTargetAtTime(){}}};
  audio.context={currentTime:1,createGain(){return {gain:{value:0,setTargetAtTime(v){this.value=v;}},connect(){}};},createMediaElementSource(){return {connect(){}};}};
  const scene={scene:{screen:'race',trackId:'puerto'}};
  audio.updateMusic(scene);await Promise.resolve();assert.equal(created.length,1);assert.ok(created[0].src.endsWith('coastal-velocity-a.mp3'));
  created[0].currentTime=99;audio.updateMusic(scene);await Promise.resolve();assert.equal(created.length,2);assert.ok(created[1].src.endsWith('coastal-velocity-b.mp3'));assert.equal(created[1].loop,false);
  created[1].currentTime=99;audio.updateMusic(scene);await Promise.resolve();assert.equal(created.length,2);assert.equal(created[0].currentTime,0);assert.equal(created[0].paused,false);
  audio.setOptions=()=>{};audio.hidden=true;const id=audio.musicFor(scene);audio.updateMusic(scene);assert.equal(audio.musicFor(scene),id);
 }finally{globalThis.Audio=previousAudio;}
});

test('manual skip visits every version and keeps that selection when driving resumes',()=>{
 const d=new MusicDirector(),scene={screen:'race',trackId:'puerto',mode:'practice'};
 const first=d.select(scene),visited=new Set([first]);
 for(let i=0;i<8;i++){
  const track=d.skipAll();visited.add(track.id);
  assert.equal(d.select(scene),track.id);
  assert.ok(['A','B'].includes(d.current.variant));
 }
 assert.equal(visited.size,9);assert.equal(d.skipAll().id,first);
 const selected=d.current.id;assert.equal(d.select({...scene}),selected);
 d.select({screen:'garage'});assert.equal(d.plan.manual,undefined);assert.equal(d.current.group,'lounge');
});

test('audio exposes title and version and allows selecting tracks while muted',()=>{
 const audio=new EngineAudio();audio.lastScene={scene:{screen:'race',trackId:'puerto'}};
 audio.musicFor(audio.lastScene);assert.equal(audio.currentMusic.title,'Coastal Velocity');assert.equal(audio.currentMusic.variant,'A');
 audio.enabled=false;audio.options.musicVolume=0;
 assert.equal(audio.nextMusic().variant,'B');assert.equal(audio.currentMusic.title,'Coastal Velocity');
 assert.equal(audio.nextMusic().title,'Afterlight Express');
 assert.equal(audio.musicFor(audio.lastScene),audio.currentMusic.id);
});
