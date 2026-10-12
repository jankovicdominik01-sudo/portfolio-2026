# Slovakia · Senica · SSOŠP — Erasmus+ deck

A 14-slide, English-language presentation for the Erasmus+ visit to Turkey:
Slovakia → Senica → our school (Súkromná stredná odborná škola podnikania) → your turn.

This deck is part of the Erasmus+ Mersin 2026 site (see `erasmus-site/README.md`),
where it is served at **`/slovakia`** next to the hub and the agriculture deck.
The build writes one self-contained file (fonts, styles, map and code inlined) plus the
photos from `erasmus-deck/img/` into `erasmus-site/dist/slovakia/`, which runs offline in
any modern browser (Chrome or Edge recommended).

## Presenting

The deck opens on the film **This is Slovakia – top 30 places** (Hike The World, YouTube).
`→` plays it full screen; `→` again (or the end of the film) starts the presentation. `Space`
pauses, `Esc` goes back to the poster. Some browsers (Safari above all) won't start a film with
sound by themselves; the film then takes one click on its own ▶, after which the keyboard and
clicker drive the deck again. The film streams from YouTube, so it needs internet and the
online version (erasmus.djweby.sk). From a USB copy, clicking the poster opens the film on YouTube
— unless you save a copy next to the deck as `media/films/this-is-slovakia.mp4`; then it plays
inside the deck, offline.

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

**Sport (slide 6):** click the video to play the 2002 final, Slovakia – Russia 4:3 (TVfunasicek,
YouTube) full screen; Ľubomír Višňovský scores the first goal after 22 seconds. `Esc` shrinks it
back, `Space` pauses, `→` moves on. It streams from YouTube (internet needed); a copy saved as
`media/hockey-2002.mp4` plays instead, offline.

**Your turn (slide 13):** the audience tries to say Slovak words out loud. The slide shows one
word at a time; `→` reveals how to say it and what it means, `→` again brings the next word, `←`
steps back. Nine words, from *Ahoj* to *najneobhospodarovávateľnejší*. The rules (volunteers, the audience
picks the best) are only in the presenter notes, not on the slide.

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
erasmus-deck/media/           optional local copies of the films (media/films/*.mp4, media/hockey-2002.mp4)
```

`tools/build_map.py` regenerates `src/map-data.json` from Natural Earth data;
`tools/photos.json` lists every Wikimedia Commons photo with its source and licence.

## Sources for the facts used

- School: [ssosp.sk](https://ssosp.sk/) (O škole, Odbory, Hlavné predmety, Študentská firma): founded 1999, 4-year study with maturita, 1,600+ graduates, the two study programmes, Omega accounting software, Cisco classroom, student company NOVA.
- Senica: [Wikipedia (sk)](https://sk.wikipedia.org/wiki/Senica), [Wikipedia (en)](https://en.wikipedia.org/wiki/Senica): population 18,970 (31 Dec 2025), 208 m, town rights 1396, manor house 1760 (Záhorská galéria), Kunov reservoir 65 ha.
- Nearby: [Branč Castle](https://en.wikipedia.org/wiki/Branč_Castle) (1251–1261), [Holíč Castle](https://en.wikipedia.org/wiki/Holíč_Castle) (Habsburg residence after 1736), [Bradlo mound](https://sk.wikipedia.org/wiki/Mohyla_Milana_Rastislava_%C5%A0tef%C3%A1nika_(Bradlo)) (Dušan Jurkovič, 1928), [Šaštín basilica](https://slovakia.travel/en/national-pilgrimage-to-our-lady-of-seven-sorrows-in-sastin) (national pilgrimage site).
- Distances are straight-line values computed from the map data (Czech border 15.6 km).
