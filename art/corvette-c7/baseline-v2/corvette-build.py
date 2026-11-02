"""Reproducible original Corvette C7-inspired surface model. Blender 4.4+.
Game coordinates everywhere: X right, Y up, Z forward; C() converts for Blender.
"""
import bpy, bmesh, math, json, os, sys
from mathutils import Vector
from math import sin,cos,pi,sqrt
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'art/corvette-c7'); GLB=os.path.join(ROOT,'public/models/corvette-c7/corvette-c7.glb')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
C=lambda p:Vector((p[0],-p[2],p[1]))
def mat(name,color,rough=.4,metal=0,coat=0,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal;bs.inputs['Coat Weight'].default_value=coat;bs.inputs['Coat Roughness'].default_value=.12
 if emission:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emission
 return m
paint=mat('M_Paint',(.006,.105,.34),.28,0,1)
carbon=mat('M_Carbon',(.014,.018,.022),.4)
glass=mat('M_Glass',(.016,.029,.037),.12,.05,.9)
rubber=mat('M_Rubber',(.015,.018,.022),.78)
rim=mat('M_Rim',(.13,.15,.17),.25,1)
chrome=mat('M_Chrome',(.6,.65,.7),.2,1)
disc=mat('M_BrakeDisc',(.27,.29,.31),.42,1)
caliper=mat('M_Caliper',(.58,.018,.009),.32,.15)
black=mat('M_Vent',(.004,.006,.008),.6)
head=mat('M_HeadLight',(.73,.88,1),.15,.1,0,2.5)
tail=mat('M_TailLight',(.48,.004,.008),.22,0,.8,.4)
red=mat('M_Lens',(.17,.003,.005),.2,0,.9)
amber=mat('M_Amber',(.9,.18,.01),.3,0,0,.5)
interior=mat('M_Interior',(.02,.023,.028),.72)
labelmat=mat('M_Lettering',(.63,.65,.68),.32,.7)
def empty(name,parent=None,pos=(0,0,0)):
 o=bpy.data.objects.new(name,None);scene.collection.objects.link(o);o.parent=parent;o.location=C(pos);return o
root=empty('CorvetteC7');root['axes']='+Y up, +Z forward (glTF)';root['units']='meters';root['vehicleId']='corvette-c7';root['wheelbase']=2.71
body=empty('BodySuspension',root);body['rideHeightMin']=-.045;body['rideHeightMax']=.07
allmesh=[]
def mesh(name,verts,faces,material,parent=body,smooth=True):
 me=bpy.data.meshes.new(name);me.from_pydata([C(v) for v in verts],[],faces);me.update()
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.parent=parent;me.materials.append(material)
 for p in me.polygons:p.use_smooth=smooth
 # One continuous vehicle-space paint atlas; other parts use dominant-axis projection.
 uv=me.uv_layers.new(name='UVMap')
 for p in me.polygons:
  n=p.normal;axis=max(range(3),key=lambda i:abs(n[i]))
  for li in p.loop_indices:
   v=me.vertices[me.loops[li].vertex_index].co;x,y,z=v.x,v.z,-v.y
   if axis==0:u=.5+z/5;vv=y/1.5;col=0;sgn=1 if n.x>0 else 0
   elif axis==1:u=.5+x/2.4;vv=y/1.5;col=2;sgn=1 if n.y<0 else 0
   else:u=.5+x/2.4;vv=.5+z/5;col=1;sgn=1 if n.z>0 else 0
   uv.data[li].uv=((col+.025+u*.95)/3,(sgn+.025+vv*.95)/2)
 allmesh.append(o);return o
def bevel(o,w=.008,segments=3):
 m=o.modifiers.new('Edge radii','BEVEL');m.width=w;m.segments=segments;m.limit_method='ANGLE'
 return o
def box(name,pos,size,material,parent=body,bev=.005):
 x,y,z=pos;a,b,c=[v/2 for v in size]
 vs=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
 o=mesh(name,vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(2,3,7,6),(0,4,7,3),(1,2,6,5)],material,parent,False)
 return bevel(o,bev,3) if bev else o
def tube(name,points,r,material,parent=body,sides=8,closed=False):
 vs=[];fs=[]
 for i,p in enumerate(points):
  p=Vector(p);t=Vector(points[(i+1)%len(points) if closed else min(i+1,len(points)-1)])-Vector(points[(i-1)%len(points) if closed else max(i-1,0)])
  t.normalize();a=t.cross(Vector((0,1,0)))
  if a.length<.01:a=t.cross(Vector((1,0,0)))
  a.normalize();b=t.cross(a).normalized()
  for j in range(sides):vs.append(p+r*(a*cos(2*pi*j/sides)+b*sin(2*pi*j/sides)))
 for i in range(len(points) if closed else len(points)-1):
  for j in range(sides):fs.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%len(points))*sides+(j+1)%sides,((i+1)%len(points))*sides+j))
 if not closed:fs.extend([tuple(range(sides-1,-1,-1)),tuple((len(points)-1)*sides+j for j in range(sides))])
 return mesh(name,vs,fs,material,parent)
