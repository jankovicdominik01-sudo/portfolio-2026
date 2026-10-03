// Small choreography helpers shared by all scenes. Elements revealed by a
// timeline carry the class "fx" (hidden until their tween first renders), and
// headlines carry "split" (their words wait below the baseline).
import { words } from "./stepper.js";

export function head(tl, el, at = 0, o = {}) {
  if (!el) return tl;
  const w = el._words || (el._words = words(el));
  return tl.fromTo(w, { yPercent: 115, y: 0 }, { yPercent: 0, y: 0, duration: o.d ?? 1.1, stagger: o.s ?? 0.07, ease: "expo.out", immediateRender: false }, at);
}
export function up(tl, t, at, o = {}) {
  return tl.fromTo(t, { autoAlpha: 0, y: o.y ?? 26 }, { autoAlpha: 1, y: 0, duration: o.d ?? 0.8, stagger: o.s ?? 0.08, ease: o.ease ?? "power3.out", immediateRender: false }, at);
}
export function fade(tl, t, at, o = {}) {
  return tl.fromTo(t, { autoAlpha: 0 }, { autoAlpha: 1, duration: o.d ?? 0.8, stagger: o.s ?? 0, ease: "power1.inOut", immediateRender: false }, at);
}
export function out(tl, t, at, o = {}) {
  return tl.to(t, { autoAlpha: 0, y: o.y ?? 0, duration: o.d ?? 0.5, stagger: o.s ?? 0, ease: "power2.in" }, at);
}
export function count(tl, el, to, at, o = {}) {
  const obj = { v: o.from ?? 0 };
  const fmt = o.fmt || ((v) => Math.round(v).toLocaleString("en-US"));
  return tl.to(obj, { v: to, duration: o.d ?? 1.6, ease: o.ease ?? "power2.out", onUpdate: () => (el.textContent = fmt(obj.v)), onReverseComplete: () => (el.textContent = fmt(o.from ?? 0)) }, at);
}
// a row of source pills
export const pills = (...ids) => `<div class="pills srcrow">${ids.map((i) => (typeof i === "string" ? `<span data-src="${i}"></span>` : `<span data-src="${i[0]}">${i[1]}</span>`)).join("")}</div>`;
