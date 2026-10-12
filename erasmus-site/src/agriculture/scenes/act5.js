// ACT V · RECOVERY AND BACK TO SOIL — scenes 18–22
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng, loop } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";
import { createDigester } from "../lib/digester3d.js";
import { createSoil } from "../lib/soil.js";

// ---------------------------------------------------------------- 18 · right material, right process
const ICON = {
  branch: '<path d="M-26 8L26 -8M0 0l8 -16M-10 3l-6 -14" stroke="#8c6a48" stroke-width="5" stroke-linecap="round" fill="none"/>',
  leaf: '<path d="M-20 0C-10 -16 14 -16 22 0C14 14 -10 14 -20 0Z" fill="#b89a3a"/><path d="M-20 0H22" stroke="#6f5a20" stroke-width="2"/>',
  grass: '<path d="M-14 12q2 -20 -4 -28M0 12q0 -22 4 -30M12 12q-2 -18 8 -24" stroke="#8fb55b" stroke-width="4" fill="none" stroke-linecap="round"/>',
  food: '<path d="M-18 6C-18 -12 18 -16 20 2C20 16 -14 20 -18 6Z" fill="#d9772f"/><circle cx="4" cy="-2" r="5" fill="#a8c65a"/>',
  oil: '<path d="M0 -22C10 -6 16 2 16 10A16 16 0 0 1 -16 10C-16 2 -10 -6 0 -22Z" fill="#e7c24a"/>',
  slurry: '<ellipse cx="0" cy="4" rx="22" ry="12" fill="#5b4028"/><ellipse cx="-6" cy="0" rx="7" ry="3" fill="#7a5a3a"/>'
};
const s18 = stepper({
  id: "s-split", title: "The right material for the right process", loop: 4, steps: 3,
  html: `
    <div class="s14-text"><p class="kicker fx">Composting and biogas are not rivals</p><h2 class="head split">The right material <em>for the right process</em></h2></div>
    <svg class="s14-svg" viewBox="0 0 1920 1080" aria-label="Bio-waste splits into composting and anaerobic digestion; both return to the soil">
      <path id="s14L" class="flowp" d="M960 360C900 520 600 520 520 690"/>
      <path id="s14R" class="flowp" d="M960 360C1020 520 1320 520 1400 690"/>
      <path id="s14L2" class="flowp2" d="M520 800C520 900 700 960 960 985"/>
      <path id="s14R2" class="flowp2" d="M1400 800C1400 900 1220 960 960 985"/>
      <circle cx="960" cy="340" r="64" class="pile"/><text x="960" y="350" class="pl" text-anchor="middle">bio-waste</text>
      <g class="box l"><rect x="330" y="690" width="380" height="110" rx="8"/><text x="520" y="738" text-anchor="middle">COMPOSTING</text><text x="520" y="772" text-anchor="middle" class="t2">with air · heat · months</text></g>
      <g class="box r"><rect x="1210" y="690" width="380" height="110" rx="8"/><text x="1400" y="738" text-anchor="middle">ANAEROBIC DIGESTION</text><text x="1400" y="772" text-anchor="middle" class="t2">no air · biogas + digestate</text></g>
      <rect x="0" y="985" width="1920" height="95" class="soil14"/><text x="960" y="1040" text-anchor="middle" class="sl">compost and digestate → back to the soil · if they are clean</text>
      <g class="icons"></g>
    </svg>
    <p class="s14-senica mono fx">Senica: composting with air — for garden and kitchen waste <span data-src="tssenica"></span></p>
    <div class="s14-sba fx"><p><b>According to the Slovak Biogas Association:</b> woody material suits composting; liquid waste, animal by-products and oils suit biogas plants — and the two should cooperate.</p><span data-src="sba"></span></div>
    <p class="s14-end fx">Wrong material in the wrong process = a worse result in <em>both.</em></p>`,
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
      tl.fromTo($(el, ".pile"), { scale: 0, svgOrigin: "960 340" }, { scale: 1, duration: 0.8, ease: "back.out(2)", immediateRender: false }, 0.4)
        .fromTo($$(el, ".flowp"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, ease: "power2.inOut", immediateRender: false }, 0.9)
        .fromTo($$(el, ".box"), { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.2, immediateRender: false }, 1.7)
        .fromTo($$(el, ".flowp2"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, immediateRender: false }, 2.3)
        .fromTo($(el, ".soil14"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: false }, 2.9)
        .fromTo($(el, ".sl"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, immediateRender: false }, 3.1);
      up(tl, $(el, ".s14-senica"), 2.4);
    },
    (tl, el) => { up(tl, $(el, ".s14-sba"), 0); },
    (tl, el) => { tl.to($(el, ".s14-sba"), { y: -30, opacity: 0.55, duration: 0.6 }, 0); up(tl, $(el, ".s14-end"), 0.3); }
  ],
  onEnter(el, ctx) { if (ctx.reduced) el._loop.pause(1.4); else el._loop.play(0); },
  onLeave(el, ctx) { ctx.whenHidden(el, () => el._loop.pause()); }
});

