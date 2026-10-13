// ACT III · OUR UNPLANNED VISIT — scenes 09–11: the farming cooperative in Senica
import { gsap } from "gsap";
import { stepper, $, $$, svg } from "../lib/stepper.js";
import { head, up, fade, out, pills } from "../lib/fx.js";
import { photoHTML, bindPhoto } from "../lib/photo.js";

// a hoof print (cloven, two toes), pointing up
const HOOF = "M-7 -14C-11 -13 -12 -4 -11 4C-10 10 -6 13 -3 11C-1 8 -1 -2 -2 -8C-3 -12 -5 -14 -7 -14ZM7 -14C11 -13 12 -4 11 4C10 10 6 13 3 11C1 8 1 -2 2 -8C3 -12 5 -14 7 -14Z";

// ---------------------------------------------------------------- 09 · the visit we didn't plan
const s09 = stepper({
  id: "s-coop", title: "The visit we didn't plan", loop: 1, steps: 3,
  html: `
    <div class="s9c-bg" data-bg="img/coop/landscape-2.webp"></div>
    <div class="s9c-shade"></div>
    <figure class="s9c-print fx"><img data-img="img/coop/team-cooperative.webp" data-lightbox="coop" data-caption="Our team at the farming cooperative in Senica (Poľnohospodárske družstvo Senica), 30 September 2026. Photo: our teacher Martin Woznica." alt="Our four students in front of the farming cooperative building in Senica"><figcaption class="mono">Poľnohospodárske družstvo Senica · 30 Sep 2026</figcaption><span class="stamp s9c-stamp">Field visit</span></figure>
    <div class="s9c-text">
      <p class="kicker fx">Field visit 2 · Senica</p>
      <h2 class="head split">The visit <em>we didn't plan</em></h2>
      <p class="sub fx">After the composting plant, we also stopped at the farming cooperative in Senica.</p>
    </div>
    <div class="s9c-expect">
      <p class="s9c-q fx">We expected to hear about <em>the weather.</em></p>
      <ul class="s9c-icons mono">
        <li class="fx"><svg viewBox="-30 -30 60 60"><circle r="11" class="sun"/><g class="rays">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line x1="0" y1="-17" x2="0" y2="-25" transform="rotate(${a})"/>`).join("")}</g></svg>heat</li>
        <li class="fx"><svg viewBox="-30 -30 60 60"><path class="crack" d="M-24 10H24M-10 10L-6 2L-12 -6M6 10L2 0L9 -8L5 -16"/></svg>drought</li>
        <li class="fx"><svg viewBox="-30 -30 60 60"><path class="cloud" d="M-18 4C-26 4 -26 -8 -17 -8C-15 -18 0 -20 4 -10C14 -14 22 -4 15 4Z"/><path class="rain" d="M-12 12L-15 20M0 12L-3 20M12 12L9 20"/></svg>storms</li>
        <li class="fx"><svg viewBox="-30 -30 60 60"><path class="frost" d="M0 -22V22M-19 -11L19 11M-19 11L19 -11"/></svg>frost</li>
      </ul>
    </div>
    <p class="s9c-else fx">We heard <em>something else.</em></p>
    <svg class="s9c-hooves" viewBox="0 0 1920 1080" aria-hidden="true"></svg>
    <div class="s9c-src">${pills(["visitcoop", "Our field visit"])}</div>`,
  setup(el) {
    const s = $(el, ".s9c-hooves");
    for (let i = 0; i < 14; i++) {
      const x = 120 + i * 130, y = 990 + (i % 2 ? -26 : 18), g = svg("g", { class: "hoof", transform: `translate(${x} ${y}) rotate(84)` }, s);
      svg("path", { d: HOOF }, g);
    }
  },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s9c-bg"), { scale: 1.12 }, { scale: 1.02, duration: 6, ease: "power1.out", immediateRender: false }, 0);
      tl.fromTo($(el, ".s9c-print"), { autoAlpha: 0, y: 80, rotation: 6 }, { autoAlpha: 1, y: 0, rotation: -2.5, duration: 1.2, ease: "expo.out", immediateRender: false }, 0.3)
        .fromTo($(el, ".s9c-stamp"), { autoAlpha: 0, scale: 1.8 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power4.in", immediateRender: false }, 1.4);
      head(tl, $(el, ".s9c-text .head"), 0.2);
      up(tl, [$(el, ".s9c-text .kicker"), $(el, ".s9c-text .sub"), $(el, ".s9c-src")], 0.5);
    },
    (tl, el) => {
      up(tl, $(el, ".s9c-q"), 0);
      up(tl, $$(el, ".s9c-icons li"), 0.5, { s: 0.2 });
    },
    (tl, el) => {
      tl.to($$(el, ".s9c-icons li"), { autoAlpha: 0.18, duration: 0.5, stagger: 0.05 }, 0)
        .to($(el, ".s9c-q"), { autoAlpha: 0.4, duration: 0.5 }, 0);
      up(tl, $(el, ".s9c-else"), 0.4);
      tl.fromTo($$(el, ".hoof"), { autoAlpha: 0, scale: 0.4, transformOrigin: "50% 50%" }, { autoAlpha: 0.9, scale: 1, duration: 0.25, stagger: 0.12, ease: "back.out(2)", immediateRender: false }, 0.8);
    }
  ]
});

// ---------------------------------------------------------------- 10 · adaptation is not always high-tech
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const s10 = stepper({
  id: "s-adapt", title: "Adaptation is not always high-tech", loop: 1, steps: 3,
  html: `
    <div class="s10a-bg" data-bg="img/coop/landscape.webp"></div>
    <div class="s10a-shade"></div>
    <div class="s10a-text">
      <p class="kicker fx">What they told us · farming cooperative, Senica</p>
      <h2 class="head split">Adaptation is not always <em>high-tech</em></h2>
      <p class="sub fx">They told us they can often adapt to the weather.</p>
    </div>
    <div class="s10a-cal fx">
      <div class="months mono">${MONTHS.map((m) => `<span>${m}</span>`).join("")}</div>
      <div class="track"><i class="win"><b class="mono">sowing</b></i><i class="ghost"></i></div>
      <div class="s10a-wx mono"><span class="wx">warm, dry spring</span><span class="arrow">← earlier, when needed</span></div>
      <p class="mono s10a-ill">Illustration · not their real dates or crops</p>
    </div>
    <div class="s10a-big">
      <p class="quote split">Sometimes adaptation means changing <em>when</em> you plant.</p>
      <div class="s10a-said fx"><span class="mono">● Our field visit · paraphrased</span><p>“At the cooperative we were told that changing the sowing time — for example sowing earlier — helps them respond to the weather.”</p></div>
    </div>
    <p class="s10a-cred mono fx">Photo: farming cooperative in Senica · fields near Senica</p>
    <div class="s10a-src">${pills(["visitcoop", "Our field visit"], ["coopphotos", "Cooperative's photo"])}</div>`,
  setup(el) { gsap.set($(el, ".ghost"), { autoAlpha: 0 }); },
  timelines: [
    (tl, el) => {
      tl.fromTo($(el, ".s10a-bg"), { scale: 1.08 }, { scale: 1, duration: 5, ease: "power1.out", immediateRender: false }, 0);
      head(tl, $(el, ".s10a-text .head"), 0.2);
      up(tl, [$(el, ".s10a-text .kicker"), $(el, ".s10a-text .sub"), $(el, ".s10a-cred"), $(el, ".s10a-src")], 0.5);
    },
    (tl, el) => {
      up(tl, $(el, ".s10a-cal"), 0);
      tl.fromTo($(el, ".win"), { left: "29%", width: "16%" }, { left: "29%", width: "16%", duration: 0.01, immediateRender: false }, 0)
        .fromTo($(el, ".wx"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, immediateRender: false }, 1)
        .fromTo($(el, ".ghost"), { autoAlpha: 0, left: "29%", width: "16%" }, { autoAlpha: 0.35, left: "29%", width: "16%", duration: 0.3, immediateRender: false }, 1.4)
        .to($(el, ".win"), { left: "21%", duration: 1.4, ease: "power3.inOut" }, 1.6)
        .fromTo($(el, ".arrow"), { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.6, immediateRender: false }, 2.2);
      fade(tl, $(el, ".s10a-ill"), 2.6);
    },
    (tl, el) => {
      tl.to([$(el, ".s10a-text .sub"), $(el, ".s10a-cal")], { autoAlpha: 0, y: -20, duration: 0.5 }, 0)
        .to($(el, ".s10a-text"), { y: -60, duration: 0.6 }, 0);
      head(tl, $(el, ".s10a-big .quote"), 0.4, { s: 0.08 });
      up(tl, $(el, ".s10a-said"), 1.6);
    }
  ]
});

// ---------------------------------------------------------------- 11 · wildlife is harder to control
const RAPE = { src: "img/coop/rapeseed-grazed.webp", w: 1920, h: 1440 };
const EVIDENCE = [
  ["sorghum-fallow-deer", "Sorghum eaten by fallow deer", "fallow deer"],
  ["rapeseed-red-deer-2", "Rapeseed after red deer", "red deer"],
  ["maize-wild-boar", "Maize after wild boar", "wild boar"],
  ["sorghum-harvest", "Sorghum after red deer — at harvest time", "red deer"]
];
const WEB = [
  ["Food production", "the farm has to harvest something", 960, 250],
  ["Wildlife", "deer and wild boar need food and cover", 1430, 470],
  ["Landscape ecology", "woods and hedges give animals shelter", 1250, 820],
  ["Crop protection", "how to protect fields without harming animals?", 670, 820],
  ["Economic loss", "what is eaten cannot be sold", 490, 470]
];
let ph11;
const s11 = stepper({
  id: "s-wildlife", title: "Wildlife is harder to control", loop: 1, steps: 4,
  html: `
    ${photoHTML("rape", { ...RAPE, alt: "A rapeseed field near Senica: in front grazed, in the background in bloom" })}
    <div class="s11w-top"></div>
    <div class="s11w-text"><p class="kicker fx">Farming cooperative, Senica · their photo, their words</p><h2 class="head split">Wildlife is harder <em>to control</em></h2></div>
    <p class="s11w-q fx">“Fallow deer like the flowers too.”<span class="mono">caption by the cooperative · translated</span></p>
    <div class="s11w-wall">${EVIDENCE.map(([f, c, a]) => `<figure class="fx"><img data-img="img/coop/${f}.webp" data-lightbox="wild" data-caption="${c}. Photo and caption: farming cooperative in Senica (translated from Slovak)." alt="${c}"><figcaption><span class="mono tag">${a}</span>${c}</figcaption></figure>`).join("")}</div>
    <svg class="s11w-web" viewBox="0 0 1920 1080" aria-label="A web of needs: food production, wildlife, landscape, crop protection, economic loss"></svg>
    <div class="s11w-webtext">${WEB.map(([t, d, x, y]) => `<div class="wn fx" style="left:${x}px;top:${y}px"><b>${t}</b><span>${d}</span></div>`).join("")}<div class="wc fx" style="left:960px;top:560px"><b>One field<br>next to the woods</b></div></div>
    <p class="s11w-not mono fx">Not an enemy — a conflict of needs</p>
    <div class="s11w-local">
      <p class="chain fx"><s>climate change → bad weather → lower harvest</s></p>
      <p class="real fx">At this cooperative: <b>the weather</b> — they adapt the sowing time. <b>Wildlife</b> — much harder.</p>
      <p class="quote s11w-end split">Agriculture needs biodiversity. Agriculture also feels <em>pressure from wildlife.</em></p>
      <p class="s11w-ask fx">How do we protect crops — without treating wildlife as the enemy?</p>
    </div>
    <div class="s11w-src">${pills(["coopphotos", "Cooperative's photos"], ["visitcoop", "Our field visit"], "iep")}</div>`,
  setup(el) {
    ph11 = bindPhoto(el, "rape", {
      ...RAPE, start: { x: 960, y: 720, z: 1 },
      notes: [
        { id: "bloom", x: 1320, y: 528, title: "In the background", text: "rapeseed in bloom", status: "confirmed", word: "Cooperative's caption", dx: 60, dy: -110 },
        { id: "grazed", x: 860, y: 1010, title: "In front: grazed", text: "the flowers are gone", status: "confirmed", word: "Cooperative's caption", dx: 120, dy: -170, r: 60 },
        { id: "left", x: 405, y: 935, title: "A few flowers left", status: "seen", dx: -60, dy: 100, r: 16 }
      ]
    });
    const s = $(el, ".s11w-web");
    WEB.forEach(([, , x, y], i) => {
      svg("line", { x1: 960, y1: 560, x2: x, y2: y, class: "spoke" }, s);
      const [nx, ny] = WEB[(i + 1) % WEB.length].slice(2);
      svg("line", { x1: x, y1: y, x2: nx, y2: ny, class: "rim" }, s);
    });
    gsap.set([s, $(el, ".s11w-webtext")], { autoAlpha: 0 });
  },
  timelines: [
    (tl, el) => {
      tl.fromTo(ph11.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.2, immediateRender: false }, 0);
      ph11.move(tl, { x: 960, y: 760, z: 1.08 }, 0, { d: 6, ease: "none" });
      head(tl, $(el, ".s11w-text .head"), 0.4);
      up(tl, [$(el, ".s11w-text .kicker"), $(el, ".s11w-src")], 0.6);
      ph11.show(tl, ["bloom", "grazed", "left"], 1.6, { stagger: 0.6 });
      up(tl, $(el, ".s11w-q"), 3.4);
    },
    (tl, el) => {
      ph11.hide(tl, ["bloom", "grazed", "left"], 0);
      tl.to(ph11.el, { autoAlpha: 0.1, duration: 0.7 }, 0.1)
        .to([$(el, ".s11w-q"), $(el, ".s11w-text .head")], { autoAlpha: 0, duration: 0.5 }, 0);
      tl.fromTo($$(el, ".s11w-wall figure"), { autoAlpha: 0, y: 50, rotation: (i) => [-2, 1.5, -1, 2][i] }, { autoAlpha: 1, y: 0, rotation: (i) => [-1.2, 0.8, -0.6, 1][i], duration: 0.8, stagger: 0.22, ease: "expo.out", immediateRender: false }, 0.4);
    },
    (tl, el) => {
      tl.to($$(el, ".s11w-wall figure"), { autoAlpha: 0, scale: 0.92, duration: 0.5, stagger: 0.05 }, 0)
        .to($(el, ".s11w-text"), { autoAlpha: 0, duration: 0.4 }, 0)
        .fromTo($(el, ".s11w-web"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.4)
        .fromTo($(el, ".s11w-webtext"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, 0.4)
        .fromTo($$(el, ".s11w-web .spoke"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.15, immediateRender: false }, 0.5)
        .fromTo($$(el, ".s11w-web .rim"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.7, stagger: 0.12, immediateRender: false }, 1.2);
      up(tl, $(el, ".wc"), 0.5);
      up(tl, $$(el, ".wn"), 0.8, { s: 0.25 });
      up(tl, $(el, ".s11w-not"), 2.2);
    },
    (tl, el) => {
      tl.to([$(el, ".s11w-web"), $(el, ".s11w-webtext"), $(el, ".s11w-not")], { autoAlpha: 0.08, duration: 0.6 }, 0);
      up(tl, $(el, ".s11w-local .chain"), 0.3);
      up(tl, $(el, ".s11w-local .real"), 1.1);
      head(tl, $(el, ".s11w-end"), 1.9, { s: 0.07 });
      up(tl, $(el, ".s11w-ask"), 3.4);
    }
  ]
});

export default [s09, s10, s11];
