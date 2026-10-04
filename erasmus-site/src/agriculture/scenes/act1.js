// ACT I · THE SYSTEM AND THE LANDSCAPE — scenes 01–05
import { gsap } from "gsap";
import { stepper, $, $$, svg, rng } from "../lib/stepper.js";
import { head, up, fade, out, count, pills } from "../lib/fx.js";
import { createSoil } from "../lib/soil.js";
import { createLandscape } from "../lib/landscape.js";
import { photoHTML, bindPhoto } from "../lib/photo.js";

// ---------------------------------------------------------------- 01 · cold open
// Our own photo first: food waste, still in plastic bags, at our town's
// composting plant. Then the question, and the camera sinks into the soil.
const FOOD = { src: "img/field/food-waste-bags.webp", w: 1600, h: 1201 };
let soil1, ph1;
const s01 = stepper({
  id: "s-cold", title: "Can this go back to soil?", loop: 0, steps: 4,
  hideNav: true,
  html: `
    ${photoHTML("cold", { ...FOOD, alt: "Food waste, much of it still in plastic bags, at the Senica composting plant" })}
    <div class="s1-vig"></div>
    <p class="kicker s1-date fx">Senica, Slovakia · 30 September 2026</p>
    <p class="s1-line s1-l1 fx">This was delivered to our town's composting plant.</p>
    <p class="s1-line s1-l2 fx">Can it go back to <em>soil?</em></p>
    <p class="s1-cred mono fx">Our photo · Senica composting plant</p>
    <div class="s1-sat"><img data-img="img/galanta-2024.webp" alt="Satellite image of large fields in western Slovakia"></div>
    <canvas class="s1-soil" aria-hidden="true"></canvas>
    <div class="s1-shade"></div>
    <div class="s1-hz mono fx"><span style="top:300px">Litter & humus · A</span><span style="top:620px">Transition · B</span><span style="top:860px">Loess · C</span></div>
    <p class="kicker s1-kick fx">Erasmus+ · Mezitli / Mersin · 8–14 October 2026</p>
    <h1 class="mega s1-title split">Back to <em>Soil?</em></h1>
    <p class="sub s1-sub fx">A field report from Senica, Slovakia — by four students who went to look.</p>
    <p class="s1-team mono fx">SSOŠP Senica · Dominik · Adam · Sara · Karolína</p>
    <figure class="s1-photo fx">
      <img data-lightbox="soil" data-img="img/soil-profile.webp" alt="Real soil profile of a chernozem on loess with a measuring tape"
        data-caption="Typical chernozem on loess, 0–2 m, with a measuring tape. Photographed in Ukraine; the same soil type is found in the Danubian Lowland. Photo: Serhey0211994 · CC BY-SA 4.0 · Wikimedia Commons">
      <figcaption><b>Real, not drawn.</b> Chernozem on loess, 0–2 m. The dark humus layer is over a metre deep.<span>Photo: Serhey0211994 · CC BY-SA 4.0</span></figcaption>
    </figure>
    <span class="visnote s1-vis fx">Left: illustration · Right: photograph</span>
    <div class="s1-src">${pills(["visitcompost", "Our photo"], "infopack")}</div>`,
  setup(el, ctx) {
    soil1 = createSoil($(el, ".s1-soil"), { quality: ctx.quality });
    ph1 = bindPhoto(el, "cold", {
      ...FOOD, start: { x: 960, y: 640, z: 1.05 },
      notes: [
        { id: "food", x: 690, y: 668, title: "Food", text: "fruit and vegetables", status: "seen", dx: -120, dy: -150 },
        { id: "bags", x: 930, y: 664, title: "Plastic bags", text: "many still closed", status: "seen", dx: 150, dy: -230 },
        { id: "liquid", x: 1060, y: 800, title: "Liquid", text: "running out of the pile", status: "seen", dx: 170, dy: 90 }
      ]
    });
    gsap.set($(el, ".s1-sat"), { autoAlpha: 0 });
    gsap.set([$(el, ".s1-soil"), $(el, ".s1-shade")], { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(ph1.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6, ease: "power1.inOut", immediateRender: false }, 0);
      ph1.move(tl, { x: 900, y: 650, z: 1.3 }, 0, { d: 9, ease: "none" });
      fade(tl, $(el, ".s1-date"), 0.8);
      up(tl, $(el, ".s1-l1"), 1.6, { d: 1.2 });
      fade(tl, $(el, ".s1-cred"), 2.4);
    },
    (tl) => { ph1.show(tl, ["food", "bags", "liquid"], 0, { stagger: 0.45 }); },
    (tl, el) => {
      ph1.hide(tl, ["food", "bags", "liquid"], 0);
      tl.to($(el, ".s1-l1"), { autoAlpha: 0.35, y: -20, duration: 0.6 }, 0);
      up(tl, $(el, ".s1-l2"), 0.3, { d: 1.2 });
      // the camera sinks into the dark heap, which becomes soil seen from above
      ph1.move(tl, { x: 960, y: 760, z: 3.2 }, 1.8, { d: 2.2, ease: "power3.in" });
      tl.to([ph1.el, $(el, ".s1-vig"), $(el, ".s1-date"), $(el, ".s1-l1"), $(el, ".s1-l2"), $(el, ".s1-cred"), $(el, ".s1-src")], { autoAlpha: 0, duration: 0.9 }, 3.4)
        .fromTo($(el, ".s1-sat"), { autoAlpha: 0, scale: 1.25 }, { autoAlpha: 1, scale: 1, duration: 1.4, ease: "power2.out", immediateRender: false }, 3.4)
        .to($(el, ".s1-sat"), { scale: 2.2, y: -900, autoAlpha: 0, duration: 2.6, ease: "power2.inOut" }, 4.6)
        .fromTo($(el, ".s1-soil"), { autoAlpha: 1, y: 1080 }, { autoAlpha: 1, y: 0, duration: 2.6, ease: "power2.inOut", immediateRender: false }, 4.6)
        .fromTo($(el, ".s1-shade"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 6)
        .fromTo(soil1.state, { roots: 0 }, { roots: 0.55, duration: 5, ease: "power1.out", immediateRender: false }, 5.6);
      fade(tl, $(el, ".s1-kick"), 6.2);
      tl.add(headTl($(el, ".s1-title")), 6.4);
      up(tl, [$(el, ".s1-sub"), $(el, ".s1-team")], 7.2);
      fade(tl, $(el, ".s1-hz"), 7.6);
    },
    (tl, el) => {
      tl.fromTo(soil1.state, { water: 0, rain: 0 }, { water: 1, rain: 1, duration: 5, ease: "sine.inOut", immediateRender: false }, 0)
        .to(soil1.state, { rain: 0, duration: 1.5 }, 4.2)
        .fromTo(soil1.state, { roots: 0.55 }, { roots: 1, duration: 5, ease: "power1.inOut", immediateRender: false }, 0)
        .fromTo($(el, ".s1-photo"), { autoAlpha: 0, clipPath: "inset(100% 0 0 0)" }, { autoAlpha: 1, clipPath: "inset(0% 0 0 0)", duration: 1.4, ease: "expo.inOut", immediateRender: false }, 0.6);
      fade(tl, $(el, ".s1-vis"), 1.4);
    }
  ],
  onEnter() { soil1.start(); },
  onLeave(el, ctx) { ctx.whenHidden(el, () => soil1.stop()); }
});
// headline words as a sub-timeline (lets a step add it at any position)
function headTl(el) { const t = gsap.timeline(); head(t, el, 0, { s: 0.12, d: 1.4 }); return t; }

// ---------------------------------------------------------------- 02 · the loop
const LOOPN = ["Soil", "Agriculture", "Food", "Waste", "Recovery", "Back to soil"];
const CHAPTER = [0, 5, 11, 12, 14, 21];
const BADGES = [
  { node: 1, img: "img/coop/team-cooperative.webp", tag: "Our field visit", text: "a farming cooperative", x: 1080, y: 330 },
  { node: 1, img: "img/ecofarm-2024.webp", tag: "Our interview", text: "an organic farmer", x: 1080, y: 425, icon: true },
  { node: 4, img: "img/field/team-husmann.webp", tag: "Our field visit", text: "the composting plant", x: 1010, y: 610 }
];
const s02 = stepper({
  id: "s-loop", title: "One loop, not one technology", loop: 0, steps: 3,
  hideNav: (step) => step < 2,
  html: `
    <div class="s2-text">
      <p class="kicker fx">The route of this talk</p>
      <h2 class="head split">From soil to waste — <em>and back again.</em></h2>
      <p class="sub fx s2-sub">Sustainability is not one technology. <b>It is a system.</b></p>
    </div>
    <svg class="s2-ring" viewBox="0 0 1920 1080" aria-label="The loop: soil, agriculture, food, waste, recovery, back to soil"><g class="ringg"></g></svg>
    <svg class="s2-links" viewBox="0 0 1920 1080" aria-hidden="true"></svg>
    <div class="s2-badges"></div>
    <p class="s2-we fx">We did not only read about it. <b>We went to look.</b></p>
    <p class="s2-corner mono fx">It waits for you in the corner →</p>`,
  setup(el, ctx) {
    const g = $(el, ".ringg"), cx = 1250, cy = 540, R = 330, rr = rng(5);
    let d = "";
    for (let i = 0; i <= 72; i++) {
      const a = -Math.PI / 2 + (i / 72) * Math.PI * 2, r = R + Math.sin(i * 0.9) * 5 + (rr() - 0.5) * 4 * (i % 72 ? 1 : 0);
      d += (i ? "L" : "M") + (cx + Math.cos(a) * r).toFixed(1) + " " + (cy + Math.sin(a) * r).toFixed(1);
    }
    svg("path", { d: d + "Z", class: "ringpath", id: "s2-path" }, g);
    const pos = [];
    LOOPN.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / 6) * Math.PI * 2, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      pos.push([x, y]);
      const node = svg("g", { class: "rnode interactive", "data-go": CHAPTER[i], tabindex: 0, role: "button" }, g);
      svg("circle", { cx: x, cy: y, r: 16, class: "dot" }, node);
      svg("circle", { cx: x, cy: y, r: 34, class: "halo" }, node);
      const lx = cx + Math.cos(a) * (R + 76), ly = cy + Math.sin(a) * (R + 62);
      const t = svg("text", { x: lx, y: ly + 10, class: "rlabel", "text-anchor": Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end" }, node);
      t.textContent = n;
      node.addEventListener("click", (e) => { e.stopPropagation(); ctx.goto(+node.dataset.go); });
    });
    svg("circle", { r: 9, class: "runner", cx: 0, cy: 0 }, g);
    // field badges next to the nodes we visited ourselves
    const box = $(el, ".s2-badges"), links = $(el, ".s2-links");
    BADGES.forEach((b) => {
      const [x, y] = pos[b.node];
      svg("path", { d: `M${x} ${y}L${b.x + 40} ${b.y + 42}`, class: "s2-link" }, links);
      const d = document.createElement("div");
      d.className = "s2-badge";
      d.style.left = b.x + "px"; d.style.top = b.y + "px";
      d.innerHTML = `${b.icon ? `<i class="mail">✉</i>` : `<span class="thumb" data-bg="${b.img}"></span>`}<span><em class="mono">● ${b.tag}</em><b>${b.text}</b></span>`;
      box.appendChild(d);
    });
  },
  timelines: [
    (tl, el) => {
      head(tl, $(el, ".s2-text .head"), 0.1);
      up(tl, [$(el, ".s2-text .kicker"), $(el, ".s2-sub")], 0.3);
      tl.fromTo($(el, ".ringpath"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 2.4, ease: "power2.inOut", immediateRender: false }, 0.2);
      tl.fromTo($$(el, ".rnode"), { autoAlpha: 0, scale: 0.4, transformOrigin: "50% 50%" }, { autoAlpha: 1, scale: 1, duration: 0.6, stagger: 0.36, ease: "back.out(2)", immediateRender: false }, 0.3);
      tl.fromTo($(el, ".runner"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, 2.5)
        .to($(el, ".runner"), { motionPath: { path: "#s2-path", align: "#s2-path", alignOrigin: [0.5, 0.5] }, duration: 4, ease: "power1.inOut" }, 2.5);
    },
    (tl, el) => {
      tl.fromTo($$(el, ".s2-link"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, stagger: 0.35, immediateRender: false }, 0)
        .fromTo($$(el, ".s2-badge"), { autoAlpha: 0, scale: 0.6, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, stagger: 0.35, ease: "back.out(1.8)", immediateRender: false }, 0.1);
      up(tl, $(el, ".s2-we"), 1.2);
    },
    (tl, el) => {
      // the ring shrinks into the corner navigator (#loopnav: centre 1834,78, r≈31)
      tl.to([$(el, ".s2-badges"), $(el, ".s2-links"), $(el, ".s2-we")], { autoAlpha: 0, duration: 0.4 }, 0)
        .to($(el, ".ringg"), { x: 1834 - 1250, y: 78 - 540, scale: 31 / 330, svgOrigin: "1250 540", duration: 1.4, ease: "expo.inOut" }, 0.1)
        .to($$(el, ".rlabel"), { autoAlpha: 0, duration: 0.3 }, 0)
        .to($(el, ".ringg"), { autoAlpha: 0, duration: 0.3 }, 1.35);
      fade(tl, $(el, ".s2-corner"), 1.4);
    }
  ]
});

// ---------------------------------------------------------------- 03 · our region
// region-2024.webp: Sentinel-2 mosaic, lon 16.75–18.45, lat 47.85–48.98 (Web Mercator)
const MAP = { lon0: 16.75, lon1: 18.45, lat0: 47.85, lat1: 48.98, w: 1920, h: 1924 };
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mx = (lon) => ((lon - MAP.lon0) / (MAP.lon1 - MAP.lon0)) * MAP.w;
const my = (lat) => ((merc(MAP.lat1) - merc(lat)) / (merc(MAP.lat1) - merc(MAP.lat0))) * MAP.h;
const PINS = [
  { n: "Senica", sub: "our school · composting plant · farming cooperative", lon: 17.3667, lat: 48.6797, src: "visitcompost", k: "visit", card: "Our school is here. On 30 September 2026 we visited the town's composting plant — and, unplanned, the farming cooperative." },
  { n: "Statok Dubina", sub: "restored farm · 44 km", lon: 17.749417, lat: 48.381333, src: "kzdubina", k: "read", card: "8 ha of land farmed intensively for 60 years; restored by the farmer Stanislav since 2012. We use the conservation programme's profile." },
  { n: "Family EcoFarm No. 5", sub: "organic farm · 60 km", lon: 17.711087, lat: 48.193255, src: "vince", k: "ask", card: "A former vineyard near Galanta, now an organic farm. The farmer answered our questions by email on 22 Sep 2026." },
  { n: "Horné Jatovo ≈", sub: "biogas plant · 75 km", lon: 17.95, lat: 48.13, src: "ctzn", k: "read", card: "A biogas plant that treats bio-waste, including kitchen waste from Bratislava (report from July 2024). Approximate location." },
  { n: "Bratislava", sub: "capital", lon: 17.1077, lat: 48.1486, src: "ctzn", k: "read", card: "Bratislava's kitchen waste travelled about 70 km to Horné Jatovo (as reported in July 2024)." }
];
const s03 = stepper({
  id: "s-region", title: "Our region — and where we went", loop: 0, steps: 2,
  html: `
    <div class="s3-map"><img data-img="img/region-2024.webp" alt="Satellite mosaic of western Slovakia"><div class="s3-pins"></div></div>
    <div class="s3-vig"></div>
    <div class="s3-far">
      <svg viewBox="0 0 1920 1080" aria-hidden="true"><path class="arc" d="M520 420 Q 960 120 1400 700"/><circle class="p1" cx="520" cy="420" r="10"/><circle class="p2" cx="1400" cy="700" r="10"/></svg>
      <p class="mono s3-l1">SENICA · 48.68° N 17.37° E</p><p class="mono s3-l2">MERSIN · 36.81° N 34.64° E</p>
      <p class="s3-km"><span class="num">0</span> <small>km</small></p><p class="mono s3-kmn">straight-line distance</p>
    </div>
    <div class="s3-text fx"><p class="kicker">Western Slovakia</p><h2 class="head">Our region — <em>and where we went</em></h2><p class="sub">Every story in this talk is within 75 km of our school.</p></div>
    <ul class="s3-legend mono fx"><li><i class="k-visit"></i>we went there</li><li><i class="k-ask"></i>we asked them</li><li><i class="k-read"></i>we read about it</li></ul>
    <div class="s3-scale mono fx"><i></i>20 km</div>
    <div class="s3-card"></div>
    <div class="s3-src">${pills("eox", ["visitcompost", "Our field visit"], "vince", "kzdubina", "ctzn")}</div>`,
  setup(el, ctx) {
    const box = $(el, ".s3-pins");
    PINS.forEach((p) => {
      const b = document.createElement("button");
      b.className = `pin interactive k-${p.k}`;
      b.style.left = mx(p.lon) + "px"; b.style.top = my(p.lat) + "px";
      b.innerHTML = `<i></i><span><b>${p.n}</b><em>${p.sub}</em></span>`;
      b.onclick = (e) => {
        e.stopPropagation();
        const c = $(el, ".s3-card");
        c.innerHTML = `<b>${p.n}</b><p>${p.card}</p><span data-src="${p.src}"></span>`;
        ctx.decorate(c);
        const r = b.getBoundingClientRect(), st = el.getBoundingClientRect(), k = ctx.scale;
        c.style.left = Math.min(1480, (r.left - st.left) / k + 30) + "px"; c.style.top = Math.max(120, (r.top - st.top) / k - 40) + "px";
        gsap.fromTo(c, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35 });
      };
      box.appendChild(b);
    });
    const K = 0.62, xs = PINS.map((p) => mx(p.lon)), ys = PINS.map((p) => my(p.lat));
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    el._mapT = { x: 1180 - cx * K, y: 560 - cy * K, K };
    $(el, ".s3-map").style.cssText = `left:0;top:0;transform-origin:0 0`;
    $(el, ".s3-scale i").style.width = K * (20 / (111.32 * Math.cos((48.4 * Math.PI) / 180)) / (MAP.lon1 - MAP.lon0)) * MAP.w + "px";
    el.addEventListener("click", () => gsap.to($(el, ".s3-card"), { autoAlpha: 0, duration: 0.2 }));
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s3-far .arc"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 2, ease: "power2.inOut", immediateRender: false }, 0.2);
      fade(tl, [$(el, ".s3-far .p1"), $(el, ".s3-l1")], 0.1);
      fade(tl, [$(el, ".s3-far .p2"), $(el, ".s3-l2")], 1.9);
      fade(tl, [$(el, ".s3-km"), $(el, ".s3-kmn")], 0.4);
      count(tl, $(el, ".s3-km .num"), 1923, 0.4, { d: 2 });
    },
    (tl, el) => {
      tl.to($(el, ".s3-far"), { autoAlpha: 0, scale: 1.3, duration: 0.8, ease: "power2.in" }, 0)
        .fromTo($(el, ".s3-map"), { autoAlpha: 0, x: el._mapT.x, y: el._mapT.y, scale: el._mapT.K * 0.5 }, { autoAlpha: 1, x: el._mapT.x, y: el._mapT.y, scale: el._mapT.K, duration: 2.2, ease: "expo.out", immediateRender: false }, 0.5)
        .fromTo($(el, ".s3-vig"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, immediateRender: false }, 0.8)
        .fromTo($$(el, ".pin"), { autoAlpha: 0, y: -40 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.25, ease: "bounce.out", immediateRender: false }, 1.6);
      up(tl, [$(el, ".s3-text"), $(el, ".s3-legend"), $(el, ".s3-scale"), $(el, ".s3-src")], 1.2);
    }
  ]
});

