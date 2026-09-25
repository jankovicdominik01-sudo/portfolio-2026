# Slovakia · Senica · SSOŠP — Erasmus+ deck

A 14-slide, English-language presentation for the Erasmus+ visit to Turkey:
Slovakia → Senica → our school (Súkromná stredná odborná škola podnikania) → Erasmus+.

The finished deck is **`public/erasmus/index.html`** (served at `/erasmus/index.html`).
It is one self-contained file (fonts, styles, map and code inlined) plus the photos in
`public/erasmus/img/`. Copy the whole `public/erasmus/` folder to a USB stick and it runs
offline in any modern browser (Chrome or Edge recommended).

## Presenting

| Key | Action |
| --- | --- |
| `→` `Space` `PageDown` (clicker) | next slide |
| `←` `PageUp` | previous slide |
| `F` | fullscreen |
| `N` | speaker notes (simple English, one per slide) |
| `C` | photo credits |
| `1`–`9`, `Home`, `End` | jump |

Clicking the right side of the screen also advances; the chapter names at the top are clickable.
Slide 6 plays a short map zoom (Europe → Slovakia → Trnava Region → Senica); wait ~5 s before moving on.

**Host city:** the final route ends at Istanbul and is labelled "Turkey". To point it at your
actual host city, edit `DESTINATION` at the top of `src/deck.js` and rebuild.

## Editing

```
erasmus-deck/src/index.html   slide markup and speaker notes
erasmus-deck/src/deck.css     design tokens and layout
erasmus-deck/src/deck.js      navigation, map camera, animations
erasmus-deck/src/credits.json photo credits shown with C
node erasmus-deck/build.mjs   rebuilds public/erasmus/index.html
```

`tools/build_map.py` regenerates `src/map-data.json` from Natural Earth data;
`tools/photos.json` lists every Wikimedia Commons photo with its source and licence.

## Sources for the facts used

- School: [ssosp.sk](https://ssosp.sk/) (O škole, Odbory, Hlavné predmety, Študentská firma): founded 1999, 4-year study with maturita, 1,600+ graduates, the two study programmes, Omega accounting software, Cisco classroom, student company NOVA.
- Senica: [Wikipedia (sk)](https://sk.wikipedia.org/wiki/Senica), [Wikipedia (en)](https://en.wikipedia.org/wiki/Senica): population 18,970 (31 Dec 2025), 208 m, town rights 1396, manor house 1760 (Záhorská galéria), Kunov reservoir 65 ha.
- Nearby: [Branč Castle](https://en.wikipedia.org/wiki/Branč_Castle) (1251–1261), [Holíč Castle](https://en.wikipedia.org/wiki/Holíč_Castle) (Habsburg residence after 1736), [Bradlo mound](https://sk.wikipedia.org/wiki/Mohyla_Milana_Rastislava_%C5%A0tef%C3%A1nika_(Bradlo)) (Dušan Jurkovič, 1928), [Šaštín basilica](https://slovakia.travel/en/national-pilgrimage-to-our-lady-of-seven-sorrows-in-sastin) (national pilgrimage site).
- Distances are straight-line values computed from the map data (Czech border 15.6 km).
- Turkey: population 85.7 million and median age 34.4 (TÜİK, end of 2024); 4+4+4 compulsory schooling; Hıdrellez (UNESCO, 2017).