def panel(name,pts,material,depth=.005,parent=body,bev=.005):
 # Non-coplanar four-corner panels receive a real smooth bilinear surface.
 n=(Vector(pts[1])-Vector(pts[0])).cross(Vector(pts[2])-Vector(pts[0])).normalized()
 if len(pts)==4 and (name=='RearDiffuser' or abs((Vector(pts[3])-Vector(pts[0])).dot(n))>.012):
  vs=[];fs=[];steps=12
  for j in range(steps+1):
   v=j/steps
   for i in range(steps+1):
    u=i/steps
    p=Vector(pts[0])*(1-u)*(1-v)+Vector(pts[1])*u*(1-v)+Vector(pts[2])*u*v+Vector(pts[3])*(1-u)*v
    vs.append(p)
  for j in range(steps):
   for i in range(steps):
    a=j*(steps+1)+i;fs.append((a,a+1,a+steps+2,a+steps+1))
  o=mesh(name,vs,fs,material,parent,True);m=o.modifiers.new('Panel thickness','SOLIDIFY');m.thickness=depth
  return o
 vs=[tuple(Vector(p)-n*depth*.5) for p in pts]+[tuple(Vector(p)+n*depth*.5) for p in pts];N=len(pts)
 fs=[tuple(range(N-1,-1,-1)),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
 o=mesh(name,vs,fs,material,parent,False)
 return bevel(o,bev,3) if bev else o
def cylinder(name,pos,r,depth,material,parent=body,axis='x',segments=64):
 vs=[]
 for d in [-depth/2,depth/2]:
  for i in range(segments):
   a=2*pi*i/segments
   p=(d,r*cos(a),r*sin(a)) if axis=='x' else (r*cos(a),r*sin(a),d) if axis=='z' else (r*cos(a),d,r*sin(a))
   vs.append(tuple(pos[k]+p[k] for k in range(3)))
 fs=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
 fs += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
 return mesh(name,vs,fs,material,parent)
def lathe(name,profile,material,parent=body,segments=96,axis='x'):
 vs=[];fs=[]
 for d,r in profile:
  for i in range(segments):
   a=2*pi*i/segments;vs.append((d,r*cos(a),r*sin(a)) if axis=='x' else (r*cos(a),r*sin(a),d))
 for j in range(len(profile)):
  for i in range(segments):fs.append((j*segments+i,j*segments+(i+1)%segments,((j+1)%len(profile))*segments+(i+1)%segments,((j+1)%len(profile))*segments+i))
 return mesh(name,vs,fs,material,parent)
def interp(st,z):
 if z<=st[0][0]:return st[0][1:]
 for idx,(a,b) in enumerate(zip(st,st[1:])):
  if z<=b[0]:
   prev=st[max(0,idx-1)];nxt=st[min(len(st)-1,idx+2)];d=b[0]-a[0];t=(z-a[0])/d
   result=[]
   for k in range(1,len(a)):
    m0=(b[k]-prev[k])/(b[0]-prev[0]);m1=(nxt[k]-a[k])/(nxt[0]-a[0])
    result.append((2*t**3-3*t*t+1)*a[k]+(t**3-2*t*t+t)*d*m0+(-2*t**3+3*t*t)*b[k]+(t**3-t*t)*d*m1)
   return result
 return st[-1][1:]

def grid_surface(name,fn,nu,nv,material,thickness=.006):
 vs=[fn(i/nu,j/nv) for j in range(nv+1) for i in range(nu+1)]
 fs=[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i) for j in range(nv) for i in range(nu)]
 ob=mesh(name,vs,fs,material)
 if thickness:
  m=ob.modifiers.new('Surface skin','SOLIDIFY');m.thickness=thickness;m.offset=-1
 return ob

def rounded_loop(points,steps=6,factor=.18):
 out=[]
 for i,b in enumerate(points):
  a=Vector(points[i-1]);b=Vector(b);c=Vector(points[(i+1)%len(points)])
  start=b+(a-b)*factor;end=b+(c-b)*factor
  for j in range(steps):
   t=j/steps;out.append(tuple(start*(1-t)**2+2*b*t*(1-t)+end*t*t))
 return out

