#!/usr/bin/env python3
"""Rebuild the compact GP circuits from the attributed geographic source.

Run from any directory:
  uv run --with numpy==1.26.4 --with scipy==1.13.1 scripts/generate-gp-circuits.py

Runtime and CI use the checked-in JSON; Python is only needed to re-author it.
The constrained fit preserves the geographic silhouette while leaving at least
8 m of corner radius and valid connectors between ordinary editor modules.
"""
import json, math
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
root=Path(__file__).resolve().parents[1]
features=json.loads((root/'art/gp-circuits/source.geojson').read_text())['features']
design=json.loads((root/'art/gp-circuits/design.json').read_text())
design_by_source={item['sourceId']:item for item in design}
chosen={item['sourceId']:item['targetLength'] for item in design}

def sub(a,b):return [a[0]-b[0],a[1]-b[1]]
def length(v):return math.hypot(*v)
def unit(v):
 d=length(v);return [v[0]/d,v[1]/d]
def dot(a,b):return a[0]*b[0]+a[1]*b[1]
def wrap(a):return math.atan2(math.sin(a),math.cos(a))
def segment_distance(p,a,b):
 v=sub(b,a);t=max(0,min(1,dot(sub(p,a),v)/(dot(v,v) or 1)));return length(sub(p,[a[0]+t*v[0],a[1]+t*v[1]]))
def rdp(points,tol):
 if len(points)<3:return points
 distances=[segment_distance(p,points[0],points[-1]) for p in points[1:-1]]
 index=max(range(len(distances)),key=lambda i:distances[i])+1
 if distances[index-1]<=tol:return [points[0],points[-1]]
 return rdp(points[:index+1],tol)[:-1]+rdp(points[index:],tol)
def vertices(points,tol):
 result=rdp(points+[points[0]],tol)[:-1]
 for _ in range(20):
  remove=[]
  for i,p in enumerate(result):
   a=unit(sub(p,result[i-1]));b=unit(sub(result[(i+1)%len(result)],p));turn=wrap(math.atan2(b[0],b[1])-math.atan2(a[0],a[1]))
   if abs(turn)<math.radians(2):remove.append(i)
  if not remove:break
  result=[p for i,p in enumerate(result) if i not in remove]
 return result

# Project and simplify the real centerlines.
out=[]
for f in features:
 id=f['properties']['id']
 if id not in chosen:continue
 coords=f['geometry']['coordinates'];lon,lat=coords[0][:2];k=math.pi/180*6371000
 points=[[(p[0]-lon)*k*math.cos(lat*math.pi/180),-(p[1]-lat)*k] for p in coords]
 if length(sub(points[0],points[-1]))<2:points.pop()
 total=sum(length(sub(points[(i+1)%len(points)],p)) for i,p in enumerate(points));scale=chosen[id]/total
 points=[[x*scale,z*scale] for x,z in points]
 tol=1
 while len(vertices(points,tol))>58:tol*=1.1
 v=vertices(points,tol);lens=[length(sub(v[(i+1)%len(v)],p)) for i,p in enumerate(v)];angles=[];trims=[];minimum=[]
 for i,p in enumerate(v):
  a=unit(sub(p,v[i-1]));b=unit(sub(v[(i+1)%len(v)],p));turn=wrap(math.atan2(b[0],b[1])-math.atan2(a[0],a[1]));angles.append(turn)
  tangent=math.tan(abs(turn)/2);minimum.append(max(7.2,2.01/abs(turn))*tangent);trims.append(max(minimum[-1],min(lens[i-1],lens[i])*.35))
 bad=[]
 for i,l in enumerate(lens):
  j=(i+1)%len(v)
  if minimum[i]+minimum[j]+2.01>l:bad.append({'index':i,'length':round(l,2),'needed':round(minimum[i]+minimum[j]+2.01,2),'turns':[round(angles[i]*180/math.pi,1),round(angles[j]*180/math.pi,1)]})
 result={'id':id,'name':f['properties']['Name'],'target':chosen[id],'scale':scale,'tolerance':tol,'vertices':len(v),'bad':bad,'points':points,'verticesXY':v}
 out.append(result)
 print(json.dumps({k:r for k,r in result.items() if k not in ['points','verticesXY']}))

