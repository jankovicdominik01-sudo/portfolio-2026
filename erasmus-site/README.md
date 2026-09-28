# Erasmus+ Mersin 2026 · Slovak team

A small static site for the Erasmus+ youth exchange *Young Ambassadors of Ecological
Agriculture* (Mezitli / Mersin, 8–14 October 2026), built by the team from SSOŠP Senica.

| URL | What |
| --- | --- |
| `/` | hub: choose a presentation (hover to preview, click for a cinematic transition; keys `←` `→` `Enter`, `1`, `2`) |
| `/slovakia/` | **Slovakia & Senica** — who we are (the original deck from `../erasmus-deck`, unchanged, plus a faint *← Hub* control) |
| `/agriculture/` | **Back to Soil?** — an interactive documentary: soil → agriculture → food → waste → recovery → back to soil |

## Build

```
cd erasmus-site
npm install
npm run build          # → dist/
```

`dist/` is a plain static folder. Upload it as it is to any static host (the live site is the
Vercel project behind erasmus.djweby.sk; `dist/vercel.json` turns on trailing slashes), or copy
it to a USB stick and double-click `index.html` — every page inlines its fonts, CSS and JS and
links to the others with relative paths, so it works fully offline.

## Presenting the agriculture deck

| Key | Action |
| --- | --- |
| `→` `Space` `PageDown` `Enter` (clicker) | next step / scene |
| `←` `PageUp` | back (a scene you go back into shows its final state) |
| `F` | fullscreen |
| `N` | presenter note for the current scene |
| `S` | all sources, grouped A–E |
| `M` / `Esc` | menu: jump to any scene, switch presentation (asks twice), back to the hub |
| `Home` `End` | first / last scene · `#s7` in the URL opens scene 7 |

Every coloured pill opens that source: who says it, when, the context, what we use it for and
what we do **not** claim. Shape and colour show the level: ● our own research · ■ official or
peer-reviewed · ◆ journalism · ▲ industry view · ○ explainers, blogs and team notes.

Click any photo for the full-screen view. Scenes with simulations say so on screen
("illustration", "visualisation — not a time-lapse").

## Adding our own photos (no code changes)

| Folder | Appears in |
| --- | --- |
| `assets/agriculture/ecofarm/` | scene 09, Family EcoFarm No. 5 (from the farm's Facebook, used with permission) |
| `assets/agriculture/field/` | scene 19, our visit to the Senica composting plant on 30 September |

Drop `.jpg`/`.webp` files in (they are used in file-name order; for scene 19 the slots are:
reception, shredder, hygienisation container, EWA fermenter, windrow, thermometer, turner,
screen, compost in a hand, what they sort out). Optional `captions.json` next to them:

```json
{ "01-reception.jpg": { "caption": "Weighing the trucks at the gate", "credit": "Photo: our team" } }
```

Then `npm run build` again. Keep photos under ~2000 px wide.

## Code map

```
src/hub/index.html              hub page (fonts inlined at build)
src/hub/deck-nav.html           the small hub control added to /slovakia
src/agriculture/index.html      stage skeleton and overlays
src/agriculture/engine.js       navigation, steps, source drawer, menu, lightbox, notes
src/agriculture/sources.js      every source, its level and what we do / don't claim
src/agriculture/scenes/act1-5   the 21 scenes (HTML + GSAP timelines per step)
src/agriculture/lib/            soil & landscape canvases, Three.js digester, helpers
assets/agriculture/img/         photos (Wikimedia Commons, credits.json) and Sentinel-2 crops
```

Libraries: GSAP 3 (with MotionPath, MorphSVG, DrawSVG), Three.js (scene 15 only), fonts
Fraunces and IBM Plex. Satellite images: Sentinel-2 cloudless by EOX (contains modified
Copernicus Sentinel data).
