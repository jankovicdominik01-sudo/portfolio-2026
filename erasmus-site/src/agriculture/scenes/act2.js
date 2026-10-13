// ACT II · AGRICULTURE — an organic farm: diversity instead of aggressive chemistry
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng } from "../lib/stepper.js";
import { head, up, fade, out, pills } from "../lib/fx.js";

const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

// ---------------------------------------------------------------- 07 · EcoFarm No. 5
const ROLES = {
  aphid: "Aphids suck plant sap. A colony grows fast on one plant.",
  lady: "Ladybirds (and their larvae) eat aphids — lots of them.",
  lace: "Lacewing larvae are aphid hunters too.",
  shrub: "Shrubs, flowers and „a little wilderness“: where predators live between meals.",
  tree: "Trees: shelter, shade, nesting — and fruit."
};
const s07 = stepper({
  id: "s-ecofarm", title: "Diversity instead of aggressive chemistry", loop: 1, steps: 4,
  html: `
    <svg class="s10-eco" viewBox="0 0 1920 1080" aria-label="Illustrated ecosystem: shrub, crop with aphids, predators, tree"></svg>
    <div class="s10-tip mono"></div>
    <div class="s9-intro">
      <figure class="s9-sat fx"><img data-img="img/ecofarm-2024.webp" data-lightbox="ecofarm" data-caption="Family EcoFarm No. 5 near Galanta from above (ring). Sentinel-2 cloudless 2024 by EOX (contains modified Copernicus Sentinel data)." alt="Satellite image of the farm area"><i class="ring9"></i><figcaption class="mono">The farm from above · Sentinel-2 2024</figcaption></figure>
      <div class="s9-side">
        <p class="kicker fx">Farm story 2 · Family EcoFarm No. 5, near Galanta</p>
        <h2 class="head split">Diversity instead of <em>aggressive chemistry</em></h2>
        <ul class="s9-facts">
          <li class="fx"><b>~4 ha</b> a former vineyard, unused for about 30 years</li>
          <li class="fx"><b>Off-grid</b> solar power · groundwater · drip irrigation</li>
        </ul>
        <div class="s9-mail fx">
          <p class="mono s9-mh"><span>From: Ing. Jozef Vince</span><span>22 Sep 2026</span></p>
          <p class="mono dim">Reply to our 6 questions · translated from Slovak</p>
          <p class="s9-type"></p>
        </div>
        ${pills("vince", "kzecofarm", "ecofarmweb")}
      </div>
    </div>
    <div class="s10-text"><p class="kicker fx">How the farm protects its plants</p><h2 class="head split">Diversity <em>is</em> protection</h2></div>
    <figure class="s10-photo fx"><img data-img="img/ladybird.webp" data-lightbox="eco" alt="Seven-spot ladybird with aphids" data-caption="A seven-spot ladybird among aphids. Photo: Smithsonian Environmental Research Center · CC BY 2.0 · Wikimedia Commons"><figcaption class="mono">Real: a ladybird among aphids · SERC · CC BY 2.0</figcaption></figure>
    <ol class="s10-ladder">
      <li class="fx"><b>1</b> Diversity — trees, shrubs, even “a little wilderness”, so predators have a home</li>
      <li class="fx"><b>2</b> Crop rotation</li>
      <li class="fx"><b>3</b> Care for the soil — green manure and “forest microorganisms”</li>
      <li class="fx"><b>4</b> Mechanical barriers</li>
      <li class="fx last"><b>5</b> Only if necessary: products allowed in organic farming — diatomaceous earth, copper, neem oil</li>
    </ol>
    <p class="s10-iep small fx">The same logic at national scale: more diverse crops → more natural enemies of pests → fewer sprays (IEP, 2020).</p>
    <div class="s10-src">${pills("vince", "iep")}</div>
    <span class="visnote s10-vis">Illustration</span>`,
  setup(el) {
    const r9 = $(el, ".ring9"); // ecofarm-2024: lon 17.690–17.732, lat 48.184–48.203
    r9.style.left = ((17.711087 - 17.69) / 0.042) * 100 + "%";
    r9.style.top = ((merc(48.203) - merc(48.193255)) / (merc(48.203) - merc(48.184))) * 100 + "%";
    const s = $(el, ".s10-eco"), R = rng(4), GY = 860;
    s.innerHTML = `<defs><radialGradient id="s10g" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#2a2419"/><stop offset="1" stop-color="#14100c"/></radialGradient></defs><rect width="1920" height="1080" fill="url(#s10g)"/>
      <rect y="${GY}" width="1920" height="${1080 - GY}" fill="#2a1f15"/>`;
    const sh = svg("g", { class: "org", "data-role": "shrub" }, s);
    for (let i = 0; i < 60; i++) svg("circle", { cx: 120 + R() * 360, cy: GY - 30 - R() * 300 * (1 - Math.abs(R() - 0.5)), r: 24 + R() * 40, fill: `hsl(${85 + R() * 30},${25 + R() * 15}%,${20 + R() * 12}%)` }, sh);
    for (let i = 0; i < 26; i++) { const x = 90 + R() * 440; svg("path", { d: `M${x} ${GY}q${(R() - 0.5) * 30} -60 ${(R() - 0.5) * 20} -${90 + R() * 60}`, stroke: "#7c9a4f", "stroke-width": 2, fill: "none" }, sh); svg("circle", { cx: x + (R() - 0.5) * 20, cy: GY - 100 - R() * 60, r: 6, fill: R() < 0.5 ? "#e5d36b" : "#c7a6e8" }, sh); }
    const tr = svg("g", { class: "org", "data-role": "tree" }, s);
    svg("path", { d: `M1700 ${GY}C1705 700 1690 600 1700 420`, stroke: "#2d1f14", "stroke-width": 34, fill: "none" }, tr);
    for (let i = 0; i < 40; i++) svg("circle", { cx: 1700 + (R() - 0.5) * 380, cy: 380 + (R() - 0.5) * 260, r: 40 + R() * 50, fill: `hsl(${95 + R() * 20},${25 + R() * 10}%,${18 + R() * 10}%)` }, tr);
    const crops = svg("g", {}, s);
    [700, 850, 1000, 1150, 1300].forEach((x, i) => {
      const h = 300 + (i === 2 ? 60 : R() * 50), g = svg("g", {}, crops);
      svg("path", { d: `M${x} ${GY}C${x - 6} ${GY - h / 2} ${x + 6} ${GY - h / 1.5} ${x} ${GY - h}`, stroke: "#6e9447", "stroke-width": 7, fill: "none" }, g);
      for (let k = 0; k < 7; k++) {
        const y = GY - 50 - k * (h / 8), d = k % 2 ? 1 : -1;
        svg("path", { d: `M${x} ${y}q${d * 40} -40 ${d * 90} -20q${-d * 40} 30 ${-d * 90} 20z`, fill: "#86ad57", opacity: 0.95 }, g);
      }
    });
    const ap = svg("g", { class: "aphids org", "data-role": "aphid" }, s);
    for (let i = 0; i < 110; i++) {
      const a = R() * Math.PI * 2, r = Math.abs(R() + R() - 1) * 95;
      svg("ellipse", { cx: 1000 + Math.cos(a) * r * 0.5, cy: 560 + Math.sin(a) * r, rx: 7.5, ry: 5.5, fill: "#e3f09a", stroke: "#1f260f", "stroke-width": 1.5, class: "aphid" }, ap);
    }
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
    gsap.set([s, $(el, ".s10-text")], { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s9-sat img"), { scale: 1.2 }, { scale: 1.04, duration: 3, ease: "power2.out", immediateRender: false }, 0);
      fade(tl, $(el, ".s9-sat"), 0);
      head(tl, $(el, ".s9-side .head"), 0.3);
      up(tl, [$(el, ".s9-side .kicker"), ...$$(el, ".s9-facts li"), $(el, ".s9-side .srcrow")], 0.5, { s: 0.15 });
      const text = "“It was a primary decision when we founded the farm: we wanted to be organic, because we believe that caring for soil and plants can be done without aggressive chemistry.”";
      const p = $(el, ".s9-type"), o = { n: 0 };
      up(tl, $(el, ".s9-mail"), 1.2, { y: 40 });
      tl.to(o, { n: text.length, duration: 3.6, ease: "none", onUpdate: () => (p.textContent = text.slice(0, Math.round(o.n))), onReverseComplete: () => (p.textContent = "") }, 1.6);
    },
    (tl, el) => {
      tl.to($(el, ".s9-intro"), { autoAlpha: 0, x: -60, duration: 0.7, ease: "power2.in" }, 0)
        .fromTo($(el, ".s10-eco"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0.4)
        .fromTo($(el, ".s10-text"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.6);
      head(tl, $(el, ".s10-text .head"), 0.6);
      up(tl, $(el, ".s10-text .kicker"), 0.8);
      tl.fromTo($$(el, ".aphid"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.4, stagger: { each: 0.03, from: "center" }, ease: "back.out(3)", immediateRender: false }, 1.2)
        .fromTo($$(el, ".pred"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, 1.2);
      fade(tl, $(el, ".s10-vis"), 1.6);
    },
    (tl, el) => {
      $$(el, ".pred").forEach((p, i) => {
        tl.to(p, { motionPath: { path: `#s10p${i}`, align: `#s10p${i}`, alignOrigin: [0.5, 0.5], autoRotate: true }, duration: 2.4 + i * 0.25, ease: "power1.inOut" }, i * 0.3);
      });
      tl.to($$(el, ".aphid"), { scale: 0, duration: 0.3, stagger: { each: 0.03, from: "edges" }, ease: "power2.in" }, 2.2);
      fade(tl, $(el, ".s10-photo"), 2.8);
    },
    (tl, el) => {
      tl.to($(el, ".s10-eco"), { opacity: 0.22, duration: 0.8 }, 0).to($(el, ".s10-photo"), { autoAlpha: 0, duration: 0.5 }, 0);
      up(tl, $$(el, ".s10-ladder li"), 0.4, { s: 0.35 });
      up(tl, [$(el, ".s10-iep"), $(el, ".s10-src")], 2.4);
    }
  ]
});

export default [s07];
