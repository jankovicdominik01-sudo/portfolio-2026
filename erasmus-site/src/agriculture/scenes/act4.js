// ACT IV · FROM FOOD TO WASTE — AND OUR FIELD REPORT — scenes 12–17
// Everything about the Senica composting plant comes from two places: the
// operator's email of 23 Sep 2026 (●) and what we saw on 30 Sep 2026 (○).
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";
import { photoHTML, bindPhoto, legendHTML } from "../lib/photo.js";
import { railHTML, railSet, railTo } from "../lib/rail.js";

const P = (name, w = 1600, h = 1201) => ({ src: `img/field/${name}.webp`, w, h });
const nophoto = (t) => `<span class="nophoto mono">no photo of this step · ${t}</span>`;

// ---------------------------------------------------------------- 12 · food becomes waste
const SHAPES = {
  tomato: "M300 120C420 120 520 210 520 330C520 450 420 540 300 540C180 540 80 450 80 330C80 210 180 120 300 120Z",
  plate: "M40 340C40 280 160 240 300 240C440 240 560 280 560 340C560 400 440 440 300 440C160 440 40 400 40 340Z",
  scraps: "M120 420L180 390L220 440L150 460Z M260 440C290 400 340 400 360 440C330 470 290 470 260 440Z M400 400L470 410L450 470L390 450Z M180 480L230 470L240 510L190 515Z M330 500C350 480 390 480 400 510C370 530 350 530 330 500Z",
  bin: "M160 200H440L410 540H190Z M140 165H460V200H140Z M260 135H340V165H260Z",
  stream: "M-200 330C0 300 200 360 450 330S800 300 1100 330V420C800 390 650 450 450 420S0 390 -200 420Z"
};
const s12 = stepper({
  id: "s-foodwaste", title: "Then food becomes waste", loop: 2, steps: 3,
  html: `
    <div class="s12-text"><p class="kicker fx">From harvest to bin</p><h2 class="head split">Then food <em>becomes waste</em></h2></div>
    <svg class="s12-svg" viewBox="0 0 1920 1080" aria-label="A tomato becomes a meal, scraps, a bin and a waste stream">
      <g class="morphg" transform="translate(1060 200)">
        <path class="leaf12" d="M300 125C270 80 230 80 210 95C250 100 270 115 300 125ZM300 125C330 80 370 80 390 95C350 100 330 115 300 125Z" fill="#6f9a45"/>
        <path class="morph" d="${SHAPES.tomato}" fill="#d9442f"/>
        <path class="food12" d="M200 330C220 290 380 290 400 330C380 360 220 360 200 330Z" fill="#c9793c" opacity="0"/>
      </g>
    </svg>
    <p class="s12-label mono"></p>
    <div class="s12-tons fx">
      <p class="kicker">Senica composting plant · taken in during 2025</p>
      <p class="s12-big"><span class="num">0</span> t</p>
      <div class="bar"><i class="g"></i><i class="k"></i><em class="cap"></em></div>
      <ul class="mono"><li><b class="sw g"></b>2,685 t garden & park waste <small>(code 20 02 01)</small></li><li><b class="sw k"></b>642 t kitchen & canteen waste <small>(code 20 01 08)</small></li><li><b class="sw c"></b>capacity 4,200 t a year</li></ul>
      <span data-src="tssenica"></span>
    </div>
    <div class="s12-eu fx"><span class="stamp">EU · since 31 Dec 2023</span><p>Bio-waste must be separated at source or collected separately — that is why there is a brown bin.</p><span data-src="euwfd"></span></div>`,
  timelines: [
    (tl, el) => {
      const m = $(el, ".morph"), lab = $(el, ".s12-label");
      const setL = (t) => () => (lab.textContent = t);
      head(tl, $(el, ".s12-text .head"), 0);
      up(tl, $(el, ".s12-text .kicker"), 0.2);
      tl.fromTo($(el, ".morphg"), { scale: 0.6, autoAlpha: 0, svgOrigin: "1360 530" }, { scale: 1, autoAlpha: 1, duration: 1.2, ease: "back.out(1.5)", immediateRender: false }, 0.2)
        .call(setL("Harvest"), null, 0.2)
        .to($(el, ".leaf12"), { autoAlpha: 0, duration: 0.4 }, 2)
        .to(m, { morphSVG: SHAPES.plate, fill: "#ece5d8", duration: 1.1, ease: "power2.inOut" }, 2)
        .to($(el, ".food12"), { opacity: 1, duration: 0.5 }, 2.8).call(setL("Meal"), null, 2.6)
        .to($(el, ".food12"), { opacity: 0, duration: 0.4 }, 4)
        .to(m, { morphSVG: SHAPES.scraps, fill: "#b98a4a", duration: 1.1, ease: "power2.inOut" }, 4).call(setL("Scraps"), null, 4.5)
        .to(m, { morphSVG: SHAPES.bin, fill: "#6b4f33", duration: 1.1, ease: "power2.inOut" }, 5.8).call(setL("Brown bio-waste bin"), null, 6.3);
    },
    (tl, el) => {
      tl.to($(el, ".morph"), { morphSVG: SHAPES.stream, fill: "#8c6a48", duration: 1.4, ease: "power2.inOut" }, 0)
        .call(() => ($(el, ".s12-label").textContent = "Waste stream → Senica composting plant"), null, 0.6)
        .to($(el, ".morphg"), { x: -700, y: 250, scale: 0.9, svgOrigin: "1360 530", duration: 1.4, ease: "power2.inOut" }, 0.9)
        .to([$(el, ".morphg"), $(el, ".s12-label")], { autoAlpha: 0, duration: 0.6 }, 2);
      up(tl, $(el, ".s12-tons"), 1.2);
      count(tl, $(el, ".s12-big .num"), 3327, 1.4, { d: 1.8 });
      tl.fromTo($(el, ".bar .g"), { width: 0 }, { width: (2685 / 4200) * 100 + "%", duration: 1.2, ease: "power2.out", immediateRender: false }, 1.5)
        .fromTo($(el, ".bar .k"), { width: 0 }, { width: (642 / 4200) * 100 + "%", duration: 0.8, ease: "power2.out", immediateRender: false }, 2.5);
    },
    (tl, el) => { up(tl, $(el, ".s12-eu"), 0); }
  ]
});

