"""Dizajn manuál djweby -> ../03_dizajn_manual/djweby-dizajn-manual.pdf (HTML + Chromium)."""
import os, re
import logo as L
from generuj import COL, SCHEMES, svg_doc, OUT, mk

def inner(parts, scheme, colmap=None):
    c = colmap or (lambda r: COL[scheme[r]][0])
    return "".join(f'<path fill="{c(r)}" d="{L.svg_d(p)}"/>' for p, r in parts)

FULL = L.logo_parts(True); WORD = L.logo_parts(False)
KEY = L.key_parts(); KEYK = L.key_parts(knockout=True)
KS = dict(key="modra", glyph="biela")
def svg(parts_size, scheme, cls="", style="", extra="", pad=0, colmap=None, attrs=""):
    parts, (w, h) = parts_size
    return (f'<svg class="{cls}" style="{style}" viewBox="{-pad:.1f} {-pad:.1f} {w+2*pad:.1f} {h+2*pad:.1f}" {attrs} xmlns="http://www.w3.org/2000/svg">'
            f'{extra}<g>{inner(parts, scheme, colmap)}</g></svg>')

X = L.clear_x(); W, H = FULL[1]
def mm(u, width_mm=120): return u/W*width_mm

def clearspace():
    pad = X*1.5
    r = (f'<rect x="{-X:.1f}" y="{-X:.1f}" width="{W+2*X:.1f}" height="{H+2*X:.1f}" fill="#EFF6FF" stroke="#3B82F6" stroke-width="1.2" stroke-dasharray="5 4"/>'
         f'<rect x="0" y="0" width="{W:.1f}" height="{H:.1f}" fill="none" stroke="#93C5FD" stroke-width="0.6"/>')
    sq = ""
    for x, y in ((-X, -X), (W, -X), (-X, H), (W, H)):
        sq += f'<rect x="{x:.1f}" y="{y:.1f}" width="{X:.1f}" height="{X:.1f}" fill="#3B82F6" opacity="0.18"/><text x="{x+X/2:.1f}" y="{y+X/2+6:.1f}" font-size="17" font-family="Inter" font-weight="700" fill="#1D4ED8" text-anchor="middle">X</text>'
    return svg(FULL, SCHEMES["farebne"], cls="cs", pad=pad, extra=r + sq)

def xheight_demo():
    # vyznačí X = výška „w“ na nápise
    parts, (w, h) = WORD
    dj, dot, weby = (L.scale(p, L.SIZE/L.UPM) for p in L.wordmark())
    top0 = L.bounds([dj, dot, weby])[1]            # posun, ktorý použil logo_parts
    base = -top0; xh = base - X                    # účaria a x-výška v súradniciach WORD
    wx = [p for p, r in parts if r == "fg"][1].bounds
    wx = (wx[0], xh, wx[2], base)
    ex = (f'<line x1="{-10:.1f}" x2="{wx[2]+4:.1f}" y1="{xh:.1f}" y2="{xh:.1f}" stroke="#E11D48" stroke-width="1"/>'
          f'<line x1="{-10:.1f}" x2="{wx[2]+4:.1f}" y1="{base:.1f}" y2="{base:.1f}" stroke="#E11D48" stroke-width="1"/>'
          f'<text x="{wx[2]+10:.1f}" y="{(wx[1]+base)/2+7:.1f}" font-size="20" font-family="Inter" font-weight="700" fill="#E11D48">X</text>')
    return svg(WORD, SCHEMES["farebne"], cls="xh", pad=30, extra=ex)

