"""Verify the saved Blender mechanical control rig without changing its rest pose."""
import bpy,json,os
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/corvette-c7/corvette-c7.blend'))
ctrl=bpy.data.objects['CTRL_Corvette'];scene=bpy.context.scene
labels=['FL','FR','RL','RR'];wheel=lambda s:bpy.data.objects['Wheel_'+s]
scene.frame_set(1);rest=[wheel(s).matrix_world.translation.copy() for s in labels]
ctrl['steering']=.35;ctrl['wheel_spin']=1.57;ctrl['ride_height']=-.03;ctrl['suspension']=.01
ctrl.update_tag();scene.frame_set(2);bpy.context.view_layer.update()
checks={}
checks['frontSteerRadians']=[bpy.data.objects['Steering_'+s].rotation_euler.z for s in ['FL','FR']]
checks['wheelSpinRadians']=[wheel(s).rotation_euler.x for s in labels]
checks['bodyHeightMeters']=bpy.data.objects['BodySuspension'].location.z
checks['wheelCenterDriftMeters']=[(wheel(s).matrix_world.translation-rest[i]).length for i,s in enumerate(labels)]
assert all(abs(x-.35)<1e-6 for x in checks['frontSteerRadians'])
assert all(abs(x-1.57)<1e-6 for x in checks['wheelSpinRadians'])
assert abs(checks['bodyHeightMeters']+.02)<1e-6
assert max(checks['wheelCenterDriftMeters'])<1e-7
for prop in ['steering','wheel_spin','ride_height','suspension']:ctrl[prop]=0.
ctrl.update_tag();scene.frame_set(1);bpy.context.view_layer.update()
checks['pass']=True;checks['sourceMeshes']=sum(o.type=='MESH' for o in bpy.data.objects);checks['sourceObjects']=len(bpy.data.objects)
open(os.path.join(ROOT,'art/corvette-c7/native-rig-check.json'),'w').write(json.dumps(checks,indent=2))
# Save the verified rest pose with compression; preserve all independently editable parts.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'art/corvette-c7/corvette-c7.blend'),compress=True)
print('NATIVE_RIG',json.dumps(checks))
