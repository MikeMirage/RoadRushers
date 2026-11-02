"""Preserve the user-approved EbZlVU0uuO model; conservatively simplify each piece.
Uniform metre normalization only. No shape reconstruction, voxelization or global reduction.
First-pass export intentionally uses simple material colors; the atlas is added after review.
"""
import bpy,bmesh,os,json,math,numpy as np
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));OUT=os.path.join(ROOT,'art/corvette-study');PUBLIC=os.path.join(ROOT,'public/models/corvette-study');os.makedirs(OUT,exist_ok=True);os.makedirs(PUBLIC,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT,'art/corvette-c7/approved-source-normalized.blend'))
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in objects:o.data.transform(o.matrix_world);o.matrix_world=Matrix.Identity(4)
# RL is part of the original base-body component. Split its actual faces, without
# replacing its design or cutting away its visible tire/fender silhouette.
source0=bpy.data.objects['tripo_part_0'];rl=source0.copy();rl.data=source0.data.copy();rl.name='source_rear_left_wheel';bpy.context.scene.collection.objects.link(rl)
def in_rl(p):return p.x<-.59 and math.hypot(-p.y+1.344,p.z-.352)<.356
for ob,want in [(source0,False),(rl,True)]:
 bm=bmesh.new();bm.from_mesh(ob.data);remove=[f for f in bm.faces if in_rl(f.calc_center_median())!=want];bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(ob.data);bm.free()