def wrong(kind):
    sc = SCHEMES["farebne"]; base = inner(FULL[0], sc); w, h = FULL[1]; vb = f"-30 -30 {w+60:.0f} {h+60:.0f}"
    if kind == "stretch":
        return (f'<svg viewBox="-30 -30 {w*1.3+60:.0f} {h+60:.0f}" xmlns="http://www.w3.org/2000/svg">'
                f'<g transform="translate(0 {h*0.14:.1f}) scale(1.3 0.72)">{base}</g></svg>')
    elif kind == "rotate": g = f'<g transform="rotate(-14 {w/2:.0f} {h/2:.0f})">{base}</g>'
    elif kind == "color": g = inner(FULL[0], sc, lambda r: {"fg": "#7C3AED", "acc": "#F97316", "hl": "#F97316", "sub": "#A78BFA"}[r])
    elif kind == "effect":
        g = ('<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="6" dy="8" stdDeviation="4" flood-color="#000" flood-opacity="0.55"/></filter>'
             '<linearGradient id="gr" x1="0" x2="1"><stop offset="0" stop-color="#EC4899"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>'
             f'<g filter="url(#sh)">{inner(FULL[0], sc, lambda r: "url(#gr)")}</g>')
    elif kind == "outline": g = "".join(f'<path fill="none" stroke="#0A0A0A" stroke-width="2.2" d="{L.svg_d(p)}"/>' for p, r in FULL[0])
    elif kind == "font":
        g = ('<text x="0" y="78" font-family="DejaVu Serif" font-weight="700" font-size="92" fill="#0A0A0A">djweby</text>'
             '<text x="4" y="128" font-family="DejaVu Serif" font-size="21" letter-spacing="5" fill="#6B7280">Dominik Jankovič</text>')
    elif kind == "bg": return (f'<svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="b" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#60A5FA"/><stop offset=".5" stop-color="#1F2937"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs>'
                               f'<rect x="-30" y="-30" width="100%" height="100%" fill="url(#b)"/><g>{inner(FULL[0], SCHEMES["farebne"])}</g></svg>')
    elif kind == "space": return (f'<svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg"><g>{inner(FULL[0], sc)}</g>'
                                  f'<rect x="{w-40:.0f}" y="-26" width="96" height="40" rx="6" fill="#F59E0B"/><text x="{w+8:.0f}" y="0" font-family="Inter" font-weight="800" font-size="20" text-anchor="middle" fill="#fff">AKCIA!</text>'
                                  f'<circle cx="-6" cy="{h-8:.0f}" r="22" fill="#10B981"/></svg>')
    return f'<svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg">{g}</svg>'

WRONG = [("stretch", "Nedeformuj pomer strán"), ("rotate", "Neotáčaj logo"), ("color", "Nemeň farby mimo palety"),
         ("effect", "Žiadne tiene, prechody, efekty"), ("outline", "Nerob z loga obrys"), ("font", "Neprepisuj logo iným písmom"),
         ("bg", "Nedávaj na rušivé pozadie bez kontrastu"), ("space", "Nenarúšaj ochrannú zónu")]

SW = [("modra", "Enter modrá", "Hlavná farba. Šípka, bodka, symbol.", "2727 C*"),
      ("cierna", "Nočná čierna", "Nápis na svetlom pozadí.", "Black C"),
      ("biela", "Biela", "Nápis na tmavom a modrom pozadí.", "—"),
      ("pozadie", "Pozadie webu", "Tmavé plochy, web, sociálne siete.", "Black 6 C*"),
      ("siva", "Sivá", "Podtitul na svetlom pozadí.", "Cool Gray 9*"),
      ("siva-sv", "Svetlá sivá", "Podtitul na tmavom pozadí.", "Cool Gray 7*")]

def rgb(h): return "/".join(str(int(h[i:i+2], 16)) for i in (1, 3, 5))

