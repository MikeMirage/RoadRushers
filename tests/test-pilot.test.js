import test from 'node:test';
import assert from 'node:assert/strict';
import {TestPilot,testPilotEnabled,testSessionStorage} from '../src/test-pilot.js';
import {Circuit} from '../src/circuit.js';
import {DriveModel,LapTracker} from '../src/physics.js';
import {TRACKS,VEHICLES} from '../src/config.js';

test('the test pilot requires the explicit URL flag',()=>{
  assert.equal(testPilotEnabled(''),false);assert.equal(testPilotEnabled('?autopilot=0'),false);
  assert.equal(testPilotEnabled('?autopilot=1&stats=1'),true);
});
test('automated sessions read player preferences but never mutate persistent storage',()=>{
  const original=new Map([['preferences','saved'],['record','42']]);
  const storage=testSessionStorage({getItem:k=>original.get(k)??null,setItem(){assert.fail('persistent write');},removeItem(){assert.fail('persistent removal');}});
  assert.equal(storage.getItem('preferences'),'saved');storage.setItem('record',12);storage.removeItem('preferences');storage.setItem('new','value');
  assert.equal(storage.getItem('record'),'12');assert.equal(storage.getItem('preferences'),null);assert.equal(storage.getItem('new'),'value');
  assert.equal(original.get('record'),'42');assert.equal(original.get('preferences'),'saved');
});
for(const track of TRACKS)test(`test AI completes ${track.id} using real driving physics`,()=>{
  const circuit=new Circuit(track),car=new DriveModel(circuit,VEHICLES[0]),pilot=new TestPilot(circuit),laps=new LapTracker();let completed=null;
  for(let i=0;i<120*150&&!completed;i++){
    const input=pilot.input(1/120,car,{weather:track.weather});assert.ok(Number.isFinite(input.steer)&&Math.abs(input.steer)<=1);
    car.step(1/120,input.steer,'track',track.weather,'normal',input.brake,input.throttle??1);completed=laps.step(1/120,car.road.progress);
  }
  assert.ok(completed,'must cross all lap gates and complete a lap');assert.ok(car.distance>circuit.length*.8);
  pilot.reset();assert.equal(pilot.driver.input.steer,0);assert.equal(pilot.driver.input.brake,false);
});
