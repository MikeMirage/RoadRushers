"""Corvette selected-to-active body atlas bake from continuous high plus authored corrections.
Unique UV0, fixed triangulation, tangent normal, AO/rough/metal ORM and semantic RGB masks.
"""
import bpy,bmesh,os,sys,json,math,shutil
from mathutils import Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));level=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race';OUT=os.path.join(ROOT,'art/corvette-c7/bakes',level,'body');os.makedirs(OUT,exist_ok=True)
res={'garage':2048,'race':1024,'far':512}[level]
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/corvette-c7/retopo',level,'low-refined.blend'))
lowparts=[o for o in bpy.data.objects if o.type=='MESH' and o.parent and o.parent.name=='BodySuspension']
# Authored additions are also bake sources; keep them separate from the AI high.
corrected=[]
for o in lowparts:
 if not o.get('authoredCorrection'):continue
 h=o.copy();h.data=o.data.copy();h.name='HIGH_'+o.name;bpy.context.scene.collection.objects.link(h);corrected.append(h)
for o in list(bpy.data.objects):
 if o not in lowparts and o not in corrected:bpy.data.objects.remove(o,do_unlink=True)
for o in lowparts+corrected:o.parent=None;o.matrix_world=Matrix.Identity(4)
# Explode matching added surfaces: glazing, trim and mirrors must not project onto
# the original shell or each other. The offsets are restored after texture baking.
correction_by_name={o.name.removeprefix('HIGH_'):o for o in corrected}
for index,o in enumerate(lowparts):
 attr=o.data.attributes.new('bake_offset','FLOAT_VECTOR','POINT')
 if o.name not in correction_by_name:continue
 offset=(4*(index+1),0,0);h=correction_by_name[o.name]
 for v,a in zip(o.data.vertices,attr.data):v.co.x+=offset[0];a.vector=offset
 for v in h.data.vertices:v.co.x+=offset[0]

with bpy.data.libraries.load(os.path.join(ROOT,'art/corvette-c7/candidates/extracted/candidate.blend'),link=False) as (a,b):b.objects=['Coachwork_Continuous_Extracted']
high=b.objects[0];bpy.context.scene.collection.objects.link(high);high.parent=None;high.matrix_world=Matrix.Identity(4);high.name='HIGH_ContinuousBody'
# Remove the old generated mirrors so they cannot project onto the rebuilt ones.
bm=bmesh.new();bm.from_mesh(high.data);delete=[]
for f in bm.faces:
 p=f.calc_center_median();x,y,z=p.x,p.z,-p.y
 if abs(x)>.80 and .79<y<1.0 and -.10<z<.30:delete.append(f)
bmesh.ops.delete(bm,geom=delete,context='FACES');bm.to_mesh(high.data);bm.free()
highs=[high]+corrected
# Build a semantic mask graph from source blue paint, red lamps and cabin location.
m=high.data.materials[0];nt=m.node_tree;bs=nt.nodes.get('Principled BSDF');base=next(n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.startswith('neutral-base-preview'));pm=next(n for n in nt.nodes if n.type=='TEX_IMAGE' and n.image and n.image.name.startswith('paint-mask-preview'))
for l in list(bs.inputs['Base Color'].links):nt.links.remove(l)
nt.links.new(base.outputs['Color'],bs.inputs['Base Color'])
def mathnode(op,a=None,b=None):
 n=nt.nodes.new('ShaderNodeMath');n.operation=op
 for i,v in enumerate([a,b]):
  if v is None:continue
  if isinstance(v,(int,float)):n.inputs[i].default_value=v
  else:nt.links.new(v,n.inputs[i])
 return n.outputs[0]
