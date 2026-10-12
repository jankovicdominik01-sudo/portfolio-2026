// BACKUP — only if someone asks. Not part of the main route (menu → Backup).
import { stepper, $, $$, svg } from "../lib/stepper.js";
import { head, up, count, pills } from "../lib/fx.js";

// ---------------------------------------------------------------- B1 · vertical farms
const b1 = stepper({
  id: "s-vertical", title: "Backup: future agriculture — vertical farms?", loop: 5, steps: 3, backup: true,
  html: `
    <div class="s20-text"><p class="kicker fx">Backup · one direction people talk about</p><h2 class="head split">Future agriculture? <em>Vertical farms</em></h2></div>
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
      tl.fromTo($$(el, ".bld .layer, .bld .led, .bld .plant20"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, stagger: 0.01, immediateRender: false }, 0.4)
        .fromTo($$(el, ".bld .shell, .bld .lab20"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: false }, 0.3);
      up(tl, $$(el, ".s20-pm li"), 1, { s: 0.4 });
    },
    (tl, el) => {
      tl.fromTo($$(el, ".tile"), { autoAlpha: 0, scale: 0, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.3, stagger: 0.07, ease: "back.out(2)", immediateRender: false }, 0.2)
        .fromTo($(el, ".pvlab"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, immediateRender: false }, 2.2);
      up(tl, [$(el, ".s20-pv"), $(el, ".s20-vis")], 0.2);
      count(tl, $(el, ".s20-pv .num"), 28, 0.2, { from: 1, d: 2 });
    },
    (tl, el) => { up(tl, $(el, ".s20-blog"), 0); }
  ]
});

// ---------------------------------------------------------------- B2 · governance
const b2 = stepper({
  id: "s-governance", title: "Backup: when waste governance fails", loop: 5, steps: 4, backup: true,
  html: `
    <div class="s18-text"><p class="kicker fx">Backup · Skalica, 20 km from our school · reported 10 Sep 2026</p><h2 class="head split">When waste governance <em>fails</em></h2>
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
    <div class="s18-src">${pills(["skalica", "Aktuality · 10 Sep 2026"])}</div>`,
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

export default [b1, b2];
