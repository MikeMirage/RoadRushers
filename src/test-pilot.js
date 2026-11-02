import {RaceGuide,RivalDriver} from './race-driver.js';

export const testPilotEnabled=search=>new URLSearchParams(search).get('autopilot')==='1';

/** Read existing preferences, but keep every automated-test write in memory. */
export function testSessionStorage(source){
  const memory=new Map();
  return {
    getItem(key){if(memory.has(key))return memory.get(key);try{return source?.getItem(key)??null;}catch{return null;}},
    setItem(key,value){memory.set(String(key),String(value));},
    removeItem(key){memory.set(String(key),null);},
  };
}

/** Uses the same steering, braking and physics as the race AI. No teleporting. */
export class TestPilot{
  constructor(circuit){this.circuit=circuit;this.racer={id:'test-pilot',drive:null};this.driver=new RivalDriver(()=>.5,0,'club',new RaceGuide(circuit));}
  reset(){this.driver.reset(0);}
  input(dt,drive,{race=null,surface='track',weather='clear',pace='normal'}={}){
    const racer=race?.player||this.racer;racer.drive=drive;
    return this.driver.decide(dt,racer,race?.racers||[racer],this.circuit,race?.interaction||'ghost',surface,weather,pace);
  }
}
