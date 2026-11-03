"""Vygeneruje kompletný balík loga djweby do ../ (spúšťať: python3 generuj.py)."""
import io, os, sys, datetime
import cairosvg
from PIL import Image
import logo as L

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATE = "2026-11-03"

# ---------------------------------------------------------------- farby
COL = {  # názov: (HEX, CMYK)
    "modra":   ("#3B82F6", (75, 52, 0, 0)),
    "cierna":  ("#0A0A0A", (0, 0, 0, 100)),
    "biela":   ("#FFFFFF", (0, 0, 0, 0)),
    "siva":    ("#6B7280", (0, 0, 0, 65)),   # podtitul na svetlom
    "siva-sv": ("#8B93A1", (0, 0, 0, 45)),   # podtitul na tmavom
    "pozadie": ("#050505", (60, 40, 40, 100)),
}
SCHEMES = {  # rola -> farba
    "farebne": dict(fg="cierna", acc="modra", hl="modra", sub="siva"),
    "negativ": dict(fg="biela", acc="modra", hl="modra", sub="siva-sv"),
    "cierne":  dict(fg="cierna", acc="cierna", hl="cierna", sub="cierna"),
    "biele":   dict(fg="biela", acc="biela", hl="biela", sub="biela"),
}
KEY_SCHEMES = {
    "farebny": (dict(key="modra", glyph="biela"), False),
    "cierny":  (dict(key="cierna"), True),
    "biely":   (dict(key="biela"), True),
}

# ---------------------------------------------------------------- zápis vektorov
def svg_doc(parts, size, scheme, title, pad=0.0, bg=None):
    w, h = size; W, H = w + 2*pad, h + 2*pad
    body = "".join(f'<path fill="{COL[scheme[r]][0]}" d="{L.svg_d(p)}"/>' for p, r in parts)
    bgr = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    tr = f' transform="translate({pad:.2f} {pad:.2f})"' if pad else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" width="{W:.2f}" height="{H:.2f}">'
            f'<title>{title}</title>{bgr}<g{tr}>{body}</g></svg>\n')

def _ps_ops(p, tx, style):
    """pathops Path -> PostScript / PDF operátory (krivky prevedené na kubické)"""
    out = []; cur = start = None
    mv, ln, cv, cl = ("moveto", "lineto", "curveto", "closepath") if style == "ps" else ("m", "l", "c", "h")
    fmt = lambda pt: "%.3f %.3f" % tx(pt)
    for verb, pts in p.segments:
        if verb == "moveTo": cur = start = pts[0]; out.append(f"{fmt(cur)} {mv}")
        elif verb == "lineTo": cur = pts[0]; out.append(f"{fmt(cur)} {ln}")
        elif verb == "curveTo": out.append(f"{fmt(pts[0])} {fmt(pts[1])} {fmt(pts[2])} {cv}"); cur = pts[2]
        elif verb == "qCurveTo":
            offs, end = list(pts[:-1]), pts[-1]
            ons = [((offs[i][0] + offs[i+1][0])/2, (offs[i][1] + offs[i+1][1])/2) for i in range(len(offs) - 1)] + [end]
            for q, e in zip(offs, ons):
                c1 = (cur[0] + 2/3*(q[0] - cur[0]), cur[1] + 2/3*(q[1] - cur[1]))
                c2 = (e[0] + 2/3*(q[0] - e[0]), e[1] + 2/3*(q[1] - e[1]))
                out.append(f"{fmt(c1)} {fmt(c2)} {fmt(e)} {cv}"); cur = e
        elif verb == "closePath": out.append(cl); cur = start
    return out

def _paint(parts, size, scheme, k, style):
    w, h = size
    tx = lambda pt: (pt[0]*k, (h - pt[1])*k)
    ops = []
    for p, r in parts:
        c, m, y, kk = COL[scheme[r]][1]
        col = f"{c/100:.3f} {m/100:.3f} {y/100:.3f} {kk/100:.3f}"
        if style == "ps": ops += [col + " setcmykcolor", "newpath"] + _ps_ops(p, tx, "ps") + ["fill"]
        else: ops += [col + " k"] + _ps_ops(p, tx, "pdf") + ["f"]
    return "\n".join(ops)

