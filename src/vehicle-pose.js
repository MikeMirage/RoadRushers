/** Terrain attitude belongs to the root, suspension attitude to the sprung shell.
 * All render paths use this contract, including instanced rivals and replays.
 */
export function animateVehicle(model,pose,dt=0,running=true,distance=null){
  const root=model.group;
  root.rotation.x=-(pose.pitch||0);root.rotation.z=pose.roll||0;
  const body=model.bodyRig;
  if(body){body.rotation.x=-(pose.bodyPitch||0);body.rotation.z=pose.bodyRoll||0;body.position.y=(model.restBodyY||0)+(model.customization?.rideHeight||0)+(pose.heave||0)/(model.visualScale||1);}
  else root.rotation.z+=(pose.steer*pose.speed*.003)||0;
  const radius=model.wheelRadius??root.userData.wheelRadius??1/3.3;
  for(const wheel of model.wheels||[]){
    const rollingRadius=wheel.userData.radius>0?wheel.userData.radius*(model.visualScale||1):radius;
    if(distance!=null)wheel.rotation.x=distance/rollingRadius;
    else if(running)wheel.rotation.x+=pose.speed*dt/rollingRadius;
  }
  const steering=pose.steeringAngle??-pose.steer*.35,base=root.userData.wheelbase,track=root.userData.track;
  for(const pivot of model.frontWheels||[]){
    // The inside tire turns farther than the outside tire (Ackermann steering).
    if(base&&track&&Math.abs(steering)>.001){
      const radius=base/Math.tan(Math.abs(steering));
      const inner=Math.sign(steering)===pivot.userData.side;
      pivot.rotation.y=Math.sign(steering)*Math.atan(base/Math.max(.15,radius+(inner?-1:1)*track/2));
    }else pivot.rotation.y=steering;
  }
}
