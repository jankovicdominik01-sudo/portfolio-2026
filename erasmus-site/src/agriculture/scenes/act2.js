// ACT II · AGRICULTURE — scenes 07–11 (two farms, real people)
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng } from "../lib/stepper.js";
import { head, up, fade, out, pills } from "../lib/fx.js";

/* global __ASSETS__ */
const ASSETS = typeof __ASSETS__ !== "undefined" ? __ASSETS__ : { ecofarm: [], field: [] };
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const HORSE = "M28 38C40 30 80 30 98 34C104 26 110 16 118 10L121 4L124 9C130 12 136 22 139 30C140 34 136 36 132 34C126 30 120 30 114 38C110 46 108 54 104 60L104 66L106 96L100 97L98 70L94 70L96 96L90 97L87 68C70 70 55 70 42 68L40 96L34 97L33 70L30 70L29 96L23 96L23 64C20 58 20 48 24 42C18 48 14 62 12 76C11 70 12 52 22 40Z";

// ---------------------------------------------------------------- 07
const STAGES = [
  ["Before", "60 years of intensive farming", "The farmer's own words for such land: “exhausted and ruined soils”."],
  ["2012", "Grass first", "Most of the field was grassed over."],
  ["Horses", "A herd grazes", "Grazing horses keep the grassland — and their manure feeds the soil."],
  ["Green manure", "Plants grown for the soil", "Green manure is grown to be returned to the soil."],
  ["No-till", "No ploughing", "Vegetables grow without ploughing, in horse manure and straw."],
  ["Food forest", "An edible forest", "Trees stop the wind and erosion, shade the soil — and give fruit."],
  ["+9 years", "Soil life returns", "Agroforester: after 9 years, an evident return of soil organisms and more organic matter."]
];
let master07;
const s07 = stepper({
  id: "s-dubina", title: "Statok Dubina: 60 years → 2012 → restoration", loop: 1, steps: 7,
  notes: "This is a visualisation of the process, not a time-lapse of the farm. Numbers of animals and plants are illustrative. The slider can be dragged. Stanislav's own voice message will be added when it arrives.",
  html: `
    <div class="s7-text"><p class="kicker fx">Farm story 1 · between Horné and Dolné Zelenice</p><h2 class="head split">Statok Dubina</h2>
      <p class="sub fx">8 ha of arable land · 60 years of intensive farming · restoration since 2012</p>
      ${pills("kzdubina", ["teamnotes", "Team notes · leads only"])}</div>
    <figure class="s7-inset fx"><img src="img/dubina-2024.webp" alt="Satellite image around Statok Dubina" data-lightbox="dubina" data-caption="Surroundings of Statok Dubina (pin). Sentinel-2 cloudless 2024 by EOX (contains modified Copernicus Sentinel data). 10 m pixels — for location only."><i class="pin7"></i><figcaption class="mono">Location · Sentinel-2 2024</figcaption></figure>
    <svg class="s7-pano" viewBox="0 0 1920 580" aria-label="Illustrated transformation of the farm"></svg>
    <div class="s7-cap"><p class="mono s7-cap-k"></p><p class="s7-cap-h"></p><p class="small s7-cap-p"></p></div>
    <div class="s7-time interactive fx"><div class="ticks">${STAGES.map((s, i) => `<span data-i="${i}">${s[0]}</span>`).join("")}</div><input type="range" min="0" max="6" step="0.01" value="0" aria-label="Scrub the transformation"></div>
    <span class="visnote s7-vis fx">Visualisation — not a time-lapse</span>`,
  setup(el) {
    const s = $(el, ".s7-pano"), R = rng(21), GY = 330;
    s.innerHTML = `<defs><linearGradient id="s7sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1712"/><stop offset="1" stop-color="#3b3122"/></linearGradient></defs>
      <rect width="1920" height="${GY}" fill="url(#s7sky)"/>`;
    const soil = svg("rect", { x: 0, y: GY, width: 1920, height: 250, fill: "#8a7a62", class: "soil" }, s);
    const life = svg("g", { class: "life", opacity: 0 }, s);
    for (let i = 0; i < 70; i++) {
      const x = R() * 1920, y = GY + 30 + R() * 200;
      if (R() < 0.35) svg("path", { d: `M${x} ${y}q10 -8 20 0t20 0`, stroke: "#c98f7a", "stroke-width": 3, fill: "none", "stroke-linecap": "round" }, life);
      else svg("circle", { cx: x, cy: y, r: 1.5 + R() * 2, fill: "#e8d8b8", opacity: 0.6 }, life);
    }
    const cracks = svg("g", { class: "cracks", stroke: "#cbb899", "stroke-width": 2, fill: "none" }, s);
    for (let i = 0; i < 22; i++) {
      let x = R() * 1920, y = GY + 2, d = `M${x} ${y}`;
      for (let k = 0; k < 6; k++) { x += (R() - 0.5) * 40; y += 10 + R() * 14; d += `L${x.toFixed(0)} ${y.toFixed(0)}`; }
      svg("path", { d }, cracks);
    }
    svg("rect", { x: 0, y: GY - 2, width: 1920, height: 4, fill: "#b9a888", class: "crust" }, s);
    const grass = svg("g", { class: "grass" }, s);
    for (let x = 0; x < 1920; x += 5) {
      const h = 14 + R() * 30;
      svg("path", { d: `M${x} ${GY}q${(R() - 0.5) * 8} ${-h / 2} ${(R() - 0.5) * 14} ${-h}`, stroke: `hsl(${80 + R() * 25},${35 + R() * 20}%,${38 + R() * 14}%)`, "stroke-width": 2, fill: "none" }, grass);
    }
    const manure = svg("g", { class: "gm" }, s);
    for (let i = 0; i < 70; i++) {
      const x = 520 + R() * 900, h = 40 + R() * 60, gg = svg("g", {}, manure);
      svg("path", { d: `M${x} ${GY}l${(R() - 0.5) * 10} ${-h}`, stroke: "#6f8f45", "stroke-width": 2 }, gg);
      for (let k = 0; k < 5; k++) svg("circle", { cx: x + (R() - 0.5) * 16, cy: GY - h - R() * 14, r: 3 + R() * 2.5, fill: R() < 0.7 ? "#9b86d6" : "#efe9dc" }, gg);
    }
    const mulch = svg("g", { class: "mulch" }, s);
    for (let x = 1060; x < 1600; x += 3) svg("path", { d: `M${x} ${GY + 2 - R() * 6}l${6 + R() * 10} ${(R() - 0.5) * 6}`, stroke: "#d8b872", "stroke-width": 2 }, mulch);
    for (let x = 1090; x < 1580; x += 46) { svg("circle", { cx: x, cy: GY - 14, r: 14, fill: "#7ea55a" }, mulch); svg("circle", { cx: x - 5, cy: GY - 18, r: 7, fill: "#9cc26e" }, mulch); }
    const horses = svg("g", { class: "horses" }, s);
    [[180, 1.25, 1], [420, 1.05, -1], [760, 1.15, 1]].forEach(([x, k, f]) => {
      const h = svg("g", { transform: `translate(${x} ${GY - 97 * k}) scale(${k * f} ${k})` }, horses);
      svg("path", { d: HORSE, fill: "#120d09" }, h);
    });
    const trees = svg("g", { class: "trees" }, s);
    [[120, 1], [300, 0.8], [1720, 1.1], [1850, 0.9], [1640, 0.75], [980, 0.7]].forEach(([x, k], i) => {
      const t = svg("g", { class: "tree", "data-x": x }, trees);
      svg("path", { d: `M${x} ${GY}l0 ${-150 * k}`, stroke: "#2d1f14", "stroke-width": 9 * k }, t);
      [[0, -170, 70], [-45, -140, 48], [48, -130, 52], [10, -215, 46]].forEach(([dx, dy, r]) => svg("circle", { cx: x + dx * k, cy: GY + dy * k, r: r * k, fill: i % 2 ? "#4f6a34" : "#5d7a3c" }, t));
      for (let f = 0; f < 6; f++) svg("circle", { class: "fruit", cx: x + (R() - 0.5) * 110 * k, cy: GY - (120 + R() * 90) * k, r: 5, fill: R() < 0.5 ? "#e0703f" : "#dcb45c" }, t);
      svg("ellipse", { cx: x, cy: GY + 8, rx: 60 * k, ry: 6, fill: "rgba(0,0,0,.25)" }, t);
    });
    // one master timeline 0…6; steps and the slider both drive its time
    master07 = gsap.timeline({ paused: true, onUpdate: () => caption(el, master07.time()) });
    master07.set({}, {}, 6);
    master07.to(soil, { attr: { fill: "#6f5d45" }, duration: 1 }, 0).to(cracks, { opacity: 0.35, duration: 1 }, 0)
      .fromTo(grass, { scaleY: 0 }, { scaleY: 1, svgOrigin: `0 ${GY}`, duration: 1, ease: "power2.out", immediateRender: true }, 0)
      .fromTo(horses, { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 1 }, 1)
      .to(soil, { attr: { fill: "#55432f" }, duration: 1 }, 2).to(cracks, { opacity: 0, duration: 1 }, 2)
      .fromTo(manure, { scaleY: 0 }, { scaleY: 1, svgOrigin: `0 ${GY}`, duration: 1, immediateRender: true }, 2)
      .fromTo(mulch, { opacity: 0 }, { opacity: 1, duration: 1, immediateRender: true }, 3)
      .to(manure, { opacity: 0.35, duration: 1 }, 3)
      .fromTo($$(s, ".tree"), { scale: 0 }, { scale: 1, svgOrigin: (i, t) => `${t.dataset.x} ${GY}`, duration: 0.8, stagger: 0.04, ease: "back.out(1.4)", immediateRender: true }, 4)
      .fromTo($$(s, ".fruit"), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.01, immediateRender: true }, 4.6)
      .to(soil, { attr: { fill: "#2e2217" }, duration: 1 }, 5).to(life, { opacity: 1, duration: 1 }, 5)
      .to($(s, ".crust"), { attr: { fill: "#3b2b1c" }, duration: 3 }, 1);
    const inp = $(el, ".s7-time input");
    inp.addEventListener("input", () => master07.pause().time(+inp.value));
    ["pointerdown", "click"].forEach((ev) => inp.addEventListener(ev, (e) => e.stopPropagation()));
    // pin on the satellite inset (dubina-2024: lon 17.715–17.785, lat 48.368–48.395)
    const p = $(el, ".pin7");
    p.style.left = ((17.749417 - 17.715) / 0.07) * 100 + "%";
    p.style.top = ((merc(48.395) - merc(48.381333)) / (merc(48.395) - merc(48.368))) * 100 + "%";
    caption(el, 0);
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s7-text .head"), 0);
      up(tl, [$(el, ".s7-text .kicker"), $(el, ".s7-text .sub"), $(el, ".s7-text .srcrow"), $(el, ".s7-inset"), $(el, ".s7-time"), $(el, ".s7-vis")], 0.3);
      tl.fromTo($(el, ".s7-pano"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.2, immediateRender: false }, 0.2);
    },
    ...[1, 2, 3, 4, 5, 6].map((i) => (tl) => tl.fromTo(master07, { time: i - 1 }, { time: i, duration: 2.4, ease: "power1.inOut", immediateRender: false }, 0))
  ],
  onEnter(el, ctx, dir, step) { if (dir > 0) master07.time(0); }
});
function caption(el, t) {
  const i = Math.max(0, Math.min(6, Math.round(t)));
  const inp = $(el, ".s7-time input");
  if (inp && document.activeElement !== inp) inp.value = t;
  if (el._cap === i) return;
  el._cap = i;
  const [k, h, p] = STAGES[i];
  $(el, ".s7-cap-k").textContent = String(i + 1).padStart(2, "0") + " · " + k;
  $(el, ".s7-cap-h").textContent = h;
  $(el, ".s7-cap-p").textContent = p;
  $$(el, ".ticks span").forEach((s) => s.classList.toggle("on", +s.dataset.i <= i));
  gsap.fromTo($(el, ".s7-cap"), { autoAlpha: 0.2, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.4 });
}

