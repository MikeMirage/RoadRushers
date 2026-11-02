import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene,Texture,Vector3 } from 'three';
import { VEHICLES,TRACKS } from '../src/config.js';
import { vehicleOrigin,vehiclePowerClass,eligibleVehicles,availableEligibleVehicles } from '../src/vehicle-regulations.js';
import { DEFAULT_PLAYGROUND,resolvePlayground,savePlayground,loadPlayground } from '../src/playground.js';
import { RaceSession,makeRaceTrack,raceGridVehicles } from '../src/race.js';
import { RivalFleet } from '../src/rival-fleet.js';
import { studioCameraFrame } from '../src/garage.js';
import { renderEligibleCards,renderRaceSetup } from '../src/race-setup-ui.js';
import { buildVehicle,vehicleAvailable } from '../src/vehicles.js';
import { disposeVehicle } from '../src/vehicle-modeler.js';

test('origin is catalogued per model rather than using the Japan-and-rally collection',()=>{
  for(const v of VEHICLES){assert.ok(vehicleOrigin(v),v.id);assert.ok(['p1','p2','p3'].includes(vehiclePowerClass(v)),v.id);}
  assert.equal(vehicleOrigin(VEHICLES.find(v=>v.id==='coda')),'US');
  const japanese=eligibleVehicles(VEHICLES,'japanese');
  assert.ok(japanese.some(v=>v.id==='apex'));assert.ok(japanese.some(v=>v.id==='trailmaster'));
  assert.ok(!japanese.some(v=>['delta','stratos','turbine','coda'].includes(v.id)));
});
test('rules resolve a compatible player and the same eligible field, and survive reload',()=>{
  const options={...DEFAULT_PLAYGROUND,mode:'race',vehicleId:'bambino',carCategory:'japanese',count:8};
  const result=resolvePlayground(options);assert.equal(vehicleOrigin(result.settings.vehicle),'JP');
  for(const v of result.settings.raceRules.vehiclePool){assert.equal(vehicleOrigin(v),'JP');assert.ok(vehicleAvailable(v));}
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  savePlayground(storage,result.options);assert.equal(loadPlayground(storage).carCategory,'japanese');
  assert.equal(loadPlayground(storage).count,8);
});
test('same-model is resolved after the final car choice and all opponents really use it',()=>{
  for(const vehicleId of ['borough','hakone']){
    const {settings}=resolvePlayground({...DEFAULT_PLAYGROUND,mode:'race',carCategory:'same-model',vehicleId,count:8});
    assert.deepEqual(settings.raceRules.vehiclePool.map(v=>v.id),[vehicleId]);
    const race=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,settings.vehicle,settings.raceRules);
    assert.ok(race.racers.every(r=>r.drive.vehicle.id===vehicleId));
  }
});
test('power classes restrict both player and rivals without deriving fictitious horsepower',()=>{
  for(const category of ['p1','p2','p3']){
    const {settings}=resolvePlayground({...DEFAULT_PLAYGROUND,mode:'race',carCategory:category});
    assert.equal(vehiclePowerClass(settings.vehicle),category);
    const grid=raceGridVehicles(settings.vehicle,settings.raceRules);
    assert.ok(grid.every(v=>vehiclePowerClass(v)===category));
    assert.deepEqual(grid,raceGridVehicles(settings.vehicle,settings.raceRules));
  }
});
test('a mixed-model race renders each rival with its own model and releases every group',()=>{
  const pool=['borough','hakone','rotor'].map(id=>VEHICLES.find(v=>v.id===id));
  const race=new RaceSession(makeRaceTrack(TRACKS[0]).circuit,pool[0],{count:8,vehiclePool:pool});
  assert.ok(new Set(race.rivals.map(r=>r.drive.vehicle.id)).size>1);
  const scene=new Scene(),glow=new Texture(),fleet=new RivalFleet(scene,race,glow);
  fleet.update(1/60,1,true);
  assert.equal(fleet.fleets.reduce((sum,f)=>sum+f.actors.length,0),7);
  for(const f of fleet.fleets)assert.ok(f.session.rivals.every(r=>r.drive.vehicle.id===f.session.vehicle.id));
  fleet.dispose();assert.equal(scene.children.length,0);glow.dispose();
});
test('race cards include only available eligible models and the ordered preparation preserves controls',()=>{
  const options={...DEFAULT_PLAYGROUND,carCategory:'japanese',vehicleId:'apex'},html=renderEligibleCards(options);
  for(const v of availableEligibleVehicles(VEHICLES,'japanese'))assert.ok(html.includes(`data-race-car="${v.id}"`));
  assert.ok(!html.includes('data-race-car="delta"'));assert.ok(!html.includes('data-race-car="bambino"'));
  assert.ok(html.includes('aria-pressed="true"'));assert.ok(!html.includes('<svg'));
  const screen=renderRaceSetup(options,TRACKS,{step:'car'});
  assert.ok(screen.indexOf('data-setup-go="circuit"')<screen.indexOf('data-setup-go="rules"'));
  assert.ok(screen.indexOf('data-setup-go="rules"')<screen.indexOf('data-setup-go="car"'));
  for(const label of ['Circuito','Reglas','Coche'])assert.ok(screen.includes(`aria-label="${label}"`));
  assert.ok(screen.includes('Salir a pista'));assert.ok(!screen.includes('data-club-nav'));
});
test('studio framing keeps a low three-quarter camera and the lineup horizontally aligned',()=>{
  for(const aspect of [390/258,390/220,2.5]){
    const frame=studioCameraFrame(aspect),offset=frame.position.clone().sub(frame.target);
    assert.ok(offset.length()>4);assert.ok(offset.y/offset.length()<.5,'not an overhead camera');
    const row=new Vector3(3.2,0,-2.8).normalize();assert.ok(Math.abs(row.dot(offset.clone().normalize()))<1e-8);
  }
});
test('native miniature finishes persist in the same model factory used in races and thumbnails',()=>{
  const v=VEHICLES.find(v=>v.id==='apex'),a=buildVehicle(v);
  a.setCustomization({color:'#123abc',glass:'#345678',glassOpacity:.65});
  assert.equal(a.materials.paint.color.getHexString(),'123abc');assert.equal(a.materials.glass.opacity,.65);
  const b=buildVehicle(v);assert.notEqual(a.materials.paint,b.materials.paint);assert.equal(b.materials.paint.color.getHexString(),v.color.slice(1));
  disposeVehicle(a);disposeVehicle(b);
});
