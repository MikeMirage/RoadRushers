import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene,Texture } from 'three';
import { BrakeEffects } from '../src/brake-effects.js';
import { buildVehicle } from '../src/vehicles.js';
import { VEHICLES } from '../src/config.js';
import { Circuit } from '../src/circuit.js';
import { kitConfig,KIT_PRESETS } from '../src/track-pieces.js';

const setup=()=>{const scene=new Scene(),effect=new BrakeEffects(scene,new Texture()),model=buildVehicle(VEHICLES[1]);effect.bind(model);return {scene,effect,model};};

test('braking illuminates rear lenses and one lightweight ground gradient, then releases both',()=>{
  const {scene,effect,model}=setup(),c=new Circuit(kitConfig(['straight-long'])),p=c.at(.5);
  const drive={...p,progress:.5,groundY:p.y,brake:1,braking:true};effect.update(drive,c,true);
  assert.equal(effect.glow.visible,true);assert.ok(effect.glow.material.opacity>.5);assert.ok(model.brakeMaterials[0].emissiveIntensity>2);
  assert.equal(scene.children.length,1);assert.equal(scene.children.some(n=>n.isLight),false);
  effect.update({...drive,braking:false},c,true);assert.equal(effect.glow.visible,false);assert.equal(model.brakeMaterials[0].emissiveIntensity,0);
});

test('the red projection stays on its own deck at a bridge crossing',()=>{
  const {effect}=setup(),c=new Circuit(kitConfig(KIT_PRESETS[1].pieces)),cross=c.layout.crossings[0];
  for(const [progress,height]of [[cross.lowerProgress,0],[cross.upperProgress,6]]){
    const p=c.at(progress);effect.update({...p,progress,groundY:p.y,brake:1,braking:true},c,true);
    const a=effect.glow.geometry.attributes.position;
    for(let i=0;i<a.count;i++){assert.ok(Math.abs(a.getY(i)-(height+.085))<.01);assert.ok(Number.isFinite(a.getX(i)));}
  }
});

test('brake glow follows ramps and fades with the distance from the road during a jump',()=>{
  const {effect}=setup(),c=new Circuit(kitConfig(['ramp-up'])),p=c.at(.6),drive={...p,progress:.6,groundY:p.y,brake:1,braking:true};
  effect.update(drive,c,true);const groundOpacity=effect.glow.material.opacity,a=effect.glow.geometry.attributes.position,heights=Array.from({length:a.count},(_,i)=>a.getY(i));
  assert.ok(Math.max(...heights)-Math.min(...heights)>.5,'projection stayed flat on an incline');
  effect.update({...drive,y:p.y+1},c,true);assert.ok(effect.glow.material.opacity<groundOpacity/2);
  effect.update({...drive,y:p.y+3},c,true);assert.equal(effect.glow.visible,false);
});

test('switching or resetting a vehicle cannot leave old brake lights glowing',()=>{
  const {effect,model}=setup(),c=new Circuit(kitConfig(['straight-long'])),p=c.at(.5),drive={...p,progress:.5,brake:1,braking:true};
  effect.update(drive,c,true);const next=buildVehicle(VEHICLES[2]);effect.bind(next);
  assert.equal(model.brakeMaterials[0].emissiveIntensity,0);assert.equal(next.brakeMaterials[0].emissiveIntensity,0);
  effect.update(drive,c,true);effect.reset();assert.equal(next.brakeMaterials[0].emissiveIntensity,0);assert.equal(effect.glow.visible,false);
});