// ---------------------------------------------------------------- 04 · landscape
// galanta-2024.webp spans 0.28° of longitude at 48.2° N → 20.8 km over 1920 px = 10.8 m/px.
const M_PER_PX = (0.28 * 111320 * Math.cos((48.2 * Math.PI) / 180)) / 1920;
const Z = 5; // zoom in step 1 → 2.16 m per stage pixel
const side = (ha) => Math.sqrt(ha * 10000) / (M_PER_PX / Z);
let land;
const s04 = stepper({
  id: "s-landscape", title: "When the landscape becomes too simple", loop: 0, steps: 4,
  html: `
    <div class="s4-sat"><img data-img="img/galanta-2024.webp" alt="Satellite image of fields around Galanta"></div>
    <div class="s4-shade"></div>
    <canvas class="s4-canvas" aria-hidden="true"></canvas>
    <div class="s4-hero">
      <p class="kicker fx">Average single-crop field · satellite data 2018</p>
      <p class="mega s4-num split">12 ha</p>
      <p class="sub fx">In Slovakia — the largest in the EU when it was measured. The EU average was <b>3.9 ha</b>.</p>
    </div>
    <div class="s4-squares"></div>
    <button class="s4-toggle interactive fx">Show in football pitches</button>
    <div class="s4-sim">
      <p class="kicker fx">One slope, two landscapes · simulation</p>
      <h2 class="head split">When the landscape becomes <em>too simple</em></h2>
    </div>
    <div class="s4-labels">
      <p class="lab mono mono-a fx" style="left:160px;top:470px">Wind lifts dry soil</p>
      <p class="lab mono mono-a fx" style="left:820px;top:560px">Bare ground heats up</p>
      <p class="lab mono mono-a fx" style="left:1480px;top:640px">Water runs off — with soil</p>
      <p class="lab mono mono-b fx" style="left:300px;top:380px">Windbreak</p>
      <p class="lab mono mono-b fx" style="left:700px;top:520px">Grass strip: water soaks in</p>
      <p class="lab mono mono-b fx" style="left:1560px;top:470px">Copse: shelter for animals</p>
    </div>
    <div class="s4-mode interactive fx"><button data-m="0" class="on">Monoculture</button><button data-m="1">Mosaic</button></div>
    <span class="visnote s4-vis fx">Squares at true scale to the zoomed satellite image</span>
    <span class="visnote s4-vis2 fx">Simulation · illustrative</span>
    <div class="s4-src">${pills("iep", ["defields", "Also reported · Denník E"], "eox")}</div>`,
  setup(el, ctx) {
    const box = $(el, ".s4-squares");
    const data = [["EU average", 3.9], ["Slovakia", 12], ["Trnava Region — ours", 18.2]];
    let x = 0;
    data.forEach(([n, ha], i) => {
      const s = side(ha), d = document.createElement("div");
      d.className = "sq" + (i === 1 ? " sk" : "") + (i === 2 ? " tt" : "");
      d.style.cssText = `left:${x}px;width:${s}px;height:${s}px`;
      d.innerHTML = `<span class="mono">${ha} ha</span><b>${n}</b>`;
      if (i === 1) { // football pitch grid: 105 × 68 m = 0.714 ha → 12 ha ≈ 17 pitches
        const g = document.createElement("div"); g.className = "pitches";
        const pw = 105 / (M_PER_PX / Z), ph = 68 / (M_PER_PX / Z);
        let k = 0;
        for (let yy = 0; yy + ph <= s + 1 && k < 17; yy += ph) for (let xx = 0; xx + pw <= s + 1 && k < 17; xx += pw, k++) {
          const p = document.createElement("i"); p.style.cssText = `left:${xx}px;top:${yy}px;width:${pw - 2}px;height:${ph - 2}px`; g.appendChild(p);
        }
        d.appendChild(g);
      }
      box.appendChild(d);
      x += s + 70;
    });
    const t = $(el, ".s4-toggle");
    t.onclick = (e) => {
      e.stopPropagation();
      const on = el.classList.toggle("pitch");
      t.textContent = on ? "≈ 17 football pitches · hide" : "Show in football pitches";
      gsap.fromTo($$(el, ".pitches i"), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: on ? 1 : 0, scale: 1, stagger: on ? 0.04 : 0, duration: 0.3 });
    };
    land = createLandscape($(el, ".s4-canvas"), { quality: ctx.quality });
    $$(el, ".s4-mode button").forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      $$(el, ".s4-mode button").forEach((x) => x.classList.toggle("on", x === b));
      gsap.to(land.state, { mosaic: +b.dataset.m, duration: ctx.reduced ? 0 : 2.5, ease: "power2.inOut" });
      gsap.to($$(el, ".mono-a"), { autoAlpha: +b.dataset.m ? 0 : 1, duration: 0.5 });
      gsap.to($$(el, ".mono-b"), { autoAlpha: +b.dataset.m ? 1 : 0, duration: 0.5 });
    }));
    gsap.set($(el, ".s4-canvas"), { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s4-sat"), { scale: 1.12 }, { scale: 1, duration: 3, ease: "power2.out", immediateRender: false }, 0);
      fade(tl, $(el, ".s4-shade"), 0);
      up(tl, $(el, ".s4-hero .kicker"), 0.4);
      head(tl, $(el, ".s4-num"), 0.6, { s: 0.15, d: 1.3 });
      up(tl, [$(el, ".s4-hero .sub"), $(el, ".s4-src")], 1.1);
    },
    (tl, el) => {
      // zoom into the satellite 5×, so 1 stage px = 2.16 m; squares grow from one corner
      tl.to($(el, ".s4-sat"), { scale: Z, duration: 2.4, ease: "expo.inOut", transformOrigin: "20% 32%" }, 0)
        .to($(el, ".s4-shade"), { opacity: 0.8, duration: 1 }, 0.4)
        .to($(el, ".s4-hero"), { y: -120, scale: 0.62, transformOrigin: "0 0", duration: 1.4, ease: "expo.inOut" }, 0)
        .to($(el, ".s4-hero .sub"), { autoAlpha: 0, duration: 0.4 }, 0)
        .fromTo($$(el, ".sq"), { autoAlpha: 0, scale: 0, transformOrigin: "0% 100%" }, { autoAlpha: 1, scale: 1, duration: 1.2, stagger: 0.35, ease: "expo.out", immediateRender: false }, 1.6);
      fade(tl, [$(el, ".s4-vis"), $(el, ".s4-toggle")], 2.6);
    },
    (tl, el) => {
      // from above to the side: the satellite tilts away, the slope rises
      tl.to([$(el, ".s4-squares"), $(el, ".s4-toggle"), $(el, ".s4-vis"), $(el, ".s4-hero")], { autoAlpha: 0, duration: 0.5 }, 0)
        .to($(el, ".s4-sat"), { rotationX: 62, y: 260, scale: Z * 0.8, autoAlpha: 0, transformPerspective: 1400, duration: 1.6, ease: "power2.in" }, 0.2)
        .fromTo($(el, ".s4-canvas"), { autoAlpha: 0, y: 200 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, 1.2)
        .fromTo(land.state, { rain: 0, wind: 0, heat: 0, mosaic: 0 }, { rain: 1, wind: 1, heat: 1, mosaic: 0, duration: 2.5, immediateRender: false }, 1.4)
        .to($(el, ".s4-shade"), { opacity: 0, duration: 0.6 }, 1.2);
      head(tl, $(el, ".s4-sim .head"), 1.6);
      up(tl, [$(el, ".s4-sim .kicker"), $(el, ".s4-vis2")], 1.8);
      up(tl, $$(el, ".mono-a"), 2.6, { s: 0.5 });
    },
    (tl, el) => {
      tl.to(land.state, { mosaic: 1, duration: 3.5, ease: "power2.inOut" }, 0);
      out(tl, $$(el, ".mono-a"), 0, { d: 0.4 });
      up(tl, $$(el, ".mono-b"), 1.4, { s: 0.4 });
      fade(tl, $(el, ".s4-mode"), 2.4);
      tl.fromTo({ v: 0 }, { v: 0 }, { v: 1, duration: 0.01, immediateRender: false, onStart: () => $$(el, ".s4-mode button").forEach((x) => x.classList.toggle("on", x.dataset.m === "1")), onReverseComplete: () => $$(el, ".s4-mode button").forEach((x) => x.classList.toggle("on", x.dataset.m === "0")) }, 0.01);
    }
  ],
  onEnter(el) { el.classList.remove("pitch"); $(el, ".s4-toggle").textContent = "Show in football pitches"; land.start(); $$(el, ".s4-mode button").forEach((x) => x.classList.toggle("on", x.dataset.m === "0")); },
  onLeave(el, ctx) { ctx.whenHidden(el, () => land.stop()); }
});