CSS = """
@page { size: 297mm 210mm; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
body { font-family: Inter, sans-serif; color: #0A0A0A; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.page { width: 297mm; height: 210mm; padding: 16mm 18mm; position: relative; overflow: hidden; page-break-after: always; background: #fff }
.dark { background: #050505; color: #fff }
.num { position: absolute; left: 18mm; bottom: 9mm; font-size: 8.5pt; color: #9CA3AF; letter-spacing: .08em }
.num b { color: #3B82F6 }
h1 { font-size: 26pt; font-weight: 800; letter-spacing: -.02em; margin-bottom: 3mm }
h2 { font-size: 11pt; font-weight: 700; margin: 0 0 2mm }
.kick { font-size: 9pt; font-weight: 700; letter-spacing: .18em; color: #3B82F6; text-transform: uppercase; margin-bottom: 4mm }
p, li, td { font-size: 10pt; line-height: 1.5; color: #374151 }
.dark p { color: #9CA3AF }
.lead { font-size: 13pt; line-height: 1.5; color: #111827; max-width: 200mm }
.grid { display: grid; gap: 6mm }
.card { border-radius: 4mm; padding: 7mm; display: flex; align-items: center; justify-content: center }
.cap { font-size: 8.5pt; color: #6B7280; margin-top: 2mm }
table { border-collapse: collapse; width: 100% }
td, th { text-align: left; padding: 2.2mm 3mm; border-bottom: 1px solid #E5E7EB; font-size: 9.5pt; vertical-align: top }
th { font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: #6B7280; font-weight: 700 }
code { font-family: 'JetBrains Mono', monospace; font-size: 8.8pt; color: #111827 }
.x { position: relative; border: 1px solid #E5E7EB; border-radius: 3mm; padding: 5mm; height: 34mm; display: flex; align-items: center; justify-content: center }
.x svg { max-height: 24mm; max-width: 100% }
.x::after { content: ""; position: absolute; right: 3mm; top: 3mm; width: 7mm; height: 7mm; border-radius: 50%; background: #E11D48 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M6 6l8 8M14 6l-8 8' stroke='white' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E") center/70% no-repeat }
.steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm }
.step { border: 1px solid #E5E7EB; border-radius: 3mm; padding: 5mm }
.step b { display: block; color: #3B82F6; font-size: 9pt; letter-spacing: .1em; margin-bottom: 1.5mm }
"""

def page(body, n, dark=False):
    return f'<section class="page{" dark" if dark else ""}">{body}<div class="num"><b>djweby</b> · Dizajn manuál v1.0 · {n:02d}</div></section>'

