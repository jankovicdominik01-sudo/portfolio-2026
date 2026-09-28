// Generic scene choreography: one paused GSAP timeline per step.
// Forward plays the step's timeline; backward reverses it. Entering a scene
// backwards jumps straight to the final state. Canvas/WebGL scenes hook in
// through onStep(step, dir) and onEnter/onLeave.
import { gsap } from "gsap";

export function stepper(def) {
  let tls = [];
  return {
    ...def,
    steps: def.steps || 1,
    init(el, ctx) {
      def.setup && def.setup(el, ctx);
      tls = (def.timelines || []).map((fn) => {
        const tl = gsap.timeline({ paused: true });
        fn(tl, el, ctx);
        return tl;
      });
    },
    enter(el, ctx, { dir, step }) {
      // reset newest-first so every tween restores the value it originally saw
      [...tls].reverse().forEach((tl) => tl.pause().timeScale(1).progress(0));
      def.onEnter && def.onEnter(el, ctx, dir, step);
      if (dir < 0 || ctx.reduced) {
        for (let i = 0; i <= step; i++) tls[i] && tls[i].progress(1);
        def.onStep && def.onStep(step, 0, el, ctx, true);
      } else {
        tls[0] && tls[0].play(0);
        def.onStep && def.onStep(0, 1, el, ctx, false);
      }
    },
    go(el, ctx, step, dir) {
      if (dir > 0) {
        // a click mid-animation: finish the earlier steps first so nothing fights
        for (let i = 0; i < step; i++) if (tls[i] && tls[i].progress() < 1) tls[i].progress(1);
        const tl = tls[step];
        if (tl) ctx.reduced ? tl.progress(1) : tl.play(0);
      } else {
        const tl = tls[step + 1];
        if (tl) ctx.reduced ? tl.progress(0) : tl.timeScale(1.6).reverse().eventCallback("onReverseComplete", () => tl.timeScale(1));
      }
      def.onStep && def.onStep(step, dir, el, ctx, ctx.reduced);
    },
    leave(el, ctx) {
      def.onLeave && def.onLeave(el, ctx);
    }
  };
}

export const $ = (el, s) => el.querySelector(s);
export const $$ = (el, s) => [...el.querySelectorAll(s)];
export const SVGNS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// split a headline into word spans for staggered reveals
export function words(el) {
  el.innerHTML = el.textContent.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : `<span class="w"><span>${w}</span></span>`)).join("");
  return [...el.querySelectorAll(".w > span")];
}
// requestAnimationFrame loop that only runs while active
export function loop(fn) {
  let id = 0, on = false, last = 0;
  const tick = (t) => { if (!on) return; const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t; fn(dt, t / 1000); id = requestAnimationFrame(tick); };
  return {
    start() { if (on) return; on = true; last = performance.now(); id = requestAnimationFrame(tick); },
    stop() { on = false; cancelAnimationFrame(id); },
    get running() { return on; }
  };
}