// ---------------------------------------------------------------- 08
const s08 = stepper({
  id: "s-stanislav", title: "“Exhausted and ruined soils…”", loop: 1, steps: 2,
  notes: "Read the quote slowly. Pause. Then the expert's observation — note it is an observation, not a measurement.",
  html: `
    <div class="s8-bg"></div>
    <blockquote class="quote s8-q split">It is exactly the exhausted and ruined soils that deserve the kindest, gentlest care — the kind that gives the soil its original life back.</blockquote>
    <p class="quote-by s8-by fx"><b>Stanislav</b>, farmer, Statok Dubina · quoted by BROZ / Krajina živá, 2022 · translated from Slovak</p>
    <div class="s8-expert fx">
      <p>“After 9 years of changed farming, there is an evident change: soil organisms are returning and there is more organic matter in the soil.”</p>
      <p class="quote-by"><b>Ing. Jaroslav Jankovič, CSc.</b>, agroforester, Krajina živá expert panel</p>
      <span class="stamp">Expert observation · not a measurement</span>
    </div>
    ${pills("kzdubina")}`,
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s8-bg"), { scale: 1.15, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 3, ease: "power2.out", immediateRender: false }, 0);
      head(tl, $(el, ".s8-q"), 0.4, { s: 0.14, d: 1.6 });
      up(tl, [$(el, ".s8-by"), $(el, ".srcrow")], 3.4);
    },
    (tl, el) => {
      tl.to($(el, ".s8-q"), { y: -150, scale: 0.8, transformOrigin: "0 0", opacity: 0.45, duration: 1.2, ease: "expo.inOut" }, 0)
        .to($(el, ".s8-by"), { y: -430, opacity: 0.45, duration: 1.2, ease: "expo.inOut" }, 0);
      up(tl, $(el, ".s8-expert"), 0.8);
    }
  ]
});