def build():
    P = []
    # 1 obálka
    P.append(page(f'''<div style="height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding-left:10mm">
      {svg(FULL, SCHEMES["negativ"], style="width:150mm")}
      <div style="margin-top:22mm;font-size:12pt;letter-spacing:.2em;color:#9CA3AF;font-weight:600">DIZAJN MANUÁL · LOGO A VIZUÁLNA IDENTITA</div>
      <div style="margin-top:2mm;font-size:10pt;color:#6B7280">verzia 1.0 · november 2026</div></div>''', 1, True))
    # 2 koncept
    P.append(page(f'''<div class="kick">01 · Koncept</div><h1>Stlač Enter. Tvoj web je online.</h1>
      <p class="lead">Logo spája meno autora a to, čo robí. Jeden znak nesie dva významy, podobne ako skrytá šípka v logu FedEx.</p>
      <div class="grid" style="grid-template-columns:1.25fr 1fr;margin-top:9mm;align-items:center">
        <div class="card" style="background:#050505;height:96mm">{svg(FULL, SCHEMES["negativ"], style="width:118mm")}</div>
        <div>
          <h2>dj = Dominik Jankovič</h2><p>Iniciály v hrubom reze. Podtitul s menom (modré D a J) hovorí každému, kto stojí za značkou.</p><br>
          <h2>weby = čo robím</h2><p>Tenší rez oddeľuje meno od služby. Kontrast hrúbok robí logo jedinečným a odlišuje ho od celých hrubých nápisov.</p><br>
          <h2>j = kláves Enter ↵</h2><p>Zalomenie písmena j končí hrotom šípky. Je to písmeno aj symbol: odoslať, spustiť, publikovať.</p><br>
          <h2>Modrá bodka</h2><p>Jediný farebný akcent v nápise. Prenáša sa do symbolu, ktorý je modrou klávesou.</p>
        </div></div>''', 2))
    # 3 verzie
    P.append(page(f'''<div class="kick">02 · Verzie loga</div><h1>Tri podoby, jedna značka</h1>
      <div class="grid" style="grid-template-columns:1.3fr 1fr .62fr;margin-top:8mm">
        <div><div class="card" style="background:#F3F4F6;height:70mm">{svg(FULL, SCHEMES["farebne"], style="width:84mm")}</div>
          <h2 style="margin-top:4mm">Hlavné logo</h2><p>Nápis s menom. Používa sa všade, kde je dosť miesta: web, ponuky, vizitky, faktúry.</p></div>
        <div><div class="card" style="background:#F3F4F6;height:70mm">{svg(WORD, SCHEMES["farebne"], style="width:62mm")}</div>
          <h2 style="margin-top:4mm">Nápis</h2><p>Bez mena. Pre malé veľkosti (pod 40 mm a 200 px), hlavičku webu a pätičky e-mailov.</p></div>
        <div><div class="card" style="background:#F3F4F6;height:70mm">{svg(KEY, KS, style="width:34mm")}</div>
          <h2 style="margin-top:4mm">Symbol</h2><p>Kláves dj↵. Favicon, app ikona, profilová fotka, pečiatka.</p></div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:9mm">
        <div class="card" style="background:#fff;border:1px solid #E5E7EB;height:30mm">{svg(WORD, SCHEMES["farebne"], style="width:42mm")}</div>
        <div class="card" style="background:#050505;height:30mm">{svg(WORD, SCHEMES["negativ"], style="width:42mm")}</div>
        <div class="card" style="background:#3B82F6;height:30mm">{svg(WORD, SCHEMES["biele"], style="width:42mm")}</div>
        <div class="card" style="background:#E5E7EB;height:30mm">{svg(WORD, SCHEMES["cierne"], style="width:42mm")}</div>
      </div>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:6mm"><p class="cap">Farebné, na svetlom</p><p class="cap">Negatív, na tmavom</p><p class="cap">Biele, na modrej alebo na fotke</p><p class="cap">Čierne, jednofarebná tlač, pečiatka, gravír</p></div>''', 3))
    # 4 farby
    rows = "".join(f'''<div style="display:flex;flex-direction:column"><div style="height:40mm;border-radius:3mm 3mm 0 0;background:{COL[k][0]};{"border:1px solid #E5E7EB;" if k=="biela" else ""}"></div>
        <div style="border:1px solid #E5E7EB;border-top:0;border-radius:0 0 3mm 3mm;padding:4mm;flex:1"><h2>{nm}</h2><p style="font-size:8.5pt;min-height:9mm">{use}</p>
        <table><tr><td style="padding:1mm 0;border:0;color:#6B7280">HEX</td><td style="padding:1mm 0;border:0"><code>{COL[k][0]}</code></td></tr>
        <tr><td style="padding:1mm 0;border:0;color:#6B7280">RGB</td><td style="padding:1mm 0;border:0"><code>{rgb(COL[k][0])}</code></td></tr>
        <tr><td style="padding:1mm 0;border:0;color:#6B7280">CMYK</td><td style="padding:1mm 0;border:0"><code>{"/".join(map(str, COL[k][1]))}</code></td></tr>
        <tr><td style="padding:1mm 0;border:0;color:#6B7280">PMS</td><td style="padding:1mm 0;border:0"><code>{pan}</code></td></tr></table></div></div>''' for k, nm, use, pan in SW)
    P.append(page(f'''<div class="kick">03 · Farby</div><h1>Farebná paleta</h1>
      <p class="lead">Modrá je jediná akcentová farba. Všetko ostatné je čierna, biela a sivá.</p>
      <div class="grid" style="grid-template-columns:repeat(6,1fr);gap:4mm;margin-top:8mm">{rows}</div>
      <p style="margin-top:5mm;font-size:8.5pt">CMYK: modrá prepočítaná z sRGB cez ICC profil (relatívna kolorimetria). Čierna v logu tlačí ako čistá K100, veľké tmavé plochy ako sýta čierna 60/40/40/100.
      Sivé pre podtitul tlačia čisto K. * PMS (Pantone) je orientačný najbližší odtieň, pred tlačou ho overte vo vzorníku.</p>''', 4))
    # 5 ochranná zóna a min. veľkosť
    P.append(page(f'''<div class="kick">04 · Ochranná zóna a minimálna veľkosť</div><h1>Logo potrebuje vzduch</h1>
      <div class="grid" style="grid-template-columns:1.35fr 1fr;margin-top:6mm;align-items:start">
        <div>{clearspace()}<p class="cap">Okolo loga nechaj voľný priestor aspoň X na každej strane. Do zóny nepatrí text, obrázok ani okraj stránky.</p></div>
        <div><h2>Čo je X</h2><p>X je výška písmena „w“ (x-výška nápisu). Rastie a klesá spolu s logom.</p>
          <div style="margin:4mm 0 8mm">{xheight_demo()}</div>
          <h2>Minimálna veľkosť</h2>
          <table><tr><th>Verzia</th><th>Tlač</th><th>Obrazovka</th></tr>
          <tr><td>Hlavné logo s menom</td><td>40 mm šírka</td><td>200 px</td></tr>
          <tr><td>Nápis bez mena</td><td>20 mm šírka</td><td>90 px</td></tr>
          <tr><td>Symbol (kláves)</td><td>6 mm</td><td>16 px</td></tr></table>
          <p style="margin-top:3mm;font-size:8.5pt">Pod minimálnou veľkosťou loga s menom prejdi na nápis. Pod veľkosťou nápisu prejdi na symbol.</p></div>
      </div>''', 5))
    # 6 typografia
    P.append(page(f'''<div class="kick">05 · Typografia</div><h1>Písmo Inter</h1>
      <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:8mm">
        <div><div style="font-family:'Inter Display';font-weight:800;font-size:64pt;letter-spacing:-.03em;line-height:1">Aa Bb</div>
          <h2 style="margin-top:5mm">Inter Display: logo a nadpisy</h2><p>Logo je postavené na Inter Display (ExtraBold, Black, Regular) a je prevedené na krivky. Na použitie loga písmo netreba inštalovať.
          Na nadpisy používaj Inter Display ExtraBold s jemne stiahnutým prestrkaním (−2 %).</p></div>
        <div><div style="font-family:Inter;font-weight:400;font-size:64pt;letter-spacing:-.02em;line-height:1;color:#374151">Aa Bb</div>
          <h2 style="margin-top:5mm">Inter: texty</h2><p>Bežný text na webe, v ponukách a dokumentoch: Inter Regular, Medium alebo SemiBold.
          Podtitul a štítky: Inter SemiBold, verzálky, prestrkanie +30 %.</p>
          <p style="margin-top:3mm">Licencia: SIL Open Font License 1.1, voľne aj na komerčné použitie. Stiahnutie: rsms.me/inter alebo Google Fonts.</p></div>
      </div>
      <div style="margin-top:10mm;padding:8mm;background:#050505;border-radius:4mm;color:#fff">
        <div style="font-size:8pt;letter-spacing:.2em;color:#3B82F6;font-weight:700">UKÁŽKA</div>
        <div style="font-family:'Inter Display';font-weight:800;font-size:24pt;letter-spacing:-.02em;margin:2mm 0">Weby, ktoré prinášajú zákazníkov.</div>
        <div style="font-size:11pt;color:#9CA3AF">Prémiové webstránky a aplikácie na mieru. Rýchle, vyladené pre SEO a postavené tak, aby predávali.</div></div>''', 6))
    # 7 zakázané úpravy
    cells = "".join(f'<div><div class="x">{wrong(k)}</div><p class="cap" style="font-weight:600;color:#111827">{t}</p></div>' for k, t in WRONG)
    P.append(page(f'''<div class="kick">06 · Zakázané úpravy</div><h1>Čo s logom nerobiť</h1>
      <p class="lead">Logo používaj iba z dodaných súborov. Nič neprekresľuj, neprepisuj ani nedopĺňaj.</p>
      <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:5mm;margin-top:7mm">{cells}</div>''', 7))
    # 8 súbory
    P.append(page(f'''<div class="kick">07 · Súbory</div><h1>Ktorý súbor kedy použiť</h1>
      <table style="margin-top:6mm">
      <tr><th style="width:52mm">Priečinok</th><th style="width:40mm">Formát</th><th>Použitie</th></tr>
      <tr><td><code>01_tlac_vektory/pdf</code></td><td>PDF, CMYK</td><td>Tlačiareň, vizitky, letáky, polep auta. Vektor, ľubovoľná veľkosť.</td></tr>
      <tr><td><code>01_tlac_vektory/eps</code></td><td>EPS, CMYK</td><td>Staršie tlačové a reklamné štúdiá, rezanie fólií, gravírovanie.</td></tr>
      <tr><td><code>01_tlac_vektory/svg</code></td><td>SVG, RGB</td><td>Web, kódovanie, Figma, Illustrator, Inkscape. Úprava farieb pre obrazovku.</td></tr>
      <tr><td><code>02_web_rastre/png</code></td><td>PNG, priehľadné</td><td>Prezentácie, dokumenty, sociálne siete. 3 veľkosti, orezané bez okraja.</td></tr>
      <tr><td><code>02_web_rastre/jpg</code></td><td>JPG, s pozadím</td><td>Všade, kde priehľadnosť nefunguje. Obsahuje ochrannú zónu.</td></tr>
      <tr><td><code>02_web_rastre/favicon</code></td><td>ICO, SVG, PNG</td><td>Ikona v prehliadači, Apple touch ikona (180 px), PWA ikony 192 a 512 px, maskovateľná ikona.</td></tr>
      <tr><td><code>02_web_rastre/socialne-siete</code></td><td>PNG, JPG</td><td>OG obrázok pre zdieľanie odkazu (1200×630), profilová fotka (1080×1080, bezpečná pre kruh).</td></tr>
      </table>
      <h2 style="margin-top:8mm">Názvy súborov</h2>
      <p><code>djweby-logo_*</code> hlavné logo s menom · <code>djweby-napis_*</code> bez mena · <code>djweby-symbol_*</code> kláves.<br>
      Farby: <code>farebne</code> na svetlom · <code>negativ</code> na tmavom · <code>biele</code> na modrej alebo fotke · <code>cierne</code> jednofarebná tlač.</p>''', 8))
    # 9 proces
    steps = [("1 · BRIEFING", "Cieľová skupina: malé a stredné firmy a živnostníci na Slovensku. Hodnoty: prémiová kvalita, rýchlosť, výsledky. Konkurencia: generické logá so zátvorkami &lt;/&gt;, ktorým sa vyhýbame."),
             ("2 · MOODBOARD", "Vychádza z existujúceho webu djweby.sk: tmavé pozadie #050505, modrá #3B82F6, písmo Inter. Značka a web hovoria rovnakým jazykom."),
             ("3 · SKICE", "Viac ako 15 konceptov: monogramy, kurzor, okno prehliadača, šípka rastu, domino, abstraktné pixely. Vybraný: j ako kláves Enter."),
             ("4 · VEKTOR", "Písmená prevedené na krivky a vlastný tvar j↵ geometricky skonštruovaný s booleovskými operáciami. Žiadne živé písmo ani bitmapa."),
             ("5 · TESTY", "Favicon 16 a 32 px, čiernobiela verzia, negatív, kontrast na modrej. Odlíšenie od podobných značiek kontrastom hrúbok dj a weby."),
             ("6 · EXPORT", "Vektory PDF a EPS v CMYK, SVG v RGB, PNG s priehľadným pozadím, JPG, favicony, podklady pre sociálne siete a tento manuál.")]
    st = "".join(f'<div class="step"><b>{a}</b><p>{b}</p></div>' for a, b in steps)
    P.append(page(f'''<div class="kick">08 · Ako logo vzniklo</div><h1>Proces v šiestich krokoch</h1>
      <div class="steps" style="margin-top:8mm">{st}</div>
      <div style="margin-top:9mm;padding:6mm 8mm;border-left:3px solid #3B82F6;background:#F3F4F6;border-radius:0 3mm 3mm 0">
      <p style="font-style:italic;color:#111827">Dobré logo nerobí to, čo sa v ňom nachádza, ale to, čo z neho bolo odobraté.</p></div>''', 9))
    html = f'<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>djweby, dizajn manuál</title><style>{CSS}</style></head><body>{"".join(P)}</body></html>'
    d = mk("03_dizajn_manual"); hp = os.path.join(d, "djweby-dizajn-manual.html"); open(hp, "w").write(html)
    import subprocess
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();"
          f"await p.goto('file://{hp}');await p.waitForTimeout(400);"
          f"await p.pdf({{path:'{os.path.join(d, 'djweby-dizajn-manual.pdf')}',width:'297mm',height:'210mm',printBackground:true}});await b.close();}})();")
    subprocess.run(["node", "-e", js], check=True)
    print("manual ok")

if __name__ == "__main__":
    build()
