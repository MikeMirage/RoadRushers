"""Symmetric measured fitting to the Magnific/Tripo high guide, never exporting its mesh.
The resulting mesh keeps the hand-authored ring/cabin topology. Only a smoothed
low-frequency displacement field is transferred, not the noisy segmented edges.
"""
import bpy,bmesh,os,json,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

def fit_guide(objects,root_path):
 path=os.path.join(root_path,'art/vehicle-pipeline/magnific/corvette-c7/source-review.blend')
 with bpy.data.libraries.load(path,link=False) as (source,target):target.objects=[n for n in source.objects if n.startswith('tripo_part_')]
 imported=[o for o in target.objects if o is not None]
 for o in imported:bpy.context.scene.collection.objects.link(o)
 bpy.context.view_layer.update()
 # Source whole bounds and axle centers measured from source-inspection world bounds.
 src_front=1.2625;src_rear=-1.3465;target_front=1.31;target_rear=-1.40
 source_height=max((o.matrix_world @ v.co).z for o in imported for v in o.data.vertices)
 assert 1.25<source_height<1.40,('Unexpected guide height',source_height)
 def normalized(p):
  x,y,z=p.x,p.z,-p.y
  if z>=src_front:z=target_front+(z-src_front)*(2.245-target_front)/(2.245-src_front)
  elif z<=src_rear:z=target_rear+(z-src_rear)*(-2.245-target_rear)/(-2.245-src_rear)
  else:z=target_rear+(z-src_rear)*(target_front-target_rear)/(src_front-src_rear)
  return Vector((x*.984,y*1.2395/source_height,z))
 groups={
  'body':{2,4,6,8,9,11,12,13,15,17,18,23,29,30,33,34,36,41,43,46,47,48,49},
  'cabin':{1,5,14,25,26,27,31,32,35,44,45},
 }
 bvhs={}
 for label,ids in groups.items():
  verts=[];faces=[]
  for o in imported:
   if int(o.name.split('_')[-1].split('.')[0]) not in ids:continue
   base=len(verts);verts.extend(normalized(o.matrix_world @ v.co) for v in o.data.vertices)
   faces.extend(tuple(base+i for i in p.vertices) for p in o.data.polygons)
  bvhs[label]=BVHTree.FromPolygons(verts,faces)
 def target(p,label):
  hits=[]
  for side in [1,-1]:
   q=Vector((p.x*side,p.y,p.z));h=bvhs[label].find_nearest(q)
   if h and h[0] is not None:
    v=h[0];hits.append(Vector((v.x*side,v.y,v.z)))
  return sum(hits,Vector())/len(hits) if hits else p
 bodies=[o for o in objects if o.name=='Coachwork_ContinuousSurface']
 cabins=[o for o in objects if o.name.startswith(('Removable_TargaRoof','Windshield','RearHatchGlass','WindowSeal','RearSailPanel'))]
 fields={};stats={}
 for label,items in [('body',bodies),('cabin',cabins)]:
  orig=[];delta=[]
  for o in items:
   v=[Vector((p.co.x,p.co.z,-p.co.y)) for p in o.data.vertices]
   ds=[]
   for p in v:
    # A hidden deck beneath the canopy is structural, not the visible high surface.
    hidden=label=='body' and -.95<p.z<.55 and abs(p.x)<.66 and p.y>.60
    q=p if hidden else target(p,label)
    d=q-p
    if d.length>.24:d*=.24/d.length
    ds.append(d)
   # Smooth field over mesh adjacency, preserving source silhouette noise-free.
   neigh=[set() for p in v]
   for e in o.data.edges:a,b=e.vertices;neigh[a].add(b);neigh[b].add(a)
   for iteration in range(12):
    new=[]
    for i,d in enumerate(ds):
     avg=sum((ds[j] for j in neigh[i]),Vector())/max(1,len(neigh[i]))
     new.append(d*.60+avg*.40 if neigh[i] else d)
    ds=new
   orig.extend(v);delta.extend(ds)
  kd=KDTree(len(orig))
  for i,p in enumerate(orig):kd.insert(p,i)
  kd.balance();fields[label]=(kd,orig,delta)
  stats[label]={'samples':len(orig),'maxDisplacement':max((d.length for d in delta),default=0),'meanDisplacement':sum(d.length for d in delta)/max(1,len(delta))}
 cabin_names=('Removable_TargaRoof','Windshield','RearHatchGlass','WindowSeal','RearSailPanel','DoorGlass','QuarterGlass','A_Pillar','RoofSideSeal','HatchSeal','WindowLowerTrim','Wiper')
 exclude=('Exhaust','Mirror','Cockpit','Seat','Headrest','Steering','FrontFlag','RearFlag')
 for o in objects:
  if not o.parent or o.parent.name!='BodySuspension' or o.name.startswith(exclude):continue
  label='cabin' if o.name.startswith(cabin_names) else 'body';kd,orig,delta=fields[label]
  for vert in o.data.vertices:
   p=Vector((vert.co.x+o.location.x,vert.co.z+o.location.z,-vert.co.y-o.location.y))
   nearest=kd.find_n(p,6);d=Vector();total=0
   for loc,i,dist in nearest:
    weight=1/(.015+dist)**3;d+=delta[i]*weight;total+=weight
   if total:d/=total
   # Long panel gap floaters keep their original depth; offset field is shared.
   q=p+d;vert.co=(q.x-o.location.x,-q.z-o.location.y,q.y-o.location.z)
  o.data.update()
 for o in imported:bpy.data.objects.remove(o,do_unlink=True)
 stats['sourceHeight']=source_height;stats['sourceAxles']=[src_front,src_rear];stats['targetAxles']=[target_front,target_rear]
 stats['method']='Symmetric nearest-surface fitting + 12 adjacency-smoothing passes; source guide polygons never exported.'
 open(os.path.join(root_path,'art/corvette-c7/guide-fit.json'),'w').write(json.dumps(stats,indent=2))
 return stats
