import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSession,makeRaceTrack,resolveCarContacts } from '../src/race.js';
import { RivalDriver,RaceGuide,AI_LEVELS } from '../src/race-driver.js';
import { Circuit } from '../src/circuit.js';
import { DriveModel } from '../src/physics.js';
import { TRACKS,VEHICLES } from '../src/config.js';
import { kitConfig,KIT_PRESETS } from '../src/track-pieces.js';
import { renderRaceSetup,renderRaceHUD } from '../src/race-ui.js';

const dt=1/120,parked={steer:0,brake:true};
const straight=(width=10)=>new Circuit({...kitConfig([{id:'straight-long',length:400}]),width});
const racer=(c,id,u,offset=0,speed=0)=>{const drive=new DriveModel(c,VEHICLES[0]);drive.reset(c,u,offset);drive.vz=drive.speed=speed;return {id,drive};};
const state=car=>['x','y','z','heading','vx','vy','vz','speed','steer','brake','drift','angularSpeed'].map(k=>car[k]);

test('all difficulty levels use the exact player vehicle, with no altered physical parameters',()=>{
  const c=makeRaceTrack(TRACKS[0]).circuit;
  for(const difficulty of Object.keys(AI_LEVELS))for(const vehicle of VEHICLES.slice(0,3)){
    const race=new RaceSession(c,vehicle,{difficulty,fieldLevels:'uniform'});
    for(const r of race.racers)assert.equal(r.drive.vehicle,vehicle);
    assert.ok(race.rivals.every(r=>r.level===difficulty));
  }
  const mixed=new RaceSession(c,VEHICLES[0],{difficulty:'club',fieldLevels:'mixed'});
  assert.equal(new Set(mixed.rivals.map(r=>r.level)).size,3);
  assert.deepEqual(new RaceSession(c,VEHICLES[0],{difficulty:'club'}).rivals.map(r=>r.level),mixed.rivals.map(r=>r.level));
  assert.equal(new RaceSession(c,VEHICLES[0],{difficulty:'invalid'}).difficulty,'club');
});

test('replaying the AI controls through an ordinary player DriveModel reproduces its motion exactly',()=>{
  const c=makeRaceTrack(TRACKS[1]).circuit,vehicle=VEHICLES[2];
  const bot={id:'bot',drive:new DriveModel(c,vehicle)},player=new DriveModel(c,vehicle);
  const driver=new RivalDriver(()=>.5,0,'expert',new RaceGuide(c));
  for(let i=0;i<2400;i++){
    const before=state(bot.drive),input=driver.decide(dt,bot,[bot],c,'ghost','track','rain');
    assert.deepEqual(state(bot.drive),before,'the controller may read the car, never move it');
    bot.drive.step(dt,input.steer,'track','rain','normal',input.brake);
    player.step(dt,input.steer,'track','rain','normal',input.brake);
    assert.deepEqual(state(bot.drive),state(player));
  }
});

test('wheel demand is continuous and a full technical lap has no rapid alternating steering',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0],{count:4,laps:1,fieldLevels:'uniform'});
  const signs=[0,0,0],switches=[0,0,0],previous=[0,0,0];
  while(r.elapsed<60&&r.finishers.length<3){
    r.step(dt,parked);
    r.rivals.forEach((a,i)=>{
      assert.ok(Math.abs(a.controller.input.steer-previous[i])<=2.1*dt+1e-9);
      assert.ok(Math.abs(a.controller.input.steer)<=1);previous[i]=a.controller.input.steer;
      if(Math.abs(a.drive.steer)>.2&&Math.sign(a.drive.steer)!==signs[i]){switches[i]++;signs[i]=Math.sign(a.drive.steer);}
    });
  }
  assert.equal(r.finishers.length,3);
  for(const count of switches)assert.ok(count/r.elapsed<.7,`${count} strong direction reversals in ${r.elapsed}s`);
});

test('difficulty changes lap pace through decisions, while the expert keeps the same motor and grip',()=>{
  const times=[];
  for(const difficulty of ['novice','club','expert']){
    const r=new RaceSession(makeRaceTrack(TRACKS[0],14).circuit,VEHICLES[0],{count:4,laps:1,difficulty,fieldLevels:'uniform'});
    while(r.elapsed<60&&r.finishers.length<3)r.step(dt,parked);
    assert.equal(r.finishers.length,3);times.push(r.rivals.reduce((s,a)=>s+a.finishTime,0)/3);
  }
  assert.ok(times[0]>times[1]);assert.ok(times[1]>times[2]);assert.ok(times[0]>times[2]*1.1);
});