// ---------------------------------------------------------------- 19 · how a biogas plant works
const PROC = [
  ["Input", "Bio-waste, manure and slurry are fed in."],
  ["No air", "Bacteria break it down without oxygen, kept warm: 35–40 °C or 50–55 °C."],
  ["Biogas", "Methane (CH₄) and CO₂ bubble up and collect under the dome."],
  ["Use", "An engine makes electricity and heat — or the gas is cleaned into biomethane."],
  ["Digestate", "What's left is digestate: it can go back to fields as fertiliser."]
];
let dig = null, digTried = false;
const s19 = stepper({
  id: "s-biogas3d", title: "How a biogas plant works", loop: 4, steps: 5,
  html: `
    <canvas class="s15-gl" aria-label="3D cutaway of a biogas digester"></canvas>
    <div class="s15-labels">
      <span data-anchor="inlet" data-step="0">Bio-waste in</span>
      <span data-anchor="heat" data-step="1">35–40 °C · no oxygen</span>
      <span data-anchor="gas" data-step="2" class="ch4">CH₄ + CO₂</span>
      <span data-anchor="chp" data-step="3">Engine → power + heat</span>
      <span data-anchor="upg" data-step="3" class="ch4">Biomethane</span>
      <span data-anchor="store" data-step="4">Digestate → fields</span>
    </div>
    <div class="s15-text"><p class="kicker fx">Anaerobic digestion</p><h2 class="head split">How a biogas plant <em>works</em></h2>
      <ol class="s15-steps">${PROC.map((p, i) => `<li data-i="${i}"><b>${String(i + 1).padStart(2, "0")} · ${p[0]}</b><span>${p[1]}</span></li>`).join("")}</ol>
      ${pills(["spravabudovy", "Explainer · process only"])}</div>
    <p class="s15-fallback small">3D view not available on this device — the steps on the left describe the same process.</p>
    <span class="visnote s15-vis">Simplified 3D model · not a specific plant</span>`,
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s15-text .head"), 0);
      up(tl, [$(el, ".s15-text .kicker"), $(el, ".s15-text .srcrow")], 0.2);
      tl.fromTo($(el, ".s15-gl"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, immediateRender: false }, 0.2);
    }
  ],
  onEnter(el, ctx) {
    if (!digTried) {
      digTried = true;
      dig = createDigester($(el, ".s15-gl"), $(el, ".s15-labels"), { quality: ctx.quality, getScale: () => ctx.scale || 1, gsap });
      if (!dig) el.classList.add("nogl");
      addEventListener("resize", () => dig && dig.resize());
    }
    dig && dig.start();
  },
  onStep(step, dir, el, ctx, instant) {
    $$(el, ".s15-steps li").forEach((li) => { li.classList.toggle("on", +li.dataset.i <= step); li.classList.toggle("now", +li.dataset.i === step); });
    dig && dig.setStep(step, instant);
  },
  onLeave(el, ctx) { ctx.whenHidden(el, () => dig && dig.stop()); }
});