// ---------------------------------------------------------------- 09
const eco = ASSETS.ecofarm || [];
const ecoMain = eco[0];
const s09 = stepper({
  id: "s-ecofarm", title: "Family EcoFarm No. 5", loop: 1, steps: 2,
  notes: "Jozef Vince wrote back to us on 22 September 2026 — the same evening we asked. Photos from the farm's Facebook are used with his permission and credited.",
  html: `
    <div class="s9-photo">
      ${ecoMain
        ? `<img src="${ecoMain.src}" data-lightbox="ecofarm" data-caption="${ecoMain.caption}" alt="${ecoMain.caption}">`
        : `<img src="img/ecofarm-2024.webp" data-lightbox="ecofarm" data-caption="Family EcoFarm No. 5 near Galanta from above (ring). Sentinel-2 cloudless 2024 by EOX (contains modified Copernicus Sentinel data)." alt="Satellite image of the farm area"><i class="ring9"></i>`}
      <p class="mono s9-credit">${ecoMain ? ecoMain.credit || "Photo: Family EcoFarm No. 5 (used with permission)" : "Sentinel-2 · 2024 · the farm from above"}</p>
      ${eco.slice(1).map((p) => `<img class="s9-more" src="${p.src}" data-lightbox="ecofarm" data-caption="${p.caption}" alt="${p.caption}">`).join("")}
    </div>
    <div class="s9-side">
      <p class="kicker fx">Farm story 2 · near Galanta</p>
      <h2 class="head split">Family EcoFarm <em>No. 5</em></h2>
      <ul class="s9-facts">
        <li class="fx"><b>39,180 m²</b> a former vineyard, unused for about 30 years</li>
        <li class="fx"><b>24</b> kinds of vegetables · <b>25+</b> trees</li>
        <li class="fx"><b>Off-grid</b> solar power · groundwater · drip irrigation</li>
      </ul>
      ${pills("kzecofarm", "ecofarmweb")}
      <div class="s9-mail fx">
        <p class="mono s9-mh"><span>From: Ing. Jozef Vince</span><span>22 Sep 2026</span></p>
        <p class="mono dim">Reply to our 6 questions · translated from Slovak</p>
        <p class="s9-type"></p>
        <span data-src="vince"></span>
      </div>
    </div>`,
  setup(el) {
    if (!ecoMain) {
      const r = $(el, ".ring9"); // ecofarm-2024: lon 17.690–17.732, lat 48.184–48.203
      r.style.left = ((17.711087 - 17.69) / 0.042) * 100 + "%";
      r.style.top = ((merc(48.203) - merc(48.193255)) / (merc(48.203) - merc(48.184))) * 100 + "%";
    }
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s9-photo img"), { scale: 1.2, autoAlpha: 0 }, { scale: 1.04, autoAlpha: 1, duration: 3, ease: "power2.out", immediateRender: false }, 0);
      head(tl, $(el, ".s9-side .head"), 0.3);
      up(tl, [$(el, ".s9-side .kicker"), ...$$(el, ".s9-facts li"), $(el, ".s9-side .srcrow")], 0.5, { s: 0.15 });
    },
    (tl, el) => {
      const text = "“It was a primary decision when we founded the farm: we wanted to be organic, because we believe that caring for soil and plants can be done without aggressive chemistry.”";
      const p = $(el, ".s9-type"), o = { n: 0 };
      up(tl, $(el, ".s9-mail"), 0, { y: 60 });
      tl.to(o, { n: text.length, duration: 3.2, ease: "none", onUpdate: () => (p.textContent = text.slice(0, Math.round(o.n))), onReverseComplete: () => (p.textContent = "") }, 0.5);
    }
  ]
});