def cutter(name,outline,axis='y',low=.2,high=1.1):
 vs=[];n=len(outline)
 for depth in [low,high]:
  for a,b in outline:vs.append((a,depth,b) if axis=='y' else (a,b,depth))
 fs=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 ob=mesh(name,vs,fs,black);allmesh.remove(ob)
 mod=coach.modifiers.new(name,'BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=ob
 bpy.context.view_layer.objects.active=coach
 with bpy.context.temp_override(object=coach,active_object=coach):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.data.objects.remove(ob,do_unlink=True)

def axial_cylinder(name,center,normal,radius,depth,material,segments=48):
 n=Vector(normal).normalized();a=Vector((1,0,0));a=(a-n*a.dot(n)).normalized();b=n.cross(a)
 vs=[];fs=[]
 for d in [-depth/2,depth/2]:
  for i in range(segments):vs.append(Vector(center)+n*d+radius*(a*cos(2*pi*i/segments)+b*sin(2*pi*i/segments)))
 fs=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
 fs += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
 return mesh(name,vs,fs,material)

# Broad, deliberately sparse design stations interpolated into dense quad ribbons.
ST=[(-2.245,.865,.79),(-2.12,.91,.86),(-1.72,.9385,.86),(-1.40,.9385,.83),(-.95,.913,.81),(-.45,.878,.765),(.15,.859,.75),(.58,.883,.735),(1.05,.92,.674),(1.31,.928,.656),(1.66,.916,.601),(1.94,.88,.536),(2.16,.84,.493),(2.245,.81,.466)]
def arch(z):
 h=.205
 for axle in [-1.40,1.31]:
  d=abs(z-axle);r=.365 if axle>0 else .375
  if d<r:h=max(h,.337+sqrt(r*r-d*d))
 return h

def surf(x,z):
 w,h=interp(ST,z);t=min(1.15,abs(x)/w)
 front=.145*math.exp(-((z-1.34)/.68)**4)
 rear=.038*math.exp(-((z+1.42)/.60)**2)
 fender=(.018+front+rear)*math.exp(-((t-.84)/.19)**2)
 hood=.030*math.exp(-((t-.38)/.115)**2)*max(0,min(1,(z-.55)*4))*max(0,min(1,(2.0-z)*4))
 base=h+fender+hood-.018*t**8
 edge=max(0,arch(z)+.030-(h+(.018+front+rear)*math.exp(-((1-.84)/.19)**2)-.018))
 return base+edge*t**12
zs=sorted(set([-2.245+i*4.49/180 for i in range(181)]+[a+d for a,r in [(1.31,.365),(-1.40,.375)] for d in [-r,-r*.999,0,r*.999,r]]))
xs=[-1,-.98,-.94,-.89,-.83,-.76,-.67,-.55,-.40,-.22,0,.22,.40,.55,.67,.76,.83,.89,.94,.98,1]
vs=[];fs=[]
# Cross section includes inner underside and arch reveal; real open wheel spaces.
for z in zs:
 w,h=interp(ST,z);lo=arch(z)
 sy=surf(w,z)
 # Rounded shoulder and a taut lower door concavity; every cross section is one shell.
 sideprofile=[]
 for q in [0,.08,.25,.48,.72,.9,1]:
  yy=lo+(sy-lo)*q
  xx=w*(.966+.034*sin(q*pi*.73))
  if lo<.28:xx-=.027*math.exp(-((yy-.37)/.16)**2)*math.exp(-((z+.05)/.9)**4)
  sideprofile.append((xx,yy,z))
 ring=[(-w*.73,.18,z)]+[(-x,y,zz) for x,y,zz in sideprofile]
 ring += [(w*t,surf(w*t,z),z) for t in xs[1:-1]]
 ring += list(reversed(sideprofile))+[(w*.73,.18,z)]
 f=max(0,min(1,(z-1.94)/.305));r=max(0,min(1,(-z-1.94)/.305))
 ring=[(x,y,zz-.12*(abs(x)/w)**2*f-.055*((y-.35)/.30)**2*f+.07*(abs(x)/w)**2*r) for x,y,zz in ring]
 vs.extend(ring)
N=len(ring)
for k in range(len(zs)-1):
 for j in range(N):fs.append((k*N+j,k*N+(j+1)%N,(k+1)*N+(j+1)%N,(k+1)*N+j))
for k in [0,len(zs)-1]:
 ri=vs[k*N:(k+1)*N]
 if k==0:
  center=tuple(sum(p[d] for p in ri)/N for d in range(3));ci=len(vs);vs.append(center)
  for j in range(N):fs.append((ci,k*N+j,k*N+(j+1)%N))
 else:
  center=(0,.35,2.245);ci=len(vs);vs.append(center);rings=[]
  for t in [.22,.44,.66,.84]:
   ids=[]
   for p in ri:
    x=p[0]*t;y=.35+(p[1]-.35)*t;z=2.245-.12*(abs(x)/.81)**2-.055*((y-.35)/.30)**2
    ids.append(len(vs));vs.append((x,y,z))
   rings.append(ids)
  rings.append([k*N+j for j in range(N)])
  for j in range(N):fs.append((ci,rings[0][j],rings[0][(j+1)%N]))
  for a,b in zip(rings,rings[1:]):
   for j in range(N):fs.append((a[j],a[(j+1)%N],b[(j+1)%N],b[j]))
coach=mesh('Coachwork_ContinuousSurface',vs,fs,paint)
# The main shell stays below windows. Arches have a thin outer painted lip.
for side in [-1,1]:
 for axle,r in [(1.31,.365),(-1.40,.375)]:
  pts=[]
  for i in range(49):
   a=pi*i/48;z=axle+r*cos(a);w,h=interp(ST,z);pts.append((side*(w+.002),.337+r*sin(a)+.007,z))
  tube('FenderLip_%s_%s'%(side,axle),pts,.0045,paint,sides=8)
 # Rocker aerodynamic blade / door lower scallop
 pts=[(side*.868,.205,.88),(side*.87,.185,-.94),(side*.90,.24,-1.0),(side*.85,.28,.72)]
 panel('SideSkirt_%s'%side,pts,carbon,.025,bev=.006)
 # Sculpted diagonal door relief, body color shares wrap.
 # Door lower scallop is modeled directly into the coachwork cross sections.
# Cabin reconstructed as a continuous family of curved patches with shared boundaries.
def roof_point(u,v):
 t=2*v-1;z=-.08-.84*u+.045*(1-t*t)*cos(pi*u)
 width=.60+.022*sin(pi*u)-.005*u
 y=1.208+.0315*max(0,sin(pi*u))**.7-.042*t*t
 return (width*t,y,z)
roof=grid_surface('Removable_TargaRoof',roof_point,28,32,paint,.014)

def wind_point(u,t):
 v=2*u-1
 bottom=Vector((.765*v,.774+.018*(1-v*v),.57+.11*(1-v*v)))
 top=Vector(roof_point(0,u))
 p=bottom*(1-t)+top*t
 p.y+=.012*sin(pi*t)*(1-v*v);p.z+=.022*sin(pi*t)*(1-v*v)
 return p
wind=grid_surface('Windshield',wind_point,36,28,glass,.004)

def hatch_point(u,t):
 v=2*u-1;top=Vector(roof_point(1,u));bottom=Vector((.69*v,.86+.005*(1-v*v),-1.80-.03*(1-v*v)))
 p=top*(1-t)+bottom*t;p.y+=.012*sin(pi*t)*(1-v*v)
 return p
rearwindow=grid_surface('RearHatchGlass',hatch_point,32,26,glass,.004)

def side_point(side,u,v):
 bottom=Vector((side*(.765+.025*sin(pi*u)+.025*u),.774+.070*u+.005*sin(pi*u),.57-1.79*u))
 top=Vector(roof_point(u,1 if side>0 else 0))
 if u>.73:
  q=(u-.73)/.27
  start=Vector(roof_point(.73,1 if side>0 else 0));end=Vector((side*.79,.844,-1.22))
  top=start*(1-q)+end*q;top.y+=.022*sin(pi*q)
 p=bottom*(1-v)+top*v;p.x+=side*.018*sin(pi*v)*sin(pi*u)
 return p
for side in [-1,1]:
 tube('A_Pillar_%s'%side,[wind_point(1 if side>0 else 0,i/32) for i in range(33)],.018,paint,sides=10)
 tube('RoofSideSeal_%s'%side,[roof_point(i/40,1 if side>0 else 0) for i in range(41)],.007,carbon,sides=8)
 tube('HatchSeal_%s'%side,[hatch_point(1 if side>0 else 0,i/32) for i in range(33)],.008,paint,sides=8)
 grid_surface('WindowSeal_%s'%side,lambda u,v:side_point(side,u,v),32,14,carbon,.008)
 for name,ua,ub in [('DoorGlass',.023,.715),('QuarterGlass',.755,.975)]:
  def window(u,v,ua=ua,ub=ub,side=side):
   p=side_point(side,ua+(ub-ua)*u,.045+.91*v);p.x+=side*.0045;return p
  grid_surface(name+'_%s'%side,window,24 if name=='DoorGlass' else 12,14,glass,.004)
 tube('WindowLowerTrim_%s'%side,[side_point(side,i/40,0) for i in range(41)],.006,carbon,sides=8)
 # C7 quarter-window tapers to a point; sail panel fills the curved roof-to-hatch strip.
 def sail(u,v,side=side):
  a=side_point(side,.73+.27*(1-v),1)
  b=Vector(hatch_point(1 if side>0 else 0,1-v))
  p=a*(1-u)+b*u;p.x+=side*.025*sin(pi*u)*sin(pi*v);return p
 grid_surface('RearSailPanel_%s'%side,sail,18,24,paint,.012)
 # Deliberate seam curves carry readable door and hood boundaries.
 pts=[(side*.889,.773,.62),(side*.884,.67,.59),(side*.873,.39,.53),(side*.877,.292,.43),(side*.891,.27,-.71),(side*.912,.32,-.89),(side*.916,.48,-1.0),(side*.913,.74,-1.08),(side*.805,.844,-1.15)]
 tube('DoorGap_%s'%side,pts,.0035,black,sides=6)
 panel('DoorRelease_%s'%side,[(side*.907,.776,-.94),(side*.914,.755,-1.07),(side*.911,.708,-1.03),(side*.901,.73,-.95)],black,.008,bev=.005)
 # C7 front fender extractor: slash-shaped black outlet behind axle.
 pts=[(side*(interp(ST,z)[0]*.998+.003),y,z) for y,z in [(.685,.87),(.69,.67),(.397,.37),(.41,.49)]]
 panel('FenderExtractor_%s'%side,pts,black,.004,bev=.001)
 tube('ExtractorBlade_%s'%side,[(side*.899,.667,.79),(side*.876,.416,.43)],.007,carbon,sides=6)
 for j in range(4):tube('ExtractorLouver_%s_%s'%(side,j),[(side*(interp(ST,.72-j*.06)[0]+.005),.638-j*.048,.72-j*.06),(side*(interp(ST,.64-j*.06)[0]+.005),.638-j*.048,.64-j*.06)],.0035,carbon,sides=5)
 # Behind-window brake cooling inlet.
 panel('RearCoolingInlet_%s'%side,[(side*.835,.872,-1.17),(side*.906,.883,-1.43),(side*.918,.856,-1.62),(side*.861,.852,-1.37)],black,.01,bev=.005)
 for j in range(3):tube('RearVentSlat_%s_%s'%(side,j),[(side*(.854+j*.014),.878,-1.23-j*.05),(side*(.881+j*.011),.87,-1.43-j*.05)],.005,carbon,sides=6)
 # Mirrors with stalks, shaped shell and rear reflective glass.
 tube('MirrorStem_%s'%side,[(side*.80,.80,.43),(side*.92,.86,.36)],.027,paint,sides=10)
 mvs=[];mfs=[]
 for j in range(13):
  z=.275+j*.18/12;rad=max(0,cos(pi*.5*j/12))**.60
  for k in range(24):
   a=2*pi*k/24;mvs.append((side*(.95+.10*rad*cos(a)),.887+.053*rad*sin(a),z))
 for j in range(12):
  for k in range(24):mfs.append((j*24+k,j*24+(k+1)%24,(j+1)*24+(k+1)%24,(j+1)*24+k))
 mfs.extend([tuple(range(23,-1,-1)),tuple(288+k for k in range(24))]);mesh('MirrorHousing_%s'%side,mvs,mfs,paint)
 panel('MirrorGlass_%s'%side,[(side*(.95+.08*cos(k*2*pi/32)),.887+.039*sin(k*2*pi/32),.272) for k in range(32)],chrome,.003,bev=.002)
 # Side indicators and fuel door.
 tube('FrontSideMarker_%s'%side,[(side*.912,.31,1.72),(side*.914,.46,1.71)],.007,amber,sides=6)
 tube('RearSideMarker_%s'%side,[(side*.916,.30,-1.89),(side*.918,.46,-1.91)],.006,tail,sides=6)
 if side==1:
  tube('FuelDoor_Seam',[(.941,.72+.083*sin(i*2*pi/64),-1.18+.082*cos(i*2*pi/64)) for i in range(64)],.0025,black,closed=True,sides=5)
# Hood shutlines and raised hood center crease.
for side in [-1,1]:
 pts=[]
 for i in range(65):
  z=.57+i*1.39/64;x=side*(.69-.19*((z-.57)/1.39));pts.append((x,surf(x,z)+.004,z))
 tube('HoodPanelGap_%s'%side,pts,.003,black,sides=6)
# Central hood heat extractor cut through the hood skin.
ventxz=rounded_loop([(-.24,1.50),(.24,1.50),(.265,1.255),(-.265,1.255)],6,.15)
# The cutter is shallow and only touches hood surfaces, not the underbody.
cutter('CUT_HoodVent',ventxz,'y',.59,.9)
vent=[(x,surf(x,z)-.028,z) for x,z in ventxz]
panel('HoodHeatExtractor',vent,black,.004,bev=0)
for j in range(6):
 z=1.28+j*.036;w=.25-(z-1.28)*.10
 tube('HoodVentBlade_%02d'%j,[(-w,surf(-w,z)-.020,z),(0,surf(0,z)-.020,z),(w,surf(w,z)-.020,z)],.004,carbon,sides=6)
def topcontour(name,outline,material,lift=.004):
 center=(sum(x for x,z in outline)/len(outline),sum(z for x,z in outline)/len(outline));boundary=[]
 for a,b in zip(outline,outline[1:]+outline[:1]):
  for j in range(6):boundary.append((a[0]+(b[0]-a[0])*j/6,a[1]+(b[1]-a[1])*j/6))
 vs=[(center[0],surf(*center)+lift,center[1])];fs=[];N=len(boundary)
 for r in range(1,7):
  t=r/6
  for x,z in boundary:
   xx=center[0]+(x-center[0])*t;zz=center[1]+(z-center[1])*t;vs.append((xx,surf(xx,zz)+lift,zz))
 for i in range(N):fs.append((0,1+i,1+(i+1)%N))
 for r in range(5):
  for i in range(N):fs.append((1+r*N+i,1+r*N+(i+1)%N,1+(r+1)*N+(i+1)%N,1+(r+1)*N+i))
 o=mesh(name,vs,fs,material);m=o.modifiers.new('Thin lens housing','SOLIDIFY');m.thickness=.002;return o
# C7 fascia aperture is cut through the curved coachwork, with an internal dark duct.
grille2d=rounded_loop([(-.64,.258),(.64,.258),(.674,.314),(.602,.443),(-.602,.443),(-.674,.314)],6,.18)
cutter('CUT_FrontGrille',grille2d,'z',2.025,2.44)
def front_z(x):return 2.245-.12*(abs(x)/.81)**2
verts=[];faces=[];n=len(grille2d)
for k in range(3):
 for x,y in grille2d:
  scale=1 if k==0 else .98
  verts.append((x*scale,.35+(y-.35)*scale,front_z(x)-.006 if k==0 else 2.045 if k==2 else front_z(x)-.035))
for k in range(2):
 for i in range(n):faces.append((k*n+i,k*n+(i+1)%n,(k+1)*n+(i+1)%n,(k+1)*n+i))
faces.append(tuple(2*n+i for i in range(n)));mesh('FrontGrilleDuct',verts,faces,black)
for row in range(4):
 for col in range(28):
  x=-.57+col*.043+(row%2)*.0215;y=.28+row*.039
  if abs(x)<.61-(y-.28)*.15:
   tube('GrilleHex_%s_%s'%(row,col),[(x+.021*cos(pi/3*i),y+.019*sin(pi/3*i),2.105) for i in range(6)],.0022,carbon,sides=4,closed=True)
tube('GrilleCenterBar',[(-.64,.338,2.12),(0,.337,2.15),(.64,.338,2.12)],.008,carbon,sides=8)
# Splitter follows the bumper's rounded planform.
outline=[]
for i in range(33):
 x=-.84+i*1.68/32;outline.append((x,.177,2.30-.17*(abs(x)/.84)**2))
for i in range(32,-1,-1):
 x=-.84+i*1.68/32;outline.append((x,.180,2.13-.17*(abs(x)/.84)**2))
panel('FrontSplitter',outline,carbon,.018,bev=.005)
# Flush lamp cavities. Projector axis points forward/up inside a single clear cover.
headlampglass=mat('M_HeadlampGlass',(.32,.42,.5),.07,0,.7)
bs=next(n for n in headlampglass.node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['Transmission Weight'].default_value=.92;bs.inputs['IOR'].default_value=1.45
for side in [-1,1]:
 outline=rounded_loop([(.55,2.105),(.815,2.035),(.866,1.74),(.817,1.535),(.733,1.65),(.625,1.91)],7,.16)
 xz=[(side*x,z) for x,z in outline]
 # Cutter lower floor follows local fender rather than removing the whole bumper.
 cv=[];cf=[];n=len(xz)
 for depth in [-.072,.12]:
  for x,z in xz:cv.append((x,surf(x,z)+depth,z))
 cf=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 cut=mesh('CUT_Optic',cv,cf,black);allmesh.remove(cut);mod=coach.modifiers.new('Headlamp cavity','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cut
 bpy.context.view_layer.objects.active=coach
 with bpy.context.temp_override(object=coach,active_object=coach):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.data.objects.remove(cut,do_unlink=True)
 topcontour('HeadlightHousing_%s'%side,xz,black,-.060)
 # Black cavity wall joins the opening rim to the floor, so no background is visible.
 vv=[(x,surf(x,z)+h,z) for h in [-.003,-.061] for x,z in xz]
 ff=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 ob=mesh('HeadlightBowl_%s'%side,vv,ff,black);mo=ob.modifiers.new('Bowl thickness','SOLIDIFY');mo.thickness=.002
 # Deep main projector and secondary upper reflector; neither protrudes above the cover.
 for j,(x,z,r) in enumerate([(.742,1.875,.048),(.807,1.70,.028)]):
  y=surf(x,z)-.030;normal=(side*.12,.48,.87)
  axial_cylinder('ProjectorCup_%s_%s'%(side,j),(side*x,y-.008,z-.014),normal,r+.009,.030,carbon,48)
  axial_cylinder('ProjectorBezel_%s_%s'%(side,j),(side*x,y,z),normal,r,.009,chrome,48)
  axial_cylinder('ProjectorGlass_%s_%s'%(side,j),(side*x,y+.003,z+.005),normal,r*.82,.009,glass,40)
  axial_cylinder('ProjectorCore_%s_%s'%(side,j),(side*x,y+.006,z+.009),normal,r*.32,.006,glass,24)
 path=rounded_loop([(.58,2.075),(.795,2.015),(.831,1.82),(.828,1.69)],6,.15)[:18]
 # Open L-shaped lightpipe, a narrow emitter under the lens.
 path=[(.58+(.795-.58)*i/14,2.075+(2.015-2.075)*i/14) for i in range(15)]+[(.795+(.831-.795)*i/14,2.015+(1.72-2.015)*i/14) for i in range(1,15)]
 tube('HeadlightDRL_%s'%side,[(side*x,surf(x,z)-.013,z) for x,z in path],.007,head,sides=8)
 topcontour('HeadlightCover_%s'%side,xz,headlampglass,.002)
# Rear upper valance and four angular red lenses, two per side.
for side in [-1,1]:
 pp=[(side*.30,.646,-2.257),(side*.83,.649,-2.255),(side*.86,.76,-2.25),(side*.79,.846,-2.25),(side*.36,.826,-2.257)]
 panel('RearLampBlackPanel_%s'%side,pp,black,.016,bev=.012)
 for j in range(2):
  x=.34+j*.248
  shape=[(x,.683),(x+.18,.678),(x+.227,.72),(x+.195,.805),(x+.05,.80),(x+.005,.74)]
  panel('TaillightLens_%s_%s'%(side,j),[(side*a,b,-2.274) for a,b in shape],red,.016,bev=.016)
  # Lightpipe closed angular outline and inset optic facets.
  center=(x+.11,.742)
  pp=[(side*(center[0]+(a-center[0])*.79),center[1]+(b-center[1])*.70,-2.288) for a,b in shape]
  tube('TaillightLED_%s_%s'%(side,j),pp,.009,tail,sides=8,closed=True)
  tube('TaillightInternal_%s_%s'%(side,j),[(side*(x+.06),.751,-2.287),(side*(x+.15),.751,-2.287)],.008,tail,sides=6)
# Rear diffuser pocket, plate, reflectors, fins.
panel('RearDiffuser',[(-.83,.19,-2.255),(.83,.19,-2.255),(.80,.52,-2.264),(-.80,.52,-2.264)],carbon,.03,bev=.016)
box('RearPlateRecess',(0,.443,-2.287),(.39,.12,.014),black,bev=.009)
for side in [-1,1]:
 tube('RearReflector_%s'%side,[(side*.43,.512,-2.279),(side*.75,.512,-2.279)],.008,tail,sides=6)
 tube('RearReverseLamp_%s'%side,[(side*.51,.287,-2.279),(side*.70,.287,-2.279)],.009,head,sides=6)
 box('RearReverseLampBacking_%s'%side,(side*.605,.287,-2.25),(.235,.036,.08),carbon,bev=.006)
 box('RearReflectorBacking_%s'%side,(side*.59,.512,-2.25),(.35,.028,.08),carbon,bev=.005)
for x in [-.76,-.47,.47,.76]:box('DiffuserFin_%s'%x,(x,.19,-2.10),(.016,.13,.34),carbon,bev=.003)
# Correct C7 signature: four central exhaust tips with real double-wall openings.
for i,x in enumerate([-.228,-.076,.076,.228]):
 o=lathe('ExhaustTip_%s'%i,[(-.10,.063),(.10,.063),(.105,.058),(.10,.051),(-.10,.051)],chrome,segments=48,axis='z');o.location=C((x,.255,-2.255))
 o=cylinder('ExhaustDarkBore_%s'%i,(x,.255,-2.26),.050,.012,black,axis='z',segments=48)
# Lip spoiler follows rear deck; no huge racing wing on the Stingray reference.
vs=[];fs=[]
for i in range(41):
 x=-.86+i*1.72/40;uplift=.017+abs(x)*.018
 vs += [(x,.853+uplift,-2.08),(x,.886+uplift,-2.19),(x,.881+uplift,-2.23),(x,.85+uplift,-2.16)]
for i in range(40):
 for j in range(4):fs.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
fs.extend([(3,2,1,0),(160,161,162,163)]);mesh('RearDeckSpoiler',vs,fs,paint)
# Two crossed flags evoke the supplied emblem; original geometry, not downloaded artwork.
for zfront in [True,False]:
 z=2.02 if zfront else -2.29;y=surf(0,z)+.018 if zfront else .75
 for side in [-1,1]:
  if zfront:pts=[(0,y,z),(side*.078,y+.006,z+.05),(side*.095,y+.004,z+.02),(side*.02,y,z-.02)]
  else:pts=[(0,y,z),(side*.078,y+.045,z),(side*.095,y+.015,z),(side*.02,y-.02,z)]
  panel(('Front' if zfront else 'Rear')+'Flag_%s'%side,pts,chrome if side<0 else tail,.003,bev=.001)
# Wipers follow the new swept windshield base.
for side in [-1,1]:
 tube('Wiper_%s'%side,[wind_point(.5+side*u,.025) for u in [.03,.20,.38]],.005,carbon,sides=6)
box('Cockpit',(0,.74,-.34),(1.4,.08,1.56),interior,bev=.04)
for side in [-1,1]:
 box('SeatCushion_%s'%side,(side*.34,.75,-.37),(.43,.09,.43),interior,bev=.05)
 box('SeatBack_%s'%side,(side*.34,.92,-.66),(.42,.42,.13),interior,bev=.055)
 box('Headrest_%s'%side,(side*.34,1.09,-.66),(.24,.15,.12),interior,bev=.04)
tube('SteeringWheel',[(.34+.125*cos(i*2*pi/48),.93+.125*sin(i*2*pi/48),.16) for i in range(48)],.016,interior,closed=True,sides=8)
cylinder('SteeringWheelHub',(.34,.93,.16),.035,.045,interior,axis='z',segments=24)
for a in [0,2*pi/3,4*pi/3]:tube('SteeringWheelSpoke_'+str(a),[(.34,.93,.16),(.34+.119*cos(a),.93+.119*sin(a),.16)],.010,interior,sides=6)
tube('SteeringColumn',[(.34,.93,.17),(.34,.76,.38)],.028,interior,sides=12)
# Independent suspension > steering > spin rigs. Calipers stay on steering nodes.
for label,side,front in [('FL',-1,True),('FR',1,True),('RL',-1,False),('RR',1,False)]:
 radius=.337 if front else .345;wx=.791 if front else .784;wz=1.31 if front else -1.40;width=.245 if front else .285
 sus=empty('Suspension_'+label,root,(side*wx,radius,wz));sus['travelMin']=-.035;sus['travelMax']=.05
 steer=empty('Steering_'+label,sus);steer['maxSteerRadians']=.45 if front else 0
 spin=empty('Wheel_'+label,steer);spin['radius']=radius;spin['width']=width;spin['side']=side
 # Rounded casing, not a cylinder: shoulders, sidewalls, beads are distinct bands.
 prof=[(-width*.5,.258),(-width*.525,.276),(-width*.52,radius-.032),(-width*.45,radius-.011),(-width*.35,radius-.002),(width*.35,radius-.002),(width*.45,radius-.011),(width*.52,radius-.032),(width*.525,.276),(width*.5,.258)]
 tire=lathe('Tire_'+label,prof,rubber,spin,128);tire['slot']='tire'
 # Three circumferential channels and lateral sipes add real tread relief.
 for j,x in enumerate([-width*.24,0,width*.24]):
  o=lathe('TireGroove_'+label+'_'+str(j),[(x-.003,radius-.001),(x+.003,radius-.001),(x+.003,radius+.0005),(x-.003,radius+.0005)],black,spin,128)
  o['tireDetail']='street'
 for i in range(56):
  a=2*pi*i/56
  for half in [-1,1]:
   pts=[]
   for j in range(4):
    x=half*(width*.08+j*width*.105);aa=a+j*.024*half
    pts.append((x,(radius-.0025)*cos(aa),(radius-.0025)*sin(aa)))
   o=tube('TreadSipe_'+label+'_'+str(i)+'_'+str(half),pts,.0025,black,spin,sides=4);o['tireDetail']='street'
 face=side*width*.515;rad=.2413 if front else .254
 # Wheel barrel and machined rim lips.
 barrel=lathe('RimBarrel_'+label,[(face-side*.18,rad-.006),(face,rad),(face+side*.008,rad-.004),(face+side*.008,rad-.018),(face-side*.17,rad-.02)],rim,spin,96)
 lip=lathe('RimLip_'+label,[(face,rad-.002),(face+side*.005,rad),(face+side*.009,rad-.004),(face+side*.005,rad-.010)],chrome,spin,96)
 # Five unified split-Y spokes: each stem and its two branches is one solid island.
 for k in range(5):
  angle=k*2*pi/5;end=rad-.014
  outline=[(.045,-.025),(.105,-.025),(end,-.057),(end+.006,-.034),(.135,0),(end+.006,.034),(end,.057),(.105,.025),(.045,.025)]
  v=[]
  for x in [face-side*.035,face+side*.012]:
   for r,t in outline:v.append((x,r*cos(angle)-t*sin(angle),r*sin(angle)+t*cos(angle)))
  n=len(outline);f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(j,(j+1)%n,(j+1)%n+n,j+n) for j in range(n)]
  bevel(mesh('SplitYSpoke_'+label+'_'+str(k),v,f,rim,spin,False),.0025,2)
 cylinder('Hub_'+label,(face,0,0),.057,.037,rim,spin,segments=48)
 cylinder('CenterCap_'+label,(face+side*.023,0,0),.030,.008,chrome,spin,segments=32)
 for i in range(5):
  a=i*2*pi/5;cylinder('Lug_'+label+'_'+str(i),(face+side*.024,.041*cos(a),.041*sin(a)),.007,.012,chrome,spin,segments=8)
 # Visible drilled rotor, hub hat and fixed red caliper.
 rotorx=face-side*.056
 cylinder('BrakeRotor_'+label,(rotorx,0,0),.184 if front else .177,.012,disc,spin,segments=96)
 cylinder('RotorHat_'+label,(rotorx+side*.009,0,0),.087,.019,carbon,spin,segments=48)
 for band in [0,1]:
  for k in range(32):
   a=(k+.4*band)*2*pi/32;r=.137+band*.025
   cylinder('RotorDrill_'+label+'_'+str(band)+'_'+str(k),(rotorx+side*.008,r*cos(a),r*sin(a)),.0033,.0018,black,spin,segments=6)
 box('BrakeCaliper_'+label,(rotorx-side*.01,.01,-.15),(.075,.19,.085),caliper,steer,bev=.022)
 # Tire sidewall concentric ridges; valve stem on front face.
 for rr in [radius-.025,radius-.052]:
  o=lathe('SidewallRidge_'+label+'_'+str(rr),[(side*width*.524,rr-.0018),(side*width*.529,rr),(side*width*.524,rr+.0018)],rubber,spin,128)
 cylinder('Valve_'+label,(face+side*.012,.10,.19),.006,.023,carbon,spin,segments=8)
# Front and rear trim follows bumper transverse sweep; no flat floating plates.
for ob in allmesh:
 if ob.name.startswith(('RearLampBlackPanel','Taillight','RearDiffuser','RearReflector','RearReverseLamp')):
  for v in ob.data.vertices:v.co.y-=.07*(abs(v.co.x)/.865)**2
# Published overall length includes splitter/exhaust. Compress only overhang regions;
# wheel centers and wheelbase remain unchanged. Half-length becomes exactly 2.245 m.
for ob in allmesh:
 if ob.parent==body:
  for v in ob.data.vertices:
   z=-(v.co.y+ob.location.y)
   if z>1.31:z=1.31+(z-1.31)*(.935/.9999999999999998)
   elif z< -1.4:z=-1.4+(z+1.4)*(.845/.960)
   v.co.y=-z-ob.location.y
# Finalize bevels only for export evaluation. Source remains fully editable.
# Consolidate tiny stationary details by parent+material into controllable subassemblies.
# Keep meaningful coachwork, glass, mechanical and tire slots individually named.
bpy.context.view_layer.update()
# Add a native controller empty with pose properties. Runtime drives the same pivots.
ctrl=empty('CTRL_Corvette',root);ctrl.empty_display_type='CUBE';ctrl.empty_display_size=.2
for name,value in [('steering',0.0),('wheel_spin',0.0),('ride_height',0.0),('suspension',0.0)]:ctrl[name]=value
# Native Blender drivers use local axes matching the exported object's conversion.
def driver(ob,path,index,prop,expression='v'):
 d=ob.driver_add(path,index).driver;d.type='SCRIPTED';v=d.variables.new();v.name='v';v.targets[0].id=ctrl;v.targets[0].data_path='["'+prop+'"]';d.expression=expression
for label in ['FL','FR','RL','RR']:
 driver(bpy.data.objects['Wheel_'+label],'rotation_euler',0,'wheel_spin')
 if label.startswith('F'):driver(bpy.data.objects['Steering_'+label],'rotation_euler',2,'steering')
driver(body,'location',2,'ride_height')
d=body.animation_data.drivers[0].driver;v=d.variables.new();v.name='travel';v.targets[0].id=ctrl;v.targets[0].data_path='["suspension"]';d.expression='v+travel'
# Export metadata and selection omit render studio, which is added afterward.
root['source']='Original procedural mesh authored from user-provided image reference';root['license']='Original project asset; Chevrolet marks belong to their owners'
scene.render.engine='CYCLES';scene.cycles.samples=32
scene.world.color=(.15,.15,.15)
scene.view_settings.view_transform='AgX'
# Preserve individually named, editable components with evaluated edge radii baked cleanly.
# Rebuild from evaluated mesh; weld ONLY within each component, not across assemblies.
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get()
for ob in allmesh:
 old=ob.data;ev=ob.evaluated_get(dg);clean=bpy.data.meshes.new_from_object(ev,depsgraph=dg)
 ob.modifiers.clear();ob.data=clean
 bm=bmesh.new();bm.from_mesh(clean)
 bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=.000001)
 bmesh.ops.dissolve_degenerate(bm,edges=bm.edges,dist=.0000001)
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
 if bm.verts and all(e.is_manifold for e in bm.edges):
  center=sum((v.co for v in bm.verts),Vector())/len(bm.verts)
  volume=0.
  for face in bm.faces:
   a=face.verts[0].co-center
   for j in range(1,len(face.verts)-1):volume+=a.dot((face.verts[j].co-center).cross(face.verts[j+1].co-center))/6.
  if volume<0:bmesh.ops.reverse_faces(bm,faces=bm.faces)
 bm.to_mesh(clean);bm.free();clean.update()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'corvette-c7.blend'),compress=True)
