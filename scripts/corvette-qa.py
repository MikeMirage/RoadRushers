"""Run installed Blender QA, preserving raw results and explicitly normalizing glTF seams.
The normalized copy never replaces the GLB. Vertex normalization must retain every face.
Double-precision scalar volume arithmetic avoids false inversion on 3 mm rotor holes.
"""
import bpy,bmesh,sys,os,json
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT,'public/models/corvette-c7/corvette-c7.glb'))
sys.path.insert(0,'/Users/miquelgelabert/.codex/skills/blender-asset-qa/scripts')
import qa_check
obs=[o.name for o in bpy.data.objects if o.type=='MESH']
raw=qa_check.run(objects=obs,profile='game',eps=.00015,tol=.006,max_tris=300000)
open(os.path.join(ROOT,'art/corvette-c7/qa-raw.json'),'w').write(json.dumps(raw,indent=2))
# glTF duplicates vertices at UV/hard-normal seams. Weld position-identical seams
# on a DISPOSABLE QA copy so edge-adjacent triangles are not false coplanar hits.
# Assert face counts unchanged: this cannot silently remove duplicate faces.
seams={}
for ob in bpy.data.objects:
 if ob.type=='MESH':
  bm=bmesh.new();bm.from_mesh(ob.data);before=(len(bm.verts),len(bm.faces))
  bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.0000001)
  after=(len(bm.verts),len(bm.faces));assert before[1]==after[1],(ob.name,before,after)
  seams[ob.name]={'verticesBefore':before[0],'verticesAfter':after[0],'facesUnchanged':after[1]}
  bm.to_mesh(ob.data);bm.free()
# mathutils Vector dot/cross is float32, which can reverse near-zero volumes for
# tiny geometry translated metres from the origin. Only volume accumulation is
# promoted to Python float64. All geometry thresholds and checks stay identical.
source=open(qa_check.__file__).read()
old='vol[g] += a.dot(b.cross(c)) / 6.0'
new='vol[g] += (float(a.x)*(float(b.y)*float(c.z)-float(b.z)*float(c.y)) + float(a.y)*(float(b.z)*float(c.x)-float(b.x)*float(c.z)) + float(a.z)*(float(b.x)*float(c.y)-float(b.y)*float(c.x))) / 6.0'
assert old in source;exec(compile(source.replace(old,new),qa_check.__file__,'exec'),qa_check.__dict__)
r=qa_check.run(objects=obs,profile='game',eps=.00015,tol=.006,max_tris=300000)
r['seamNormalization']=seams
r['qaAdaptations']=['Position-identical glTF seam vertices welded at 0.1 micrometre in disposable QA copy; every face count asserted unchanged.','Signed volume computed in float64 scalars instead of mathutils float32 to avoid cancellation in 3 mm rotor holes.']
open(os.path.join(ROOT,'art/corvette-c7/qa-final.json'),'w').write(json.dumps(r,indent=2))
print('QA_SUMMARY',json.dumps({'pass':r['pass'],'errors':r['errors'],'warnings':r['warnings']},indent=2))
