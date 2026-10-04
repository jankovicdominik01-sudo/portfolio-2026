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

22 scenes (+2 backup scenes in the menu), ~23 min of speaking. Four presenters:
Dominik, Adam, Sara, Karolína. **Print `agriculture/script.html`** (menu → *Speaker script*):
presenter map, timings, and step-by-step notes for every scene.

| Key | Action |
| --- | --- |
| `→` `Space` `PageDown` `Enter` (clicker), wheel / touchpad | next step (one gesture = one step, never two) |
| `←` `PageUp` | back |
| `P` | **presenter window**: notes for the current step, timers, next scene, buttons (works offline too) |
| `F` | fullscreen · `B` black screen · `G` scene overview · `12` `Enter` go to scene 12 |
| `S` | our research: all sources by level + photo log · `N` notes on the projector (avoid) |
| `M` / `Esc` | menu · `Home` `End` first / last scene · `#s7.2` in the URL = scene 7, step 2 (a refresh resumes) |

Source pills: ● our field visit · ◉ interview / operator data · ■ official · ◆ journalism · ▲ industry · ○ explainer.
Photo labels: ● confirmed in writing · ○ in our photo · ◌ our interpretation · ? unknown.

## Our field material

| Folder | What |
| --- | --- |
| `assets/agriculture/field/` | Senica composting plant, 30 Sep 2026 (photos by our teacher Martin Woznica, from the team chat) |
| `assets/agriculture/coop/` | photos + captions shared by the farming cooperative in Senica (2 Oct 2026) |

`tools/prepare_photos.py` converts raw copies into these WebP files. `docs/01-AUDIT-A-PLAN.md`
has the audit, evidence inventory and fact check.

## QA

```
python3 tools/qa_shots.py http://localhost:4173 /tmp/shots [--engine webkit]   # every step, final state
python3 tools/qa_nav.py   http://localhost:4173 /tmp/shots /tmp/nav            # hammering, wheel, back, refresh
```

## Code map

```
src/hub/index.html              hub page (fonts inlined at build)
src/agriculture/engine.js       navigation, presenter link, sources, menu, overview, lightbox
src/agriculture/notes.js        speaker script (presenter, time, level, notes per step)
src/agriculture/sources.js      every source, its level and what we do / don't claim
src/agriculture/evidence.js     photo log
src/agriculture/scenes/act1-5   the 22 scenes · scenes/backup.js the 2 backup scenes
src/agriculture/lib/photo.js    annotated photos: camera moves, labels with evidence status, loupes
src/agriculture/lib/rail.js     the "follow one load" station rail
src/agriculture/presenter.html  presenter window
tools/render-script.mjs         printable speaker script + presenter map
```