# The authoring .blend above retains each detail; GLB merges per rigid parent/material.
buckets={}
for o in list(allmesh):
 key=(o.parent.name if o.parent else '',o.data.materials[0].name,o.get('tireDetail',''))
 buckets.setdefault(key,[]).append(o)
merged=[]
for key,obs in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
 bpy.ops.object.convert(target='MESH')
 bpy.ops.object.join()
 o=bpy.context.object;o.name='Part_'+key[0]+'_'+key[1]+('_Tread' if key[2] else '')
 if key[2]:o['tireDetail']=key[2]
 merged.append(o)
allmesh=merged
for ob in allmesh:
 me=ob.data;bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=bm.faces);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free();me.update()
 uv=me.uv_layers.active
 for p in me.polygons:
  n=p.normal;axis=max(range(3),key=lambda k:abs(n[k]))
  for li in p.loop_indices:
   v=me.vertices[me.loops[li].vertex_index].co;x,y,z=v.x,v.z,-v.y
   if axis==0:u=.5+z/5;vv=y/1.5;col=0;sgn=1 if n.x>0 else 0
   elif axis==1:u=.5+x/2.4;vv=y/1.5;col=2;sgn=1 if n.y<0 else 0
   else:u=.5+x/2.4;vv=.5+z/5;col=1;sgn=1 if n.z>0 else 0
   uv.data[li].uv=((col+.025+u*.95)/3,(sgn+.025+vv*.95)/2)
