// ACT V · BACK TO SOIL — scenes 19–21
import { gsap } from "gsap";
import { stepper, $, $$, svg } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";
import { createSoil } from "../lib/soil.js";

/* global __ASSETS__ */
const ASSETS = typeof __ASSETS__ !== "undefined" ? __ASSETS__ : { ecofarm: [], field: [] };

// ---------------------------------------------------------------- 19
// Field visit slot. Photos dropped into assets/agriculture/field/ (see README)
// fill these slots automatically at build time, in this order.
const SHOTS = ["Reception & weighing", "Shredder", "Hygienisation container", "EWA fermenter", "Windrow", "Thermometer", "Turner", "Screen", "Compost in a hand", "What they sort out"];
const PROCESS = [
  ["Reception", "Weighing, a visual check, records"],
  ["Preparation", "Wood is chipped; kitchen waste mixed 2 : 1 with green waste"],
  ["Hygienisation", "Kitchen waste: at least 1 hour at 70 °C"],
  ["Composting", "EWA fermenter or windrows, 45–70 °C, turned · 3–5 months"],
  ["Screening", "Checked to STN 46 5735; rejects go to an authorised company"],
  ["Compost", "650–800 t a year for gardens and town greenery"]
];
const field = ASSETS.field || [];
const s19 = stepper({
  id: "s-fieldvisit", title: "Field visit: Senica composting plant", loop: 5, steps: 3,
  notes: "Told by the students who were there on 30 September 2026. Before the visit, everything here comes from the operator's email of 23 September. Our own photos fill the frames.",
  html: `
    <div class="s19-head"><span class="stamp s19-stamp fx">Field research · 30 September 2026 · 9:00</span>
      <h2 class="head split">Senica composting plant</h2>
      <p class="sub fx">Technické služby Senica · capacity 4,200 t a year · 3,327 t taken in during 2025</p></div>
    <ol class="s19-proc">${PROCESS.map((p, i) => `<li class="fx"><b>${String(i + 1).padStart(2, "0")} · ${p[0]}</b><span>${p[1]}</span></li>`).join("")}</ol>
    <div class="s19-therm fx"><svg viewBox="0 0 120 520" aria-hidden="true"><rect x="45" y="20" width="30" height="430" rx="15" class="tube"/><rect x="52" y="440" width="16" height="0" class="merc"/><circle cx="60" cy="470" r="36" class="bulb"/><rect x="20" y="${440 - 70 * 5}" width="8" height="${25 * 5}" class="band"/></svg>
      <p class="big"><span class="num">0</span> °C</p><p class="mono">at least 1 hour for kitchen waste · operator data</p></div>
    <div class="s19-gal">${SHOTS.map((s, i) => field[i]
      ? `<figure class="shot has"><img src="${field[i].src}" data-lightbox="field" data-caption="${field[i].caption || s}" alt="${field[i].caption || s}"><figcaption class="mono">${field[i].caption || s}</figcaption></figure>`
      : `<figure class="shot empty"><div><span class="mono">${String(i + 1).padStart(2, "0")}</span><b>${s}</b><em class="mono">our photo · 30 Sep</em></div></figure>`).join("")}</div>
    <div class="s19-mass">
      <div class="io fx"><p class="big">3,327 t</p><p class="mono">in · 2025</p></div>
      <div class="arrow fx"><svg viewBox="0 0 600 120"><path d="M0 60H560" class="a"/><path d="M540 30L580 60L540 90" class="a"/></svg><p class="q">What happens to the difference?</p></div>
      <div class="io fx"><p class="big">650–800 t</p><p class="mono">compost out · per year</p></div>
      <div class="qs fx"><p class="kicker">Our questions on site</p><ul><li>How much leaves as water vapour and CO₂?</li><li>How many tonnes of rejects are sorted out?</li><li>Which of the 12 permitted waste codes do you really process?</li><li>What would help most — from us, the residents?</li></ul></div>
    </div>
    <div class="s19-src">${pills("tssenica", "fieldvisit")}</div>`,
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s19-stamp"), { autoAlpha: 0, scale: 2, rotation: -6 }, { autoAlpha: 1, scale: 1, rotation: -2, duration: 0.45, ease: "power4.in", immediateRender: false }, 0);
      head(tl, $(el, ".s19-head .head"), 0.4);
      up(tl, [$(el, ".s19-head .sub"), $(el, ".s19-src")], 0.6);
      up(tl, $$(el, ".s19-proc li"), 1, { s: 0.2 });
      fade(tl, $(el, ".s19-therm"), 1.6);
      tl.fromTo($(el, ".merc"), { attr: { y: 440, height: 0 } }, { attr: { y: 440 - 70 * 5, height: 70 * 5 }, duration: 2.4, ease: "power2.out", immediateRender: false }, 1.8);
      count(tl, $(el, ".s19-therm .num"), 70, 1.8, { d: 2.4 });
    },
    (tl, el) => {
      tl.to([$(el, ".s19-proc"), $(el, ".s19-therm")], { autoAlpha: 0, y: -20, duration: 0.5 }, 0)
        .fromTo($$(el, ".shot"), { autoAlpha: 0, y: 40, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: "power3.out", immediateRender: false }, 0.3);
    },
    (tl, el) => {
      tl.to($(el, ".s19-gal"), { autoAlpha: 0, duration: 0.5 }, 0);
      up(tl, $$(el, ".s19-mass > *"), 0.3, { s: 0.35 });
      tl.fromTo($$(el, ".s19-mass .a"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1, immediateRender: false }, 0.8);
    }
  ]
});