// ---------------------------------------------------------------- 13 · field report
const TEAM = P("team-husmann");
const PRINTS = [
  ["turner", "The turner"], ["windrows", "Windrows"], ["mixer-guide", "The red machine"],
  ["branches-guide", "Branches"], ["food-waste-bags", "Food waste"], ["site-overview", "The yard"]
];
let ph13;
const s13 = stepper({
  id: "s-fieldreport", title: "Field report: Senica composting plant", loop: 3, steps: 3,
  html: `
    ${photoHTML("team", { ...TEAM, alt: "Our four students at the Senica composting plant, next to a blue machine and a mountain of green waste" })}
    <div class="s13-shade"></div>
    <div class="s13-head">
      <span class="stamp s13-stamp fx">Field report · 30 · 09 · 2026 · 9:00</span>
      <h2 class="head split">Senica <em>composting plant</em></h2>
      <p class="sub fx">Run by Technické služby Senica — the town's technical services. Built for up to 4,200 tonnes of bio-waste a year.</p>
    </div>
    <div class="s13-book">
      <div class="s13-prints">${PRINTS.map(([f, c], i) => `<figure class="print fx" style="--r:${[-3, 2, -1.5, 2.5, -2, 1][i]}deg"><img data-img="img/field/${f}.webp" data-lightbox="notebook" data-caption="${c} — Senica composting plant, 30 Sep 2026. Our photo (taken by our teacher Martin Woznica)." alt="${c}"><figcaption class="mono">${String(i + 1).padStart(2, "0")} · ${c}</figcaption></figure>`).join("")}</div>
      <figure class="s13-phone fx"><div class="frame"><video data-img="img/field/site-pan.mp4" muted playsinline loop preload="none" aria-label="Our 15-second video: a look around the composting plant"></video></div><figcaption class="mono">Our video · 15 s · no sound</figcaption></figure>
      <p class="s13-count mono fx">15 photos · 16 short clips · 1 video — all from our visit</p>
    </div>
    <div class="s13-legend">
      <p class="kicker fx">How we label what we show</p>
      <ul>
        <li class="fx"><b class="st-confirmed">●</b><span><b>Confirmed in writing</b> — the operator wrote it to us (email, 23 Sep)</span></li>
        <li class="fx"><b class="st-seen">○</b><span><b>In our photo</b> — you can see it yourself</span></li>
        <li class="fx"><b class="st-likely">◌</b><span><b>Our interpretation</b> — likely, but not confirmed</span></li>
        <li class="fx"><b class="st-unknown">?</b><span><b>Unknown</b> — we don't know yet, and we say so</span></li>
      </ul>
    </div>
    <div class="s13-src">${pills(["visitcompost", "Our field visit"], "tssenica")}</div>`,
  setup(el) {
    ph13 = bindPhoto(el, "team", { ...TEAM, start: { x: 820, y: 640, z: 1.02 } });
    gsap.set([$(el, ".s13-book"), $(el, ".s13-legend")], { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(ph13.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, immediateRender: false }, 0);
      ph13.move(tl, { x: 780, y: 620, z: 1.12 }, 0, { d: 7, ease: "none" });
      tl.fromTo($(el, ".s13-stamp"), { autoAlpha: 0, scale: 2, rotation: -7 }, { autoAlpha: 1, scale: 1, rotation: -2, duration: 0.45, ease: "power4.in", immediateRender: false }, 0.6);
      head(tl, $(el, ".s13-head .head"), 1);
      up(tl, [$(el, ".s13-head .sub"), $(el, ".s13-src")], 1.3);
    },
    (tl, el) => {
      tl.to([ph13.el, $(el, ".s13-shade")], { autoAlpha: 0.12, duration: 0.8 }, 0)
        .to($(el, ".s13-head"), { autoAlpha: 0, y: -30, duration: 0.5 }, 0)
        .fromTo($(el, ".s13-book"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3)
        .fromTo($$(el, ".print"), { autoAlpha: 0, y: 120, rotation: 0, scale: 1.15 }, { autoAlpha: 1, y: 0, rotation: (i, t) => t.style.getPropertyValue("--r"), scale: 1, duration: 0.8, stagger: 0.16, ease: "expo.out", immediateRender: false }, 0.4)
        .fromTo($(el, ".s13-phone"), { autoAlpha: 0, x: 80 }, { autoAlpha: 1, x: 0, duration: 0.9, ease: "expo.out", immediateRender: false }, 1.3);
      fade(tl, $(el, ".s13-count"), 2);
    },
    (tl, el) => {
      tl.to($(el, ".s13-book"), { autoAlpha: 0.08, duration: 0.6 }, 0)
        .fromTo($(el, ".s13-legend"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      up(tl, [$(el, ".s13-legend .kicker"), ...$$(el, ".s13-legend li")], 0.4, { s: 0.3 });
    }
  ],
  onStep(step, dir, el) {
    const v = $(el, ".s13-phone video");
    if (!v) return;
    if (step === 1) { const p = v.play(); p && p.catch(() => {}); } else v.pause();
  },
  onLeave(el) { const v = $(el, ".s13-phone video"); v && v.pause(); }
});

// ---------------------------------------------------------------- 14 · follow one load (1)
const BR = P("branches-guide"), MX = P("mixer-guide"), HU = P("team-husmann"), YARD = P("site-overview");
let ph14a, ph14b, ph14c, ph14d;
const s14 = stepper({
  id: "s-load1", title: "Follow one load (1): arrive, store, prepare", loop: 3, steps: 4,
  html: `
    ${photoHTML("yard", { ...YARD, alt: "The yard of the composting plant" })}
    ${photoHTML("branch", { ...BR, alt: "A big pile of branches at the composting plant, our guide explains" })}
    ${photoHTML("mixer", { ...MX, alt: "A red machine with a hopper and a ladder; a student looks inside" })}
    ${photoHTML("husm", { ...HU, alt: "A blue machine labelled Husmann at the composting plant", box: [0, 0, 1100, 1080] })}
    <div class="s14-shade"></div>
    ${railHTML()}
    <div class="s14-title"><p class="kicker fx">Follow one load · part 1</p><h2 class="head split">Arrive, store, <em>prepare</em></h2></div>
    <div class="panel s14-p0 fx">
      <p class="pk mono">01 Arrive</p><p>Garden waste comes in the operator's trucks — and residents bring it themselves. Kitchen waste comes in a special vehicle.</p>
      <p class="pk mono">02 Check</p><p>Every load is weighed, checked by eye and written down. Kitchen waste also goes into a food-safety record (HACCP).</p>
      <p class="st mono"><b class="st-confirmed">●</b> operator, email 23 Sep</p>${nophoto("operator's description")}
    </div>
    <div class="panel s14-p1 fx"><p class="pk mono">03 Store</p><p>The loads wait in piles in the yard. A worker decides what happens next.</p><p class="st mono"><b class="st-confirmed">●</b> operator · <b class="st-seen">○</b> our photo</p></div>
    <div class="panel s14-p2 fx"><p class="pk mono">04 Prepare</p><p>Wood is chipped and crushed. The rest is cut and mixed in a cutting-and-mixing machine — woody and soft bio-waste together.</p><p class="st mono"><b class="st-confirmed">●</b> operator · <b class="st-seen">○</b> our photo</p></div>
    <figure class="s14-inside fx"><img data-img="img/field/mixer-inside.webp" data-lightbox="mixer" data-caption="Looking inside the red machine from its platform, 30 Sep 2026. Our photo." alt="Inside the red machine: dark, finely cut material"><figcaption><b>Inside</b> dark, finely cut material <em class="mono">○ in our photo</em></figcaption><i class="q" title="We can't tell">?</i><span class="qlab"><b>A light piece</b> plastic or paper? We can't tell from the photo. <em class="mono">? unknown</em></span></figure>
    <div class="panel s14-p3 fx"><p class="pk mono">04 Prepare · kitchen waste</p><p>Kitchen waste goes through a shredder and is mixed with green waste: <b>2 parts kitchen waste, 1 part green waste.</b></p>
      <div class="ratio" aria-label="Two parts kitchen waste to one part green waste"><i class="k"></i><i class="k"></i><i class="g"></i><span class="mono">2 : 1</span></div>
      <p class="st mono"><b class="st-confirmed">●</b> operator, email 23 Sep</p></div>
    ${legendHTML("s14-leg")}
    <div class="s14-src">${pills(["visitcompost", "Our photos"], "tssenica")}</div>`,
  setup(el) {
    ph14a = bindPhoto(el, "yard", { ...YARD, start: { x: 900, y: 640, z: 1.02 } });
    ph14b = bindPhoto(el, "branch", {
      ...BR, start: { x: 760, y: 640, z: 1 },
      notes: [
        { id: "wood", x: 330, y: 600, title: "Branches", text: "woody garden waste", status: "seen", dx: 120, dy: -230, r: 46 },
        { id: "next", x: 520, y: 690, title: "Next step", text: "chipped and crushed", status: "confirmed", dx: 240, dy: 150 },
        { id: "guide", x: 1070, y: 690, title: "Our guide", text: "explained every station", status: "seen", dx: -170, dy: -200 }
      ]
    });
    ph14c = bindPhoto(el, "mixer", {
      ...MX, start: { x: 700, y: 640, z: 1 },
      notes: [
        { id: "mix", x: 330, y: 650, title: "Cutting & mixing machine", text: "the operator describes one — we think this is it", status: "likely", word: "Our interpretation", dx: 90, dy: -330, r: 40 },
        { id: "ladder", x: 800, y: 600, title: "Platform & ladder", text: "to look inside", status: "seen", dx: -150, dy: -150 },
        { id: "drive", x: 975, y: 905, title: "Drive?", text: "probably the motor housing", status: "likely", dx: 150, dy: 60, r: 18 }
      ]
    });
    ph14d = bindPhoto(el, "husm", {
      ...HU, start: { x: 300, y: 640, z: 1.9 },
      notes: [
        { id: "shred", x: 250, y: 720, title: "A shredder · brand Husmann", text: "is it the kitchen-waste shredder? not confirmed", status: "likely", dx: 80, dy: 210, r: 34 },
        { id: "eu", x: 240, y: 628, title: "Project plate", text: "„kompostáreň“ · EU-funded", status: "seen", dx: 130, dy: -160, r: 18 }
      ]
    });
    gsap.set([ph14b.el, ph14c.el, ph14d.el], { autoAlpha: 0 });
    railSet(el, 0);
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(ph14a.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0);
      ph14a.move(tl, { x: 840, y: 660, z: 1.1 }, 0, { d: 6, ease: "none" });
      tl.fromTo($(el, ".rail"), { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6, immediateRender: false }, 0.2)
        .fromTo($(el, ".rail-track"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, ease: "power2.inOut", immediateRender: false }, 0.3);
      head(tl, $(el, ".s14-title .head"), 0.4);
      up(tl, [$(el, ".s14-title .kicker"), $(el, ".s14-src")], 0.6);
      railTo(tl, el, 0, 1, 1.4, 1);
      up(tl, $(el, ".s14-p0"), 1.2);
    },
    (tl, el) => {
      railTo(tl, el, 1, 2, 0, 0.9);
      tl.to([ph14a.el, $(el, ".s14-p0"), $(el, ".s14-title")], { autoAlpha: 0, duration: 0.6 }, 0)
        .fromTo(ph14b.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, immediateRender: false }, 0.2);
      ph14b.move(tl, { x: 600, y: 660, z: 1.18 }, 0.2, { d: 3 });
      ph14b.show(tl, ["wood", "next", "guide"], 1.2, { stagger: 0.5 });
      up(tl, [$(el, ".s14-p1"), $(el, ".s14-leg")], 1);
    },
    (tl, el) => {
      railTo(tl, el, 2, 3, 0, 0.9);
      ph14b.hide(tl, ["wood", "next", "guide"], 0);
      tl.to([ph14b.el, $(el, ".s14-p1")], { autoAlpha: 0, duration: 0.6 }, 0.1)
        .fromTo(ph14c.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, immediateRender: false }, 0.3);
      ph14c.move(tl, { x: 640, y: 680, z: 1.1 }, 0.3, { d: 3 });
      ph14c.show(tl, ["mix", "ladder", "drive"], 1.2, { stagger: 0.5 });
      up(tl, $(el, ".s14-p2"), 1);
      tl.fromTo($(el, ".s14-inside"), { autoAlpha: 0, scale: 0.6, rotation: 4 }, { autoAlpha: 1, scale: 1, rotation: 1.5, duration: 0.9, ease: "expo.out", immediateRender: false }, 2.8)
        .fromTo([$(el, ".s14-inside .q"), $(el, ".s14-inside .qlab")], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, stagger: 0.2, immediateRender: false }, 3.8);
    },
    (tl, el) => {
      ph14c.hide(tl, ["mix", "ladder", "drive"], 0);
      tl.to([ph14c.el, $(el, ".s14-p2"), $(el, ".s14-inside")], { autoAlpha: 0, duration: 0.6 }, 0.1)
        .fromTo(ph14d.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, immediateRender: false }, 0.3);
      ph14d.move(tl, { x: 280, y: 660, z: 2.1 }, 0.3, { d: 3 });
      ph14d.show(tl, ["shred", "eu"], 1.2, { stagger: 0.5 });
      up(tl, $(el, ".s14-p3"), 1);
      tl.fromTo($$(el, ".s14-p3 .ratio i"), { scale: 0, transformOrigin: "50% 100%" }, { scale: 1, duration: 0.5, stagger: 0.2, ease: "back.out(2)", immediateRender: false }, 1.8);
    }
  ]
});