// ---------------------------------------------------------------- 10
const ROLES = {
  aphid: "Aphids suck plant sap. A colony grows fast on one plant.",
  lady: "Ladybirds (and their larvae) eat aphids — lots of them.",
  lace: "Lacewing larvae are aphid hunters too.",
  shrub: "Shrubs, flowers and „a little wilderness“: where predators live between meals.",
  tree: "Trees: shelter, shade, nesting — and fruit."
};
const s10 = stepper({
  id: "s-diversity", title: "Diversity is protection", loop: 1, steps: 4,
  notes: "His first tool isn't a spray — it's the hedge. Hover over an organism to see its role. The illustration is simplified; the photo is real.",
  html: `
    <div class="s10-text"><p class="kicker fx">How EcoFarm No. 5 protects its plants</p><h2 class="head split">Diversity <em>is</em> protection</h2></div>
    <svg class="s10-eco" viewBox="0 0 1920 1080" aria-label="Illustrated ecosystem: shrub, crop with aphids, predators, tree"></svg>
    <div class="s10-tip mono"></div>
    <figure class="s10-photo fx"><img src="img/ladybird.webp" data-lightbox="eco" alt="Seven-spot ladybird with aphids" data-caption="A seven-spot ladybird among aphids. Photo: Smithsonian Environmental Research Center · CC BY 2.0 · Wikimedia Commons"><figcaption class="mono">Real: a ladybird among aphids · SERC · CC BY 2.0</figcaption></figure>
    <ol class="s10-ladder">
      <li class="fx"><b>1</b> Diversity — trees, shrubs, even “a little wilderness”, so predators have a refuge</li>
      <li class="fx"><b>2</b> Crop rotation</li>
      <li class="fx"><b>3</b> Care for the soil</li>
      <li class="fx"><b>4</b> Mechanical barriers</li>
      <li class="fx last"><b>5</b> Only if necessary: products allowed in organic farming — diatomaceous earth, copper, neem oil</li>
    </ol>
    <p class="s10-iep small fx">Same logic at national scale: more diverse crops → more natural enemies of pests → fewer sprays (IEP, 2020).</p>
    <div class="s10-src">${pills("vince", "iep", "kzecofarm")}</div>
    <span class="visnote s10-vis">Illustration</span>`,
  setup(el) {
    const s = $(el, ".s10-eco"), R = rng(4), GY = 860;
    s.innerHTML = `<defs><radialGradient id="s10g" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#2a2419"/><stop offset="1" stop-color="#14100c"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#s10g)"/>
      <rect y="${GY}" width="1920" height="${1080 - GY}" fill="#2a1f15"/>`;
    // shrub / wilderness (left)
    const sh = svg("g", { class: "org", "data-role": "shrub" }, s);
    for (let i = 0; i < 60; i++) svg("circle", { cx: 120 + R() * 360, cy: GY - 30 - R() * 300 * (1 - Math.abs(R() - 0.5)), r: 24 + R() * 40, fill: `hsl(${85 + R() * 30},${25 + R() * 15}%,${20 + R() * 12}%)` }, sh);
    for (let i = 0; i < 26; i++) { const x = 90 + R() * 440; svg("path", { d: `M${x} ${GY}q${(R() - 0.5) * 30} -60 ${(R() - 0.5) * 20} -${90 + R() * 60}`, stroke: "#7c9a4f", "stroke-width": 2, fill: "none" }, sh); svg("circle", { cx: x + (R() - 0.5) * 20, cy: GY - 100 - R() * 60, r: 6, fill: R() < 0.5 ? "#e5d36b" : "#c7a6e8" }, sh); }
    // tree (right)
    const tr = svg("g", { class: "org", "data-role": "tree" }, s);
    svg("path", { d: `M1700 ${GY}C1705 700 1690 600 1700 420`, stroke: "#2d1f14", "stroke-width": 34, fill: "none" }, tr);
    for (let i = 0; i < 40; i++) svg("circle", { cx: 1700 + (R() - 0.5) * 380, cy: 380 + (R() - 0.5) * 260, r: 40 + R() * 50, fill: `hsl(${95 + R() * 20},${25 + R() * 10}%,${18 + R() * 10}%)` }, tr);
    // crops (centre): broad-bean-like plants
    const crops = svg("g", {}, s);
    [700, 850, 1000, 1150, 1300].forEach((x, i) => {
      const h = 300 + (i === 2 ? 60 : R() * 50), g = svg("g", {}, crops);
      svg("path", { d: `M${x} ${GY}C${x - 6} ${GY - h / 2} ${x + 6} ${GY - h / 1.5} ${x} ${GY - h}`, stroke: "#6e9447", "stroke-width": 7, fill: "none" }, g);
      for (let k = 0; k < 7; k++) {
        const y = GY - 50 - k * (h / 8), d = k % 2 ? 1 : -1;
        svg("path", { d: `M${x} ${y}q${d * 40} -40 ${d * 90} -20q${-d * 40} 30 ${-d * 90} 20z`, fill: "#86ad57", opacity: 0.95 }, g);
      }
    });
    // aphid colony on the middle plant
    const ap = svg("g", { class: "aphids org", "data-role": "aphid" }, s);
    for (let i = 0; i < 110; i++) {
      const a = R() * Math.PI * 2, r = Math.abs(R() + R() - 1) * 95;
      svg("ellipse", { cx: 1000 + Math.cos(a) * r * 0.5, cy: 560 + Math.sin(a) * r, rx: 7.5, ry: 5.5, fill: "#e3f09a", stroke: "#1f260f", "stroke-width": 1.5, class: "aphid" }, ap);
    }
    // predators start in the shrub
    const PATHS = [
      "M300 640C520 420 760 380 985 520", "M260 560C480 300 840 360 1012 580", "M380 700C600 700 800 640 990 600",
      "M200 600C420 380 880 300 1020 540", "M340 520C600 260 860 420 995 560", "M280 680C520 560 820 520 1008 610"
    ];
    PATHS.forEach((d, i) => {
      svg("path", { d, class: "flight", id: `s10p${i}` }, s);
      const g = svg("g", { class: "pred org", "data-role": i < 4 ? "lady" : "lace", "data-i": i }, s);
      if (i < 4) {
        svg("circle", { cx: 0, cy: 0, r: 13, fill: "#d9342b" }, g);
        svg("circle", { cx: 12, cy: 0, r: 6, fill: "#111" }, g);
        svg("path", { d: "M-13 0H13", stroke: "#111", "stroke-width": 1.5 }, g);
        [[-5, -6], [-5, 6], [3, -7], [3, 7], [-10, 0]].forEach(([x, y]) => svg("circle", { cx: x, cy: y, r: 2.6, fill: "#111" }, g));
      } else {
        svg("ellipse", { cx: 0, cy: -9, rx: 20, ry: 8, fill: "rgba(200,240,210,.35)", stroke: "rgba(200,240,210,.6)" }, g);
        svg("ellipse", { cx: 0, cy: 9, rx: 20, ry: 8, fill: "rgba(200,240,210,.35)", stroke: "rgba(200,240,210,.6)" }, g);
        svg("path", { d: "M-18 0H18", stroke: "#8cd07a", "stroke-width": 4, "stroke-linecap": "round" }, g);
      }
      g.setAttribute("transform", `translate(${260 + i * 20} ${620 - i * 12})`);
    });
    const tip = $(el, ".s10-tip");
    $$(s, ".org").forEach((o) => {
      o.addEventListener("mouseenter", () => { tip.textContent = ROLES[o.dataset.role]; tip.classList.add("on"); });
      o.addEventListener("mouseleave", () => tip.classList.remove("on"));
    });
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s10-text .head"), 0);
      up(tl, $(el, ".s10-text .kicker"), 0.2);
      tl.fromTo($$(el, ".aphid"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.4, stagger: { each: 0.035, from: "center" }, ease: "back.out(3)", immediateRender: true }, 0.8);
      tl.fromTo($$(el, ".pred"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: true }, 0.8);
    },
    (tl, el) => {
      $$(el, ".pred").forEach((p, i) => {
        tl.to(p, { motionPath: { path: `#s10p${i}`, align: `#s10p${i}`, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 2.4 + i * 0.25, ease: "power1.inOut" }, i * 0.3);
      });
      tl.to($$(el, ".aphid"), { scale: 0, duration: 0.3, stagger: { each: 0.03, from: "edges" }, ease: "power2.in" }, 2.2);
      fade(tl, $(el, ".s10-photo"), 2.8);
    },
    (tl, el) => {
      tl.to($(el, ".s10-eco"), { opacity: 0.25, duration: 0.8 }, 0).to($(el, ".s10-photo"), { autoAlpha: 0, duration: 0.5 }, 0);
      up(tl, $$(el, ".s10-ladder li"), 0.4, { s: 0.35 });
    },
    (tl, el) => { up(tl, $(el, ".s10-iep"), 0); }
  ]
});