geo=nt.nodes.new('ShaderNodeNewGeometry');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(geo.outputs['Position'],sep.inputs[0])
cabin=mathnode('MULTIPLY',mathnode('GREATER_THAN',sep.outputs['Z'],.80),mathnode('MULTIPLY',mathnode('GREATER_THAN',sep.outputs['Y'],-.75),mathnode('LESS_THAN',sep.outputs['Y'],1.85)))
glassmask=mathnode('MULTIPLY',cabin,mathnode('SUBTRACT',1,pm.outputs['Color']))
# Tail lamps use red source pixels and remain independent from uniform paint.
colorsep=nt.nodes.new('ShaderNodeSeparateColor');colorsep.mode='RGB';nt.links.new(base.outputs['Color'],colorsep.inputs[0])
redtest=mathnode('MULTIPLY',mathnode('GREATER_THAN',colorsep.outputs['Red'],.08),mathnode('MULTIPLY',mathnode('GREATER_THAN',colorsep.outputs['Red'],mathnode('MULTIPLY',colorsep.outputs['Green'],2.2)),mathnode('GREATER_THAN',colorsep.outputs['Red'],mathnode('MULTIPLY',colorsep.outputs['Blue'],2.2))))
rear=mathnode('GREATER_THAN',sep.outputs['Y'],1.75);brakemask=mathnode('MULTIPLY',rear,redtest)
combine=nt.nodes.new('ShaderNodeCombineColor');combine.mode='RGB';nt.links.new(pm.outputs['Color'],combine.inputs['Red']);nt.links.new(brakemask,combine.inputs['Green']);nt.links.new(glassmask,combine.inputs['Blue'])
rough=mathnode('SUBTRACT',.65,mathnode('MULTIPLY',pm.outputs['Color'],.35));rough=mathnode('SUBTRACT',rough,mathnode('MULTIPLY',glassmask,.48));nt.links.new(rough,bs.inputs['Roughness']);bs.inputs['Metallic'].default_value=.025
# Clean each body part before joining, preserving intentional component boundaries.
for o in lowparts:
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.0000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
bpy.ops.object.select_all(action='DESELECT')
for o in lowparts:o.select_set(True)
bpy.context.view_layer.objects.active=lowparts[0];bpy.ops.object.join();lo=bpy.context.object;lo.name='BodyAtlasLow'
while lo.data.uv_layers:lo.data.uv_layers.remove(lo.data.uv_layers[0])
lo.data.uv_layers.new(name='UVMap');bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.01,area_weight=0,correct_aspect=True,scale_to_bounds=False);bpy.ops.uv.average_islands_scale();bpy.ops.uv.pack_islands(rotate=True,margin=.008);bpy.ops.object.mode_set(mode='OBJECT')
mat=bpy.data.materials.new('VehicleBody');mat.use_nodes=True;lo.data.materials.clear();lo.data.materials.append(mat)
for p in lo.data.polygons:p.material_index=0
zero=0
for p in lo.data.polygons:
 uv=[lo.data.uv_layers.active.data[i].uv for i in p.loop_indices]
 if abs(sum(a.x*b.y-b.x*a.y for a,b in zip(uv,uv[1:]+uv[:1])))<1e-12:zero+=1
assert zero==0,('Degenerate body UVs',zero)
sys.path.insert(0,'/Users/miquelgelabert/.codex/skills/blender-texture-baking/scripts');import bake_maps
result=bake_maps.run(low=lo.name,high=[o.name for o in highs],maps=['normal','ao','roughness','metallic','basecolor'],res=res,samples=32,margin_px=8 if level!='garage' else 16,extrusion=.065,out=OUT,name='Body',pack_orm=True,device='CPU')
# Bake the actual runtime paint/brake/glass IDs with the identical projection cage.
for l in list(bs.inputs['Base Color'].links):nt.links.remove(l)
nt.links.new(combine.outputs[0],bs.inputs['Base Color'])
for o in corrected:
 for mm in o.data.materials:
  pbs=mm.node_tree.nodes.get('Principled BSDF');c=(1,0,0,1) if mm.name.startswith('Refined_Paint') else (0,0,1,1) if mm.name.startswith('Refined_Glass') else (0,0,0,1);pbs.inputs['Base Color'].default_value=c
mask=bake_maps.run(low=lo.name,high=[o.name for o in highs],maps=['basecolor'],res=res,samples=16,margin_px=8 if level!='garage' else 16,extrusion=.065,out=OUT,name='BodyMask',device='CPU')
public=os.path.join(ROOT,'public/models/optimized/corvette-c7/textures',level);os.makedirs(public,exist_ok=True)
for source,target in [('T_Body_BC.png','body-baseColor.png'),('T_Body_N.png','body-normal.png'),('T_Body_ORM.png','body-orm.png'),('T_BodyMask_BC.png','body-mask.png')]:shutil.copy2(os.path.join(OUT,source),os.path.join(public,target))
for o in highs:o.hide_render=True;o.hide_set(True)
for v,a in zip(lo.data.vertices,lo.data.attributes['bake_offset'].data):v.co-=a.vector
lo.data.update()
# The editable low mesh and source/cage arrangement remain in this native file.
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'body-baked.blend'),compress=True)
report={'level':level,'resolution':res,'lowTriangles':len(lo.data.polygons),'highTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in highs),'normalConvention':'OpenGL tangent','zeroAreaUV':zero,'bake':result,'maskBake':mask}
open(os.path.join(OUT,'bake-report.json'),'w').write(json.dumps(report,indent=2));open(os.path.join(OUT,'uv-triangles.json'),'w').write(json.dumps([[list(lo.data.uv_layers.active.data[i].uv) for i in p.loop_indices] for p in lo.data.polygons]));print('BODY_BAKE',json.dumps(report),flush=True)
