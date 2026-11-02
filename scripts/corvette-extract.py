"""Directed retopology from the user's continuous Tripo high source.
Coarse symmetric convex cross-sections close absent glazing; spline-like filtering
removes high-frequency triangulation noise. Independent clean wheels retain the rig.
Candidate only: nothing is written into the active public model path.
"""
import bpy,bmesh,math,os,json,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'art/corvette-c7/candidates/extracted');os.makedirs(OUT,exist_ok=True)
SOURCE=os.path.join(ROOT,'art/vehicle-pipeline/magnific/corvette-user-sample/source-review.blend')
bpy.ops.wm.open_mainfile(filepath=SOURCE);bpy.context.view_layer.update()
src=next(o for o in bpy.data.objects if o.type=='MESH')
verts=[o for o in (src.matrix_world @ v.co for v in src.data.vertices)]
game=np.array([(v.x,v.z,-v.y) for v in verts],dtype=float)
# Axles from ground-contact samples, then piecewise longitudinal correction to 2.71 m.
feet=game[(game[:,1]<.045)&(np.abs(game[:,0])>.60)]
sf=float(np.median(feet[feet[:,2]>.5,2]));sr=float(np.median(feet[feet[:,2]<-.5,2]))
height=float(game[:,1].max());bodywidth=float(np.percentile(np.abs(game[(game[:,1]>.35)&(game[:,1]<.85)&(np.abs(game[:,2])<1.8),0]),99.7))
for p in game:
 p[0]*=.9385/bodywidth;p[1]*=1.2395/height
 z=p[2]
 if z>=sf:p[2]=1.31+(z-sf)*(.935/(2.245-sf))
 elif z<=sr:p[2]=-1.4+(z-sr)*(-.845/(-2.245-sr))
 else:p[2]=-1.4+(z-sr)*2.71/(sf-sr)
