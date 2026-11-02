"""Directed corrections of the reconstructed Corvette low topology.
Adds curved glazing, independent mirrors, real fascia cavity and four exhaust bores.
Cuts circular wheel wells analytically; nothing is exported before bake/QA.
"""
import bpy,bmesh,os,sys,math,json
from mathutils import Vector
from mathutils.bvhtree import BVHTree
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));level=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'race';OUT=os.path.join(ROOT,'art/corvette-c7/retopo',level)
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'low-parts.blend'))
body=bpy.data.objects['BodySuspension'];coach=bpy.data.objects['Coachwork_Retopo_'+level];C=lambda p:Vector((p[0],-p[2],p[1]))
def mat(name,color,rough=.4,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;return m
paint=mat('Refined_Paint',(1,1,1),.3);glass=mat('Refined_Glass',(.008,.014,.019),.16);black=mat('Refined_Trim',(.004,.006,.008),.58);metal=mat('Refined_Exhaust',(.32,.35,.38),.28,1)
added=[]
def mesh(name,vs,fs,m,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata([C(v) for v in vs],[],fs);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(o);o.parent=body;me.materials.append(m)
 for p in me.polygons:p.use_smooth=smooth
 added.append(o);return o
# High source is retained only as a measurement guide for glazing heights.
with bpy.data.libraries.load(os.path.join(ROOT,'art/corvette-c7/candidates/extracted/candidate.blend'),link=False) as (a,b):b.objects=['Coachwork_Continuous_Extracted']
high=b.objects[0];bpy.context.scene.collection.objects.link(high);high.parent=None;bpy.context.view_layer.update()
bvh=BVHTree.FromPolygons([v.co for v in high.data.vertices],[tuple(p.vertices) for p in high.data.polygons])
# Limited projection of the sparse, reconstructed control mesh reduces bake
# gradients without copying the dense source's triangulation or tiny surface noise.
for v in coach.data.vertices:
 hit=bvh.find_nearest(v.co)
 if hit and hit[0] is not None and hit[3]<.045:v.co=v.co.lerp(hit[0],.75)
# Restore exact wheel openings with a Boolean instead of moving irregular triangles.
for side in [-1,1]:
 for axle,cy,r in [(1.31,.337,.360),(-1.4,.345,.368)]:
  bpy.ops.mesh.primitive_cylinder_add(vertices=48 if level=='garage' else 32 if level=='race' else 16,radius=r,depth=1.2,location=C((side*1.15,cy,axle)),rotation=(0,math.pi/2,0))
  cut=bpy.context.object;mo=coach.modifiers.new('Analytic wheel arch','BOOLEAN');mo.operation='DIFFERENCE';mo.solver='EXACT';mo.object=cut;bpy.context.view_layer.objects.active=coach;bpy.ops.object.modifier_apply(modifier=mo.name);bpy.data.objects.remove(cut,do_unlink=True)
# The proxy's blunt mirror cones are replaced with purpose-built silhouettes.
bm=bmesh.new();bm.from_mesh(coach.data)
remove=[]
for f in bm.faces:
 p=f.calc_center_median();x,y,z=p.x,p.z,-p.y
 outside=any(abs(v.co.x)>1.01 and v.co.z<.75 for v in f.verts)
 t=max(0,min(1,(.70-z)/.85));windshield=(-.15<z<.70 and y>.82 and abs(x)<.705-.12*t-.035)
 sideglass=(.85<y<1.16 and -.88<z<.28 and .57<abs(x)<.77)
 oldmirror=abs(x)>.80 and .79<y<1.0 and -.10<z<.30
 if outside or windshield or sideglass or oldmirror:remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(coach.data);bm.free()
# Curved windshield follows measured high surface, with rounded planform.
nu,nv=(16,8) if level=='garage' else (8,4) if level=='race' else (6,2)
vs=[];fs=[]
for j in range(nv+1):
 t=j/nv
 for i in range(nu+1):
  u=i/nu*2-1;w=.705*(1-t)+.585*t;x=u*w
  z=(.70-.10*u*u)*(1-t)+(-.15+.035*u*u)*t
  hit=bvh.ray_cast(C((x,2,z)),Vector((0,0,-1)),1.4)
  y=hit[0].z+.002 if hit and hit[0] is not None and hit[0].z>.78 else .86+(1.205-.86)*t
  vs.append((x,y,z))
for j in range(nv):
 for i in range(nu):a=j*(nu+1)+i;fs.append((a,a+1,a+nu+2,a+nu+1))
mesh('CleanWindshield',vs,fs,glass)
for side in [-1,1]:
 nu,nv=(16,6) if level=='garage' else (8,3) if level=='race' else (4,2);vs=[];fs=[]
 for j in range(nv+1):
  v=j/nv
  for i in range(nu+1):
   u=i/nu;front=.40*(1-v)-.16*v;back=-.96*(1-v)-.80*v;z=front*(1-u)+back*u;y=.823*(1-v)+(1.125+.025*math.sin(math.pi*u))*v;x=side*(.785*(1-v)+.645*v+.010*math.sin(math.pi*u)*math.sin(math.pi*v));vs.append((x,y,z))
 for j in range(nv):
  for i in range(nu):a=j*(nu+1)+i;fs.append((a,a+1,a+nu+2,a+nu+1))
 mesh('CleanSideGlass_'+str(side),vs,fs,glass)
 # Rounded mirror housing, oval glass, low profile stem.
 rings=8 if level=='garage' else 4;segments=16 if level=='garage' else 8;vs=[];fs=[]
 for j in range(rings+1):
  a=math.pi*j/rings
  for i in range(segments):
   b=2*math.pi*i/segments;vs.append((side*(.935+.105*math.sin(a)*math.cos(b)),.872+.050*math.sin(a)*math.sin(b),.12+.105*math.cos(a)))
 for j in range(rings):
  for i in range(segments):fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
 mesh('CleanMirror_'+str(side),vs,fs,paint)
 vs=[(side*.935,.872,.011)]+[(side*(.935+.081*math.cos(2*math.pi*i/segments)),.872+.034*math.sin(2*math.pi*i/segments),.011) for i in range(segments)]
 mesh('CleanMirrorGlass_'+str(side),vs,[(0,1+i,1+(i+1)%segments) for i in range(segments)],glass)
 vs=[(side*x,y,z) for x,y,z in [(.78,.83,.20),(.88,.86,.16),(.90,.86,.12),(.80,.83,.16),(.78,.85,.20),(.88,.88,.16),(.90,.88,.12),(.80,.85,.16)]]
 mesh('CleanMirrorStem_'+str(side),vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],black)
# Main grille is a cut aperture with a recessed black back, not a painted flat patch.
outline=[(-.63,.255),(.63,.255),(.65,.32),(.58,.445),(-.58,.445),(-.65,.32)]
vs=[(x,y,z) for z in [2.055,2.5] for x,y in outline];n=len(outline);fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
cut=mesh('CUT_Fascia',vs,fs,black);added.remove(cut);mo=coach.modifiers.new('Front grille depth','BOOLEAN');mo.operation='DIFFERENCE';mo.solver='EXACT';mo.object=cut;bpy.context.view_layer.objects.active=coach;bpy.ops.object.modifier_apply(modifier=mo.name);bpy.data.objects.remove(cut,do_unlink=True)
mesh('CleanGrilleBack',[(x,y,2.05) for x,y in outline],[tuple(range(n))],black)
# Four real hollow tips; normals and cylindrical bore survive in every LOD.
segments=16 if level=='garage' else 12 if level=='race' else 8
for k,x in enumerate([-.165,-.055,.055,.165]):
 vs=[];fs=[]
 for r,z in [(.047,-2.20),(.047,-2.245),(.036,-2.245),(.036,-2.13)]:
  for i in range(segments):a=2*math.pi*i/segments;vs.append((x+r*math.cos(a),.245+r*math.sin(a),z))
 for j in range(3):
  for i in range(segments):fs.append((j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i))
 mesh('CleanExhaust_'+str(k),vs,fs,metal)
 mesh('CleanExhaustBore_'+str(k),[(x,.245,-2.125)]+[(x+.036*math.cos(2*math.pi*i/segments),.245+.036*math.sin(2*math.pi*i/segments),-2.125) for i in range(segments)],[(0,1+i,1+(i+1)%segments) for i in range(segments)],black)
bpy.data.objects.remove(high,do_unlink=True)
for o in added:o['authoredCorrection']=True
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'low-refined.blend'),compress=True)
report={'level':level,'triangles':triangles,'bodyTriangles':sum(len(p.vertices)-2 for p in coach.data.polygons),'correctionTriangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in added),'corrections':['analytic arch Boolean','curved windshield','side glass','rounded mirrors','grille cavity','four hollow exhaust tips']}
open(os.path.join(OUT,'refinement.json'),'w').write(json.dumps(report,indent=2));print('REFINED',json.dumps(report),flush=True)
