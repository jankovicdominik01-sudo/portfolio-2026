"""djweby — geometria loga (čisté vektorové obrysy, žiadne živé písmo).

Logo  = „dj“ (Inter Display ExtraBold) + „weby“ (Inter Display Regular)
        j = kláves Enter ↵ (vlastný tvar), modrá bodka nad j
        podtitul DOMINIK JANKOVIČ (Inter SemiBold), modré D a J
Symbol = kláves (zaoblený štvorec) s „dj↵“ (Inter Display Black)

Súradnice: SVG (y nadol), účaria y = 0. Písmo Inter je pod licenciou SIL OFL 1.1,
ktorá dovoľuje použitie v logu a prevod na krivky.
"""
import math, os
import pathops
from fontTools.ttLib import TTFont
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.svgLib.path import parse_path

FONT_DIR = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter")
UPM = 2048
XH = 1056                        # x-výška Inter Display
STEM = {"ExtraBold": 344, "Black": 400}

# ---------------------------------------------------------------- základné tvary
def _f(v): return f"{v:.3f}".rstrip("0").rstrip(".")

def from_d(*ds):
    out = pathops.Path()
    for d in ds:
        p = pathops.Path(); parse_path(d, p.getPen()); p.simplify(fix_winding=True); out.addPath(p)
    out.simplify(fix_winding=True, clockwise=True)
    return out

def rect(x0, y0, x1, y1):
    x0, x1 = sorted((x0, x1)); y0, y1 = sorted((y0, y1))
    return f"M{_f(x0)},{_f(y0)}H{_f(x1)}V{_f(y1)}H{_f(x0)}Z"

def sector(cx, cy, ro, ri, a0, a1):
    """medzikružný výsek v smere hodín (0° = vpravo, 90° = dole)"""
    pt = lambda r, a: (cx + r*math.cos(math.radians(a)), cy + r*math.sin(math.radians(a)))
    P = lambda p: f"{_f(p[0])},{_f(p[1])}"
    d = f"M{P(pt(ro, a0))}A{_f(ro)},{_f(ro)} 0 0 1 {P(pt(ro, a1))}"
    if ri <= 0.01: return d + f"L{P((cx, cy))}Z"
    return d + f"L{P(pt(ri, a1))}A{_f(ri)},{_f(ri)} 0 0 0 {P(pt(ri, a0))}Z"

def rounded_rect(x0, y0, x1, y1, r):
    k = 0.5523*r
    return (f"M{x0+r},{y0}H{x1-r}C{x1-r+k},{y0} {x1},{y0+r-k} {x1},{y0+r}"
            f"V{y1-r}C{x1},{y1-r+k} {x1-r+k},{y1} {x1-r},{y1}H{x0+r}"
            f"C{x0+r-k},{y1} {x0},{y1-r+k} {x0},{y1-r}V{y0+r}C{x0},{y0+r-k} {x0+r-k},{y0} {x0+r},{y0}Z")

def poly(pts):
    p = pathops.Path(); p.moveTo(*pts[0])
    for q in pts[1:]: p.lineTo(*q)
    p.close(); p.simplify(fix_winding=True, clockwise=True); return p

def union(*ps):
    o = ps[0]
    for p in ps[1:]: o = pathops.op(o, p, pathops.PathOp.UNION, fix_winding=True, clockwise=True)
    return o

def diff(a, b): return pathops.op(a, b, pathops.PathOp.DIFFERENCE, fix_winding=True, clockwise=True)

def xform(p, a=1, b=0, c=0, d=1, e=0, f=0):
    o = pathops.Path(); p.draw(TransformPen(o.getPen(), (a, b, c, d, e, f))); return o

def move(p, dx, dy): return xform(p, 1, 0, 0, 1, dx, dy)
def scale(p, s): return xform(p, s, 0, 0, s, 0, 0)

def contours(p):
    out, cur = [], None
    for verb, pts in p.segments:
        if verb == "moveTo": cur = pathops.Path(); cur.moveTo(*pts[0])
        elif verb == "lineTo": cur.lineTo(*pts[0])
        elif verb == "curveTo": cur.cubicTo(*pts[0], *pts[1], *pts[2])
        elif verb == "qCurveTo": cur.quadTo(*pts[0], *pts[1])
        elif verb == "closePath": cur.close(); out.append(cur)
    return out

def bounds(paths):
    bs = [p.bounds for p in paths]
    return min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)

def svg_d(p, nd=2):
    pen = SVGPathPen(None, ntos=lambda v: f"{v:.{nd}f}".rstrip("0").rstrip("."))
    p.draw(pen); return pen.getCommands()

# ---------------------------------------------------------------- písmo
_fonts = {}
def font(name):
    if name not in _fonts:
        f = TTFont(os.path.join(FONT_DIR, name + ".otf"))
        _fonts[name] = (f.getGlyphSet(), f.getBestCmap(), f["hmtx"])
    return _fonts[name]

def glyph(name, ch, x=0.0, s=1.0):
    gs, cm, hm = font(name); p = pathops.Path()
    gs[cm[ord(ch)]].draw(TransformPen(p.getPen(), (s, 0, 0, -s, x, 0)))
    p.simplify(fix_winding=True, clockwise=True)
    return p, hm[cm[ord(ch)]][0]*s