# Save exact paint UV wireframe paths for a downloadable skin template.
uvpolys=[]
for ob in allmesh:
 if ob.data.materials[0]==paint:
  for p in ob.data.polygons:uvpolys.append([[round(x,6) for x in ob.data.uv_layers.active.data[li].uv] for li in p.loop_indices])
open(os.path.join(OUT,'paint-uv.json'),'w').write(json.dumps(uvpolys))
bpy.ops.object.select_all(action='DESELECT')
for ob in [root,body,ctrl]+[o for o in bpy.data.objects if o.parent is not None]:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=GLB,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False,export_yup=True,export_cameras=False,export_lights=False)
# Evaluated triangle/material metrics.
metrics={'objects':{},'materials':len(bpy.data.materials),'dimensionsTarget':[1.877,1.239,4.49],'wheelbase':2.71,'blender':bpy.app.version_string}
dg=bpy.context.evaluated_depsgraph_get();total=0
for o in allmesh:
 ev=o.evaluated_get(dg);me=ev.to_mesh();me.calc_loop_triangles();n=len(me.loop_triangles);metrics['objects'][o.name]={'triangles':n};total+=n;ev.to_mesh_clear()
metrics['triangles']=total;metrics['meshCount']=len(allmesh)
open(os.path.join(OUT,'build-metrics.json'),'w').write(json.dumps(metrics,indent=2))
if '--skip-renders' in sys.argv:
 print('CORVETTE_METRICS',json.dumps({k:v for k,v in metrics.items() if k!='objects'}));sys.exit(0)