// ---------------------------------------------------------------- 11
function bed(g, dry) {
  const GY = 700, R = rng(9);
  svg("rect", { x: 0, y: GY, width: 1920, height: 380, fill: dry ? "#8a7458" : "#3a2a1b" }, g);
  if (dry) svg("image", { href: "img/cracked.webp", x: 0, y: GY, width: 1920, height: 1440, preserveAspectRatio: "xMidYMin slice", opacity: 0.55, class: "crackimg" }, g);
  else { // moist band under the drip line
    for (let x = 160; x < 1920; x += 280) svg("ellipse", { cx: x, cy: GY + 24, rx: 90, ry: 26, fill: "rgba(20,14,9,.7)" }, g);
  }
  svg("path", { d: `M0 ${GY - 6}H1920`, stroke: "#1c1c1c", "stroke-width": 8 }, g); // drip line
  for (let x = 160; x < 1920; x += 280) {
    const p = svg("g", { class: "plant" }, g);
    svg("path", { d: `M${x} ${GY}C${x - 8} ${GY - 120} ${x + 8} ${GY - 200} ${x} ${GY - 300}`, stroke: dry ? "#8c8a55" : "#5f8d3e", "stroke-width": 8, fill: "none" }, p);
    for (let k = 0; k < 6; k++) {
      const y = GY - 70 - k * 40, d = k % 2 ? 1 : -1;
      svg("path", { d: `M${x} ${y}q${d * 55} -55 ${d * 120} -24q${-d * 55} 40 ${-d * 120} 24z`, fill: dry ? "#a9a063" : "#7fb351", class: "leaf", "data-x": x, "data-y": y, "data-d": d }, p);
    }
    if (!dry) for (let k = 0; k < 3; k++) svg("circle", { cx: x + 4, cy: GY - 2, r: 5, fill: "#8fd3e0", class: "drop", "data-k": k }, g);
    if (!dry) svg("circle", { cx: x + 30, cy: GY - 170 - R() * 60, r: 16, fill: "#d9442f", class: "fruit11" }, p);
  }
}
let split11 = 960, drops11;
const s11 = stepper({
  id: "s-drought", title: "When drought hits even a good farm", loop: 1, steps: 3,
  notes: "This was this year, 2026. Drag the divider. Left: where drip irrigation reaches. Right: what the farmer described for the parts he could not water.",
  html: `
    <svg class="s11-svg" viewBox="0 0 1920 1080" aria-label="Split screen: watered and drought-stressed plants">
      <defs>
        <clipPath id="s11L"><rect class="cl" x="0" y="0" width="960" height="1080"/></clipPath>
        <clipPath id="s11R"><rect class="cr" x="960" y="0" width="960" height="1080"/></clipPath>
        <filter id="s11heat" x="0" y="0" width="100%" height="100%"><feTurbulence class="turb" type="fractalNoise" baseFrequency="0.004 0.03" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="14"/></filter>
      </defs>
      <g clip-path="url(#s11L)"><rect width="1920" height="1080" fill="#1d1a13"/><g class="wet"></g></g>
      <g clip-path="url(#s11R)"><rect width="1920" height="1080" fill="#3a2b1c"/><g class="dry" filter="url(#s11heat)"></g><rect width="1920" height="700" fill="rgba(224,112,63,.12)"/></g>
    </svg>
    <div class="s11-div interactive"><i></i><span>⟷</span></div>
    <p class="s11-l mono fx">With drip irrigation</p><p class="s11-r mono fx">Where water can't reach</p>
    <div class="s11-text"><p class="kicker fx">Farm story 2 · summer 2026</p><h2 class="head split">When drought hits <em>even a good farm</em></h2></div>
    <div class="s11-loss fx">
      <p class="quote s11-lq">“I can't water the whole farm, so this year we lost several shrubs and trees in our orchard … a much lower yield, and stress from drought and heat.”</p>
      <p class="quote-by"><b>Jozef Vince</b> · our interview, 22 Sep 2026 · off-grid solar and groundwater limit how much he can pump</p>
    </div>
    <div class="s11-econ fx">
      <p class="kicker">On the economics of farming</p>
      <p class="quote">“… if you go after the economics, it is guaranteed that people and/or the ecology suffer.”</p>
      <p class="quote-by"><b>Jozef Vince</b> · Family EcoFarm No. 5 · our interview, translated</p>
    </div>
    <figure class="s11-photo fx"><img src="img/drip.webp" data-lightbox="drought" alt="A drip irrigation line watering young plants" data-caption="Drip irrigation: water only where the roots are. Photo: Dwight Sipler · CC BY 2.0 · Wikimedia Commons"><figcaption class="mono">Real drip line · D. Sipler · CC BY 2.0</figcaption></figure>
    <div class="s11-src">${pills("vince")}</div>
    <span class="visnote s11-vis">Illustration + photo texture (cracked soil: I. Achiri, CC BY-SA 4.0)</span>`,
  setup(el, ctx) {
    bed($(el, ".wet"), false); bed($(el, ".dry"), true);
    const d = $(el, ".s11-div");
    const setSplit = (x) => {
      split11 = Math.max(80, Math.min(1840, x));
      $(el, ".cl").setAttribute("width", split11); $(el, ".cr").setAttribute("x", split11); $(el, ".cr").setAttribute("width", 1920 - split11);
      d.style.left = split11 + "px";
    };
    let drag = false;
    d.addEventListener("pointerdown", (e) => { drag = true; d.setPointerCapture(e.pointerId); e.stopPropagation(); });
    d.addEventListener("pointermove", (e) => { if (!drag) return; const r = el.getBoundingClientRect(); setSplit((e.clientX - r.left) / ctx.scale); });
    d.addEventListener("pointerup", () => (drag = false));
    d.addEventListener("click", (e) => e.stopPropagation());
    setSplit(960);
    // drip drops loop (only runs while the scene is active)
    drops11 = gsap.timeline({ paused: true, repeat: -1 });
    $$(el, ".wet .drop").forEach((p) => drops11.fromTo(p, { attr: { cy: 694 }, opacity: 1 }, { attr: { cy: 730 }, opacity: 0, duration: 1.2, ease: "power1.in" }, +p.dataset.k * 0.4));
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s11-text .head"), 0);
      up(tl, [$(el, ".s11-text .kicker"), $(el, ".s11-l"), $(el, ".s11-r"), $(el, ".s11-photo")], 0.3);
      // right side: leaves wilt, colour drains, heat shimmers
      $$(el, ".dry .leaf").forEach((l) => tl.to(l, { rotation: +l.dataset.d * 38, svgOrigin: `${l.dataset.x} ${l.dataset.y}`, duration: 3, ease: "power2.inOut" }, 0.8));
      tl.to($(el, ".dry"), { filter: "url(#s11heat) saturate(.35)", duration: 0.01 }, 0.8)
        .fromTo($(el, ".turb"), { attr: { baseFrequency: "0.004 0.03" } }, { attr: { baseFrequency: "0.006 0.05" }, duration: 3, ease: "sine.inOut", yoyo: true, repeat: 1, immediateRender: false }, 0.8);
    },
    (tl, el) => {
      tl.to($(el, ".s11-photo"), { autoAlpha: 0, duration: 0.4 }, 0).to($(el, ".s11-text"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, [$(el, ".s11-loss"), $(el, ".s11-src")], 0.3);
    },
    (tl, el) => {
      out(tl, $(el, ".s11-loss"), 0);
      up(tl, $(el, ".s11-econ"), 0.4);
    }
  ],
  onEnter() { drops11.play(0); },
  onLeave() { setTimeout(() => drops11.pause(), 800); }
});

export default [s07, s08, s09, s10, s11];
