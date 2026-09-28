// ACT IV · RECOVERY — scenes 15–18 (technology and its trade-offs)
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng, loop } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";
import { createDigester } from "../lib/digester3d.js";

// ---------------------------------------------------------------- 15
const PROC = [
  ["Input", "Bio-waste, manure and slurry are fed in."],
  ["No oxygen", "Bacteria break it down in four phases, kept warm: 35–40 °C (mesophilic) or 50–55 °C (thermophilic)."],
  ["Biogas", "Methane (CH₄) and CO₂ bubble up and collect under the dome."],
  ["Use", "A CHP engine makes electricity and heat — or the gas is upgraded to biomethane with over 95 % CH₄."],
  ["Digestate", "What's left is digestate: it can go back to fields as fertiliser."]
];
let dig = null, digTried = false;
const s15 = stepper({
  id: "s-biogas3d", title: "How a biogas plant works", loop: 4, steps: 5,
  notes: "A biogas plant is basically a warm stomach without oxygen. The model is a simplified cutaway, not a specific plant. Drag is not needed — the camera moves by itself.",
  html: `
    <canvas class="s15-gl" aria-label="3D cutaway of a biogas digester"></canvas>
    <div class="s15-labels">
      <span data-anchor="inlet" data-step="0">Bio-waste in</span>
      <span data-anchor="heat" data-step="1">35–40 °C · no oxygen</span>
      <span data-anchor="gas" data-step="2" class="ch4">CH₄ + CO₂</span>
      <span data-anchor="chp" data-step="3">CHP → electricity + heat</span>
      <span data-anchor="upg" data-step="3" class="ch4">Biomethane &gt; 95 % CH₄</span>
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
  onLeave() { setTimeout(() => dig && dig.stop(), 800); }
});

// ---------------------------------------------------------------- 16
function createLeak(canvas, quality) {
  const W = (canvas.width = 1920), H = (canvas.height = 1080), g = canvas.getContext("2d");
  const PY = 760, st = { flow: 0, leak: 0, store: 0 };
  const N = quality === "low" ? 160 : 320;
  const ps = Array.from({ length: N }, () => ({ x: Math.random() * W, y: PY + (Math.random() - 0.5) * 30, mode: 0, a: 1, vx: 0, vy: 0 }));
  const puffs = [];
  function render(dt) {
    const f = dt * 60;
    g.clearRect(0, 0, W, H);
    // atmosphere gradient
    const at = g.createLinearGradient(0, 0, 0, PY);
    at.addColorStop(0, "rgba(127,178,255,.08)"); at.addColorStop(1, "rgba(127,178,255,0)");
    g.fillStyle = at; g.fillRect(0, 0, W, PY);
    // pipe
    g.fillStyle = "#2c2a27"; g.fillRect(0, PY - 24, 1250, 48);
    g.fillStyle = "#3a3733"; g.fillRect(0, PY - 24, 1250, 6);
    g.fillStyle = "#4a4640"; g.fillRect(730, PY - 34, 36, 68); // a flange: the weak spot
    // digestate store (largest source)
    g.fillStyle = "#3b2a1a"; g.fillRect(1380, PY - 90, 380, 150);
    g.fillStyle = "#5a4029"; g.fillRect(1380, PY - 90, 380, 12);
    g.fillStyle = "rgba(236,229,216,.55)"; g.font = "500 22px IBM Plex Mono, monospace";
    g.fillText("DIGESTATE STORAGE", 1420, PY + 100);
    g.fillText("GAS LINE → ENGINE", 40, PY + 70);
    ps.forEach((p) => {
      if (p.mode === 0) {
        p.x += 7 * f * st.flow; p.y = PY + Math.sin(p.x / 40 + p.a * 9) * 10;
        if (p.x > 1250) { p.x = 0; }
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
const FACTORS = [
  ["Inputs", "What goes in: waste and residues — or crops grown only for energy?"],
  ["Transport", "How far the waste travels. Bratislava's kitchen waste went about 70 km (2024 report)."],
  ["Operation", "Maintenance and control. In the study, a few badly run sites caused most of the emissions."],
  ["Leaks", "Methane escaping from tanks, valves, flanges and pipes."],
  ["Digestate", "Handling and storing digestate was the largest emission source in the study."],
  ["Contamination", "Plastic and other wrong items have to be removed — or end up in the digestate."],
  ["The alternative", "Compared with what? Fossil gas, landfill, composting — the answer changes."],
  ["Right waste", "Woody material suits composting, wet waste suits digestion (Slovak Biogas Association view)."]
];
let leak;
const s16 = stepper({
  id: "s-impact", title: "Renewable does not automatically mean impact-free", loop: 4, steps: 4,
  notes: "This is not an accusation of the industry. It is about what decides whether a plant actually helps. The study is a global synthesis, not a measurement of Slovak plants.",
  html: `
    <canvas class="s16-canvas" aria-hidden="true"></canvas>
    <div class="s16-text"><p class="kicker fx">Methane is a strong greenhouse gas</p><h2 class="head split">Renewable does not automatically mean <em>impact-free</em></h2></div>
    <div class="s16-facts">
      <div class="fx"><p class="big">up to 2×</p><p>Methane emissions measured along biogas and biomethane supply chains: up to twice the highest estimate of the International Energy Agency.</p></div>
      <div class="fx"><p class="big">#1</p><p>The largest source: handling and storing digestate.</p></div>
    </div>
    <div class="s16-super fx">
      <div class="cells"></div>
      <p class="s16-sup"><b>5 %</b> of emitters caused <b>62 %</b> of the emissions.</p>
      <div class="bar"><i></i><span class="mono">62 %</span></div>
      <p class="small">So the name “renewable” doesn't decide the result — <b>how the plant is run</b> does. The same study still finds biogas more climate-friendly than the fossil alternatives.</p>
    </div>
    <div class="s16-factors"><p class="kicker">What decides the real impact? · click a card</p><div class="grid">${FACTORS.map((f, i) => `<button class="fcard interactive fx" data-i="${i}"><b>${f[0]}</b><span>${f[1]}</span></button>`).join("")}</div></div>
    <div class="s16-src">${pills(["oneearth", "Peer-reviewed · One Earth 2022"])}</div>
    <span class="visnote s16-vis">Illustration · not to scale</span>`,
  setup(el, ctx) {
    leak = createLeak($(el, ".s16-canvas"), ctx.quality);
    const c = $(el, ".cells");
    for (let i = 0; i < 100; i++) { const d = document.createElement("i"); if (i < 5) d.className = "hot"; c.appendChild(d); }
    $$(el, ".fcard").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); b.classList.toggle("open"); }));
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(leak.st, { flow: 0, leak: 0 }, { flow: 1, leak: 1, duration: 2, immediateRender: false }, 0.3);
      head(tl, $(el, ".s16-text .head"), 0);
      up(tl, [$(el, ".s16-text .kicker"), $(el, ".s16-src"), $(el, ".s16-vis")], 0.3);
    },
    (tl, el) => {
      tl.fromTo(leak.st, { store: 0 }, { store: 1, duration: 1.5, immediateRender: false }, 0.6);
      up(tl, $$(el, ".s16-facts > div"), 0, { s: 0.6 });
    },
    (tl, el) => {
      out(tl, $$(el, ".s16-facts > div"), 0);
      tl.to($(el, ".s16-canvas"), { opacity: 0.3, duration: 0.6 }, 0);
      up(tl, $(el, ".s16-super"), 0.3);
      tl.fromTo($$(el, ".cells i"), { opacity: 0 }, { opacity: 1, duration: 0.2, stagger: 0.006, immediateRender: false }, 0.5)
        .fromTo($(el, ".s16-super .bar i"), { width: 0 }, { width: "62%", duration: 1.4, ease: "power2.out", immediateRender: false }, 1.4);
    },
    (tl, el) => {
      out(tl, $(el, ".s16-super"), 0);
      tl.to($(el, ".s16-text"), { y: -40, duration: 0.6 }, 0).to($(el, ".s16-canvas"), { opacity: 0.1, duration: 0.6 }, 0);
      up(tl, $$(el, ".fcard"), 0.3, { s: 0.08 });
      fade(tl, $(el, ".s16-factors .kicker"), 0.3);
    }
  ],
  onEnter() { leak.start(); },
  onLeave() { setTimeout(() => leak.stop(), 800); }
});

// ---------------------------------------------------------------- 17
const NODES = [
  { id: "ba", x: 170, y: 560, t: "Bratislava", d: "Kitchen waste collected in the capital — about 9,000 t came from Bratislava (2024 report)." },
  { id: "rc", x: 760, y: 560, t: "Reception & sorting", d: "Up to 12 % of deliveries were things that don't belong — even a printer and rebar." },
  { id: "hy", x: 1010, y: 560, t: "Hygienisation", d: "Heated to 70 °C for at least one hour, to kill pathogens." },
  { id: "dg", x: 1260, y: 560, t: "Digestion", d: "Wet and dry digestion; dry digestion runs in 36 containers." },
  { id: "chp", x: 1640, y: 330, t: "Energy", d: "Gas is captured from 40 % methane; the CHP engine needs at least 50 %." },
  { id: "fert", x: 1640, y: 560, t: "Fertiliser", d: "Digestate is used as fertiliser." },
  { id: "bc", x: 1640, y: 790, t: "Biochar", d: "Pyrolysis at 400–600 °C makes biochar and a soil improver (company's claims about benefits are not proof)." }
];
const s17 = stepper({
  id: "s-jatovo", title: "Horné Jatovo: food waste → energy, fertiliser, biochar", loop: 4, steps: 4,
  notes: "This is one plant as reported in July 2024 — not every biogas plant. Never say “biogas plants leak 20 % methane”. The 2026 status is unknown to us. Hover or click a node for detail.",
  html: `
    <div class="s17-text"><p class="kicker fx">A real plant · as reported in July 2024</p><h2 class="head split">Horné Jatovo: <em>food waste → energy, fertiliser, biochar</em></h2></div>
    <svg class="s17-svg" viewBox="0 0 1920 1080" aria-label="Process map of the Horné Jatovo plant">
      <path id="s17route" class="route" d="M170 560C300 460 420 680 560 560S700 520 760 560"/>
      <text x="460" y="470" class="rt17" text-anchor="middle">≈ 70 km</text>
      <path class="pipe17" d="M760 560H1260"/>
      <path class="pipe17 br" d="M1260 560C1400 560 1450 330 1640 330"/>
      <path class="pipe17 br" d="M1260 560H1640"/>
      <path class="pipe17 br" d="M1260 560C1400 560 1450 790 1640 790"/>
      <path id="s17leak" class="leak17" d="M1400 470C1420 400 1380 330 1420 250S1400 150 1440 110"/>
      <g class="nodes"></g><g class="trucks"></g>
    </svg>
    <div class="s17-tip"></div>
    <div class="s17-fig fx"><p class="big">~45,000 t</p><p>of bio-waste a year, about half of it kitchen waste.</p></div>
    <div class="s17-leak fx">
      <p><b>The problem they were fixing:</b> gas from dry fermentation with less than 40 % methane could only go through a biofilter — “about 20 %” was lost this way, the report says. A biomethane upgrade was planned (Recovery Plan grant).</p>
      <span class="stamp">One plant · July 2024 · fix planned</span>
      <p class="mono s17-never">Not a figure for biogas plants in general.</p>
    </div>
    <div class="s17-src">${pills(["ctzn", "CTZN / Denník N · 30 Jul 2024"])}</div>
    <span class="visnote s17-vis">Schematic · positions not geographic</span>`,
  setup(el) {
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
      .to(t, { motionPath: { path: "#s17route", align: "#s17route", alignOrigin: [0.5, 0.5], autoRotate: false }, duration: 4.2, ease: "none" }, i * 1.4)
      .to(t, { autoAlpha: 0, duration: 0.3 }, i * 1.4 + 3.9));
    el._leak = gsap.timeline({ paused: true, repeat: -1 });
    const lk = $(el, "#s17leak");
    for (let i = 0; i < 6; i++) {
      const c = svg("circle", { r: 4, class: "gasdot" }, $(el, ".s17-svg"));
      el._leak.fromTo(c, { autoAlpha: 0.9 }, { motionPath: { path: lk, align: lk, alignOrigin: [0.5, 0.5] }, autoAlpha: 0, duration: 3, ease: "none" }, i * 0.5);
    }
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s17-text .head"), 0);
      up(tl, [$(el, ".s17-text .kicker"), $(el, ".s17-src"), $(el, ".s17-vis")], 0.2);
      tl.fromTo($(el, ".route"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, immediateRender: true }, 0.4)
        .fromTo($$(el, ".n17"), { autoAlpha: 0, scale: 0.5, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.3, immediateRender: true }, 0.4)
        .fromTo($(el, ".pipe17:not(.br)"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1, immediateRender: true }, 1.2)
        .fromTo($(el, ".rt17"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: true }, 1.2)
        .call(() => el._trucks.play(0), null, 1.6);
      up(tl, $(el, ".s17-fig"), 1.8);
    },
    (tl, el) => {
      tl.fromTo($$(el, ".pipe17.br"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.2, stagger: 0.2, immediateRender: true }, 0);
      tl.to($$(el, '.n17[data-id="chp"] .c, .n17[data-id="fert"] .c, .n17[data-id="bc"] .c'), { attr: { class: "c lit" }, duration: 0.01, stagger: 0.3 }, 0.8);
    },
    (tl, el) => {
      tl.fromTo($(el, ".leak17"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, immediateRender: true }, 0).call(() => el._leak.play(0), null, 1)
        .to($(el, ".s17-fig"), { autoAlpha: 0, duration: 0.4 }, 0);
      up(tl, $(el, ".s17-leak"), 0.6);
    },
    (tl, el) => { tl.fromTo($(el, ".s17-leak .stamp"), { scale: 1 }, { scale: 1.12, yoyo: true, repeat: 1, duration: 0.25 }, 0); fade(tl, $(el, ".s17-never"), 0.2); }
  ],
  onEnter(el, ctx, dir, step) { if (dir < 0 || ctx.reduced) el._trucks.play(0); if (dir < 0 && step >= 2) el._leak.play(0); },
  onStep(step, dir, el) { if (step < 2) el._leak.pause(0); },
  onLeave(el) { setTimeout(() => { el._trucks.pause(); el._leak.pause(); }, 800); }
});

// ---------------------------------------------------------------- 18
const s18 = stepper({
  id: "s-governance", title: "When waste governance fails", loop: 4, steps: 4,
  notes: "We don't accuse anyone — we separate what is documented from what is claimed. No names of people or companies. This case is construction waste, not agricultural waste.",
  html: `
    <div class="s18-text"><p class="kicker fx">Skalica, 20 km from our school · reported 10 Sep 2026</p><h2 class="head split">When waste governance <em>fails</em></h2>
      <p class="sub fx">A construction-waste site in an industrial zone. What do we actually know?</p></div>
    <div class="s18-cards">
      <article class="card doc fx"><span class="stamp">Documented</span><p>The Slovak Environmental Inspectorate inspected the site on <b>29 July 2026</b>. The inspection has <b>not been concluded</b>.</p><p>The Slovak Land Fund reports <b>environmental degradation</b> on land it leases there.</p><p class="down mono">→ confirmed by institutions in the article</p></article>
      <article class="card all fx"><span class="stamp">Alleged</span><p>Other claims in the report — about how the waste got there and who is responsible — are disputed.</p><p class="down mono">→ we do not repeat them as facts</p></article>
      <article class="card inv fx"><span class="stamp">Under investigation</span><p>The outcome of the inspection is open. Anything else is for the authorities to decide.</p><p class="down mono">→ we will update if the result is published</p></article>
    </div>
    <div class="s18-side">
      <div class="fx"><p class="kicker">Rules and incentives</p><p>According to the Slovak Biogas Association, commercial bio-waste — from restaurants and shops — “often doesn't exist on paper”.</p><span data-src="sba"></span></div>
      <div class="fx"><p class="kicker">The bigger question</p><p>What happens to waste that can't be reused or treated biologically? Bratislava is debating a planned incinerator: 220,000 t a year (reduced from 317,000), favourable EIA opinion in July 2026.</p><span data-src="slovnaft"></span></div>
    </div>
    <div class="s18-src">${pills(["skalica", "Aktuality · 10 Sep 2026"], ["delandfill", "Background · Denník E 2017"])}</div>`,
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s18-text .head"), 0);
      up(tl, [$(el, ".s18-text .kicker"), $(el, ".s18-text .sub"), $(el, ".s18-src")], 0.2);
    },
    (tl, el) => { tl.fromTo($(el, ".card.doc"), { autoAlpha: 0, scale: 1.3, rotation: -2 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.5, ease: "power4.in", immediateRender: false }, 0); },
    (tl, el) => {
      tl.fromTo($(el, ".card.all"), { autoAlpha: 0, scale: 1.3, rotation: 2 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.5, ease: "power4.in", immediateRender: false }, 0)
        .fromTo($(el, ".card.inv"), { autoAlpha: 0, scale: 1.3, rotation: -1 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.5, ease: "power4.in", immediateRender: false }, 0.6);
    },
    (tl, el) => { up(tl, $$(el, ".s18-side > div"), 0, { s: 0.4 }); }
  ]
});

export default [s15, s16, s17, s18];