data=out

def frames(p):
 outgoing=np.roll(p,-1,axis=0)-p;lens=np.linalg.norm(outgoing,axis=1);unit=outgoing/lens[:,None]
 headings=np.arctan2(unit[:,0],unit[:,1]);turns=np.arctan2(np.sin(headings-np.roll(headings,1)),np.cos(headings-np.roll(headings,1)))
 minimum=np.maximum(8.0,2.05/np.maximum(np.abs(turns),1e-8))*np.tan(np.abs(turns)/2)
 return lens,unit,turns,minimum

# Fit safe circular tangencies with minimal geographic displacement.
out=[]
for entry in data:
 original=np.array(entry['verticesXY']);n=len(original);sign=np.sign(frames(original)[2])
 def objective(x):return np.sum((x.reshape(n,2)-original)**2)
 def gradient(x):return 2*(x-original.flatten())
 def constraints(x):
  lens,unit,turns,d=frames(x.reshape(n,2))
  return np.concatenate([lens-d-np.roll(d,-1)-2.06,sign*turns-.005,math.radians(170)-np.abs(turns)])
 fit=minimize(objective,original.flatten(),jac=gradient,method='SLSQP',constraints=[{'type':'ineq','fun':constraints}],bounds=[(float(v)-18,float(v)+18) for v in original.flatten()],options={'maxiter':400,'ftol':1e-8})
 assert fit.success and min(constraints(fit.x))>=-1e-6, (entry["id"],fit.message)
 p=fit.x.reshape(n,2);lens,unit,turns,minimum=frames(p);trim=np.maximum(minimum,np.minimum(lens,np.roll(lens,1))*.35)
 for _ in range(100):
  for i in range(n):
   j=(i+1)%n;extra=trim[i]+trim[j]+2.055-lens[i]
   if extra<=0:continue
   capacities=np.maximum(0,[trim[i]-minimum[i],trim[j]-minimum[j]]);total=sum(capacities)
   if total>0:
    trim[i]-=extra*capacities[0]/total;trim[j]-=extra*capacities[1]/total
 radii=trim/np.tan(np.abs(turns)/2);incoming=np.roll(unit,1,axis=0)
 before=p-incoming*trim[:,None];after=p+unit*trim[:,None]
 # Anchor modern GP grids; the source files may begin at a historic start.
 anchor=np.array([0.,0.]);phase=design_by_source[entry["id"]].get("startAtSourcePhase",0)
 if phase:
  source=np.array(entry["points"]);distances=np.concatenate([[0],np.cumsum(np.linalg.norm(np.diff(source,axis=0),axis=1))]);anchor=source[np.argmin(np.abs(distances/distances[-1]-phase))]
 candidates=[]
 for i in range(n):
  j=(i+1)%n;v=before[j]-after[i];l=np.linalg.norm(v)
  if l<70:continue
  t=np.clip(np.dot(anchor-after[i],v)/(l*l),.05,.95);q=after[i]+v*t
  candidates.append((np.linalg.norm(q-anchor),i,l,float(t)))
 _,start,total_straight,t=min(candidates);fraction=1-min(95,total_straight*.55)/total_straight
 start_point=after[start]+(before[(start+1)%n]-after[start])*fraction;heading=math.atan2(unit[start,0],unit[start,1])
 pieces=[]
 for k in range(n):
  i=(start+k)%n;j=(i+1)%n
  straight=np.linalg.norm(before[j]-(start_point if k==0 else after[i]))
  if straight>=2:pieces.append({'id':'straight','length':float(straight)})
  pieces.append({'id':'curve-medium-'+('left' if turns[j]>0 else 'right'),'radius':float(radii[j]),'angle':float(abs(turns[j])*180/math.pi)})
 last=np.linalg.norm(start_point-after[start]);pieces.append({'id':'straight','length':float(last)})
 length=sum(v.get('length',v.get('radius',0)*v.get('angle',0)*math.pi/180) for v in pieces)
 scale=entry['target']/length
 for v in pieces:
  if 'length'in v:v['length']*=scale
  if 'radius'in v:v['radius']*=scale
 result={**entry,'pieces':pieces,'fitVertices':p.tolist(),'startPoint':start_point.tolist(),'heading':heading,'rescale':scale,'fitSuccess':bool(fit.success),'constraint':float(min(constraints(fit.x))),'maxMoved':float(max(np.linalg.norm(p-original,axis=1))),'minRadius':float(min(radii))*scale}
 out.append(result)
 print(json.dumps({k:result[k] for k in ['id','fitSuccess','constraint','maxMoved','minRadius']}),len(pieces),flush=True)

