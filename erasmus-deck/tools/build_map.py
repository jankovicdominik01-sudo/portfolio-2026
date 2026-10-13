# Regenerates src/map-data.json from Natural Earth data (public domain).
# Put these files in tools/data/ first:
#   countries-50m.json, countries-10m.json  https://cdn.jsdelivr.net/npm/world-atlas@2/
#   rivers.json    ne_50m_rivers_lake_centerlines.geojson  (github.com/nvkelso/natural-earth-vector)
#   admin1.json    ne_10m_admin_1_states_provinces.geojson (same repo)
import json,math,re,os
HERE=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.join(HERE,'data')
def D(n): return os.path.join(DATA,n)
R=6371.0; lon0,lat0=math.radians(22),math.radians(46)
def P(lon,lat):
    l,p=math.radians(lon),math.radians(lat)
    k=math.sqrt(2/(1+math.sin(lat0)*math.sin(p)+math.cos(lat0)*math.cos(p)*math.cos(l-lon0)))
    x=R*k*math.cos(p)*math.sin(l-lon0); y=R*k*(math.cos(lat0)*math.sin(p)-math.sin(lat0)*math.cos(p)*math.cos(l-lon0))
    return x,-y
def topo_decode(t,objname):
    sx,sy=t['transform']['scale']; tx,ty=t['transform']['translate']
    arcs=[]
    for a in t['arcs']:
        x=y=0; pts=[]
        for dx,dy in a: x+=dx;y+=dy; pts.append((x*sx+tx,y*sy+ty))
        arcs.append(pts)
    def arc(i):
        return arcs[i] if i>=0 else arcs[~i][::-1]
    def ring(ids):
        pts=[]
        for i in ids:
            a=arc(i); pts.extend(a if not pts else a[1:])
        return pts
    out=[]
    for g in t['objects'][objname]['geometries']:
        polys=[]
        if g['type']=='Polygon': polys=[[ring(r) for r in g['arcs']]]
        elif g['type']=='MultiPolygon': polys=[[ring(r) for r in p] for p in g['arcs']]
        out.append((g.get('id'),g.get('properties',{}).get('name'),polys))
    return out
def inview(r,box):
    lo=[p[0] for p in r]; la=[p[1] for p in r]
    return not(max(lo)<box[0] or min(lo)>box[2] or max(la)<box[1] or min(la)>box[3])
def path(rings,prec=1,minlen=0.0):
    s=[]
    for r in rings:
        pts=[P(*p) for p in r]
        # drop near-duplicate points
        q=[pts[0]]
        for p in pts[1:]:
            if abs(p[0]-q[-1][0])+abs(p[1]-q[-1][1])>minlen: q.append(p)
        if len(q)<3: continue
        f=lambda v: (f"{v:.{prec}f}").rstrip('0').rstrip('.') if prec else str(round(v))
        s.append('M'+'L'.join(f"{f(x)},{f(y)}" for x,y in q)+'Z')
    return ''.join(s)
BOX=(-30,24,65,74)
c50=topo_decode(json.load(open(D('countries-50m.json'))),'countries')
c10={i:(n,p) for i,n,p in topo_decode(json.load(open(D('countries-10m.json'))),'countries')}
DETAIL={'703','203','040','348','616','804','792'}
countries=[]
for cid,name,polys in c50:
    if cid in DETAIL: polys=c10[cid][1]
    rings=[r for poly in polys for r in poly if inview(r,BOX)]
    if not rings: continue
    d=path(rings,1 if cid in DETAIL else 0, 0.8 if cid in DETAIL else 3)
    if d: countries.append({'id':cid,'name':name,'d':d})
adm=json.load(open(D('admin1.json')))
regions=[]
for f in adm['features']:
    p=f['properties']
    if p.get('adm0_a3')!='SVK': continue
    g=f['geometry']; polys=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
    regions.append({'name':p['name_en'] or p['name'],'d':path([r for poly in polys for r in poly],2,0.3)})
riv=json.load(open(D('rivers.json')))
rivers=[]
for f in riv['features']:
    n=f['properties'].get('name') or ''
    if n in('Danube','Morava','Váh','Vah'):
        g=f['geometry']; lines=[g['coordinates']] if g['type']=='LineString' else g['coordinates']
        d=''.join('M'+'L'.join(f"{P(*pt)[0]:.1f},{P(*pt)[1]:.1f}" for pt in ln) for ln in lines)
        rivers.append({'name':n,'d':d})
pts={'Senica':(17.3669,48.6792),'Bratislava':(17.1077,48.1486),'Trnava':(17.5883,48.3774),'Istanbul':(28.9784,41.0082),
     'Ankara':(32.8597,39.9334),'Vienna':(16.3738,48.2082),'Prague':(14.4378,50.0755),'Budapest':(19.0402,47.4979),
     'Warsaw':(21.0122,52.2297),'Kyiv':(30.5234,50.4501),'Brussels':(4.3517,50.8503),'Rome':(12.4964,41.9028),
     'Madrid':(-3.7038,40.4168),'Paris':(2.3522,48.8566),'Berlin':(13.405,52.52),'Lisbon':(-9.1393,38.7223),'Athens':(23.7275,37.9838),
     'Tatras':(20.0878,49.1794),'Kosice':(21.2611,48.7164),'Skalica':(17.2266,48.8449),'Holic':(17.1623,48.8119),'Sastin':(17.1452,48.6374),'Branc':(17.5694,48.6594),'Bradlo':(17.6700,48.6617),'Kunov':(17.3380,48.7020),'Hodonin':(17.1325,48.8490),'Myjava':(17.5684,48.7589)}
points={k:[round(P(*v)[0],2),round(P(*v)[1],2)] for k,v in pts.items()}
def hav(a,b):
    (l1,p1),(l2,p2)=[(math.radians(x),math.radians(y)) for x,y in (a,b)]
    h=math.sin((p2-p1)/2)**2+math.cos(p1)*math.cos(p2)*math.sin((l2-l1)/2)**2
    return 2*R*math.asin(math.sqrt(h))
for a,b in [('Senica','Istanbul'),('Senica','Ankara'),('Senica','Bratislava'),('Bratislava','Istanbul')]:
    print(a,b,round(hav(pts[a],pts[b])))
json.dump({'countries':countries,'regions':regions,'rivers':rivers,'points':points},open(os.path.join(HERE,'..','src','map-data.json'),'w'),separators=(',',':'))
print(len(countries), [r['name'] for r in rivers], [r['name'] for r in regions])
xs=[];ys=[]
for c in countries:
  if c['id']=='703':
    import re; nums=list(map(float,re.findall(r'-?[\d.]+',c['d']))); print('SVK bbox',min(nums[0::2]),max(nums[0::2]),min(nums[1::2]),max(nums[1::2]))
  if c['id']=='792':
    nums=list(map(float,re.findall(r'-?[\d.]+',c['d']))); print('TUR bbox',min(nums[0::2]),max(nums[0::2]),min(nums[1::2]),max(nums[1::2]))
print(points)
