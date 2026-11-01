import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Box3,Group,PerspectiveCamera,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VEHICLES} from '../src/config.js';
import {buildVehicle,preloadVehicles} from '../src/vehicles.js';
import {disposeVehicle} from '../src/vehicle-modeler.js';
import {garageCameraFrame} from '../src/garage.js';

test('all 53 showroom cars remain centered and fully visible in narrow, square and landscape viewports',async()=>{
  const bytes=await readFile(new URL('../public/models/vehicle-truck-yellow.glb',import.meta.url));
  const loader=new GLTFLoader().register(()=>({name:'geometry-only',loadTexture:()=>Promise.resolve(null)}));
  await preloadVehicles(()=>loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
  for(const vehicle of VEHICLES){
    const model=buildVehicle(vehicle),display=new Group();
    // Collection cars occupy different rows before the selected one is framed.
    display.position.set(-2.175,0,-10.2);display.add(model.group);
    model.group.position.y=.19;model.group.rotation.y=-.22;model.group.updateWorldMatrix(true,true);
    const bounds=new Box3().setFromObject(model.group);
    for(const aspect of [.45,.75,1,2,3.5]){
      const camera=new PerspectiveCamera(40,aspect,.05,160),frame=garageCameraFrame(bounds,aspect,camera.fov);
      camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld();
      const center=bounds.getCenter(new Vector3()).project(camera);
      assert.ok(Math.abs(center.x)<1e-6&&Math.abs(center.y)<1e-6,`${vehicle.id}: centered at ${aspect}`);
      for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
        const point=new Vector3(x,y,z).project(camera);
        assert.ok(Math.abs(point.x)<=.82001&&Math.abs(point.y)<=.82001&&Math.abs(point.z)<1,`${vehicle.id}: full model visible at ${aspect}`);
      }
    }
    disposeVehicle(model);
  }
});
