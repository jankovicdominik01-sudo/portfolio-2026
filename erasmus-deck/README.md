# Slovakia · Senica · SSOŠP — Erasmus+ deck

A 14-slide, English-language presentation for the Erasmus+ visit to Turkey:
Slovakia → Senica → our school (Súkromná stredná odborná škola podnikania) → Erasmus+.

This deck is part of the Erasmus+ Mersin 2026 site (see `erasmus-site/README.md`),
where it is served at **`/slovakia`** next to the hub and the agriculture deck.
The build writes one self-contained file (fonts, styles, map and code inlined) plus the
photos from `erasmus-deck/img/` into `erasmus-site/dist/slovakia/`, which runs offline in
any modern browser (Chrome or Edge recommended).

## Presenting

The deck opens on a one-minute **intro film** (Spiš Castle from the air, the High Tatras,
Bratislava on the Danube, folk traditions — with fujara music). Press `→` or click to play it
with sound; `→` again skips it. When it ends, the deck cuts straight to the cover: the film's
last frame is the cover photo.

| Key | Action |
| --- | --- |
| `→` `Space` `PageDown` (clicker) | next slide |
| `←` `PageUp` | previous slide |
| `F` | fullscreen |
| `P` | **presenter view**: a second window with the speaker notes (with a Slovak translation on request), the next slide and a timer. Put the deck on the projector, keep this window on the laptop; its buttons and arrow keys drive the deck. |
| `N` | speaker notes on the main screen |
| `C` | photo and film credits |
| `1`–`9`, `Home`, `End` | jump |

**Photos:** click any photo to open it full screen (sharper copies from `img/full/` are used
when available); `←` `→` browse the photos of that slide, `Esc` closes. Full-screen background
photos have a small ⤢ button in the top-right corner.

Slide 7 (Senica) plays a short map zoom (Europe → Slovakia → Trnava Region → Senica); wait ~5 s before moving on.

**Hockey 2002 (slide 6):** the slide plays `media/hockey-2002.mp4` if that file exists — save
the clip of the final under exactly that name and it plays inside the deck, offline. Without
it, the slide offers a "Find it on YouTube" button (needs internet). Broadcast footage is
copyrighted, so it is not included here.

**Host city:** the route on the map ends at Istanbul and is labelled "Turkey". To point it at your
actual host city, edit `DESTINATION` at the top of `src/deck.js` and rebuild.

## Editing

```
erasmus-deck/src/index.html   slide markup and speaker notes
erasmus-deck/src/deck.css     design tokens and layout
erasmus-deck/src/deck.js      navigation, map camera, animations
erasmus-deck/src/credits.json photo credits shown with C
node erasmus-deck/build.mjs   rebuilds erasmus-site/dist/slovakia (or pass --out <dir>)
erasmus-deck/img/             photos (img/full/: sharper copies for the lightbox)
erasmus-deck/media/           intro.mp4 + intro-poster.jpg (the film), hockey-2002.mp4 (optional)
python3 erasmus-deck/tools/make_intro.py <raw> <fonts>   re-renders the intro film (see the script)
```

`tools/build_map.py` regenerates `src/map-data.json` from Natural Earth data;
`tools/photos.json` lists every Wikimedia Commons photo with its source and licence.

## Sources for the facts used

- School: [ssosp.sk](https://ssosp.sk/) (O škole, Odbory, Hlavné predmety, Študentská firma): founded 1999, 4-year study with maturita, 1,600+ graduates, the two study programmes, Omega accounting software, Cisco classroom, student company NOVA.
- Senica: [Wikipedia (sk)](https://sk.wikipedia.org/wiki/Senica), [Wikipedia (en)](https://en.wikipedia.org/wiki/Senica): population 18,970 (31 Dec 2025), 208 m, town rights 1396, manor house 1760 (Záhorská galéria), Kunov reservoir 65 ha.
- Nearby: [Branč Castle](https://en.wikipedia.org/wiki/Branč_Castle) (1251–1261), [Holíč Castle](https://en.wikipedia.org/wiki/Holíč_Castle) (Habsburg residence after 1736), [Bradlo mound](https://sk.wikipedia.org/wiki/Mohyla_Milana_Rastislava_%C5%A0tef%C3%A1nika_(Bradlo)) (Dušan Jurkovič, 1928), [Šaštín basilica](https://slovakia.travel/en/national-pilgrimage-to-our-lady-of-seven-sorrows-in-sastin) (national pilgrimage site).
- Distances are straight-line values computed from the map data (Czech border 15.6 km).
- Turkey: population 85.7 million and median age 34.4 (TÜİK, end of 2024); 4+4+4 compulsory schooling; Hıdrellez (UNESCO, 2017).
