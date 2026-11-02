import bpy,sys,os,json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public/models/corvette-c7/corvette-c7.glb'))
sys.path.insert(0,'/Users/miquelgelabert/.codex/skills/blender-asset-qa/scripts');import review_shots
obs=[o.name for o in bpy.data.objects if o.type=='MESH']
for mode in ['random']:
 r=review_shots.run(objects=obs,out=os.path.join(ROOT,'art/corvette-c7/review-'+mode+'.png'),views=['front','right','back','top','three_quarter'],mode=mode,res=512)
 print(json.dumps(r))

wire=[]
for ob in bpy.data.objects:
 if ob.type=='MESH':
  verts=[list(ob.matrix_world @ v.co) for v in ob.data.vertices]
  wire.append({'vertices':verts,'edges':[list(e.vertices) for e in ob.data.edges]})
open(os.path.join(ROOT,'art/corvette-c7/wire-edges.json'),'w').write(json.dumps(wire,separators=(',',':')))
