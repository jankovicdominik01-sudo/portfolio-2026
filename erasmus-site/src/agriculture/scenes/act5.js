// ACT V · RECOVERY AND BACK TO SOIL
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

// ---------------------------------------------------------------- 22 · back to soil
const LESSONS = [
  ["A simple landscape loses water, soil and life.", "Huge fields, fewer partridges."],
  ["The first protection is diversity, not a spray.", "Hedges bring the ladybirds."],
  ["Farms adapt to the weather — wildlife is harder.", "Reality is local."],
  ["Bio-waste is a resource only when it is clean.", "Plastic does not become soil."],
  ["The right material for the right process.", "Compost and biogas work together."]
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
      <div class="s21-btns"><button class="b-src interactive">Our research</button><button class="b-top interactive">↺ Back to the start</button>${__HUB__ ? `<a class="b-hub" href="../index.html">Erasmus hub</a>` : ""}</div>
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

export default [s18, s19, s22];
