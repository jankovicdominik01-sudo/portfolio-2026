// Generic scene choreography: one paused GSAP timeline per step.
// Forward plays the step's timeline; backward reverses it. Entering a scene
// backwards jumps straight to the final state. Canvas/WebGL scenes hook in
// through onStep(step, dir) and onEnter/onLeave.
//
// Navigation must never drop input and never fight itself, so every change of
// step first "settles" all timelines into the exact state of the step we are
// leaving (finished or rewound), then starts the one transition we want.
import { gsap } from "gsap";

export function stepper(def) {
  let tls = [];
  let at = 0; // the step whose final state the timelines currently represent
  function settle(step) {
    // newest first when rewinding, oldest first when finishing: every tween
    // then restores / reaches the value it was built against
    for (let i = tls.length - 1; i > step; i--) { const tl = tls[i]; if (tl && (tl.progress() > 0 || tl.isActive())) { tl.pause().timeScale(1); tl.eventCallback("onReverseComplete", null); tl.progress(0); } }
    for (let i = 0; i <= step; i++) { const tl = tls[i]; if (tl && (tl.progress() < 1 || tl.isActive())) { tl.pause().timeScale(1); tl.progress(1); } }
  }
  return {
    ...def,
    steps: def.steps || 1,
    init(el, ctx) {
      def.setup && def.setup(el, ctx);
      // GSAP restores the *pre-tween* value when a fromTo is rewound past its
      // start. So the first tween that touches a property decides that
      // property's starting state: if it is a fromTo, its "from" values are
      // applied right now. Rewinding (jumps, Back, re-entering) then always
      // lands on exactly the state the audience saw first.
      const used = new WeakMap();
      tls = (def.timelines || []).map((fn) => {
        const tl = gsap.timeline({ paused: true });
        fn(tracked(tl, used), el, ctx);
        return tl;
      });
    },
    enter(el, ctx, { dir, step }) {
      // reset newest-first so every tween restores the value it originally saw
      [...tls].reverse().forEach((tl) => { tl.pause().timeScale(1); tl.eventCallback("onReverseComplete", null); tl.progress(0); });
      def.onEnter && def.onEnter(el, ctx, dir, step);
      if (dir < 0 || ctx.reduced || step > 0) {
        for (let i = 0; i <= step; i++) tls[i] && tls[i].progress(1);
        at = step;
        def.onStep && def.onStep(step, 0, el, ctx, true);
      } else {
        at = 0;
        tls[0] && tls[0].play(0);
        def.onStep && def.onStep(0, 1, el, ctx, false);
      }
    },
    go(el, ctx, step, dir) {
      if (dir > 0) {
        settle(step - 1);
        const tl = tls[step];
        if (tl) ctx.reduced ? tl.progress(1) : tl.play(0);
      } else {
        settle(step + 1);
        const tl = tls[step + 1];
        if (tl) {
          if (ctx.reduced) tl.progress(0);
          // GSAP reverses by a negative timeScale: pause first, or restoring 1 plays it forward again
          else tl.timeScale(1.6).reverse().eventCallback("onReverseComplete", () => { tl.pause(); tl.timeScale(1); tl.eventCallback("onReverseComplete", null); });
        }
      }
      at = step;
      def.onStep && def.onStep(step, dir, el, ctx, ctx.reduced);
    },
    getTimelines() { return tls; }, // QA only
    // finish whatever is running so the screen shows exactly step `at`
    finish() { settle(at); },
    leave(el, ctx) {
      settle(at);
      def.onLeave && def.onLeave(el, ctx);
    }
  };
}

const CONFIG = new Set(["duration", "ease", "stagger", "delay", "repeat", "yoyo", "repeatDelay", "immediateRender", "overwrite", "lazy", "paused", "id",
  "onStart", "onUpdate", "onComplete", "onReverseComplete", "onRepeat", "callbackScope", "transformOrigin", "svgOrigin", "smoothOrigin", "data", "inherit"]);
const KEY = (k) => (k === "autoAlpha" || k === "alpha" ? "opacity" : k);
function claim(targets, vars, used, prime) {
  if (!vars || typeof vars !== "object") return;
  const list = gsap.utils.toArray(targets).filter((t) => t && typeof t === "object");
  if (!list.length) return;
  const set = {};
  for (const k in vars) {
    if (CONFIG.has(k)) continue;
    const key = KEY(k);
    const free = list.every((t) => !(used.get(t) || new Set()).has(key));
    list.forEach((t) => { let u = used.get(t); if (!u) used.set(t, (u = new Set())); u.add(key); if (k === "autoAlpha") u.add("visibility"); });
    if (prime && free) set[k] = vars[k];
  }
  if (prime && Object.keys(set).length) {
    if (vars.transformOrigin) set.transformOrigin = vars.transformOrigin;
    if (vars.svgOrigin) set.svgOrigin = vars.svgOrigin;
    gsap.set(list, set);
  }
}
function tracked(tl, used) {
  const proxy = new Proxy(tl, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== "function") return v;
      return (...args) => {
        if (k === "fromTo") claim(args[0], args[1], used, true);
        else if (k === "from") claim(args[0], args[1], used, true);
        else if (k === "to" || k === "set") claim(args[0], args[1], used, false);
        const r = v.apply(t, args);
        return r === t ? proxy : r;
      };
    }
  });
  return proxy;
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
  el.innerHTML = el.innerHTML.split(/(<[^>]+>|\s+)/).map((w) => (!w || /^\s+$/.test(w) || /^</.test(w) ? w : `<span class="w"><span>${w}</span></span>`)).join("");
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
