"""Exact orthographic edge projections; avoids wireframe-modifier miter spikes."""
import os,json,math
from PIL import Image,ImageDraw
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)));OUT=os.path.join(ROOT,'art/corvette-c7')
data=json.load(open(os.path.join(OUT,'wire-edges.json')))
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def norm(a):
 l=math.sqrt(dot(a,a));return [x/l for x in a]
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
for m in data:m['v']=[(v[0],v[2],-v[1]) for v in m['vertices']]
vs=[v for m in data for v in m['v']];center=[(min(v[k] for v in vs)+max(v[k] for v in vs))*.5 for k in range(3)]
views=[('front',(0,.05,1)),('right',(1,.05,0)),('back',(0,.05,-1)),('top',(0,1,.001)),('three_quarter',(1,.65,1))]
sheet=Image.new('RGB',(1536,1024),'white')
for idx,(name,direction) in enumerate(views):
 d=norm(direction);right=norm(cross([0,1,0],d));up=cross(d,right)
 def proj(v):
  p=[v[k]-center[k] for k in range(3)];return dot(p,right),dot(p,up)
 projected=[proj(v) for v in vs];extent=[max(abs(p[k]) for p in projected) for k in range(2)];scale=min(900/(2*extent[0]),800/(2*extent[1]))
 im=Image.new('RGB',(1024,1024),'#f8fafb');draw=ImageDraw.Draw(im)
 for m in data:
  pts=[proj(v) for v in m['v']];pts=[(512+p[0]*scale,530-p[1]*scale) for p in pts]
  for a,b in m['edges']:draw.line([pts[a],pts[b]],fill='#395870',width=1)
 draw.text((35,30),name.upper()+' / EXACT MESH EDGES',fill='#142a3b')
 im=im.resize((512,512),Image.Resampling.LANCZOS);im.save(os.path.join(OUT,'review-wire_'+name+'.png'));sheet.paste(im,((idx%3)*512,(idx//3)*512))
sheet.save(os.path.join(OUT,'review-wire.png'))