// ---------------------------------------------------------------- 15 · follow one load (2)
const WR = P("windrows"), TU = P("turner");
let ph15a, ph15b;
const TEMP = [[0, 20], [0.15, 52], [0.4, 66], [0.8, 69], [1.1, 58], [1.15, 66], [1.6, 62], [2.1, 52], [2.15, 60], [2.7, 50], [3.3, 42], [3.9, 34], [4.5, 27], [5, 24]];
const TURNS = [1.12, 2.12];
const s15 = stepper({
  id: "s-load2", title: "Follow one load (2): heat, air, time", loop: 4, steps: 5,
  html: `
    ${photoHTML("wind", { ...WR, alt: "Long piles of compost (windrows) with a loader in the background" })}
    ${photoHTML("turn", { ...TU, alt: "A tractor-pulled compost turner on a concrete yard" })}
    <div class="s15-shade"></div>
    ${railHTML()}
    <div class="s15-title"><p class="kicker fx">Follow one load · part 2</p><h2 class="head split">Heat, air, <em>time</em></h2></div>
    <div class="s15-heat">
      <svg class="therm" viewBox="0 0 160 640" aria-hidden="true"><rect x="58" y="20" width="44" height="540" rx="22" class="tube"/><rect x="68" y="540" width="24" height="0" class="merc"/><circle cx="80" cy="580" r="48" class="bulb"/>${[20, 40, 60, 80].map((t) => `<line x1="108" x2="124" y1="${540 - t * 6}" y2="${540 - t * 6}" class="tick"/><text x="130" y="${546 - t * 6}" class="tl">${t}°</text>`).join("")}<line x1="40" x2="120" y1="${540 - 70 * 6}" y2="${540 - 70 * 6}" class="limit"/></svg>
      <div class="hv"><p class="big"><span class="num">0</span> °C</p><p class="for mono">for at least <b>1 hour</b></p></div>
      <div class="panel s15-p0 fx"><p class="pk mono">05 Heat · kitchen waste only</p><p>Kitchen waste is heated in a closed container: <b>at least 70 °C for at least one hour.</b> This is called hygienisation — it kills germs.</p><p>Under the mix: about 15 cm of wood chips.</p><p class="st mono"><b class="st-confirmed">●</b> operator, email 23 Sep</p>${nophoto("we have no clear photo of the container")}</div>
    </div>
    <div class="panel s15-p1 fx"><p class="pk mono">06 Compost</p><p>The material is shaped into long piles — <b>windrows</b>. Inside, microbes heat them to <b>45–70 °C</b>. Workers check temperature and moisture.</p><p class="st mono"><b class="st-confirmed">●</b> operator · <b class="st-seen">○</b> our photo</p></div>
    <div class="panel s15-p2 fx"><p class="pk mono">06 Compost · turning</p><p>A <b>turner</b> drives over the windrow and turns it. This brings air into the pile.</p><p class="st mono"><b class="st-confirmed">●</b> operator · <b class="st-seen">○</b> our photo · <b class="st-likely">◌</b> how it is driven</p></div>
    <div class="s15-chart">
      <p class="kicker fx">One windrow over time · illustration</p>
      <svg viewBox="0 0 1400 620" aria-label="Illustration: temperature of a windrow over five months, with turning">
        <rect class="band" x="80" y="${560 - 70 * 7}" width="1260" height="${25 * 7}"/>
        <text class="bandl" x="92" y="${560 - 70 * 7 + 30}">45–70 °C · the hot phase</text>
        <line class="ax" x1="80" y1="560" x2="1340" y2="560"/><line class="ax" x1="80" y1="40" x2="80" y2="560"/>
        ${[0, 1, 2, 3, 4, 5].map((m) => `<text class="axl" x="${80 + m * 252}" y="596" text-anchor="middle">${m} mo</text>`).join("")}
        ${[20, 40, 60].map((t) => `<text class="axl" x="66" y="${566 - t * 7}" text-anchor="end">${t}°</text>`).join("")}
        <path class="curve" d="${TEMP.map(([m, t], i) => `${i ? "L" : "M"}${80 + m * 252} ${560 - t * 7}`).join("")}"/>
        ${TURNS.map((m) => `<g class="turn"><line x1="${80 + m * 252}" x2="${80 + m * 252}" y1="80" y2="560"/><text x="${80 + m * 252}" y="66" text-anchor="middle">▲ turned</text></g>`).join("")}
        <rect class="done" x="${80 + 3 * 252}" y="40" width="${2 * 252}" height="520"/><text class="donel" x="${80 + 4 * 252}" y="110" text-anchor="middle">3–5 months → compost</text>
      </svg>
      <p class="s15-chartnote small fx">They check temperature and moisture, and turn the windrow when the temperature changes. After <b>3–5 months</b> it is compost. <span class="mono">● operator · curve shape = illustration, not measured data</span></p>
    </div>
    <div class="s15-vs">
      <p class="kicker fx">So compost is not just rotting waste</p>
      <div class="cols">
        <div class="col good fx"><p class="mono h">Managed · Senica plant</p><ul><li>heat 45–70 °C</li><li>air from turning</li><li>moisture checked</li><li>3–5 months</li><li>quality check</li></ul></div>
        <div class="col bad fx"><p class="mono h">Unmanaged heap</p><ul><li>no control of heat</li><li>no turning</li><li>no checks</li><li>“what people call compost”</li></ul></div>
      </div>
      <blockquote class="quote s15-q fx">“By definition, compost is a managed process.”<span class="quote-by"><b>Jozef Vince</b> · Family EcoFarm No. 5 · our interview</span></blockquote>
    </div>
    ${legendHTML("s15-leg")}
    <div class="s15-src">${pills(["visitcompost", "Our photos"], "tssenica", "vince")}</div>`,
  setup(el) {
    ph15a = bindPhoto(el, "wind", {
      ...WR, start: { x: 800, y: 700, z: 1 },
      notes: [
        { id: "row", x: 1150, y: 860, title: "Windrow", text: "a long compost pile", status: "confirmed", word: "Operator · our photo", dx: -380, dy: -240, r: 60 },
        { id: "loader", x: 1165, y: 548, title: "Loader at work", status: "seen", dx: 110, dy: -60 },
        { id: "plastic", x: 1312, y: 990, title: "Small plastic pieces", text: "even here, inside the compost", status: "seen", dx: -330, dy: -220, r: 16 }
      ],
      loupes: [{ id: "lp", x: 1305, y: 995, at: [1660, 700], d: 300, mag: 3.4, title: "zoom ×3" }]
    });
    ph15b = bindPhoto(el, "turn", {
      ...TU, start: { x: 820, y: 680, z: 1.05 },
      notes: [
        { id: "turner", x: 980, y: 600, title: "Turner", text: "turns the windrows — air in", status: "confirmed", word: "Operator · our photo", dx: 80, dy: -170, r: 40 },
        { id: "rotor", x: 880, y: 745, title: "Rotor with paddles", text: "lifts and mixes the pile", status: "seen", dx: 230, dy: 190, r: 34 },
        { id: "pto", x: 560, y: 724, title: "Drive shaft", text: "a tractor probably drives it", status: "likely", dx: -100, dy: -150, r: 20 }
      ],
      loupes: [{ id: "lr", x: 870, y: 740, at: [1640, 560], d: 320, mag: 1.8, title: "rotor · zoom ×2" }]
    });
    gsap.set([ph15a.el, ph15b.el, $(el, ".s15-chart"), $(el, ".s15-vs")], { autoAlpha: 0 });
    railSet(el, 3);
  },
  timelines: [
    (tl, el) => {
      fade(tl, $(el, ".rail"), 0, { d: 0.4 });
      railTo(tl, el, 3, 4, 0.3, 1);
      head(tl, $(el, ".s15-title .head"), 0.2);
      up(tl, [$(el, ".s15-title .kicker"), $(el, ".s15-src")], 0.4);
      fade(tl, $(el, ".s15-heat .therm"), 0.6);
      tl.fromTo($(el, ".merc"), { attr: { y: 540, height: 0 } }, { attr: { y: 540 - 70 * 6, height: 70 * 6 }, duration: 2.4, ease: "power2.out", immediateRender: false }, 0.9);
      fade(tl, $(el, ".s15-heat .hv"), 0.9);
      count(tl, $(el, ".s15-heat .num"), 70, 0.9, { d: 2.4 });
      up(tl, $(el, ".s15-p0"), 1.4);
    },
    (tl, el) => {
      railTo(tl, el, 4, 5, 0, 0.9);
      tl.to([$(el, ".s15-heat"), $(el, ".s15-title")], { autoAlpha: 0, duration: 0.6 }, 0)
        .fromTo(ph15a.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0.2);
      ph15a.move(tl, { x: 900, y: 760, z: 1.12 }, 0.2, { d: 3 });
      ph15a.show(tl, ["row", "loader"], 1, { stagger: 0.5 });
      up(tl, [$(el, ".s15-p1"), $(el, ".s15-leg")], 0.9);
      ph15a.show(tl, ["plastic"], 2.4);
      ph15a.loupe(tl, "lp", 2.9);
    },
    (tl, el) => {
      ph15a.hide(tl, ["row", "loader", "plastic"], 0);
      ph15a.unloupe(tl, "lp", 0);
      tl.to([ph15a.el, $(el, ".s15-p1")], { autoAlpha: 0, duration: 0.6 }, 0.1)
        .fromTo(ph15b.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0.3);
      ph15b.move(tl, { x: 800, y: 700, z: 1.25 }, 0.3, { d: 3 });
      ph15b.show(tl, ["turner", "rotor", "pto"], 1.1, { stagger: 0.55 });
      ph15b.loupe(tl, "lr", 2.6);
      up(tl, $(el, ".s15-p2"), 1);
    },
    (tl, el) => {
      ph15b.hide(tl, ["turner", "rotor", "pto"], 0);
      ph15b.unloupe(tl, "lr", 0);
      tl.to([ph15b.el, $(el, ".s15-p2"), $(el, ".s15-leg")], { autoAlpha: 0, duration: 0.6 }, 0.1)
        .fromTo($(el, ".s15-chart"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.4)
        .fromTo($(el, ".s15-chart .band"), { scaleY: 0, transformOrigin: "50% 100%" }, { scaleY: 1, duration: 0.8, immediateRender: false }, 0.5)
        .fromTo($(el, ".s15-chart .curve"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 3, ease: "none", immediateRender: false }, 0.8)
        .fromTo($$(el, ".s15-chart .turn"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, stagger: 0.66, immediateRender: false }, 1.4)
        .fromTo([$(el, ".s15-chart .done"), $(el, ".s15-chart .donel")], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: false }, 3.4);
      up(tl, [$(el, ".s15-chart .kicker"), $(el, ".s15-chartnote")], 0.5);
    },
    (tl, el) => {
      tl.to($(el, ".s15-chart"), { autoAlpha: 0.08, duration: 0.6 }, 0)
        .fromTo($(el, ".s15-vs"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      up(tl, [$(el, ".s15-vs .kicker"), ...$$(el, ".s15-vs .col")], 0.4, { s: 0.3 });
      up(tl, $(el, ".s15-q"), 1.6);
    }
  ]
});

// ---------------------------------------------------------------- 16 · follow one load (3)
const s16 = stepper({
  id: "s-load3", title: "Follow one load (3): screen, check, return", loop: 4, steps: 3,
  html: `
    ${railHTML()}
    <div class="s16-title"><p class="kicker fx">Follow one load · part 3</p><h2 class="head split">Screen, check, <em>return</em></h2></div>
    <svg class="s16-drum" viewBox="0 0 1200 640" aria-label="Illustration of a drum screen separating fine compost from coarse pieces">
      <defs><clipPath id="drumclip"><rect x="200" y="160" width="700" height="240" rx="30"/></clipPath></defs>
      <path class="hopper" d="M70 40H330L280 170H120Z"/>
      <g clip-path="url(#drumclip)"><rect x="200" y="160" width="700" height="240" class="drum"/><g class="mesh">${Array.from({ length: 30 }, (_, i) => `<line x1="${200 + i * 26}" y1="160" x2="${200 + i * 26 - 60}" y2="400"/>`).join("")}</g></g>
      <rect x="200" y="160" width="700" height="240" rx="30" class="drumline"/>
      <text class="dl hint" x="550" y="140" text-anchor="middle">a turning drum with holes</text>
      <path class="hintline" d="M400 420L400 470M560 420L560 470M700 420L700 470"/>
      <text class="dl hint" x="150" y="490">fine pieces fall through ↓</text>
      <path class="hintline" d="M905 300C960 300 990 360 1000 420"/>
      <text class="dl hint" x="930" y="270">coarse pieces roll out</text>
      <path class="pile fine" d="M300 600C380 470 640 470 720 600Z"/><text class="dl" x="510" y="630" text-anchor="middle">fine compost</text>
      <rect x="940" y="430" width="200" height="150" class="bin"/><text class="dl" x="1040" y="620" text-anchor="middle">rejects</text>
      <g class="parts"></g>
    </svg>
    <div class="panel s16-p0 fx"><p class="pk mono">07 Screen</p><p>Mature compost goes through a screen — like a giant sieve. Fine compost falls through. Things that cannot become compost are collected separately and handed to an authorised company.</p><p>Quality is checked against a Slovak standard for industrial composts (STN 46 5735).</p><p class="st mono"><b class="st-confirmed">●</b> operator, email 23 Sep</p>${nophoto("we did not see the screen working")}</div>
    <div class="s16-out">
      <p class="mega s16-num"><span class="num">0</span>–<span class="num2">0</span> t</p>
      <p class="sub fx">of compost a year</p>
      <div class="dest">
        <div class="fx"><svg viewBox="-40 -40 80 80"><path d="M-26 6L0 -18L26 6V30H-26Z"/><rect x="-8" y="12" width="16" height="18"/></svg><b>Residents' gardens</b><span>in Senica</span></div>
        <div class="fx"><svg viewBox="-40 -40 80 80"><circle cx="-12" cy="-6" r="16"/><circle cx="12" cy="-12" r="18"/><path d="M-12 10V30M12 6V30"/></svg><b>Parks & flower beds</b><span>the town's green areas</span></div>
      </div>
      <p class="st mono fx"><b class="st-confirmed">●</b> operator, email 23 Sep</p>
    </div>
    <div class="s16-mass">
      <div class="io in fx"><p class="big">3,327 t</p><p class="mono">in · 2025</p></div>
      <svg class="flow" viewBox="0 0 700 240" aria-hidden="true"><path class="a" d="M0 120H640"/><path class="a" d="M612 92L650 120L612 148"/><path class="b" d="M200 120C260 120 280 30 360 10"/><path class="b2" d="M260 120C320 120 330 210 400 230"/></svg>
      <div class="io outp fx"><p class="big">650–800 t</p><p class="mono">compost out · per year</p></div>
      <p class="q fx">Where did the rest go?</p>
      <div class="interp fx"><p class="mono"><b class="st-likely">◌</b> our interpretation</p><p>Most of it probably leaves as <b>water vapour</b> and <b>CO₂</b>: microbes break the material down and the heat dries it. Plus the rejects from the screen.</p><p class="mono unk"><b class="st-unknown">?</b> our next question for the operator</p></div>
    </div>
    <div class="s16-src">${pills("tssenica", ["visitcompost", "Our field visit"])}</div>`,
  setup(el) {
    const g = $(el, ".parts"), R = rng(16);
    for (let i = 0; i < 40; i++) {
      const fine = i % 4 !== 0;
      svg(fine ? "circle" : "rect", fine ? { r: 4 + R() * 3, class: "p fine", "data-i": i } : { width: 18 + R() * 16, height: 7, rx: 2, class: "p coarse" + (i % 8 === 0 ? " plast" : ""), "data-i": i }, g);
    }
    el._parts = gsap.timeline({ paused: true, repeat: -1 });
    $$(el, ".parts .p").forEach((p, i) => {
      const t = (i * 0.17) % 6.8, fine = p.classList.contains("fine");
      el._parts.fromTo(p, { x: 200, y: 110, opacity: 0 }, { x: 250, y: 200, opacity: 1, duration: 0.5, ease: "power1.in" }, t);
      if (fine) el._parts.to(p, { x: 320 + (i * 37) % 360, y: 540 + (i % 3) * 12, duration: 1.2, ease: "power2.in" }, t + 0.5).to(p, { opacity: 0, duration: 0.3 }, t + 1.6);
      else el._parts.to(p, { x: 880, y: 300, rotation: 180, duration: 1.4, ease: "none" }, t + 0.5).to(p, { x: 1020, y: 500, duration: 0.6, ease: "power2.in" }, t + 1.9).to(p, { opacity: 0, duration: 0.3 }, t + 2.4);
    });
    el._mesh = gsap.to($(el, ".mesh"), { x: 26, duration: 0.6, ease: "none", repeat: -1, paused: true });
    gsap.set([$(el, ".s16-out"), $(el, ".s16-mass")], { autoAlpha: 0 });
    railSet(el, 5);
  },
  timelines: [
    (tl, el) => {
      fade(tl, $(el, ".rail"), 0, { d: 0.4 });
      railTo(tl, el, 5, 6, 0.3, 1);
      head(tl, $(el, ".s16-title .head"), 0.2);
      up(tl, [$(el, ".s16-title .kicker"), $(el, ".s16-src")], 0.4);
      tl.fromTo($(el, ".s16-drum"), { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1, immediateRender: false }, 0.6);
      up(tl, $(el, ".s16-p0"), 1.2);
    },
    (tl, el) => {
      railTo(tl, el, 6, 7, 0, 1);
      tl.to([$(el, ".s16-drum"), $(el, ".s16-p0")], { autoAlpha: 0, duration: 0.6 }, 0)
        .fromTo($(el, ".s16-out"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.4);
      count(tl, $(el, ".s16-out .num"), 650, 0.5, { d: 1.6 });
      count(tl, $(el, ".s16-out .num2"), 800, 0.5, { d: 1.8 });
      up(tl, [$(el, ".s16-out .sub"), ...$$(el, ".s16-out .dest > div"), $(el, ".s16-out .st")], 1, { s: 0.3 });
    },
    (tl, el) => {
      tl.to([$(el, ".s16-out"), $(el, ".s16-title")], { autoAlpha: 0, duration: 0.5 }, 0)
        .fromTo($(el, ".s16-mass"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      up(tl, $(el, ".s16-mass .in"), 0.4);
      tl.fromTo($$(el, ".s16-mass .flow .a"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1, immediateRender: false }, 0.8)
        .fromTo([$(el, ".s16-mass .flow .b"), $(el, ".s16-mass .flow .b2")], { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, stagger: 0.2, immediateRender: false }, 1.5);
      up(tl, $(el, ".s16-mass .outp"), 1.4);
      up(tl, $(el, ".s16-mass .q"), 2.2);
      up(tl, $(el, ".s16-mass .interp"), 2.8);
    }
  ],
  onStep(step, dir, el) { if (step === 0) { el._parts.play(); el._mesh.play(); } else { el._parts.pause(); el._mesh.pause(); } },
  onLeave(el, ctx) { ctx.whenHidden(el, () => { el._parts.pause(); el._mesh.pause(); }); }
});

// ---------------------------------------------------------------- 17 · what should never go in
const FOOD = P("food-waste-bags");
let ph17;
const s17 = stepper({
  id: "s-never", title: "What should never go in", loop: 4, steps: 5,
  html: `
    ${photoHTML("never", { ...FOOD, alt: "Food waste, much of it still in plastic bags, at the Senica composting plant" })}
    <div class="s17-shade"></div>
    <div class="s17-title"><p class="kicker fx">Back to our first photo</p><h2 class="head split">So — can this go back <em>to soil?</em></h2></div>
    <div class="s17-answer">
      <div class="yes fx"><p class="mono">The food</p><p class="big">Yes.</p><p>It can become compost.</p></div>
      <div class="no fx"><p class="mono">The plastic</p><p class="big">Never.</p><p>It must be taken out — by hand or by the screen.</p></div>
    </div>
    <div class="s17-list">
      <p class="kicker fx">What the plant finds in bio-waste · operator, email 23 Sep</p>
      <ul>${["stones", "soil", "plastic", "textile", "mixed rubbish", "metal"].map((t) => `<li class="fx">${t}</li>`).join("")}<li class="fx wide">+ branches that are not prepared as instructed</li></ul>
    </div>
    <div class="s17-chain">
      <p class="fx"><b>One wrong item</b></p><i class="fx">→</i><p class="fx">extra sorting work</p><i class="fx">→</i><p class="fx">rejects for an authorised company</p><i class="fx">→</i><p class="fx">what the screen misses can end up in gardens <span class="mono">◌</span></p>
    </div>
    <div class="s17-also">
      <div class="fx"><p class="mono"><b class="st-seen">○</b> our photo · windrow</p><p>We saw small plastic pieces even inside the compost piles.</p></div>
      <div class="fx"><p class="big">12 %</p><p>Horné Jatovo biogas plant: up to 12 % of delivered bio-waste did not belong there — even a printer and rebar (report, July 2024).</p><span data-src="ctzn"></span></div>
    </div>
    <div class="s17-end">
      <p class="mega split">Plastic does not become <em>soil.</em></p>
      <p class="sub fx">What can people do? The operator's answer was short: <b>“Don't put unwanted things in bio-waste.”</b></p>
    </div>
    ${legendHTML("s17-leg")}
    <div class="s17-src">${pills(["visitcompost", "Our photo"], "tssenica")}</div>`,
  setup(el) {
    ph17 = bindPhoto(el, "never", {
      ...FOOD, start: { x: 960, y: 640, z: 1.02 },
      notes: [
        { id: "b1", x: 930, y: 664, title: "Plastic bag", text: "still closed, food inside", status: "seen", dx: -80, dy: 260, r: 26 },
        { id: "b2", x: 1190, y: 702, title: "Plastic bag", status: "seen", dx: 120, dy: 200, r: 22 },
        { id: "b3", x: 800, y: 545, title: "Plastic bag", status: "seen", dx: -200, dy: -40, r: 22 }
      ],
      loupes: [
        { id: "l1", x: 930, y: 660, at: [1560, 300], d: 330, mag: 3.2, title: "zoom ×3" },
        { id: "l2", x: 1192, y: 700, at: [1730, 640], d: 240, mag: 3.6 }
      ]
    });
    gsap.set([$(el, ".s17-answer"), $(el, ".s17-list"), $(el, ".s17-chain"), $(el, ".s17-also"), $(el, ".s17-end")], { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(ph17.el, { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: 1.4, immediateRender: false }, 0);
      ph17.move(tl, { x: 960, y: 650, z: 1.15 }, 0, { d: 6, ease: "none" });
      head(tl, $(el, ".s17-title .head"), 0.6);
      up(tl, [$(el, ".s17-title .kicker"), $(el, ".s17-src")], 0.8);
    },
    (tl, el) => {
      ph17.move(tl, { x: 1000, y: 660, z: 1.5 }, 0, { d: 2 });
      ph17.show(tl, ["b1", "b2", "b3"], 0.6, { stagger: 0.4 });
      ph17.loupe(tl, "l1", 1.4);
      ph17.loupe(tl, "l2", 1.9);
      fade(tl, $(el, ".s17-leg"), 1);
    },
    (tl, el) => {
      ph17.hide(tl, ["b1", "b2", "b3"], 0);
      ph17.unloupe(tl, "l1", 0); ph17.unloupe(tl, "l2", 0);
      tl.to([ph17.el], { autoAlpha: 0.14, duration: 0.7 }, 0.1)
        .to([$(el, ".s17-title"), $(el, ".s17-leg")], { autoAlpha: 0, duration: 0.4 }, 0)
        .fromTo($(el, ".s17-answer"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      up(tl, $(el, ".s17-answer .yes"), 0.4);
      up(tl, $(el, ".s17-answer .no"), 1.1);
      tl.fromTo($(el, ".s17-list"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 1.9);
      up(tl, [$(el, ".s17-list .kicker"), ...$$(el, ".s17-list li")], 2, { s: 0.12 });
    },
    (tl, el) => {
      tl.to([$(el, ".s17-answer"), $(el, ".s17-list")], { autoAlpha: 0, y: -20, duration: 0.5 }, 0)
        .fromTo([$(el, ".s17-chain"), $(el, ".s17-also")], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      up(tl, $$(el, ".s17-chain > *"), 0.4, { s: 0.16, y: 0 });
      up(tl, $$(el, ".s17-also > div"), 1.8, { s: 0.4 });
    },
    (tl, el) => {
      tl.to([$(el, ".s17-chain"), $(el, ".s17-also")], { autoAlpha: 0, duration: 0.5 }, 0)
        .to(ph17.el, { autoAlpha: 0.32, duration: 0.8 }, 0)
        .fromTo($(el, ".s17-end"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.3);
      head(tl, $(el, ".s17-end .mega"), 0.4, { s: 0.1, d: 1.3 });
      up(tl, $(el, ".s17-end .sub"), 1.6);
    }
  ]
});

export default [s12, s13, s14, s15, s16, s17];