def pdf_doc(parts, size, scheme, title, width_mm):
    k = width_mm/25.4*72/size[0]; W, H = size[0]*k, size[1]*k
    content = _paint(parts, size, scheme, k, "pdf").encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            (f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W:.3f} {H:.3f}] /TrimBox [0 0 {W:.3f} {H:.3f}] "
             f"/Contents 4 0 R /Resources << >> >>").encode(),
            b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
            (f"<< /Title ({title}) /Author (Dominik Jankovic) /Creator (djweby brand generator) "
             f"/CreationDate (D:{DATE.replace('-', '')}120000) >>").encode()]
    buf = io.BytesIO(); buf.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"); offs = []
    for i, o in enumerate(objs, 1):
        offs.append(buf.tell()); buf.write(b"%d 0 obj\n" % i + o + b"\nendobj\n")
    x = buf.tell(); buf.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1))
    for o in offs: buf.write(b"%010d 00000 n \n" % o)
    buf.write(b"trailer\n<< /Size %d /Root 1 0 R /Info 5 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, x))
    return buf.getvalue()

def eps_doc(parts, size, scheme, title, width_mm):
    k = width_mm/25.4*72/size[0]; W, H = size[0]*k, size[1]*k
    import math
    return (f"%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 {math.ceil(W)} {math.ceil(H)}\n"
            f"%%HiResBoundingBox: 0 0 {W:.3f} {H:.3f}\n%%Title: {title}\n%%Creator: djweby brand generator\n"
            f"%%CreationDate: {DATE}\n%%DocumentProcessColors: Cyan Magenta Yellow Black\n%%LanguageLevel: 2\n"
            f"%%Pages: 1\n%%EndComments\n%%BeginProlog\n%%EndProlog\n%%Page: 1 1\ngsave\n"
            + _paint(parts, size, scheme, k, "ps") + "\ngrestore\nshowpage\n%%EOF\n")

# ---------------------------------------------------------------- rastre
def png(svg, width, path=None, bg=None):
    data = cairosvg.svg2png(bytestring=svg.encode(), output_width=width)
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    if bg:
        b = Image.new("RGBA", im.size, bg); b.alpha_composite(im); im = b
    if path: im.save(path, optimize=True)
    return im

def save_jpg(im, path, q=92): im.convert("RGB").save(path, quality=q, optimize=True, progressive=True)

def mk(*p):
    d = os.path.join(OUT, *p); os.makedirs(d, exist_ok=True); return d

# ---------------------------------------------------------------- hlavný beh
def main():
    V = {"svg": mk("01_tlac_vektory", "svg"), "pdf": mk("01_tlac_vektory", "pdf"), "eps": mk("01_tlac_vektory", "eps")}
    P = mk("02_web_rastre", "png"); J = mk("02_web_rastre", "jpg")
    FAV = mk("02_web_rastre", "favicon"); SOC = mk("02_web_rastre", "socialne-siete")
    X = L.clear_x()
    arts = []  # (name, parts, size, scheme, width_mm, png_widths, jpg_bg)
    logo_full = L.logo_parts(True); logo_word = L.logo_parts(False)
    BG = {"farebne": "#FFFFFF", "negativ": COL["pozadie"][0], "cierne": "#FFFFFF", "biele": COL["modra"][0]}
    for sc in SCHEMES:
        arts.append((f"djweby-logo_{sc}", *logo_full, SCHEMES[sc], 120, (800, 1600, 3200), BG[sc]))
        arts.append((f"djweby-napis_{sc}", *logo_word, SCHEMES[sc], 80, (600, 1200, 2400), BG[sc]))
    for sc, (cmap, ko) in KEY_SCHEMES.items():
        kp = L.key_parts(knockout=ko)
        arts.append((f"djweby-symbol_{sc}", *kp, cmap, 30, (256, 512, 1024),
                     {"farebny": "#FFFFFF", "cierny": "#FFFFFF", "biely": COL["pozadie"][0]}[sc]))
    for name, parts, size, scheme, wmm, pws, jbg in arts:
        title = name.replace("_", " ")
        s = svg_doc(parts, size, scheme, title)
        open(os.path.join(V["svg"], name + ".svg"), "w").write(s)
        open(os.path.join(V["pdf"], name + ".pdf"), "wb").write(pdf_doc(parts, size, scheme, title, wmm))
        open(os.path.join(V["eps"], name + ".eps"), "w").write(eps_doc(parts, size, scheme, title, wmm))
        for pw in pws:
            png(s, pw, os.path.join(P, f"{name}_{pw}px.png"))
        # JPG: s ochrannou zónou 1X na pozadí
        pad = X if "symbol" not in name else size[0]*0.25
        sj = svg_doc(parts, size, scheme, title, pad=pad, bg=jbg)
        save_jpg(png(sj, pws[1]), os.path.join(J, f"{name}_{pws[1]}px.jpg"))
    # ---------------- favicony a ikony
    def key_svg(**kw):
        parts, size = L.key_parts(**kw)
        return svg_doc(parts, size, dict(key="modra", glyph="biela"), "djweby")
    small = key_svg(gh=0.56, r=0.22)                        # optimalizované pre 16–48 px
    open(os.path.join(FAV, "favicon.svg"), "w").write(small)
    ims = [png(small, s) for s in (16, 32, 48)]
    for s, im in zip((16, 32, 48), ims): im.save(os.path.join(FAV, f"favicon-{s}x{s}.png"))
    ims[2].save(os.path.join(FAV, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])
    png(key_svg(full_bleed=True, gh=0.50), 180, os.path.join(FAV, "apple-touch-icon.png"))
    png(key_svg(), 192, os.path.join(FAV, "icon-192.png"))
    png(key_svg(), 512, os.path.join(FAV, "icon-512.png"))
    png(key_svg(full_bleed=True, gh=0.40), 512, os.path.join(FAV, "icon-maskable-512.png"))
    # ---------------- sociálne siete
    parts, size = logo_full
    w = 1200*0.56; k = w/size[0]; pad_x = (1200 - w)/2/k; pad_y = (630/k - size[1])/2
    og = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {1200/k:.2f} {630/k:.2f}">'
          f'<rect width="100%" height="100%" fill="{COL["pozadie"][0]}"/><g transform="translate({pad_x:.2f} {pad_y:.2f})">'
          + "".join(f'<path fill="{COL[SCHEMES["negativ"][r]][0]}" d="{L.svg_d(p)}"/>' for p, r in parts) + "</g></svg>")
    im = png(og, 1200); im.convert("RGB").save(os.path.join(SOC, "og-image_1200x630.png"), optimize=True)
    save_jpg(im, os.path.join(SOC, "og-image_1200x630.jpg"))
    png(key_svg(full_bleed=True, gh=0.40), 1080, os.path.join(SOC, "profilovka_1080x1080.png"))
    print("hotovo:", OUT)

if __name__ == "__main__":
    main()