# Studio review: separate .blend copy includes lights/cameras, production source remains clean.
def area(name,pos,power,size,target=(0,.5,0)):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=C(pos);o.rotation_euler=(C(target)-o.location).to_track_quat('-Z','Y').to_euler()
area('Studio_Key',(3.8,5,4),1400,5);area('Studio_Fill',(-4,3,1),1100,4);area('Studio_Rim',(1,3,-5),1700,4)
floor=box('StudioFloor',(0,-.05,0),(200,.08,200),mat('StudioGrey',(.10,.12,.14),.55),None,bev=0)
camd=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camd);scene.collection.objects.link(cam);scene.camera=cam
scene.render.resolution_x=1400;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.cycles.samples=24;scene.cycles.use_denoising=True
for name,pos in [('front-three-quarter',(4.9,2.75,6.8)),('rear-three-quarter',(-4.9,2.55,-6.8)),('side',(7.6,1.7,0))]:
 cam.location=C(pos);cam.rotation_euler=(C((0,.6,0))-cam.location).to_track_quat('-Z','Y').to_euler();camd.type='PERSP';camd.lens=52
 scene.render.filepath=os.path.join(OUT,name+'.png');bpy.ops.render.render(write_still=True)
print('CORVETTE_METRICS',json.dumps({k:v for k,v in metrics.items() if k!='objects'}))