C=lambda p:Vector((p[0],-p[2],p[1]))
def material(name,color,rough=.4,metal=0,coat=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Coat Weight'].default_value=coat;return m
paint=material('M_Paint',(.008,.13,.37),.28,0,1);glass=material('M_Glass',(.012,.022,.03),.16,.05,.75);trim=material('M_Carbon',(.014,.019,.023),.55)
# Load the existing independently editable wheels and rigid pivots, preserving names.
wheelprefix=('Suspension_','Steering_','Wheel_','Tire_','TireGroove_','TreadSipe_','RimBarrel_','RimLip_','SplitYSpoke_','Hub_','CenterCap_','Lug_','BrakeRotor_','RotorHat_','RotorDrill_','BrakeCaliper_','SidewallRidge_','Valve_')
with bpy.data.libraries.load(os.path.join(ROOT,'art/corvette-c7/baseline-v1/corvette-c7.blend'),link=False) as (a,b):b.objects=[n for n in a.objects if n in ['CorvetteC7','BodySuspension','CTRL_Corvette'] or n.startswith(wheelprefix)]
for o in b.objects:
 if o:bpy.context.scene.collection.objects.link(o)
bpy.context.view_layer.update();root=bpy.data.objects['CorvetteC7'];body=bpy.data.objects['BodySuspension']
def mesh(name,v,f,mats,parent=body):
 me=bpy.data.meshes.new(name);me.from_pydata([C(p) for p in v],[],f);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob.parent=parent
 for mat in mats:me.materials.append(mat)
 for poly in me.polygons:poly.use_smooth=True
 uv=me.uv_layers.new(name='UVMap')
 for poly in me.polygons:
  for li in poly.loop_indices:
   p=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=(((-p.y)+2.3)/4.6,(math.atan2(p.x,p.z-.42)%(2*math.pi))/(2*math.pi))
 return ob

# Preserve continuous source topology and UV; remove the integrated wheels by
# analytic arch clearance, then add independent authored wheels and rigid pivots.
from mathutils import Matrix
src.data.transform(src.matrix_world);src.matrix_world=Matrix.Identity(4)
for vert,p in zip(src.data.vertices,game):vert.co=C(p)
src.parent=body;src.name='Coachwork_Continuous_Extracted'
bm=bmesh.new();bm.from_mesh(src.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000002)
remove=[]
for face in bm.faces:
 p=face.calc_center_median();x,y,z=p.x,p.z,-p.y
 if any(abs(x)>.59 and math.hypot(z-axle,y-cy)<r for axle,cy,r in [(1.31,.337,.360),(-1.4,.345,.368)]):remove.append(face)
bmesh.ops.delete(bm,geom=remove,context='FACES')
# Boundary vertices are projected to an exact circle, eliminating the sawtooth
# triangle deletion edge without fitting any high-frequency guide detail.
for vert in bm.verts:
 if not vert.is_boundary:continue
 p=vert.co;x,y,z=p.x,p.z,-p.y
 for axle,cy,r in [(1.31,.337,.360),(-1.4,.345,.368)]:
  d=math.hypot(z-axle,y-cy)
  if abs(x)>.59 and abs(d-r)<.055:
   p.y=-(axle+(z-axle)*r/d);p.z=cy+(y-cy)*r/d
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(src.data);bm.free()
bpy.ops.object.select_all(action='DESELECT');src.select_set(True);bpy.context.view_layer.objects.active=src
if src.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
sm=src.modifiers.new('Gentle surface fairing','SMOOTH');sm.factor=.35;sm.iterations=3
bpy.ops.object.modifier_apply(modifier=sm.name)
# Remove paint from the source color map so the paint is a true neutral material.
sourceimage=next(i for i in bpy.data.images if i.size[0]==2048)
w,h=sourceimage.size;pixels=np.array(sourceimage.pixels[:],dtype=np.float32).reshape(h,w,4)
factor=(pixels[:,:,2]-pixels[:,:,0]>.09).astype(np.float32)
# Neutral glass and trim should not inherit bright, metallic-looking source color.
neutral=(np.max(pixels[:,:,:3],axis=2)-np.min(pixels[:,:,:3],axis=2))<.10
pixels[:,:,:3]*=np.where(neutral & (factor<.5),.30,1)[:,:,None]
base=pixels.copy();base[:,:,:3]=base[:,:,:3]*(1-factor[:,:,None])+factor[:,:,None]
mask=np.ones_like(base);mask[:,:,:3]=factor[:,:,None]
def makeimage(name,data):
 im=bpy.data.images.new(name,width=w,height=h,alpha=True);im.pixels.foreach_set(data.ravel());im.filepath_raw=os.path.join(OUT,name+'.png');im.file_format='PNG';im.save();return im
baseimage=makeimage('neutral-base-preview',base);maskimage=makeimage('paint-mask-preview',mask);maskimage.colorspace_settings.name='Non-Color'
mat=bpy.data.materials.new('SourceNeutralPaint');mat.use_nodes=True;nt=mat.node_tree;bs=nt.nodes.get('Principled BSDF')
tex=nt.nodes.new('ShaderNodeTexImage');tex.image=baseimage
mk=nt.nodes.new('ShaderNodeTexImage');mk.image=maskimage
mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';mix.inputs[2].default_value=(.008,.13,.37,1);nt.links.new(mk.outputs['Color'],mix.inputs[0]);nt.links.new(tex.outputs['Color'],mix.inputs[1]);nt.links.new(mix.outputs[0],bs.inputs['Base Color'])
bs.inputs['Roughness'].default_value=.36;bs.inputs['Metallic'].default_value=0;bs.inputs['Coat Weight'].default_value=.12
src.data.materials.clear();src.data.materials.append(mat)
for p in src.data.polygons:p.use_smooth=True;p.material_index=0
# Close the open side windows with clean gently convex glazing patches.
for side in [-1,1]:
 vv=[];ff=[];nu=18;nv=8
 for j in range(nv+1):
  v=j/nv
  for i in range(nu+1):
   u=i/nu
   front=.40*(1-v)+(-.16)*v;back=-.96*(1-v)+(-.80)*v
   z=front*(1-u)+back*u
   y=.823*(1-v)+(1.125+.025*math.sin(math.pi*u))*v
   x=side*(.785*(1-v)+.645*v+.010*math.sin(math.pi*u)*math.sin(math.pi*v))
   vv.append((x,y,z))
 for j in range(nv):
  for i in range(nu):a=j*(nu+1)+i;ff.append((a,a+1,a+nu+2,a+nu+1))
 mesh('SideGlassClean_'+str(side),vv,ff,[glass])
# Isolated candidate; no production exports are overwritten.
scene=bpy.context.scene;scene.view_layers[0].material_override=None
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'candidate.blend'),compress=True)
meta={'sourceHeight':height,'sourceAxles':[sf,sr],'targetWheelbase':2.71,'bodyWidthScale':.9385/bodywidth,'triangles':sum(len(p.vertices)-2 for p in src.data.polygons),'method':'Continuous user source, corrected dimensions, wheel geometry removed; clean authored wheel rigs; paint-neutral color reconstruction'}
open(os.path.join(OUT,'measurement.json'),'w').write(json.dumps(meta,indent=2))
def area(name,pos,power,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=C(pos);o.rotation_euler=(C((0,.5,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(3.8,5,4),1400,5);area('Fill',(-4,3,1),1100,4);area('Rim',(1,3,-5),1700,4)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.01));floor=bpy.context.object;floor.data.materials.append(material('Floor',(.10,.12,.14),.55))
d=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',d);scene.collection.objects.link(cam);scene.camera=cam;d.lens=52
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
for name,pos in [('front-three-quarter',(4.9,2.75,6.8)),('side',(7.6,1.7,0)),('rear-three-quarter',(-4.9,2.55,-6.8))]:
 cam.location=C(pos);cam.rotation_euler=(C((0,.6,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)
print('UNIBODY',json.dumps(meta))