fitted={item["id"]:item for item in out}
environment=json.loads((root/"src/tracks/lawson-superstar.json").read_text())["environment"]

# Author elevation, variable width and the Monaco tunnel.
def planar(piece):return piece.get('length',piece.get('radius',0)*piece.get('angle',0)*math.pi/180)
def height(profile,u):
 for (a,y),(b,z) in zip(profile,profile[1:]):
  if u<=b:return y+(z-y)*(.5-.5*math.cos(math.pi*max(0,min(1,(u-a)/(b-a)))))
 return profile[-1][1]
entries=[];references=[]
for meta in design:
 source=fitted[meta['sourceId']];pieces=source['pieces'];total=sum(map(planar,pieces));cuts=[p[0]*total for p in meta['heightProfile'][1:-1]]
 if meta['tunnelRange']:cuts += [u*total for u in meta['tunnelRange']]
 authored=[];distance=0
 for p in pieces:
  span=planar(p);splits=[0]
  for cut in sorted(set(cuts)):
   local=cut-distance
   if local-splits[-1]>=2.05 and span-local>=2.05:splits.append(local)
  splits.append(span)
  for a,b in zip(splits,splits[1:]):
   q=dict(p)
   if 'angle' in q:q['angle']*=((b-a)/span)
   else:q['length']=b-a
   start=(distance+a)/total;end=(distance+b)/total;mid=(start+end)/2
   rise=height(meta['heightProfile'],end)-height(meta['heightProfile'],start)
   if abs(rise)>1e-8:
    q['rise']=rise
    if q['id']=='straight':q['id']='ramp-up' if rise>0 else 'ramp-down'
   if meta['slug']=='suzuka' and q['id']=='straight' and .76<=mid<=.86 and abs(rise)<1e-8:q['id']='bridge'
   if meta['tunnelRange'] and meta['tunnelRange'][0]<=mid<=meta['tunnelRange'][1]:q['tunnel']=True
   if meta['slug']=='austin':
    if start<.03<=end:q['widthFactorTo']=1.4
    if start<.12<=end:q['widthFactorTo']=1
   authored.append({k:round(v,9) if isinstance(v,float) else v for k,v in q.items()})
  distance+=span
 if meta['slug']=='monaco':authored[0]['widthFactorTo']=.8;authored[-1]['widthFactorTo']=1
 assert len(authored)<=128,(meta['slug'],len(authored))
 doc={'version':2,'name':meta['name'],'startHeight':meta['startHeight'],'pieces':authored,'environment':environment,'props':[]}
 entries.append({k:meta[k] for k in ['id','slug','name','inspiration','country','character','description','guide','sources']}|{'document':doc})
 references.append({'id':meta['id'],'reference':[[round(x*source['rescale'],4),round(z*source['rescale'],4)] for x,z in source['points']],'startPoint':[v*source['rescale'] for v in source['startPoint']],'heading':source['heading'],'maxAdjustedMetres':source['maxMoved']*source['rescale']})
 print(meta['name'],len(authored),'editable sections',flush=True)
(root/'src/tracks/gp-world-tour.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n')
(root/'art/gp-circuits/reference.json').write_text(json.dumps(references,separators=(',',':'))+'\n')