test('a rival commits to a free passing lane and completes a clean physical overtake',()=>{
  const c=straight(),bot=racer(c,'bot',.15,0,12),leader=racer(c,'leader',.2,0,12);
  const driver=new RivalDriver(()=>.1,0,'expert',new RaceGuide(c));
  let contacts=0,passed=false,passSide=0,changes=0;
  for(let i=0;i<1200;i++){
    const input=driver.decide(dt,bot,[bot,leader],c,'contact','asphalt','clear');
    if(driver.maneuver==='pass'){
      const side=Math.sign(driver.targetLane);if(passSide&&side!==passSide)changes++;passSide=side;
    }
    bot.drive.step(dt,input.steer,'asphalt','clear','normal',input.brake);
    leader.drive.step(dt,0,'asphalt','clear','normal',leader.drive.speed>8);
    contacts+=resolveCarContacts([bot,leader],c);
    if(bot.drive.z>leader.drive.z+6){passed=true;break;}
  }
  assert.ok(passSide);assert.equal(changes,0);assert.equal(contacts,0);assert.equal(passed,true);
});

test('a defender makes one early move and does not swerve after an attacker changes sides',()=>{
  const c=straight(),bot=racer(c,'bot',.4,0,18),attacker=racer(c,'attacker',.37,2,21);
  const driver=new RivalDriver(()=>.1,0,'expert',new RaceGuide(c));
  driver.decide(dt,bot,[bot,attacker],c,'contact','asphalt','clear');
  assert.equal(driver.maneuver,'defend');assert.ok(driver.targetLane>1);
  const lane=driver.targetLane;
  attacker.drive.reset(c,.37,-2);attacker.drive.vz=attacker.drive.speed=21;
  for(let i=0;i<180;i++)driver.decide(dt,bot,[bot,attacker],c,'contact','asphalt','clear');
  assert.equal(driver.targetLane,lane);
  attacker.drive.reset(c,.398,2);attacker.drive.vz=attacker.drive.speed=21;
  for(let i=0;i<30;i++)driver.decide(dt,bot,[bot,attacker],c,'contact','asphalt','clear');
  assert.ok(driver.targetLane<=bot.drive.road.offset+.01,'leave space to a car already alongside');
});

test('a rival brakes and follows instead of forcing a pass where the road is too narrow',()=>{
  const c=straight(6),bot=racer(c,'bot',.15,0,18),leader=racer(c,'leader',.23,0,8);
  const driver=new RivalDriver(()=>.1,0,'expert',new RaceGuide(c));let contacts=0,minimumGap=Infinity;
  for(let i=0;i<1200;i++){
    const input=driver.decide(dt,bot,[bot,leader],c,'contact','asphalt','clear');
    assert.notEqual(driver.maneuver,'pass');
    bot.drive.step(dt,input.steer,'asphalt','clear','normal',input.brake);
    leader.drive.step(dt,0,'asphalt','clear','normal',leader.drive.speed>8);
    contacts+=resolveCarContacts([bot,leader],c);minimumGap=Math.min(minimumGap,leader.drive.z-bot.drive.z);
  }
  assert.equal(contacts,0);assert.ok(minimumGap>4.5);assert.ok(bot.drive.speed<10);
});

test('ghost rivals ignore traffic and never accelerate according to the player position',()=>{
  const c=makeRaceTrack(TRACKS[0]).circuit,a=new RaceSession(c,VEHICLES[0],{count:4}),b=new RaceSession(c,VEHICLES[0],{count:4});
  a.player.drive.reset(c,.3);b.player.drive.reset(c,.7);
  for(let i=0;i<600;i++){a.step(dt,parked);b.step(dt,parked);}
  assert.deepEqual(a.rivals.map(r=>state(r.drive)),b.rivals.map(r=>state(r.drive)));
});

test('each difficulty finishes on wet mixed surfaces and on the elevated crossing with all original cars',()=>{
  for(const vehicle of VEHICLES.slice(0,3))for(const difficulty of Object.keys(AI_LEVELS))for(const track of [TRACKS[1],kitConfig(KIT_PRESETS[1].pieces)]){
    const r=new RaceSession(makeRaceTrack(track).circuit,vehicle,{count:4,laps:1,difficulty,fieldLevels:'uniform'});
    while(r.elapsed<100&&r.finishers.length<3)r.step(dt,parked,'track','rain');
    assert.equal(r.finishers.length,3,`${vehicle.id}/${difficulty}/${track.id}`);
  }
});

test('race setup exposes difficulty and field variety, and standings identify individual rival levels',()=>{
  const r=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,VEHICLES[0]);
  const html=renderRaceSetup({difficulty:'expert',fieldLevels:'uniform',count:12,laps:3,width:'original',trackId:TRACKS[0].id},[TRACKS[0]],VEHICLES[0]);
  assert.ok(html.includes('data-race-difficulty="expert" aria-pressed="true"'));
  assert.ok(html.includes('value="uniform" selected'));assert.ok(html.includes('sin ayudas de velocidad'));
  const hud=renderRaceHUD(r);assert.ok(hud.includes('IA ·'));assert.ok(hud.includes('VARIADA'));
});