// ---------------------------------------------------------------- 20
const s20 = stepper({
  id: "s-vertical", title: "Future agriculture?", loop: 5, steps: 3,
  notes: "A possible direction, not a replacement for soil. The 28 m² figure is for powering a 9-layer farm with solar panels (van Delden et al., Nature Food 2021).",
  html: `
    <div class="s20-text"><p class="kicker fx">One direction people talk about</p><h2 class="head split">Future agriculture? <em>Vertical farms</em></h2></div>
    <svg class="s20-svg" viewBox="0 0 1920 1080" aria-label="A 9-layer vertical farm next to the solar area it would need">
      <g class="bld"></g><g class="pv"></g>
      <line x1="0" y1="900" x2="1920" y2="900" class="gl"/>
    </svg>
    <ul class="s20-pm">
      <li class="plus fx"><b>+</b> Water and nutrients recirculate: use efficiency can approach 100 %</li>
      <li class="plus fx"><b>+</b> No erosion, no weather, close to the city</li>
      <li class="minus fx"><b>−</b> Plants need light — and LEDs need a lot of electricity</li>
    </ul>
    <div class="s20-pv fx"><p class="big"><span class="num">1</span> m²</p><p>of land with a 9-layer farm would need about <b>28 m² of solar panels</b> to power it.</p></div>
    <p class="s20-blog small fx">Companies actively promote vertical farms. We use peer-reviewed numbers instead of their percentages.</p>
    <div class="s20-src">${pills(["naturefood", "Peer-reviewed · Nature Food 2021"], ["dnblog", "Company blog · promotion"])}</div>
    <span class="visnote s20-vis">To scale: each tile = 1 m²</span>`,
  setup(el) {
    const b = $(el, ".bld"), p = $(el, ".pv");
    const T = 44, bx = 300, by = 900 - 9 * T;
    svg("rect", { x: bx - 6, y: by - 16, width: T + 12, height: 9 * T + 16, class: "shell" }, b);
    for (let i = 0; i < 9; i++) {
      svg("rect", { x: bx, y: by + i * T, width: T, height: T - 4, class: "layer" }, b);
      svg("rect", { x: bx + 2, y: by + i * T + 2, width: T - 4, height: 4, class: "led" }, b);
      for (let k = 0; k < 4; k++) svg("circle", { cx: bx + 7 + k * 10, cy: by + i * T + T - 12, r: 5, class: "plant20" }, b);
    }
    svg("text", { x: bx + T / 2, y: 940, "text-anchor": "middle", class: "lab20" }, b).textContent = "1 m² · 9 layers";
    for (let i = 0; i < 28; i++) {
      const c = i % 7, r = Math.floor(i / 7);
      svg("rect", { x: 700 + c * (T + 6), y: 900 - (r + 1) * (T + 6), width: T, height: T, class: "tile" }, p);
    }
    svg("text", { x: 700 + 3.5 * (T + 6), y: 940, "text-anchor": "middle", class: "lab20 pvlab" }, p).textContent = "≈ 28 m² of solar panels";
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s20-text .head"), 0);
      up(tl, [$(el, ".s20-text .kicker"), $(el, ".s20-src")], 0.2);
      tl.fromTo($$(el, ".bld .layer, .bld .led, .bld .plant20"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, stagger: 0.01, immediateRender: true }, 0.4)
        .fromTo($$(el, ".bld .shell, .bld .lab20"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: true }, 0.3);
      up(tl, $$(el, ".s20-pm li"), 1, { s: 0.4 });
    },
    (tl, el) => {
      tl.fromTo($$(el, ".tile"), { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.07, ease: "back.out(2)", immediateRender: true }, 0.2)
        .fromTo($(el, ".pvlab"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: true }, 2.2);
      up(tl, [$(el, ".s20-pv"), $(el, ".s20-vis")], 0.2);
      count(tl, $(el, ".s20-pv .num"), 28, 0.2, { from: 1, d: 2 });
    },
    (tl, el) => { up(tl, $(el, ".s20-blog"), 0); }
  ]
});

