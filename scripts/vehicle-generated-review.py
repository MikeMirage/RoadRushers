"""Inspect a generated source, never silently promote it to a game asset.

Blender -b -P scripts/vehicle-generated-review.py -- source.glb output-directory
The original GLB is untouched. Dimensions/triangles and review views are evidence,
not an assertion of production readiness.
"""
import bpy, sys, os, json, math
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--')+1:]
source, output = map(os.path.abspath, args[:2])
os.makedirs(output, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=source)
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# Tripo's current Corvette result is longitudinal X, Y up in glTF.
# Convert source X front to Blender -Y front for common review cameras.
transform = Matrix.Rotation(-math.pi/2, 4, 'Z')
for o in objects:
    o.matrix_world = transform @ o.matrix_world
bpy.context.view_layer.update()
points = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
minimum = Vector(tuple(min(p[k] for p in points) for k in range(3)))
maximum = Vector(tuple(max(p[k] for p in points) for k in range(3)))
scale = 4.49 / (maximum.y-minimum.y)
center = (minimum+maximum)/2
center.z = minimum.z
normalization = Matrix.Diagonal((scale,scale,scale,1)) @ Matrix.Translation(-center)
for o in objects:
    o.matrix_world = normalization @ o.matrix_world
bpy.context.view_layer.update()
report = {'source':source, 'status':'candidate-high-source-not-game-ready',
          'normalization':'Uniform length to 4.49m for visual comparison; not dimensional validation',
          'sourceBounds':list(maximum-minimum),'parts':[]}
for o in objects:
    o.data.calc_loop_triangles()
    report['parts'].append({'name':o.name,'triangles':len(o.data.loop_triangles),
        'vertices':len(o.data.vertices),'uvLayers':len(o.data.uv_layers),
        'center':list(o.matrix_world.translation),'dimensions':list(o.dimensions)})
report['triangles'] = sum(p['triangles'] for p in report['parts'])
with open(os.path.join(output,'source-inspection.json'),'w') as f:
    json.dump(report,f,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output,'source-review.blend'))
sys.path.insert(0,os.path.expanduser('~/.codex/skills/blender-asset-qa/scripts'))
import review_shots
for mode in ['solid','random']:
    review_shots.run(objects=[o.name for o in objects],out=os.path.join(output,mode+'.png'),
                     views=['front','right','back','top','three_quarter'],mode=mode,res=640)
print('SOURCE_INSPECTION',report['triangles'],len(objects))
