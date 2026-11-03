# djweby: logo a exporty

Logo pre **djweby.sk** (Dominik Jankovič). Podrobné pravidlá sú v [dizajn manuáli](03_dizajn_manual/djweby-dizajn-manual.pdf).

- **dj** = Dominik Jankovič (hrubý rez), **weby** = čo robím (tenký rez)
- **j = kláves Enter ↵**: písmeno aj symbol („stlač Enter, tvoj web je online“)
- **Symbol**: modrá klávesa `dj↵` (favicon, app ikona, profilovka)

## Farby

| Farba | HEX | RGB | CMYK |
|---|---|---|---|
| Enter modrá | `#3B82F6` | 59/130/246 | 75/52/0/0 |
| Nočná čierna | `#0A0A0A` | 10/10/10 | 0/0/0/100 |
| Pozadie webu | `#050505` | 5/5/5 | 60/40/40/100 |
| Sivá (podtitul na svetlom) | `#6B7280` | 107/114/128 | 0/0/0/65 |
| Svetlá sivá (podtitul na tmavom) | `#8B93A1` | 139/147/161 | 0/0/0/45 |

## Súbory

| Priečinok | Čo tam je |
|---|---|
| `01_tlac_vektory/pdf`, `eps` | Tlač, CMYK, vektor (tlačiareň, polep, gravír) |
| `01_tlac_vektory/svg` | Web a úpravy, RGB, vektor |
| `02_web_rastre/png` | Priehľadné PNG v 3 veľkostiach |
| `02_web_rastre/jpg` | JPG s pozadím a ochrannou zónou |
| `02_web_rastre/favicon` | `favicon.ico/.svg`, Apple touch, PWA 192/512, maskovateľná |
| `02_web_rastre/socialne-siete` | OG obrázok 1200×630, profilovka 1080×1080 |
| `03_dizajn_manual` | Manuál (PDF a HTML) |

Varianty: `logo` (s menom), `napis` (bez mena), `symbol`. Farby: `farebne` (na svetlom),
`negativ` (na tmavom), `biele` (na modrej alebo fotke), `cierne` (jednofarebná tlač).

## Pregenerovanie

Všetko je generované kódom z `_zdroj/` (písmená prevedené na krivky, nie je to živé písmo):

```bash
pip install skia-pathops fonttools cairosvg pillow   # + písmo Inter (OFL) v /usr/share/fonts/opentype/inter
cd _zdroj && python3 generuj.py && python3 manual.py # manual.py potrebuje Node + playwright
```

Písmo Inter je pod licenciou SIL Open Font License 1.1, ktorá dovoľuje použitie v logu.