// ---------------------------------------------------------------- 05 · partridge
const BIRD = "M2 16C2 10 7 7 13 7C16 7 18 8 20 9.5C20.5 6.5 22.5 4.5 25 4.5C27 4.5 28.3 5.6 28.8 7L30 8L28.6 8.8C28.2 10.4 27 11.6 25.8 12.3C26 18 21.5 22.5 14 22.5C8 22.5 3.5 20 2 16Z";
const s05 = stepper({
  id: "s-partridge", title: "The partridge test", loop: 0, steps: 3,
  html: `
    <figure class="s6-photo fx"><img data-lightbox="partridge" data-img="img/partridge.webp" alt="Grey partridges in a field"
      data-caption="Grey partridges (Perdix perdix). Photo: TRinaud · CC BY 4.0 · Wikimedia Commons"><figcaption>Grey partridge · <i>Perdix perdix</i><span>Photo: TRinaud · CC BY 4.0</span></figcaption></figure>
    <div class="s6-text"><p class="kicker fx">A bird that needs a mosaic</p><h2 class="head split">The partridge <em>test</em></h2></div>
    <div class="s6-grid" aria-hidden="true"></div>
    <div class="s6-stat fx"><p class="mega">−99%</p><p class="sub">Grey partridges in Slovakia: down by up to 99 % in 50 years, according to SOS/BirdLife Slovensko.</p></div>
    <ol class="s6-chain">
      <li class="fx">Field structure</li><li class="fx">Margins & shelter</li><li class="fx">Insects for chicks</li><li class="fx">Birds survive</li><li class="fx">Biodiversity</li>
    </ol>
    <p class="s6-mech small fx">Partridges eat seeds and insects. They need a mosaic of crops, fallow land and field margins.</p>
    <div class="s6-src">${pills(["smepartridge", "SME · BirdLife 2025"], ["dnpartridge", "Denník N 2021 · headline"], "veda")}</div>`,
  setup(el) {
    const g = $(el, ".s6-grid"), r = rng(3);
    const order = [];
    for (let i = 0; i < 100; i++) {
      const b = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      b.setAttribute("viewBox", "0 0 30 26"); b.classList.add("bird");
      b.innerHTML = `<path d="${BIRD}"/>`;
      g.appendChild(b); order.push([r(), b]);
    }
    el._fade = order.sort((a, b) => a[0] - b[0]).map((x) => x[1]).filter((b) => b !== g.children[44]);
    g.children[44].classList.add("last");
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s6-photo"), { autoAlpha: 0, clipPath: "inset(0 100% 0 0)" }, { autoAlpha: 1, clipPath: "inset(0 0% 0 0)", duration: 1.4, ease: "expo.inOut", immediateRender: false }, 0);
      head(tl, $(el, ".s6-text .head"), 0.5);
      up(tl, [$(el, ".s6-text .kicker"), $(el, ".s6-src")], 0.6);
      tl.fromTo($$(el, ".bird"), { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.4, stagger: { each: 0.012, from: "random" }, immediateRender: false }, 1);
    },
    (tl, el) => {
      tl.to(el._fade, { autoAlpha: 0.08, duration: 0.6, stagger: 0.045, ease: "power1.in" }, 0)
        .to($(el, ".bird.last"), { scale: 1.5, duration: 0.8, ease: "back.out(2)" }, 4.4);
      up(tl, $(el, ".s6-stat"), 4.2);
    },
    (tl, el) => {
      tl.to($(el, ".s6-grid"), { autoAlpha: 0, duration: 0.6 }, 0);
      up(tl, $$(el, ".s6-chain li"), 0.2, { s: 0.3, y: 0 });
      fade(tl, $(el, ".s6-mech"), 1.8);
    }
  ]
});

export default [s01, s02, s03, s04, s05];