# ---------------------------------------------------------------- j = Enter ↵
ENTER = dict(ah=1.62, gap=0.24, L=0.35, alen=0.88, ro=1.0)     # v logu
ENTER_KEY = dict(ah=1.75, gap=0.24, L=0.35, alen=0.90, ro=1.0)  # v symbole

def enter_j(sw, a, P):
    """driek j od x-výšky nadol, zalomenie doľava a hrot šípky. a = ľavá hrana drieku"""
    ah, gap, L, ro = P["ah"]*sw, P["gap"]*sw, P["L"]*sw, P["ro"]*sw
    yc = ah/2 + gap; yb, yt = yc + sw/2, yc - sw/2
    xr = a + sw; acx, acy = xr - ro, yb - ro
    body = from_d(rect(a, -XH, xr, acy + 0.5), sector(acx, acy, ro, max(ro - sw, 0), 0, 90),
                  rect(a - L, yt, acx + 0.5, yb))
    base = a - L; tip = base - P["alen"]*ah
    return union(body, poly([(tip, yc), (base + 0.5, yc - ah/2), (base + 0.5, yc + ah/2)]))

def dj_glyphs(heavy="InterDisplay-ExtraBold", P=ENTER, dj_track=-0.02):
    sw = STEM[heavy.split("-")[1]]
    d, dadv = glyph(heavy, "d")
    jg, _ = glyph(heavy, "j", dadv + dj_track*UPM)
    cs = contours(jg); dot = min(cs, key=lambda c: c.bounds[1])
    jr = max(c.bounds[2] for c in cs if c is not dot)
    return union(d, enter_j(sw, jr - sw, P)), dot, jr

def wordmark(wgap=0.075, track_w=-0.012):
    """vráti (dj, bodka, weby) v jednotkách písma"""
    dj, dot, jr = dj_glyphs()
    x = jr + wgap*UPM; weby = pathops.Path(); first = True
    for ch in "weby":
        p, adv = glyph("InterDisplay-Regular", ch, x)
        if first:
            sh = x - p.bounds[0]; p = move(p, sh, 0); x += sh; first = False
        weby.addPath(p); x += adv + track_w*UPM
    weby.simplify(fix_winding=True, clockwise=True)
    return dj, dot, weby

# ---------------------------------------------------------------- podtitul
DESC = "DOMINIK JANKOVIČ"; DESC_FONT = "Inter-SemiBold"; DESC_TRACK = 0.30

def descriptor(width):
    gs, cm, hm = font(DESC_FONT)
    adv = [hm[cm[ord(c)]][0] for c in DESC]
    def ink(c):
        bp = BoundsPen(gs); gs[cm[ord(c)]].draw(bp); return bp.bounds
    w1 = (sum(adv[:-1]) + ink(DESC[-1])[2] - ink(DESC[0])[0])/UPM + (len(DESC) - 1)*DESC_TRACK
    size = width/w1; s = size/UPM
    track = (width - (sum(adv[:-1]) + ink(DESC[-1])[2] - ink(DESC[0])[0])*s)/(len(DESC) - 1)
    x = -ink(DESC[0])[0]*s; out = []
    for i, c in enumerate(DESC):
        if c != " ":
            p, _ = glyph(DESC_FONT, c, x, s); out.append((p, "hl" if i in (0, 8) else "sub"))
        x += adv[i]*s + track
    return out, size

# ---------------------------------------------------------------- zostavy
SIZE = 100.0  # veľkosť písma loga v jednotkách návrhu

def logo_parts(with_name=True):
    """[(path, rola)] s ľavým horným rohom na (0,0). roly: fg, acc, hl, sub"""
    s = SIZE/UPM
    dj, dot, weby = (scale(p, s) for p in wordmark())
    parts = [(dj, "fg"), (weby, "fg"), (dot, "acc")]
    x0, y0, x1, y1 = bounds([p for p, _ in parts])
    if with_name:
        dd, dsz = descriptor(x1 - x0)
        ytop = y1 + SIZE*0.20; capH = 1490/UPM*dsz
        parts += [(move(p, x0, ytop + capH), r) for p, r in dd]
    x0, y0, x1, y1 = bounds([p for p, _ in parts])
    return [(move(p, -x0, -y0), r) for p, r in parts], (x1 - x0, y1 - y0)

def clear_x():
    """X = x-výška „weby“ (výška písmena w) — jednotka ochrannej zóny"""
    return XH/UPM*SIZE

def key_parts(gh=0.50, r=0.24, box=1000.0, full_bleed=False, knockout=False):
    """symbol: kláves s „dj↵“. roly: key, glyph. knockout = znak vyrazený z klávesu (1 farba)"""
    dj, dot, _ = dj_glyphs("InterDisplay-Black", ENTER_KEY, dj_track=0.01)
    gl = union(dj, dot); x0, y0, x1, y1 = gl.bounds
    s = min(box*gh/(y1 - y0), box*0.64/(x1 - x0))
    gl = scale(gl, s); x0, y0, x1, y1 = gl.bounds
    gl = move(gl, box/2 - (x0 + x1)/2, box/2 - (y0 + y1)/2)
    key = from_d(rect(0, 0, box, box) if full_bleed else rounded_rect(0, 0, box, box, box*r))
    if knockout: return [(diff(key, gl), "key")], (box, box)
    return [(key, "key"), (gl, "glyph")], (box, box)