// ---------------------------------------------------------------- 21
const LESSONS = [
  ["Soil is alive", "and it takes years to rebuild — Dubina needed about nine to show change."],
  ["Landscape is protection", "hedges, strips and mosaics hold water, soil and wildlife."],
  ["Good farms still struggle", "drought and economics hit even the careful ones."],
  ["Waste is a resource only when it's clean", "one wrong item travels all the way to the soil."],
  ["Renewable ≠ impact-free", "operation, leaks and the right process decide the result."]
];
let soil21;
const s21 = stepper({
  id: "s-backtosoil", title: "Back to soil", loop: 5, steps: 3,
  notes: "End with the question to our hosts: what does this loop look like in Mersin? Then open the Sources (S) if there are questions.",
  html: `
    <canvas class="s21-soil" aria-hidden="true"></canvas>
    <div class="s21-shade"></div>
    <div class="s21-lessons"><p class="kicker fx">What we learned</p><ol>${LESSONS.map((l, i) => `<li class="fx"><span class="mono">${String(i + 1).padStart(2, "0")}</span><b>${l[0]}</b> — ${l[1]}</li>`).join("")}</ol></div>
    <svg class="s21-ring" viewBox="0 0 1920 1080" aria-hidden="true"><path d="M960 140a190 190 0 1 1 0 380a190 190 0 1 1 0 -380" class="r"/><circle r="10" class="dot21"/></svg>
    <div class="s21-final"><p class="mega s21-m split">Back to <em>soil.</em></p><p class="s21-sys fx">Environmental sustainability is not one technology. <b>It is a system.</b></p></div>
    <figure class="s21-worm fx"><img src="img/earthworm.webp" data-lightbox="end" alt="An earthworm in straw mulch" data-caption="An earthworm in mulch — soil life at work. Photo: USDA NRCS South Dakota · public domain · Wikimedia Commons"><figcaption class="mono">Soil life · USDA NRCS · public domain</figcaption></figure>
    <div class="s21-ask fx">
      <p class="quote">What does this loop look like in <em>Mersin?</em></p>
      <div class="s21-btns"><button class="b-src interactive">Sources</button><button class="b-top interactive">↺ Back to the start</button><a class="b-hub" href="../index.html">Erasmus hub</a></div>
    </div>`,
  setup(el, ctx) {
    soil21 = createSoil($(el, ".s21-soil"), { quality: ctx.quality, surface: 620 });
    $(el, ".b-src").onclick = (e) => { e.stopPropagation(); ctx.openSources(); };
    $(el, ".b-top").onclick = (e) => { e.stopPropagation(); ctx.goto(0); };
  },
  timelines: [
    (tl, el) => { up(tl, [$(el, ".s21-lessons .kicker"), ...$$(el, ".s21-lessons li")], 0.1, { s: 0.3 }); },
    (tl, el) => {
      tl.to($(el, ".s21-lessons"), { autoAlpha: 0, y: -30, duration: 0.6 }, 0)
        .fromTo($(el, ".s21-ring .r"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 2, ease: "power2.inOut", immediateRender: true }, 0.3)
        .fromTo($(el, ".dot21"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: true }, 0.3)
        .to($(el, ".dot21"), { motionPath: { path: $(el, ".s21-ring .r"), align: $(el, ".s21-ring .r"), alignOrigin: [0.5, 0.5], start: 0.25, end: 1.25 }, duration: 2.4, ease: "power1.inOut" }, 0.3)
        .to($(el, ".dot21"), { y: "+=400", autoAlpha: 0, duration: 1, ease: "power2.in" }, 2.7)
        .fromTo($(el, ".s21-soil"), { autoAlpha: 0, y: 200 }, { autoAlpha: 1, y: 0, duration: 2, ease: "power2.out", immediateRender: true }, 2.5)
        .fromTo(soil21.state, { roots: 0, water: 0 }, { roots: 1, water: 0.8, duration: 5, immediateRender: true }, 2.8)
        .to($(el, ".s21-ring"), { autoAlpha: 0.25, duration: 1 }, 3);
      head(tl, $(el, ".s21-m"), 3);
      up(tl, $(el, ".s21-sys"), 4);
      fade(tl, $(el, ".s21-worm"), 4.6);
    },
    (tl, el) => {
      tl.to($(el, ".s21-final"), { y: -170, scale: 0.7, transformOrigin: "50% 0", duration: 1, ease: "expo.inOut" }, 0).to($(el, ".s21-worm"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, $(el, ".s21-ask"), 0.6);
    }
  ],
  onEnter() { soil21.start(); },
  onLeave() { setTimeout(() => soil21.stop(), 800); }
});

export default [s19, s20, s21];
