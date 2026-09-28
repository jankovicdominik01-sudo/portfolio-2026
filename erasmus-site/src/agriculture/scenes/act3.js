// ACT III · FOOD → WASTE — scenes 12–14
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";

// ---------------------------------------------------------------- 12
const SHAPES = {
  tomato: "M300 120C420 120 520 210 520 330C520 450 420 540 300 540C180 540 80 450 80 330C80 210 180 120 300 120Z",
  plate: "M40 340C40 280 160 240 300 240C440 240 560 280 560 340C560 400 440 440 300 440C160 440 40 400 40 340Z",
  scraps: "M120 420L180 390L220 440L150 460Z M260 440C290 400 340 400 360 440C330 470 290 470 260 440Z M400 400L470 410L450 470L390 450Z M180 480L230 470L240 510L190 515Z M330 500C350 480 390 480 400 510C370 530 350 530 330 500Z",
  bin: "M160 200H440L410 540H190Z M140 165H460V200H140Z M260 135H340V165H260Z",
  stream: "M-200 330C0 300 200 360 450 330S800 300 1100 330V420C800 390 650 450 450 420S0 390 -200 420Z"
};
const s12 = stepper({
  id: "s-foodwaste", title: "Then food becomes waste", loop: 2, steps: 3,
  notes: "In 2025 Senica's composting plant took in over 3,300 tonnes of bio-waste — the operator told us this by email. 20 02 01 = biodegradable garden and park waste; 20 01 08 = biodegradable kitchen and canteen waste.",
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
      <p class="kicker">Senica composting plant · intake in 2025</p>
      <p class="s12-big"><span class="num">0</span> t</p>
      <div class="bar"><i class="g"></i><i class="k"></i><em class="cap"></em></div>
      <ul class="mono"><li><b class="sw g"></b>2,685 t garden & park waste <small>(20 02 01)</small></li><li><b class="sw k"></b>642 t kitchen waste <small>(20 01 08)</small></li><li><b class="sw c"></b>capacity 4,200 t / year</li></ul>
      <span data-src="tssenica"></span>
    </div>
    <figure class="s12-photo fx"><img src="img/kitchen-waste.webp" data-lightbox="waste" alt="Kitchen bio-waste: vegetable peels and scraps" data-caption="Kitchen bio-waste. Photo: Muu-karhu · CC BY-SA 3.0 · Wikimedia Commons"><figcaption class="mono">Real kitchen bio-waste · Muu-karhu · CC BY-SA 3.0</figcaption></figure>
    <div class="s12-eu fx"><span class="stamp">EU · since 31 Dec 2023</span><p>Bio-waste must be separated at source or collected separately.</p><span data-src="euwfd"></span></div>`,
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
      fade(tl, $(el, ".s12-photo"), 6.6);
    },
    (tl, el) => {
      tl.to($(el, ".morph"), { morphSVG: SHAPES.stream, fill: "#8c6a48", duration: 1.4, ease: "power2.inOut" }, 0)
        .call(() => ($(el, ".s12-label").textContent = "Waste stream"), null, 0.6)
        .to($(el, ".morphg"), { x: -700, y: 250, scale: 0.9, svgOrigin: "1360 530", duration: 1.4, ease: "power2.inOut" }, 0.9)
        .to($(el, ".s12-photo"), { autoAlpha: 0, duration: 0.4 }, 0)
        .to([$(el, ".morphg"), $(el, ".s12-label")], { autoAlpha: 0, duration: 0.6 }, 2);
      up(tl, $(el, ".s12-tons"), 1.2);
      count(tl, $(el, ".s12-big .num"), 3327, 1.4, { d: 1.8 });
      tl.fromTo($(el, ".bar .g"), { width: 0 }, { width: (2685 / 4200) * 100 + "%", duration: 1.2, ease: "power2.out", immediateRender: false }, 1.5)
        .fromTo($(el, ".bar .k"), { width: 0 }, { width: (642 / 4200) * 100 + "%", duration: 0.8, ease: "power2.out", immediateRender: false }, 2.5);
    },
    (tl, el) => { up(tl, $(el, ".s12-eu"), 0); }
  ]
});

// ---------------------------------------------------------------- 13
const ITEMS = [
  { k: "Plastic bag", x: 560, y: 460, where: "Screened out and handed to an authorised company for disposal (operator)." },
  { k: "Can / metal", x: 1180, y: 380, where: "Metal is on the operator's list of problem items." },
  { k: "Textile", x: 880, y: 700, where: "Textile doesn't belong in bio-waste — it has to be removed." },
  { k: "Stone", x: 1460, y: 640, where: "Stones are on the operator's list — they have to be screened out." },
  { k: "Soil", x: 380, y: 760, where: "Soil is on the operator's list of things that shouldn't be in the bin." },
  { k: "Mixed municipal waste", x: 1340, y: 860, where: "Mixed rubbish belongs in the black bin, not in bio-waste." }
];
const s13 = stepper({
  id: "s-contamination", title: "It looks clean. Look closer.", loop: 3, steps: 3,
  notes: "The composting plant told us this directly. The top photo is garden waste (not from Senica); the close-up is an illustration of the items the operator listed. After 30 September our own photos replace it.",
  html: `
    <div class="s13-photo"><img src="img/garden-waste.webp" alt="Garden waste being dumped into a container"></div>
    <div class="s13-shade"></div>
    <div class="s13-text"><p class="kicker fx">Bio-waste, from above</p><h2 class="head split">It looks clean. <em>Look closer.</em></h2><p class="mono s13-cred fx">Photo: garden waste · Albarubescens · CC BY-SA 4.0 · not from Senica</p></div>
    <svg class="s13-macro" viewBox="0 0 1920 1080" aria-label="Illustrated close-up of bio-waste with contaminants"></svg>
    <div class="s13-tip"></div>
    <p class="s13-cap fx"><b>What the Senica composting plant finds in bio-waste:</b> stones, soil, plastic, textile, mixed municipal waste, metal — and branches that aren't prepared as instructed. <span data-src="tssenica"></span></p>
    <span class="visnote s13-vis fx">Illustration of the operator's list</span>
    <div class="s13-chain">
      <p class="fx"><b>One wrong item</b></p><i class="fx">→</i><p class="fx">extra sorting</p><i class="fx">→</i><p class="fx">rejected material</p><i class="fx">→</i><p class="fx">lower-quality compost</p>
    </div>
    <div class="s13-nums">
      <div class="fx"><p class="big">12 %</p><p>Horné Jatovo biogas plant: up to 12 % of delivered bio-waste didn't belong there — even a printer and rebar (July 2024).</p><span data-src="ctzn"></span></div>
      <div class="fx"><p class="big">3 g/kg</p><p>EU limit for compost or digestate sold as a fertilising product: glass, metal and plastic over 2 mm, per kg of dry matter.</p><span data-src="eufpr"></span></div>
    </div>`,
  setup(el, ctx) {
    const s = $(el, ".s13-macro"), R = rng(13);
    s.innerHTML = `<rect width="1920" height="1080" fill="#211a12"/>`;
    const org = svg("g", {}, s);
    for (let i = 0; i < 420; i++) {
      const x = R() * 1920, y = R() * 1080, r = 10 + R() * 40, a = R() * 180, t = R();
      if (t < 0.45) svg("ellipse", { cx: x, cy: y, rx: r, ry: r * 0.45, transform: `rotate(${a} ${x} ${y})`, fill: `hsl(${40 + R() * 70},${30 + R() * 30}%,${18 + R() * 22}%)` }, org);
      else if (t < 0.75) svg("path", { d: `M${x} ${y}l${(R() - 0.5) * 160} ${(R() - 0.5) * 60}`, stroke: `hsl(${25 + R() * 15},${30 + R() * 20}%,${22 + R() * 18}%)`, "stroke-width": 3 + R() * 7, "stroke-linecap": "round" }, org);
      else svg("circle", { cx: x, cy: y, r: r * 0.4, fill: `hsl(${20 + R() * 40},${40 + R() * 30}%,${30 + R() * 25}%)` }, org);
    }
    const draw = {
      "Plastic bag": (g, x, y) => { svg("path", { d: `M${x - 70} ${y - 30}C${x - 40} ${y - 60} ${x + 50} ${y - 50} ${x + 80} ${y - 20}L${x + 60} ${y + 60}C${x + 10} ${y + 80} ${x - 40} ${y + 70} ${x - 80} ${y + 40}Z`, fill: "rgba(235,240,245,.82)", stroke: "#fff", "stroke-width": 2 }, g); svg("path", { d: `M${x - 40} ${y - 45}q15 -40 40 0M${x + 20} ${y - 48}q15 -40 40 0`, stroke: "rgba(235,240,245,.9)", "stroke-width": 6, fill: "none" }, g); },
      "Can / metal": (g, x, y) => { svg("rect", { x: x - 60, y: y - 30, width: 120, height: 60, rx: 10, fill: "#9aa3ab", transform: `rotate(-20 ${x} ${y})` }, g); svg("path", { d: `M${x - 80} ${y + 60}l140 -20l20 30`, stroke: "#6f7780", "stroke-width": 7, fill: "none" }, g); },
      Textile: (g, x, y) => svg("path", { d: `M${x - 90} ${y - 20}c30 -30 60 10 90 -10s60 -20 90 10l-10 60c-30 20 -60 -10 -90 10s-60 10 -80 -10z`, fill: "#3f6bb0", stroke: "#2c4f86", "stroke-width": 3 }, g),
      Stone: (g, x, y) => svg("path", { d: `M${x - 60} ${y}c0 -40 40 -55 70 -45s50 30 45 55s-40 40 -70 35s-45 -20 -45 -45z`, fill: "#8d8a84", stroke: "#6d6a64", "stroke-width": 3 }, g),
      Soil: (g, x, y) => { for (let i = 0; i < 26; i++) svg("circle", { cx: x + (R() - 0.5) * 120, cy: y + (R() - 0.5) * 60, r: 6 + R() * 12, fill: "#4b3622" }, g); },
      "Mixed municipal waste": (g, x, y) => svg("path", { d: `M${x - 70} ${y + 40}c-10 -60 20 -100 70 -100s80 40 70 100z M${x - 10} ${y - 60}l10 -20l10 20z`, fill: "#161616", stroke: "#333", "stroke-width": 3 }, g)
    };
    const tip = $(el, ".s13-tip");
    ITEMS.forEach((it, i) => {
      const g = svg("g", { class: "item interactive", "data-i": i }, s);
      draw[it.k](g, it.x, it.y);
      const ring = svg("g", { class: "ring13" }, s);
      svg("circle", { cx: it.x, cy: it.y, r: 110, class: "rc" }, ring);
      const t = svg("text", { x: it.x, y: it.y - 128, "text-anchor": "middle", class: "rt" }, ring);
      t.textContent = it.k;
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        tip.innerHTML = `<b>${it.k}</b>${it.where}`;
        tip.style.left = Math.min(1500, it.x + 120) + "px"; tip.style.top = Math.max(120, it.y - 60) + "px";
        gsap.fromTo(tip, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3 });
      });
    });
    el.addEventListener("click", () => gsap.to(tip, { autoAlpha: 0, duration: 0.2 }));
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s13-photo"), { scale: 1 }, { scale: 1.08, duration: 6, ease: "none", immediateRender: false }, 0);
      head(tl, $(el, ".s13-text .head"), 0.2);
      up(tl, [$(el, ".s13-text .kicker"), $(el, ".s13-cred")], 0.4);
    },
    (tl, el) => {
      tl.to($(el, ".s13-photo"), { scale: 3.2, autoAlpha: 0, duration: 1.6, ease: "expo.in", transformOrigin: "55% 60%" }, 0)
        .to($(el, ".s13-text"), { autoAlpha: 0, duration: 0.5 }, 0)
        .fromTo($(el, ".s13-macro"), { autoAlpha: 0, scale: 0.7 }, { autoAlpha: 1, scale: 1, duration: 1.4, ease: "expo.out", immediateRender: false }, 1.3)
        .fromTo($$(el, ".ring13"), { autoAlpha: 0, scale: 1.8, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.3, ease: "back.out(2)", immediateRender: false }, 2.5);
      up(tl, [$(el, ".s13-cap"), $(el, ".s13-vis")], 2.4);
    },
    (tl, el) => {
      tl.to($(el, ".s13-macro"), { opacity: 0.1, duration: 0.8 }, 0).to($(el, ".s13-cap"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, $$(el, ".s13-chain > *"), 0.3, { s: 0.18, y: 0 });
      up(tl, $$(el, ".s13-nums > div"), 1.6, { s: 0.4 });
    }
  ]
});

// ---------------------------------------------------------------- 14
const ICON = {
  branch: '<path d="M-26 8L26 -8M0 0l8 -16M-10 3l-6 -14" stroke="#8c6a48" stroke-width="5" stroke-linecap="round" fill="none"/>',
  leaf: '<path d="M-20 0C-10 -16 14 -16 22 0C14 14 -10 14 -20 0Z" fill="#b89a3a"/><path d="M-20 0H22" stroke="#6f5a20" stroke-width="2"/>',
  grass: '<path d="M-14 12q2 -20 -4 -28M0 12q0 -22 4 -30M12 12q-2 -18 8 -24" stroke="#8fb55b" stroke-width="4" fill="none" stroke-linecap="round"/>',
  food: '<path d="M-18 6C-18 -12 18 -16 20 2C20 16 -14 20 -18 6Z" fill="#d9772f"/><circle cx="4" cy="-2" r="5" fill="#a8c65a"/>',
  oil: '<path d="M0 -22C10 -6 16 2 16 10A16 16 0 0 1 -16 10C-16 2 -10 -6 0 -22Z" fill="#e7c24a"/>',
  slurry: '<ellipse cx="0" cy="4" rx="22" ry="12" fill="#5b4028"/><ellipse cx="-6" cy="0" rx="7" ry="3" fill="#7a5a3a"/>'
};
const s14 = stepper({
  id: "s-split", title: "The right material for the right process", loop: 3, steps: 3,
  notes: "This split comes from the Slovak Biogas Association — an industry view, so we say whose view it is. Composting needs oxygen; a biogas plant works without it.",
  html: `
    <div class="s14-text"><p class="kicker fx">Composting and biogas are not rivals</p><h2 class="head split">The right material <em>for the right process</em></h2></div>
    <svg class="s14-svg" viewBox="0 0 1920 1080" aria-label="Bio-waste splits into composting and anaerobic digestion; both return to the soil">
      <path id="s14L" class="flowp" d="M960 360C900 520 600 520 520 690"/>
      <path id="s14R" class="flowp" d="M960 360C1020 520 1320 520 1400 690"/>
      <path id="s14L2" class="flowp2" d="M520 800C520 900 700 960 960 985"/>
      <path id="s14R2" class="flowp2" d="M1400 800C1400 900 1220 960 960 985"/>
      <circle cx="960" cy="340" r="64" class="pile"/><text x="960" y="350" class="pl" text-anchor="middle">bio-waste</text>
      <g class="box l"><rect x="330" y="690" width="380" height="110" rx="8"/><text x="520" y="738" text-anchor="middle">COMPOSTING</text><text x="520" y="772" text-anchor="middle" class="t2">with oxygen · heat · weeks to months</text></g>
      <g class="box r"><rect x="1210" y="690" width="380" height="110" rx="8"/><text x="1400" y="738" text-anchor="middle">ANAEROBIC DIGESTION</text><text x="1400" y="772" text-anchor="middle" class="t2">no oxygen · biogas + digestate</text></g>
      <rect x="0" y="985" width="1920" height="95" class="soil14"/><text x="960" y="1040" text-anchor="middle" class="sl">compost and digestate → back to the soil</text>
      <g class="icons"></g>
    </svg>
    <div class="s14-sba fx"><p><b>According to the Slovak Biogas Association:</b> woody material suits composting; liquid waste, animal by-products and oils suit biogas plants — and the two should cooperate.</p><span data-src="sba"></span></div>
    <div class="s14-vince fx">
      <p class="quote">“By definition, compost is a managed process.”</p>
      <p class="quote-by"><b>Jozef Vince</b> · our interview · on his farm's own “unmanaged heap, which people call compost”</p>
      <span data-src="vince"></span>
    </div>`,
  setup(el) {
    const g = $(el, ".icons");
    [["branch", "L"], ["food", "R"], ["leaf", "L"], ["oil", "R"], ["grass", "L"], ["slurry", "R"], ["branch", "L"], ["food", "R"]].forEach(([k, side], i) => {
      const n = svg("g", { class: "ic ic" + side, "data-side": side, "data-i": i }, g);
      n.innerHTML = ICON[k];
    });
    el._loop = gsap.timeline({ paused: true, repeat: -1 });
    $$(el, ".ic").forEach((n, i) => {
      const p = n.dataset.side;
      el._loop.fromTo(n, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, i * 0.6)
        .to(n, { motionPath: { path: `#s14${p}`, align: `#s14${p}`, alignOrigin: [0.5, 0.5] }, duration: 2.2, ease: "power1.in" }, i * 0.6)
        .to(n, { autoAlpha: 0, duration: 0.3 }, i * 0.6 + 2);
    });
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s14-text .head"), 0);
      up(tl, $(el, ".s14-text .kicker"), 0.2);
      tl.fromTo($(el, ".pile"), { scale: 0, svgOrigin: "960 340" }, { scale: 1, duration: 0.8, ease: "back.out(2)", immediateRender: true }, 0.4)
        .fromTo($$(el, ".flowp"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power2.inOut", immediateRender: true }, 0.9)
        .fromTo($$(el, ".box"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.2, immediateRender: true }, 1.7)
        .fromTo($$(el, ".flowp2"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, immediateRender: true }, 2.3)
        .fromTo($(el, ".soil14"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: true }, 2.9)
        .fromTo($(el, ".sl"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: true }, 3.1)
        .call(() => el._loop.play(0), null, 1.8);
    },
    (tl, el) => { up(tl, $(el, ".s14-sba"), 0); },
    (tl, el) => { tl.to($(el, ".s14-sba"), { y: -40, opacity: 0.5, duration: 0.6 }, 0); up(tl, $(el, ".s14-vince"), 0.3); }
  ],
  onEnter(el, ctx, dir) { if (dir < 0 || ctx.reduced) el._loop.play(0); if (ctx.reduced) el._loop.pause(1.4); },
  onLeave(el) { setTimeout(() => el._loop.pause(), 800); }
});

export default [s12, s13, s14];
