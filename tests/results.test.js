import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceProgress,RaceSession } from '../src/race.js';
import { LapTracker } from '../src/physics.js';
import { Circuit } from '../src/circuit.js';
import { DEFAULT_PLAYGROUND,resolvePlayground } from '../src/playground.js';
import { ResultRecords,resultContext,createReport,estimatedStanding,RESULTS_KEY } from '../src/results.js';
import { renderSessionResult } from '../src/results-ui.js';
import { estimateLeaderboard } from '../src/ranking-estimate.js';
import { loadAILeaderboard } from '../src/leaderboard.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
const setup=(patch={})=>{const {settings}=resolvePlayground({...DEFAULT_PLAYGROUND,mode:'race',...patch});return {settings,circuit:new Circuit(settings.track)};};
const ctx=patch=>{const {settings,circuit}=setup(patch);return resultContext(settings,circuit);};

test('race timing includes the grid in lap one and interpolates each crossing consistently with the total',()=>{
  const p=new RaceProgress(.98,2,100);
  for(let i=1;i<=304;i++)p.step(.1,(.98+i*.01)%1,i*.1,3);
  assert.equal(p.lapTimes.length,3);near(p.lapTimes[0],10.2);near(p.lapTimes[1],10);near(p.lapTimes[2],10);
  near(p.lapTimes.reduce((s,t)=>s+t,0),p.finishTime);
  p.step(.1,.02,31,3);assert.equal(p.lapTimes.length,3);
});
test('a start on the line counts full laps, and training preserves partial-lap time between crossings',()=>{
  const p=new RaceProgress(0,0,100),training=new LapTracker();
  for(let i=1;i<=205;i++){p.step(.1,(i%100)/100,i*.1,2);training.step(.1,(i%100)/100);}
  assert.equal(p.lapTimes.length,2);near(p.finishTime,20);near(training.lapTimes.reduce((s,t)=>s+t,0)+training.time,training.elapsed);
  near(training.time,.5);training.reset();assert.deepEqual(training.lapTimes,[]);assert.equal(training.elapsed,0);
});
test('a complete simulated three-lap race produces three times and resets all of them on retry',()=>{
  const {settings,circuit}=setup({count:4,laps:3}),race=new RaceSession(circuit,settings.vehicle,settings.raceRules);
  while(race.elapsed<180&&!race.finished){const car=race.player.drive,p=circuit.at(car.road.progress+.024),error=Math.atan2(Math.sin(Math.atan2(p.x-car.x,p.z-car.z)-car.heading),Math.cos(Math.atan2(p.x-car.x,p.z-car.z)-car.heading));race.step(1/120,{steer:error>.035?-1:error<-.035?1:0,brake:false});}
  assert.equal(race.finished,true);assert.equal(race.player.tracker.lapTimes.length,3);near(race.player.tracker.lapTimes.reduce((s,t)=>s+t,0),race.player.finishTime);
  race.reset();assert.deepEqual(race.player.tracker.lapTimes,[]);assert.equal(race.elapsed,0);
});
test('personal lap records persist, while total records remain separated by lap count',()=>{
  const storage=memory(),records=new ResultRecords(storage),context=ctx();
  const first=records.recordSession(context,[28,25,26],79,true);assert.equal(first.bestLap,25);assert.equal(first.totals[3],79);
  records.recordSession({...context,laps:1},[29],29,true);records.recordSession(context,[30,27,28],85,true);
  const saved=new ResultRecords(storage).get(context);assert.equal(saved.bestLap,25);assert.deepEqual(saved.totals,{'1':29,'3':79});
});
test('geometry, width, car and driving conditions partition records; camera and visual theme do not',()=>{
  const base=ctx();
  for(const patch of [{vehicleId:'velo'},{width:14},{surface:'ice'},{weather:'rain'},{pace:'calm'},{interaction:'contact'},{count:4}])assert.notEqual(ctx(patch).key,base.key);
  assert.equal(ctx({camera:'chase',theme:'tokyo'}).key,base.key);
  assert.equal(ctx({laps:1,difficulty:'expert'}).key,base.key);
  const {settings,circuit}=setup();const modified={...settings,track:{...settings.track,points:settings.track.points.map(([x,z],i)=>[x+(i===0?2:0),z])}};
  assert.notEqual(resultContext(modified,circuit).key,base.key);
});
test('aborted races can retain completed laps but never create a race-total record',()=>{
  const records=new ResultRecords(memory()),context=ctx(),r=createReport({context,lapTimes:[30],totalTime:42,complete:false,records});
  assert.equal(r.personalBest,30);assert.equal(r.personalTotal,null);near(r.partialTime,12);assert.deepEqual(records.get(context).totals,{});
  assert.throws(()=>records.recordSession(context,[30],30,true));assert.throws(()=>records.recordSession(context,[30,25,NaN],80,true));assert.throws(()=>records.recordSession(context,[30,25,26],20,true));
});
test('a record set during the race is identified against the record at its start',()=>{
  const context=ctx(),records=new ResultRecords(memory());records.recordLap(context,24);
  const r=createReport({context,lapTimes:[28,24,26],totalTime:78,complete:true,records,previousBestLap:null});assert.equal(r.newLapRecord,true);assert.equal(r.personalBest,24);
  const slower=createReport({context,lapTimes:[29,25,28],totalTime:82,complete:true,records,previousBestLap:24});assert.equal(slower.newLapRecord,false);assert.equal(slower.personalBest,24);
});
test('unavailable or corrupt storage preserves a useful in-memory result',()=>{
  const context=ctx(),storage=memory();storage.setItem(RESULTS_KEY,'invalid');const records=new ResultRecords(storage);assert.equal(records.get(context).bestLap,null);
  const blocked=new ResultRecords({getItem(){throw Error();},setItem(){throw Error();}});blocked.recordSession(context,[30,28,29],87,true);assert.equal(blocked.get(context).bestLap,28);assert.equal(blocked.saveAvailable,false);
});
test('a provisional top 50 merges the real local record and pins it when outside the table',()=>{
  const entries=Array.from({length:50},(_,i)=>({id:`ai-${i}`,name:`IA ${i}`,bestLap:20+i,totalTime:70+i}));
  const quick=estimatedStanding(entries,'lap',19);assert.equal(quick.rows.length,50);assert.equal(quick.player.rank,1);assert.equal(quick.rows[0].isPlayer,true);
  const slow=estimatedStanding(entries,'lap',100);assert.equal(slow.player.rank,51);assert.equal(slow.rows.includes(slow.player),false);
  const tied=estimatedStanding(entries,'lap',20.001);assert.equal(tied.player.rank,1);
});
test('estimated references are reproducible AI-based values independent of player performance',()=>{
  const context=ctx({laps:1,count:4}),a=estimateLeaderboard(context),b=estimateLeaderboard(context);
  assert.deepEqual(a,b);assert.equal(a.length,50);assert.equal(new Set(a.map(e=>e.id)).size,50);
  for(const e of a){assert.equal(e.simulated,true);assert.ok(e.bestLap>10&&e.totalTime>=e.bestLap);}
});
test('the ranking provider caches valid references and aborts background work on navigation',async()=>{
  const storage=memory(),context=ctx(),entries=Array.from({length:50},(_,i)=>({id:`ai-${i}`,name:`IA ${i}`,bestLap:25+i,totalTime:80+i}));let terminated=false;
  const factory=()=>{const worker={terminate(){terminated=true;},postMessage(){queueMicrotask(()=>worker.onmessage({data:{entries}}));}};return worker;};
  assert.equal((await loadAILeaderboard(context,{storage,workerFactory:factory})).length,50);assert.equal(terminated,true);
  await loadAILeaderboard(context,{storage,workerFactory:()=>{throw Error('cached request started a worker');}});
  const controller=new AbortController();let canceled=false;
  const pending=loadAILeaderboard(context,{signal:controller.signal,workerFactory:()=>({postMessage(){},terminate(){canceled=true;}})});controller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(canceled,true);
});
test('results show every actual lap and clearly label fictional world rankings',()=>{
  const r=createReport({context:ctx(),lapTimes:[29,25,27],totalTime:81,records:new ResultRecords(memory()),position:2});
  let html=renderSessionResult(r);assert.ok(html.includes('TIEMPO TOTAL'));assert.ok(html.includes('TU RÉCORD DE VUELTA'));assert.ok(html.includes('0:29.00'));assert.ok(html.includes('0:25.00'));assert.ok(html.includes('0:27.00'));
  r.tab='ranking';r.leaderboard={status:'ready',entries:Array.from({length:50},(_,i)=>({id:`ai-${i}`,name:i===0?'<script>':`IA ${i}`,bestLap:20+i,totalTime:70+i}))};
  html=renderSessionResult(r);assert.ok(html.includes('PROVISIONAL · ESTIMACIÓN IA'));assert.ok(html.includes('No hay resultados de jugadores reales'));assert.ok(html.includes('IA · FICTICIO'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