// ---------------------------------------------------------------- 20 · renewable ≠ impact-free
function createLeak(canvas, quality) {
  const W = (canvas.width = 1920), H = (canvas.height = 1080), g = canvas.getContext("2d");
  const PY = 820, st = { flow: 0, leak: 0, store: 0 };
  const N = quality === "low" ? 160 : 320;
  const ps = Array.from({ length: N }, () => ({ x: Math.random() * W, y: PY + (Math.random() - 0.5) * 30, mode: 0, a: 1, vx: 0, vy: 0 }));
  const puffs = [];
  function render(dt) {
    const f = dt * 60;
    g.clearRect(0, 0, W, H);
    const at = g.createLinearGradient(0, 0, 0, PY);
    at.addColorStop(0, "rgba(127,178,255,.08)"); at.addColorStop(1, "rgba(127,178,255,0)");
    g.fillStyle = at; g.fillRect(0, 0, W, PY);
    g.fillStyle = "#2c2a27"; g.fillRect(0, PY - 24, 1250, 48);
    g.fillStyle = "#3a3733"; g.fillRect(0, PY - 24, 1250, 6);
    g.fillStyle = "#4a4640"; g.fillRect(730, PY - 34, 36, 68);
    g.fillStyle = "#3b2a1a"; g.fillRect(1380, PY - 90, 380, 150);
    g.fillStyle = "#5a4029"; g.fillRect(1380, PY - 90, 380, 12);
    g.fillStyle = "rgba(236,229,216,.55)"; g.font = "500 22px IBM Plex Mono, monospace";
    g.fillText("DIGESTATE STORAGE", 1420, PY + 100);
    g.fillText("GAS LINE → ENGINE", 40, PY + 70);
    ps.forEach((p) => {
      if (p.mode === 0) {
        p.x += 7 * f * st.flow; p.y = PY + Math.sin(p.x / 40 + p.a * 9) * 10;
        if (p.x > 1250) p.x = 0;
        if (p.x > 730 && p.x < 766 && Math.random() < 0.015 * st.leak * f) { p.mode = 1; p.vx = 1 + Math.random(); p.vy = -1.2 - Math.random(); p.a = 1; }
        g.fillStyle = `rgba(127,178,255,${0.9 * st.flow})`;
        g.fillRect(p.x, p.y - 2, 5, 4);
      } else {
        p.x += p.vx * f; p.y += p.vy * f; p.vx += (Math.random() - 0.5) * 0.1; p.a -= 0.004 * f;
        if (p.a <= 0 || p.y < 0) { p.mode = 0; p.x = 0; p.y = PY; return; }
        g.fillStyle = `rgba(160,200,255,${p.a * 0.8})`; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill();
      }
    });
    if (st.store > 0.01 && puffs.length < 260 && Math.random() < 0.8 * st.store) puffs.push({ x: 1390 + Math.random() * 360, y: PY - 92, vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random() * 1.2, a: 1 });
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.x += p.vx * f; p.y += p.vy * f; p.a -= 0.003 * f;
      if (p.a <= 0) { puffs.splice(i, 1); continue; }
      g.fillStyle = `rgba(160,200,255,${p.a * 0.7})`; g.beginPath(); g.arc(p.x, p.y, 3.4, 0, 7); g.fill();
    }
  }
  const L = loop(render);
  return { st, start: L.start, stop: L.stop };
}
const NODES = [
  { id: "ba", x: 170, y: 560, t: "Bratislava", d: "Kitchen waste from the capital, about 70 km away (2024 report)." },
  { id: "rc", x: 740, y: 560, t: "Reception & sorting", d: "Up to 12 % of deliveries were things that don't belong — even a printer and rebar." },
  { id: "hy", x: 990, y: 560, t: "Hygienisation", d: "Heated to 70 °C for at least one hour, to kill germs." },
  { id: "dg", x: 1240, y: 560, t: "Digestion", d: "Wet and dry digestion; biogas is collected." },
  { id: "chp", x: 1640, y: 330, t: "Energy", d: "Gas with enough methane goes to an engine for electricity and heat." },
  { id: "fert", x: 1640, y: 560, t: "Fertiliser", d: "Digestate is used as fertiliser." },
  { id: "bc", x: 1640, y: 790, t: "Biochar", d: "Heated without air at 400–600 °C to make biochar (the company's claims about benefits are not proof)." }
];
let leak20;
const s20 = stepper({
  id: "s-impact", title: "Renewable does not mean impact-free", loop: 4, steps: 5,
  html: `
    <canvas class="s16-canvas" aria-hidden="true"></canvas>
    <div class="s17-text"><p class="kicker fx">A real Slovak plant · Horné Jatovo · as reported in July 2024</p><h2 class="head split">Renewable does not mean <em>impact-free</em></h2></div>
    <svg class="s17-svg" viewBox="0 0 1920 1080" aria-label="Process map of the Horné Jatovo plant">
      <path id="s20route" class="route" d="M170 560C300 460 420 680 560 560S700 520 740 560"/>
      <text x="460" y="470" class="rt17" text-anchor="middle">≈ 70 km</text>
      <path class="pipe17" d="M740 560H1240"/>
      <path class="pipe17 br" d="M1240 560C1380 560 1450 330 1640 330"/>
      <path class="pipe17 br" d="M1240 560H1640"/>
      <path class="pipe17 br" d="M1240 560C1380 560 1450 790 1640 790"/>
      <path id="s20leak" class="leak17" d="M1380 470C1400 400 1360 330 1400 250S1380 150 1420 110"/>
      <g class="nodes"></g><g class="trucks"></g>
    </svg>
    <div class="s17-tip"></div>
    <p class="s20-circ fx">Food waste → <b>energy</b>, <b>fertiliser</b> and <b>biochar</b>. A real circular idea.</p>
    <div class="s17-leak fx">
      <p><b>The problem they were fixing:</b> gas from dry digestion with less than 40 % methane could only go through a biofilter — “about 20 %” was lost this way, the report says. A biomethane upgrade was planned.</p>
      <span class="stamp">One plant · July 2024 · a fix was planned</span>
      <p class="mono s17-never">Not a figure for biogas plants in general — and we don't know the situation in 2026.</p>
    </div>
    <div class="s16-facts">
      <div class="fx"><p class="kicker">All over the world · peer-reviewed study, 2022</p><p class="big">up to 2×</p><p>Biogas and biomethane supply chains can leak up to twice as much methane as the highest estimate of the International Energy Agency.</p></div>
      <div class="fx"><p class="big">62 %</p><p>of the leaks came from a small number of facilities and pieces of equipment — “super-emitters”.</p></div>
      <div class="fx small"><p>The same researchers say biogas still remains more climate-friendly than fossil fuels.</p></div>
    </div>
    <p class="s20-end quote split">The label “renewable” does not decide the result. <em>Operation does.</em></p>
    <div class="s20-src">${pills(["ctzn", "Denník N · 30 Jul 2024"], ["oneearth", "Peer-reviewed · One Earth 2022"])}</div>
    <span class="visnote s20-vis">Schematic · positions not geographic</span>`,
  setup(el, ctx) {
    leak20 = createLeak($(el, ".s16-canvas"), ctx.quality);
    const g = $(el, ".nodes"), tip = $(el, ".s17-tip");
    NODES.forEach((n) => {
      const k = svg("g", { class: "n17 interactive", "data-id": n.id }, g);
      svg("circle", { cx: n.x, cy: n.y, r: n.id === "ba" ? 26 : 34, class: "c" }, k);
      const t = svg("text", { x: n.x, y: n.y + (n.id === "ba" ? 64 : 74), "text-anchor": "middle", class: "t" }, k);
      t.textContent = n.t;
      const show = (e) => {
        e && e.stopPropagation();
        tip.innerHTML = `<b>${n.t}</b>${n.d}`;
        tip.style.left = Math.min(1440, n.x - 150) + "px"; tip.style.top = n.y + 110 + "px";
        tip.classList.add("on");
      };
      k.addEventListener("mouseenter", show); k.addEventListener("click", show);
      k.addEventListener("mouseleave", () => tip.classList.remove("on"));
    });
    const tr = $(el, ".trucks");
    for (let i = 0; i < 3; i++) { const t = svg("g", { class: "truck" }, tr); t.innerHTML = '<rect x="-22" y="-12" width="30" height="22" rx="3" fill="#dcb45c"/><rect x="8" y="-6" width="14" height="16" rx="2" fill="#c9a24c"/><circle cx="-12" cy="12" r="5" fill="#111"/><circle cx="14" cy="12" r="5" fill="#111"/>'; }
    el._trucks = gsap.timeline({ paused: true, repeat: -1 });
    $$(el, ".truck").forEach((t, i) => el._trucks.fromTo(t, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, i * 1.4)
      .to(t, { motionPath: { path: "#s20route", align: "#s20route", alignOrigin: [0.5, 0.5], autoRotate: false }, duration: 4.2, ease: "none" }, i * 1.4)
      .to(t, { autoAlpha: 0, duration: 0.3 }, i * 1.4 + 3.9));
    el._leak = gsap.timeline({ paused: true, repeat: -1 });
    const lk = $(el, "#s20leak");
    for (let i = 0; i < 6; i++) {
      const c = svg("circle", { r: 4, class: "gasdot" }, $(el, ".s17-svg"));
      el._leak.fromTo(c, { autoAlpha: 0.9 }, { motionPath: { path: lk, align: lk, alignOrigin: [0.5, 0.5] }, autoAlpha: 0, duration: 3, ease: "none" }, i * 0.5);
    }
    gsap.set($(el, ".s16-canvas"), { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s17-text .head"), 0);
      up(tl, [$(el, ".s17-text .kicker"), $(el, ".s20-src"), $(el, ".s20-vis")], 0.2);
      tl.fromTo($(el, ".route"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, immediateRender: false }, 0.4)
        .fromTo($$(el, ".n17"), { autoAlpha: 0, scale: 0.5, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.3, immediateRender: false }, 0.4)
        .fromTo($(el, ".pipe17:not(.br)"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1, immediateRender: false }, 1.2)
        .fromTo($(el, ".rt17"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: false }, 1.2);
    },
    (tl, el) => {
      tl.fromTo($$(el, ".pipe17.br"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, stagger: 0.2, immediateRender: false }, 0)
        .to($$(el, '.n17[data-id="chp"] .c, .n17[data-id="fert"] .c, .n17[data-id="bc"] .c'), { fill: "rgba(167,201,111,.85)", stroke: "#a7c96f", duration: 0.4, stagger: 0.3 }, 0.8);
      up(tl, $(el, ".s20-circ"), 1.2);
    },
    (tl, el) => {
      tl.fromTo($(el, ".leak17"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, immediateRender: false }, 0)
        .to($(el, ".s20-circ"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, $(el, ".s17-leak"), 0.6);
    },
    (tl, el) => {
      tl.to([$(el, ".s17-svg"), $(el, ".s17-leak"), $(el, ".s20-vis")], { autoAlpha: 0, duration: 0.6 }, 0)
        .to($(el, ".s17-text .kicker"), { autoAlpha: 0, duration: 0.3 }, 0)
        .fromTo($(el, ".s16-canvas"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0.3)
        .fromTo(leak20.st, { flow: 0, leak: 0, store: 0 }, { flow: 1, leak: 1, store: 1, duration: 2, immediateRender: false }, 0.4);
      up(tl, $$(el, ".s16-facts > div"), 0.6, { s: 0.7 });
    },
    (tl, el) => {
      tl.to($(el, ".s16-facts"), { autoAlpha: 0.15, duration: 0.5 }, 0).to($(el, ".s16-canvas"), { opacity: 0.35, duration: 0.6 }, 0);
      head(tl, $(el, ".s20-end"), 0.3, { s: 0.07 });
    }
  ],
  onEnter(el) { el._trucks.play(0); leak20.start(); },
  onStep(step, dir, el) { if (step >= 2) el._leak.play(); else el._leak.pause(0); },
  onLeave(el, ctx) { ctx.whenHidden(el, () => { el._trucks.pause(); el._leak.pause(); leak20.stop(); }); }
});

// ---------------------------------------------------------------- 21 · what can fail
const FAILS = [
  { n: 0, x: 960, y: 250, bad: "Huge uniform fields", badd: "erosion, runoff, no shelter", good: "A mosaic", goodd: "strips, hedges, trees", src: "iep", st: "B" },
  { n: 1, x: 1500, y: 335, bad: "Drought", badd: "even a careful farm loses trees", good: "Save water", goodd: "drip irrigation — but limits remain", src: "vince", st: "I" },
  { n: 1, x: 1560, y: 570, bad: "Wildlife damage", badd: "deer and wild boar eat crops", good: "No simple fix", goodd: "a local conflict of needs", src: "coopphotos", st: "?" },
  { n: 3, x: 1380, y: 850, bad: "Plastic in bio-waste", badd: "we saw it ourselves", good: "Clean sorting at home", goodd: "the operator's one request", src: "visitcompost", st: "A" },
  { n: 4, x: 560, y: 860, bad: "Wrong process", badd: "the wrong material, the wrong plant", good: "Right material, right process", goodd: "woody → compost · wet → digestion", src: "sba", st: "D" },
  { n: 4, x: 370, y: 600, bad: "Methane leaks", badd: "a few sites cause most leaks", good: "Measure and repair", goodd: "check every pipe and tank", src: "oneearth", st: "B" },
  { n: 5, x: 430, y: 335, bad: "Storage fails", badd: "Hron river, 2021", good: "Storage that survives a storm", goodd: "our conclusion", src: "tasrhron", st: "C" }
];
const s21 = stepper({
  id: "s-fail", title: "What can fail — and what good management looks like", loop: 5, steps: 4,
  html: `
    <div class="s21f-text"><p class="kicker fx">The whole loop, one more time</p><h2 class="head split">What can fail — <em>and what good management looks like</em></h2></div>
    <svg class="s21f-ring" viewBox="0 0 1920 1080" aria-hidden="true"><circle cx="960" cy="590" r="250" class="ring"/>${["Soil", "Agriculture", "Food", "Waste", "Recovery", "Back to soil"].map((t, i) => { const a = -Math.PI / 2 + (i / 6) * Math.PI * 2, x = 960 + Math.cos(a) * 250, y = 590 + Math.sin(a) * 250; return `<g class="rn"><circle cx="${x}" cy="${y}" r="12"/><text x="${960 + Math.cos(a) * 200}" y="${590 + Math.sin(a) * 200 + 8}" text-anchor="middle">${t}</text></g>`; }).join("")}</svg>
    <div class="s21f-cards">${FAILS.map((f, i) => `<div class="fc fx" style="left:${f.x}px;top:${f.y}px" data-i="${i}"><div class="bad"><b>${f.bad}</b><span>${f.badd}</span></div><div class="good"><b>${f.good}</b><span>${f.goodd}</span></div><span data-src="${f.src}"></span></div>`).join("")}</div>
    <div class="s21f-hron fx">
      <p class="kicker">What can fail at the very end · Budča, central Slovakia · July 2021</p>
      <p>A storm made a tree fall on the bag that stored <b>digestate</b> at a biogas plant. About <b>400 m³</b> leaked into a stream and then into the <b>Hron river</b>. Fish died.</p>
      <span data-src="tasrhron"></span>
    </div>
    <p class="s21f-end quote split">Every step of the loop can fail. Good management <em>checks every step.</em></p>`,
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s21f-text .head"), 0);
      up(tl, $(el, ".s21f-text .kicker"), 0.2);
      tl.fromTo($(el, ".s21f-ring .ring"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.6, ease: "power2.inOut", immediateRender: false }, 0.3)
        .fromTo($$(el, ".s21f-ring .rn"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.15, immediateRender: false }, 0.6);
      up(tl, $$(el, ".fc"), 1.4, { s: 0.35 });
    },
    (tl, el) => {
      tl.to($$(el, ".fc:not([data-i='6'])"), { autoAlpha: 0.25, duration: 0.5 }, 0)
        .to($(el, ".fc[data-i='6']"), { scale: 1.08, duration: 0.5 }, 0);
      up(tl, $(el, ".s21f-hron"), 0.4);
    },
    (tl, el) => {
      tl.to($(el, ".s21f-hron"), { autoAlpha: 0, duration: 0.4 }, 0)
        .to($$(el, ".fc"), { autoAlpha: 1, scale: 1, duration: 0.4 }, 0.2);
      $$(el, ".fc").forEach((c, i) => tl.to(c, { "--flip": 1, duration: 0.6, ease: "power2.inOut", onStart: () => c.classList.add("flipped"), onReverseComplete: () => c.classList.remove("flipped") }, 0.5 + i * 0.25));
    },
    (tl, el) => {
      tl.to([$(el, ".s21f-cards"), $(el, ".s21f-ring")], { autoAlpha: 0.12, duration: 0.6 }, 0);
      head(tl, $(el, ".s21f-end"), 0.3, { s: 0.07 });
    }
  ]
});

// ---------------------------------------------------------------- 22 · back to soil
const LESSONS = [
  ["Soil is alive — and slow to rebuild.", "Statok Dubina needed about nine years to show a clear change."],
  ["A simple landscape loses water, soil and life.", "Huge fields, fewer partridges."],
  ["Good farms still face drought — and wildlife.", "Sustainable does not mean invulnerable."],
  ["Bio-waste is a resource only when it is clean.", "Plastic does not become soil."],
  ["Renewable is not automatically impact-free.", "Operation decides the result."]
];
let soil22;
const s22 = stepper({
  id: "s-backtosoil", title: "Back to soil", loop: 5, steps: 4,
  html: `
    <canvas class="s21-soil" aria-hidden="true"></canvas>
    <div class="s21-shade"></div>
    <p class="s22-gift fx">Compost from Senica goes back to residents' gardens and the town's green areas. <span data-src="tssenica"></span></p>
    <div class="s21-lessons"><p class="kicker fx">What we learned</p><ol>${LESSONS.map((l, i) => `<li class="fx"><span class="mono">${String(i + 1).padStart(2, "0")}</span><b>${l[0]}</b> ${l[1]}</li>`).join("")}</ol></div>
    <svg class="s21-ring" viewBox="0 0 1920 1080" aria-hidden="true"><path d="M960 140a190 190 0 1 1 0 380a190 190 0 1 1 0 -380" class="r"/><circle r="10" class="dot21"/></svg>
    <div class="s21-final"><p class="mega s21-m split">Sustainability is not <em>a product.</em></p><p class="s21-sys fx">It is the quality of <b>the whole system.</b></p></div>
    <figure class="s21-worm fx"><img data-img="img/earthworm.webp" data-lightbox="end" alt="An earthworm in straw mulch" data-caption="An earthworm in mulch — soil life at work. Photo: USDA NRCS South Dakota · public domain · Wikimedia Commons"><figcaption class="mono">Soil life · USDA NRCS · public domain</figcaption></figure>
    <div class="s21-ask fx">
      <p class="quote">What does this loop look like in <em>Mersin?</em></p>
      <p class="mono s21-thanks">Thank you · Teşekkürler · Ďakujeme — Dominik, Adam, Sara, Karolína · SSOŠP Senica</p>
      <div class="s21-btns"><button class="b-src interactive">Our research</button><button class="b-top interactive">↺ Back to the start</button><a class="b-hub" href="../index.html">Erasmus hub</a></div>
    </div>`,
  setup(el, ctx) {
    soil22 = createSoil($(el, ".s21-soil"), { quality: ctx.quality, surface: 620 });
    $(el, ".b-src").onclick = (e) => { e.stopPropagation(); ctx.openSources(); };
    $(el, ".b-top").onclick = (e) => { e.stopPropagation(); ctx.goto(0); };
    gsap.set($(el, ".s21-soil"), { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s21-soil"), { autoAlpha: 0, y: 260 }, { autoAlpha: 1, y: 0, duration: 2, ease: "power2.out", immediateRender: false }, 0)
        .fromTo(soil22.state, { roots: 0, water: 0 }, { roots: 0.6, water: 0.5, duration: 4, immediateRender: false }, 0.4);
      up(tl, $(el, ".s22-gift"), 1);
    },
    (tl, el) => {
      tl.to($(el, ".s22-gift"), { autoAlpha: 0, duration: 0.4 }, 0)
        .to($(el, ".s21-soil"), { opacity: 0.3, duration: 0.6 }, 0);
      up(tl, [$(el, ".s21-lessons .kicker"), ...$$(el, ".s21-lessons li")], 0.3, { s: 0.35 });
    },
    (tl, el) => {
      tl.to($(el, ".s21-lessons"), { autoAlpha: 0, y: -30, duration: 0.6 }, 0)
        .to($(el, ".s21-soil"), { opacity: 1, duration: 1 }, 0.6)
        .fromTo($(el, ".s21-ring .r"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 2, ease: "power2.inOut", immediateRender: false }, 0.3)
        .fromTo($(el, ".dot21"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, 0.3)
        .to($(el, ".dot21"), { motionPath: { path: $(el, ".s21-ring .r"), align: $(el, ".s21-ring .r"), alignOrigin: [0.5, 0.5], start: 0.25, end: 1.25 }, duration: 2.4, ease: "power1.inOut" }, 0.3)
        .to($(el, ".dot21"), { y: "+=400", autoAlpha: 0, duration: 1, ease: "power2.in" }, 2.7)
        .fromTo(soil22.state, { roots: 0.6 }, { roots: 1, water: 0.9, duration: 4, immediateRender: false }, 2.8)
        .to($(el, ".s21-ring"), { autoAlpha: 0.25, duration: 1 }, 3);
      head(tl, $(el, ".s21-m"), 3, { s: 0.1 });
      up(tl, $(el, ".s21-sys"), 4.2);
      fade(tl, $(el, ".s21-worm"), 4.8);
    },
    (tl, el) => {
      tl.to($(el, ".s21-final"), { y: -190, scale: 0.66, transformOrigin: "50% 0", duration: 1, ease: "expo.inOut" }, 0).to($(el, ".s21-worm"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, $(el, ".s21-ask"), 0.6);
    }
  ],
  onEnter() { soil22.start(); },
  onLeave(el, ctx) { ctx.whenHidden(el, () => soil22.stop()); }
});

export default [s18, s19, s20, s21, s22];