assert len(rl.data.polygons)>500,'RL extraction did not identify a complete wheel region'
objects.append(rl)
# Measured centers from approved geometry. Keep the approved wheelbase/proportions.
centers={'FL':(-.7777,.3504,1.2719),'FR':(.7748,.3540,1.2715),'RL':(-.783,.352,-1.344),'RR':(.7916,.3522,-1.3445)}
C=lambda p:Vector((p[0],-p[2],p[1]))
def empty(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.scene.collection.objects.link(o);o.parent=parent;o.location=C(pos);return o
root=empty('CorvetteStudy');root['sourceCreation']='EbZlVU0uuO';root['axes']='+Y up,+Z forward';root['normalization']='Uniform scale to 4.49m length; approved proportions retained'
body=empty('BodySuspension',root);ctrl=empty('CTRL_Corvette',root)
for k in ['steering','wheel_spin','ride_height','suspension']:ctrl[k]=0.0
def drive(o,path,index,expression,props):
 d=o.driver_add(path,index).driver;d.type='SCRIPTED';d.expression=expression
 for key in props:v=d.variables.new();v.name=key;v.type='SINGLE_PROP';v.targets[0].id=ctrl;v.targets[0].data_path='["'+key+'"]'
drive(body,'location',2,'ride_height+suspension',['ride_height','suspension'])
wheels={}
for label,pos in centers.items():
 sus=empty('Suspension_'+label,root,pos);steer=empty('Steering_'+label,sus);spin=empty('Wheel_'+label,steer);spin['radius']=.347 if label=='FL' else .351;spin['side']=-1 if label.endswith('L') else 1
 if label.startswith('F'):drive(steer,'rotation_euler',2,'steering',['steering'])
 drive(spin,'rotation_euler',0,'wheel_spin',['wheel_spin']);wheels[label]=spin
# A compact, neutral material palette. Paint is white for runtime tinting.
def material(name,role,color,rough,metal=0,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m['vehicleRole']=role;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if emit:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit
 return m
mats=[material('StudyPaint','paint',(1,1,1),.30,.25),material('StudyGlass','glass',(.009,.014,.019),.16,.03),material('StudyTrim','trim',(.012,.016,.020),.58),material('StudyRubber','rubber',(.013,.015,.018),.82),material('StudyRim','rim',(.42,.46,.50),.27,.85),material('StudyMetal','metal',(.27,.30,.33),.30,.85),material('StudyBrake','metal',(.48,.016,.009),.35,.18),material('StudyHeadlight','lights',(.72,.82,1),.20,.05,1.2),material('StudyTaillight','brake',(.34,.003,.007),.24,0,.45),material('StudyAmber','lights',(.65,.10,.004),.30,0,.3)]
partwheel={3:'FL',4:'FR',5:'RR',9:'RR'}
bodypaint={1,2,7,12,14,16,19,25,26,30,31}
glassparts={6,20,22,24,27,28}
rows=[];low=[];sources=[]
for index,hi in enumerate(objects):
 name=hi.name;part=int(name.rsplit('_',1)[1]) if name.startswith('tripo_part_') else -1;wheel='RL' if hi==rl else partwheel.get(part)
 image=next((n.image for n in hi.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image and 'base_color' in n.image.name),None)
 pixels=np.array(image.pixels[:],dtype=np.float32).reshape(image.size[1],image.size[0],4) if image else None
 # Each source piece has its own reduction budget; small silhouette features and
 # glazing retain more geometry than hidden interior structure.
 ratio=.36
 if wheel:ratio=.42
 elif part in {10,11,15,18,23,36,37}:ratio=.28
 elif part in {6,20,22,24,27,28}:ratio=.65
 elif part in {7,19,30,31,33,34}:ratio=.70
 elif len(hi.data.polygons)<650:ratio=.65
 lo=hi.copy();lo.data=hi.data.copy();lo.name='Study_'+('WheelRL' if part==-1 else str(part));bpy.context.scene.collection.objects.link(lo)
 bpy.ops.object.select_all(action='DESELECT');lo.select_set(True);bpy.context.view_layer.objects.active=lo
 mod=lo.modifiers.new('Conservative piece reduction','DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=ratio;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 # Quantify the local surface displacement; no nominal triangle budget is treated
 # as proof of visual preservation.
 hbvh=BVHTree.FromPolygons([v.co for v in hi.data.vertices],[tuple(p.vertices) for p in hi.data.polygons]);lbvh=BVHTree.FromPolygons([v.co for v in lo.data.vertices],[tuple(p.vertices) for p in lo.data.polygons]);errors=[]
 for mesh,target in [(hi.data,lbvh),(lo.data,hbvh)]:
  step=max(1,len(mesh.vertices)//1000)
  for v in list(mesh.vertices)[::step]:
   hit=target.find_nearest(v.co)
   if hit and hit[0] is not None:errors.append(hit[3])
 uv=lo.data.uv_layers.active;face_roles=[]
 for p in lo.data.polygons:
  if pixels is not None and uv:
   coords=[uv.data[i].uv for i in p.loop_indices];u=sum(v.x for v in coords)/len(coords);v=sum(v.y for v in coords)/len(coords);rgb=pixels[int((v%1)*(pixels.shape[0]-1)),int((u%1)*(pixels.shape[1]-1)),:3]
  else:rgb=np.array([.1,.1,.1])
  r,g,b=map(float,rgb);value=max(r,g,b);paintblue=(b>r*1.45 and b>g*1.08 and b>.15);red=(r>.15 and r>g*1.9 and r>b*1.9);amber=(r>.28 and g>.07 and r>g*1.4 and g>b*1.8)
  if wheel:role=6 if red else 4 if value>.24 else 3
  elif part in glassparts:role=1
  elif part in {33,34}:role=0 if paintblue else 7 if value>.5 else 5 if value>.28 else 1
  elif red and p.center.y>1.75 and p.center.z>.5:role=8
  elif amber:role=9
  elif paintblue:role=0
  elif part in bodypaint:role=1 if part in {30,31} and p.normal.y>.65 and p.center.y>.01 else 0
  elif part==13:role=2
  elif part==17:role=0 if paintblue or (abs(p.center.x)>.60 and p.center.z>.42 and abs(p.normal.x)>.35) or (p.center.z>1.16 and p.normal.z>.25) else 2
  elif part==0:role=0 if p.center.z>.43 and abs(p.center.x)>.62 and abs(p.normal.x)>.35 else 5 if value>.38 and p.center.y>1.65 else 2
  else:role=5 if value>.38 else 2
  face_roles.append(role)
 lo.data.materials.clear()
 for m in mats:lo.data.materials.append(m)
 for p,role in zip(lo.data.polygons,face_roles):p.material_index=role
 if lo.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
 for p in lo.data.polygons:p.use_smooth=True
 lo['sourceHigh']='HIGH_'+name;lo['sourcePart']=part;lo['wheelSlot']=wheel or '';lo['simplificationRatio']=ratio
 if wheel:
  offset=C(centers[wheel])
  for v in lo.data.vertices:v.co-=offset
  lo.parent=wheels[wheel];lo.location=(0,0,0)
 else:lo.parent=body
 hi.name='HIGH_'+name;hi.hide_render=True;hi.hide_set(True);sources.append(hi);low.append(lo)
 rows.append({'source':name,'wheel':wheel,'highTriangles':sum(len(p.vertices)-2 for p in hi.data.polygons),'lowTriangles':sum(len(p.vertices)-2 for p in lo.data.polygons),'ratio':ratio,'surfaceErrorP95m':float(np.percentile(errors,95)),'surfaceErrorMaxm':float(max(errors))})
# Keep the authoring pairs editable for the subsequent normal bake.
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'study-work.blend'),compress=True)
# Group static source pieces by rigid parent. The role materials remain separate
# render primitives so custom paint/rim/rubber changes cannot tint unrelated parts.
for parent in [body]+list(wheels.values()):
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent]
 if len(obs)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();bpy.context.object.name='BodyMesh' if parent==body else parent.name+'Mesh'
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in root.children_recursive:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=os.path.join(PUBLIC,'model.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_texcoords=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
triangles=sum(r['lowTriangles'] for r in rows);points=[o.matrix_world@v.co for o in root.children_recursive if o.type=='MESH' for v in o.data.vertices];bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
report={'status':'draft','model':'model.glb','source':{'creation':'EbZlVU0uuO','provider':'Tripo 3.1','file':'art/vehicle-pipeline/magnific/corvette-user-parts/textured-pbr.glb'},'stage':'simple colors and rig preview; normal atlas pending','triangles':triangles,'glbBytes':os.path.getsize(os.path.join(PUBLIC,'model.glb')),'dimensions':{'length':bounds[1][1]-bounds[0][1],'width':bounds[1][0]-bounds[0][0],'height':bounds[1][2]-bounds[0][2],'wheelbase':2.616,'track':1.5525,'wheelRadius':.351},'wheelCenters':centers,'notes':['Approved source proportions retained with uniform scale to 4.49m length.','Rear-left wheel faces separated from the original base-body object; no replacement wheel design.','Conservative reduction by source piece; not a race-budget asset.'],'parts':rows}
open(os.path.join(PUBLIC,'manifest.json'),'w').write(json.dumps(report,indent=2));open(os.path.join(OUT,'preview-report.json'),'w').write(json.dumps(report,indent=2));print('STUDY_PREVIEW',triangles,report['glbBytes'],flush=True)
