// Photo evidence: one of our real photos fills a box on the stage, a virtual
// camera moves through it (zoom and pan in photo pixels), and annotations stay
// pinned to points in the photo while their text stays crisp and unscaled.
//
// Every annotation carries an evidence status, so the audience always knows
// how sure we are:
//   confirmed  ●  written by the operator / the cooperative / the farmer
//   seen       ○  visible in our photo
//   likely     ◌  our interpretation
//   unknown    ?  we do not know yet
import { gsap } from "gsap";
import { svg } from "./stepper.js";

export const STATUS = {
  confirmed: { sym: "●", word: "Operator confirmed" },
  seen: { sym: "○", word: "In our photo" },
  likely: { sym: "◌", word: "Our interpretation" },
  unknown: { sym: "?", word: "We don't know yet" }
};

// Markup for a photo box. `box` is in stage pixels; default is the full stage.
export function photoHTML(id, { src, w, h, alt = "", box = [0, 0, 1920, 1080], cls = "" }) {
  const [x, y, bw, bh] = box;
  return `<div class="ph ${cls}" data-ph="${id}" style="left:${x}px;top:${y}px;width:${bw}px;height:${bh}px">
    <div class="ph-cam" style="width:${w}px;height:${h}px"><img data-img="${src}" width="${w}" height="${h}" alt="${alt}" draggable="false"><svg class="ph-flow" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg></div>
    <div class="ph-shade"></div>
    <svg class="ph-lines" viewBox="0 0 ${bw} ${bh}" aria-hidden="true"></svg>
    <div class="ph-loupes"></div>
    <div class="ph-labels"></div>
  </div>`;
}

