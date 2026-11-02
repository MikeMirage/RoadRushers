"""Directed retopology from the user's continuous Tripo high source.
Coarse symmetric convex cross-sections close absent glazing; spline-like filtering
removes high-frequency triangulation noise. Independent clean wheels retain the rig.
Candidate only: nothing is written into the active public model path.
"""
import bpy,bmesh,math,os,json,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'art/corvette-c7/candidates/unibody');os.makedirs(OUT,exist_ok=True)
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
faces=[]
for poly in src.data.polygons:
 ids=list(poly.vertices);p=game[ids].mean(axis=0)
 iswheel=any(abs(p[0])>.59 and math.hypot(p[2]-axle,p[1]-radius)<radius+.026 for axle,radius in [(1.31,.337),(-1.4,.345)])
 ismirror=abs(p[0])>.94 and p[1]>.75 and -.35<p[2]<.5
 if not iswheel and not ismirror:faces.append(ids)
bvh=BVHTree.FromPolygons([Vector(p) for p in game],faces)
src.hide_render=True;src.hide_set(True);src.name='SOURCE_Continuous_Tripo_High'
# Cross-section convex hull; no segmented source edges become output topology.
def hull2(points):
 p=sorted(set((round(float(x),6),round(float(y),6)) for x,y in points))
 if len(p)<3:return p
 def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
 lo=[];hi=[]
 for q in p:
  while len(lo)>=2 and cross(lo[-2],lo[-1],q)<=0:lo.pop()
  lo.append(q)
 for q in reversed(p):
  while len(hi)>=2 and cross(hi[-2],hi[-1],q)<=0:hi.pop()
  hi.append(q)
 return lo[:-1]+hi[:-1]
def ray_polygon(poly,theta,cy=.42):
 dx,dy=math.sin(theta),math.cos(theta);best=None
 for a,b in zip(poly,poly[1:]+poly[:1]):
  ax,ay=a[0],a[1]-cy;ex,ey=b[0]-a[0],b[1]-a[1];det=dx*ey-dy*ex
  if abs(det)<1e-10:continue
  r=(ax*ey-ay*ex)/det;t=(ax*dy-ay*dx)/det
  if r>0 and -1e-5<=t<=1.00001:best=r if best is None else min(best,r)
 return best
NZ=88;NT=72;zgrid=np.linspace(-2.10,2.10,NZ+1);thetas=np.arange(NT)*2*math.pi/NT
rgrid=np.empty((NZ+1,NT));missing=0
for iz,z in enumerate(zgrid):
 pts=[]
 for th in np.arange(144)*2*math.pi/144:
  d=Vector((math.sin(th),math.cos(th),0));origin=Vector((0,.42,z))+d*2.5
  hit=bvh.ray_cast(origin,-d,5)
  if hit and hit[0] is not None:
   p=hit[0];pts.append((abs(p.x),p.y));pts.append((-abs(p.x),p.y))
 poly=hull2(pts)
 for it,theta in enumerate(thetas):
  r=ray_polygon(poly,theta)
  if r is None:missing+=1;r=.5
  rgrid[iz,it]=r
# Smooth only the low-resolution section field, not dense guide vertices.
# Three separable binomial passes preserve coherent highlights and remove local pits.
for _ in range(3):
 rgrid=(np.roll(rgrid,1,axis=1)+2*rgrid+np.roll(rgrid,-1,axis=1))/4
 padded=np.pad(rgrid,((1,1),(0,0)),mode='edge');rgrid=(padded[:-2]+2*padded[1:-1]+padded[2:])/4
# Keep symmetry exact after numerical smoothing.
for it in range(NT):
 twin=(-it)%NT;rgrid[:,it]=rgrid[:,twin]=(rgrid[:,it]+rgrid[:,twin])*.5
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
v=[];f=[]
for iz,z in enumerate(zgrid):
 for it,theta in enumerate(thetas):
  r=rgrid[iz,it];v.append((r*math.sin(theta),.42+r*math.cos(theta),z))
for iz in range(NZ):
 for it in range(NT):f.append((iz*NT+it,iz*NT+(it+1)%NT,(iz+1)*NT+(it+1)%NT,(iz+1)*NT+it))
# Front/rear caps follow longitudinal rays, with continuous rings at their perimeter.
for end,sign in [(0,-1),(NZ,1)]:
 ring=v[end*NT:(end+1)*NT];ci=len(v);v.append((0,.42,sign*2.22));ids=[]
 for t in [.25,.5,.75]:
  row=[]
  for p in ring:
   x=p[0]*t;y=.42+(p[1]-.42)*t
   hit=bvh.ray_cast(Vector((x,y,sign*3)),Vector((0,0,-sign)),1.2)
   zz=hit[0].z if hit and hit[0] is not None else sign*2.18
   zz=zz*(1-t**6)+sign*2.10*t**6
   row.append(len(v));v.append((x,y,zz))
  ids.append(row)
 ids.append([end*NT+i for i in range(NT)])
 for it in range(NT):f.append((ci,ids[0][it],ids[0][(it+1)%NT]))
 for a,b in zip(ids,ids[1:]):
  for it in range(NT):f.append((a[it],a[(it+1)%NT],b[(it+1)%NT],b[it]))
coach=mesh('Coachwork_Retopo_Sections',v,f,[paint,glass,trim])
# Coarse semantic glazing regions will be replaced with the source's ID bake.
for poly in coach.data.polygons:
 p=poly.center;x,y,z=p.x,p.z,-p.y
 if y>.82 and ((-.02<z<.65 and abs(x)<.74) or (-1.72<z<-.92 and abs(x)<.65) or (-1.15<z<.38 and abs(x)>.53 and y<1.19)):
  poly.material_index=1
 if y<.20:poly.material_index=2
# True wheel-arch cavities. The central chassis remains intact.
for side in [-1,1]:
 for axle,r,cy in [(1.31,.375,.337),(-1.40,.385,.345)]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=r,depth=.70,location=C((side*.96,cy,axle)),rotation=(0,math.pi/2,0))
  cut=bpy.context.object;mod=coach.modifiers.new('Wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut;bpy.context.view_layer.objects.active=coach;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# Retopo remains candidate-only until silhouettes, topology and baking are approved.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.15,.15,.15);scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'candidate.blend'),compress=True)
meta={'sourceHeight':height,'sourceAxles':[sf,sr],'targetWheelbase':2.71,'bodyWidthScale':.9385/bodywidth,'sectionGrid':[NZ+1,NT],'missingRays':missing,'method':'Symmetric convex cross-section envelope from continuous source; three low-frequency binomial passes; analytic arch cuts'}
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