// Bind a photo box. `notes` are the annotations:
//   { id, x, y, title, text, status, word?, dx=60, dy=-40, align?: "l"|"r", r=22, ring=true }
// `loupes`: { id, x, y, at: [stageX, stageY] (inside the box), d = 300, mag = 2.6, title? }
export function bindPhoto(root, id, { w, h, notes = [], loupes = [], start }) {
  const el = root.querySelector(`[data-ph="${id}"]`);
  const camEl = el.querySelector(".ph-cam");
  const lines = el.querySelector(".ph-lines");
  const labelsEl = el.querySelector(".ph-labels");
  const loupesEl = el.querySelector(".ph-loupes");
  const BW = el.offsetWidth || parseFloat(el.style.width), BH = el.offsetHeight || parseFloat(el.style.height);
  const s0 = Math.max(BW / w, BH / h);
  const cam = { x: w / 2, y: h / 2, z: 1, ...(start || {}) };
  let S = s0, tx = 0, ty = 0;

  function clampCam() {
    S = s0 * Math.max(1, cam.z);
    const hx = BW / (2 * S), hy = BH / (2 * S);
    const cx = Math.min(Math.max(cam.x, hx), w - hx), cy = Math.min(Math.max(cam.y, hy), h - hy);
    tx = BW / 2 - cx * S; ty = BH / 2 - cy * S;
  }
  const project = (px, py) => [tx + px * S, ty + py * S];

  // ---- annotations ----
  const items = notes.map((n) => {
    const st = STATUS[n.status] || STATUS.seen;
    const g = svg("g", { class: `ph-note st-${n.status}` }, lines);
    const line = svg("path", { class: "ph-leader", d: "M0 0" }, g);
    const ring = n.ring === false ? null : svg("circle", { class: "ph-ring", r: n.r || 22, cx: 0, cy: 0 }, g);
    const dot = svg("circle", { class: "ph-dot", r: 6, cx: 0, cy: 0 }, g);
    const lab = document.createElement("div");
    lab.className = `ph-label st-${n.status}${n.align === "l" ? " al" : ""}${n.cls ? " " + n.cls : ""}`;
    lab.innerHTML = `${n.title ? `<b>${n.title}</b>` : ""}${n.text ? `<span>${n.text}</span>` : ""}<em class="mono">${st.sym} ${n.word || st.word}</em>`;
    labelsEl.appendChild(lab);
    return { n, g, line, ring, dot, lab };
  });
  const loupeItems = loupes.map((l) => {
    const d = l.d || 300;
    const g = svg("g", { class: "ph-loupe-line" }, lines);
    const line = svg("path", { d: "M0 0" }, g);
    const div = document.createElement("div");
    div.className = "ph-loupe";
    div.style.cssText = `width:${d}px;height:${d}px;left:${l.at[0] - d / 2}px;top:${l.at[1] - d / 2}px`;
    div.innerHTML = `<i></i>${l.title ? `<b class="mono">${l.title}</b>` : ""}`;
    loupesEl.appendChild(div);
    return { l, d, g, line, div, bgSet: false };
  });

  function layout() {
    clampCam();
    camEl.style.transform = `translate(${tx}px, ${ty}px) scale(${S})`;
    items.forEach(({ n, line, ring, dot, lab }) => {
      const [ax, ay] = project(n.x, n.y);
      const dx = n.dx ?? 60, dy = n.dy ?? -40;
      const lx = ax + dx, ly = ay + dy;
      ring && ring.setAttribute("cx", ax); ring && ring.setAttribute("cy", ay);
      dot.setAttribute("cx", ax); dot.setAttribute("cy", ay);
      // elbow leader: diagonal out of the ring, then horizontal to the label
      const r0 = (n.r || 22) + 4, len = Math.hypot(dx, dy) || 1;
      const sx = ax + (dx / len) * r0, sy = ay + (dy / len) * r0;
      line.setAttribute("d", `M${sx.toFixed(1)} ${sy.toFixed(1)}L${(lx - Math.sign(dx || 1) * 18).toFixed(1)} ${ly.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}`);
      lab.style.left = lx + "px"; lab.style.top = ly + "px";
      lab.classList.toggle("flip", dx < 0);
    });
    loupeItems.forEach((it) => {
      const { l, d, line, div } = it;
      const k = s0 * (l.mag || 2.6); // loupe magnification relative to the uncropped photo
      const i = div.querySelector("i");
      i.style.backgroundSize = `${w * k}px ${h * k}px`;
      i.style.backgroundPosition = `${d / 2 - l.x * k}px ${d / 2 - l.y * k}px`;
      const [ax, ay] = project(l.x, l.y);
      const cx = l.at[0], cy = l.at[1], vx = ax - cx, vy = ay - cy, len = Math.hypot(vx, vy) || 1;
      line.setAttribute("d", `M${(cx + (vx / len) * (d / 2)).toFixed(1)} ${(cy + (vy / len) * (d / 2)).toFixed(1)}L${(ax - (vx / len) * 14).toFixed(1)} ${(ay - (vy / len) * 14).toFixed(1)}`);
    });
  }
  layout();

  const api = {
    el, cam, layout,
    // camera move inside a step timeline
    move(tl, to, at = 0, o = {}) {
      return tl.to(cam, { ...to, duration: o.d ?? 2.2, ease: o.ease ?? "power2.inOut", onUpdate: layout }, at);
    },
    // reveal annotations (ids) inside a step timeline
    show(tl, ids, at = 0, o = {}) {
      const list = items.filter((it) => ids.includes(it.n.id));
      list.forEach((it, k) => {
        const t = at + k * (o.stagger ?? 0.35);
        tl.fromTo(it.g, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, t)
          .fromTo(it.dot, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.4, ease: "back.out(3)", immediateRender: false }, t);
        it.ring && tl.fromTo(it.ring, { scale: 2.2, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: 0.6, ease: "expo.out", immediateRender: false }, t);
        tl.fromTo(it.line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, ease: "power2.out", immediateRender: false }, t + 0.15)
          .fromTo(it.lab, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out", immediateRender: false }, t + 0.35);
      });
      return tl;
    },
    hide(tl, ids, at = 0) {
      const list = items.filter((it) => ids.includes(it.n.id));
      list.forEach((it) => tl.to([it.g, it.lab], { autoAlpha: 0, duration: 0.35 }, at));
      return tl;
    },
    loupe(tl, lid, at = 0) {
      const it = loupeItems.find((x) => x.l.id === lid);
      if (!it) return tl;
      const ensure = () => { if (!it.bgSet) { it.div.querySelector("i").style.backgroundImage = `url("${camEl.querySelector("img").dataset.img}")`; it.bgSet = true; } layout(); };
      tl.fromTo(it.div, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: "expo.out", immediateRender: false, onStart: ensure, onUpdate: () => it.bgSet || ensure() }, at)
        .fromTo(it.g, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, immediateRender: false }, at + 0.3)
        .fromTo(it.line, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.5, immediateRender: false }, at + 0.3);
      return tl;
    },
    unloupe(tl, lid, at = 0) {
      const it = loupeItems.find((x) => x.l.id === lid);
      if (it) tl.to([it.div, it.g], { autoAlpha: 0, duration: 0.3 }, at);
      return tl;
    },
    // initial hidden state (call once in setup)
    reset() {
      items.forEach((it) => gsap.set([it.g, it.lab], { autoAlpha: 0 }));
      loupeItems.forEach((it) => gsap.set([it.div, it.g], { autoAlpha: 0 }));
    }
  };
  api.reset();
  return api;
}

// Small legend chip for scenes with annotated photos.
export const legendHTML = (cls = "") => `<div class="ph-legend mono ${cls}"><span class="st-confirmed">● confirmed in writing</span><span class="st-seen">○ in our photo</span><span class="st-likely">◌ our interpretation</span><span class="st-unknown">? unknown</span></div>`;
