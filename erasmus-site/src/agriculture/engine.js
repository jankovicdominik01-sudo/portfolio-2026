// Presentation engine: a fixed 1920×1080 stage, scenes with numbered steps,
// clicker/keyboard navigation, source drawer, lightbox, menu and notes.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { SOURCES, LEVELS } from "./sources.js";

/* global __ASSETS__ */
const CREDITS = (typeof __ASSETS__ !== "undefined" && __ASSETS__.credits) || [];
const LOOP = ["Soil", "Agriculture", "Food", "Waste", "Recovery", "Back to soil"];

export function createEngine(scenes, opts) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const quality = detectQuality();
  const stage = document.getElementById("stage");
  const root = document.getElementById("scenes");
  const ctx = { gsap, reduced, quality, stage, openLightbox, openSource, flash };

  let current = -1, step = 0, busy = false, overlay = null;

  // ---------- stage scaling ----------
  function fit() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = `translate(${(innerWidth - 1920 * s) / 2}px, ${(innerHeight - 1080 * s) / 2}px) scale(${s})`;
    ctx.scale = s;
  }
  addEventListener("resize", fit); fit();

  // ---------- build scenes ----------
  scenes.forEach((sc, i) => {
    const el = document.createElement("section");
    el.className = "scene";
    el.id = sc.id;
    el.dataset.index = i;
    el.innerHTML = sc.html;
    el.setAttribute("aria-hidden", "true");
    root.appendChild(el);
    sc.el = el;
  });
  scenes.forEach((sc) => sc.init && sc.init(sc.el, ctx));

  // ---------- loop navigator ----------
  const nav = document.getElementById("loopnav");
  buildLoopNav();
  function buildLoopNav() {
    const R = 44, cx = 60, cy = 60;
    let h = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${R}" class="ring"/><circle cx="${cx}" cy="${cy}" r="${R}" class="prog" pathLength="1"/>`;
    LOOP.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / LOOP.length) * Math.PI * 2;
      h += `<circle class="node" data-n="${i}" cx="${cx + Math.cos(a) * R}" cy="${cy + Math.sin(a) * R}" r="5"/>`;
    });
    h += `</svg><div class="navtext"><span class="stage-name"></span><span class="count mono"></span></div>`;
    nav.innerHTML = h;
  }
  function updateNav() {
    const sc = scenes[current];
    const node = sc.loop ?? 0;
    nav.querySelectorAll(".node").forEach((n, i) => n.classList.toggle("on", i <= node));
    nav.querySelector(".prog").style.strokeDashoffset = 1 - (current + 1) / scenes.length;
    nav.querySelector(".stage-name").textContent = LOOP[node];
    nav.querySelector(".count").textContent = `${String(current + 1).padStart(2, "0")} / ${scenes.length}`;
    nav.classList.toggle("hidden", !!sc.hideNav);
    document.getElementById("notes-text").textContent = sc.notes || "";
  }

  // ---------- navigation ----------
  function show(i, targetStep, dir) {
    if (i < 0 || i >= scenes.length) return;
    const prev = current >= 0 ? scenes[current] : null;
    const next = scenes[i];
    if (prev && prev !== next) {
      prev.leave && prev.leave(prev.el, ctx);
      prev.el.classList.remove("active");
      prev.el.setAttribute("aria-hidden", "true");
      gsap.to(prev.el, { autoAlpha: 0, duration: reduced ? 0 : 0.7, ease: "power2.inOut" });
    }
    current = i;
    step = targetStep;
    next.el.classList.add("active");
    next.el.setAttribute("aria-hidden", "false");
    gsap.fromTo(next.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduced ? 0 : 0.7, ease: "power2.inOut" });
    next.enter && next.enter(next.el, ctx, { dir, step });
    updateNav();
    try { history.replaceState(null, "", `#s${i + 1}`); } catch (e) { /* sandbox */ }
    lock(450);
  }
  function lock(ms) { busy = true; setTimeout(() => (busy = false), ms); }

  function next() {
    if (busy) return;
    const sc = scenes[current];
    if (step < (sc.steps || 1) - 1) {
      step++;
      sc.go && sc.go(sc.el, ctx, step, 1);
      lock(350);
    } else if (current < scenes.length - 1) show(current + 1, 0, 1);
  }
  function prev() {
    if (busy) return;
    const sc = scenes[current];
    if (step > 0) {
      step--;
      sc.go && sc.go(sc.el, ctx, step, -1);
      lock(250);
    } else if (current > 0) show(current - 1, (scenes[current - 1].steps || 1) - 1, -1);
  }
  ctx.goto = (i) => show(i, 0, 1);
  ctx.openSources = () => openOverlay("sources");

  // ---------- keyboard / clicker / touch ----------
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (overlay === "lightbox") {
      if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); lightboxStep(1); }
      else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); lightboxStep(-1); }
      else if (k === "Escape") closeLightbox();
      return;
    }
    if (overlay && k === "Escape") { closeOverlay(); return; }
    if (overlay === "menu" || overlay === "sources" || overlay === "source") return;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); prev(); }
    else if (k === "Home") show(0, 0, 1);
    else if (k === "End") show(scenes.length - 1, 0, 1);
    else if (k === "f" || k === "F") toggleFullscreen();
    else if (k === "n" || k === "N") document.getElementById("notes").classList.toggle("on");
    else if (k === "s" || k === "S") openOverlay("sources");
    else if (k === "m" || k === "M" || k === "Escape") openOverlay("menu");
  });
  stage.addEventListener("click", (e) => {
    if (overlay) return;
    if (e.target.closest("button, a, [data-src], [data-lightbox], .interactive, input")) return;
    const r = stage.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.2) prev(); else next();
  });
  let tx = null;
  stage.addEventListener("touchstart", (e) => (tx = e.touches[0].clientX), { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (tx == null || overlay) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
    tx = null;
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen();
    } catch (e) { /* not allowed */ }
  }

  // ---------- source pills → drawer ----------
  document.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-src]");
    if (!pill) return;
    e.stopPropagation();
    openSource(pill.dataset.src);
  });
  function decoratePills(root = document) {
    root.querySelectorAll("[data-src]").forEach((p) => {
      const s = SOURCES[p.dataset.src];
      if (!s) return;
      p.classList.add("pill", "lv" + s.level);
      if (!p.textContent.trim()) p.textContent = s.pill;
      p.setAttribute("role", "button");
      p.setAttribute("tabindex", "0");
      p.setAttribute("title", s.title);
    });
  }
  decoratePills();
  ctx.decorate = decoratePills;
  function openSource(id) {
    const s = SOURCES[id];
    if (!s) return;
    const d = document.getElementById("drawer");
    d.innerHTML = `<button class="x" aria-label="Close">×</button>
      <span class="pill lv${s.level}">${s.pill}</span>
      <p class="lvl mono">${LEVELS[s.level]}</p>
      <h3>${s.title}</h3>
      <dl><dt>Who</dt><dd>${s.author}</dd><dt>Date</dt><dd>${s.date}</dd><dt>Type</dt><dd>${s.type}</dd>
      <dt>Context</dt><dd>${s.context}</dd><dt>We use it for</dt><dd>${s.use}</dd><dt>We do not claim</dt><dd>${s.avoid}</dd></dl>
      ${s.url ? `<p class="url mono">${s.url}</p><a class="open" href="${s.url}" target="_blank" rel="noopener">Open original ↗</a>` : ""}`;
    d.querySelector(".x").onclick = closeOverlay;
    openOverlay("source");
  }

  // ---------- sources panel ----------
  function buildSourcesPanel() {
    const p = document.getElementById("sources");
    const groups = {};
    Object.entries(SOURCES).forEach(([id, s]) => (groups[s.level] = groups[s.level] || []).push([id, s]));
    p.innerHTML = `<button class="x" aria-label="Close">×</button><h2>Sources</h2><p class="lead">Who is saying this? Every pill in the presentation opens one of these.</p>` +
      Object.keys(LEVELS).map((L) => `<section><h3><span class="pill lv${L}">${L}</span> ${LEVELS[L]}</h3><ul>` +
        (groups[L] || []).map(([id, s]) => `<li><button data-src="${id}" class="srcline"><b>${s.title}</b><span>${s.author} · ${s.date}</span></button></li>`).join("") +
        `</ul></section>`).join("") +
      (CREDITS.length ? `<section><h3>Photos & imagery</h3><ul class="credits">${CREDITS.map((c) => `<li>${c}</li>`).join("")}</ul></section>` : "");
    p.querySelector(".x").onclick = closeOverlay;
    p.querySelectorAll(".srcline").forEach((b) => b.classList.remove("pill"));
  }
  buildSourcesPanel();

  // ---------- menu ----------
  function buildMenu() {
    const m = document.getElementById("menu");
    const other = opts.otherDeck;
    m.innerHTML = `<button class="x" aria-label="Close">×</button>
      <div class="menu-grid">
        <div><p class="mono dim">Scenes</p><ol class="scene-list">${scenes.map((s, i) => `<li><button data-go="${i}"><span class="mono">${String(i + 1).padStart(2, "0")}</span>${s.title}</button></li>`).join("")}</ol></div>
        <div class="menu-side">
          <p class="mono dim">Presentations</p>
          <ul class="decks"><li class="cur">✓ Ecological Agriculture</li><li><button class="switch">${other.title}</button><button class="confirm" hidden>Switch now →</button></li></ul>
          <a class="hub" href="${opts.hubHref}">← Back to Erasmus hub</a>
          <p class="mono dim keys">→ / ← next · F fullscreen · N notes · S sources · M menu</p>
        </div>
      </div>`;
    m.querySelector(".x").onclick = closeOverlay;
    m.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { closeOverlay(); show(+b.dataset.go, 0, 1); }));
    const sw = m.querySelector(".switch"), cf = m.querySelector(".confirm");
    sw.onclick = () => { cf.hidden = false; sw.classList.add("armed"); };
    cf.onclick = () => (location.href = other.href);
  }
  buildMenu();
  document.getElementById("menubtn").onclick = (e) => { e.stopPropagation(); openOverlay("menu"); };

  function openOverlay(name) {
    closeOverlay(true);
    overlay = name;
    const el = document.getElementById(name === "source" ? "drawer" : name);
    el.classList.add("on");
    document.body.classList.add("has-overlay");
  }
  function closeOverlay(silent) {
    ["drawer", "menu", "sources"].forEach((id) => document.getElementById(id).classList.remove("on"));
    const cf = document.querySelector("#menu .confirm");
    if (cf) { cf.hidden = true; document.querySelector("#menu .switch").classList.remove("armed"); }
    if (overlay !== "lightbox") { overlay = null; document.body.classList.remove("has-overlay"); }
    if (!silent) stage.focus && stage.focus();
  }

  // ---------- cinematic lightbox (shared-element) ----------
  const lb = document.getElementById("lightbox");
  let lbList = [], lbIndex = 0, lbSource = null;
  document.addEventListener("click", (e) => {
    const img = e.target.closest("[data-lightbox]");
    if (!img || overlay) return;
    e.stopPropagation();
    const group = img.dataset.lightbox;
    lbList = [...document.querySelectorAll(`[data-lightbox="${group}"]`)];
    openLightbox(img, lbList.indexOf(img));
  });
  function openLightbox(img, idx) {
    lbIndex = idx; lbSource = img;
    const big = lb.querySelector("img");
    big.src = img.dataset.full || img.currentSrc || img.src;
    lb.querySelector(".cap").innerHTML = img.dataset.caption || img.alt || "";
    lb.classList.add("on"); overlay = "lightbox";
    if (!reduced) {
      const a = img.getBoundingClientRect(), b = big.getBoundingClientRect();
      gsap.fromTo(big, { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: a.width / b.width },
        { x: 0, y: 0, scale: 1, duration: 0.65, ease: "expo.out" });
      gsap.fromTo(lb.querySelector(".bg"), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    }
  }
  function lightboxStep(d) {
    if (lbList.length < 2) return;
    lbIndex = (lbIndex + d + lbList.length) % lbList.length;
    const img = lbList[lbIndex];
    const big = lb.querySelector("img");
    gsap.to(big, { opacity: 0, x: -40 * d, duration: reduced ? 0 : 0.2, onComplete: () => {
      big.src = img.dataset.full || img.currentSrc || img.src;
      lb.querySelector(".cap").innerHTML = img.dataset.caption || img.alt || "";
      gsap.fromTo(big, { opacity: 0, x: 40 * d }, { opacity: 1, x: 0, duration: reduced ? 0 : 0.35 });
    } });
    lbSource = img;
  }
  function closeLightbox() {
    const big = lb.querySelector("img");
    const done = () => { lb.classList.remove("on"); gsap.set(big, { clearProps: "all" }); overlay = null; };
    if (reduced || !lbSource) return done();
    const a = lbSource.getBoundingClientRect(), b = big.getBoundingClientRect();
    gsap.to(big, { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: a.width / b.width, duration: 0.45, ease: "expo.inOut", onComplete: done });
    gsap.to(lb.querySelector(".bg"), { opacity: 0, duration: 0.4 });
  }
  lb.addEventListener("click", (e) => {
    if (e.target.closest(".nav")) { lightboxStep(e.target.closest(".nav").dataset.d | 0); return; }
    closeLightbox();
  });

  function flash(msg) {
    const f = document.getElementById("flash");
    f.textContent = msg; gsap.fromTo(f, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.3, yoyo: true, repeat: 1, repeatDelay: 1.6 });
  }

  // wake lock for projector use
  addEventListener("keydown", () => { if (navigator.wakeLock && !ctx.lock) navigator.wakeLock.request("screen").then((l) => (ctx.lock = l)).catch(() => {}); }, { once: true });

  // a typed or bookmarked #sN jumps there (replaceState above never fires this)
  addEventListener("hashchange", () => {
    const h = /^#s(\d+)$/.exec(location.hash || "");
    if (h && current >= 0 && +h[1] - 1 !== current) { closeOverlay(true); show(Math.min(scenes.length - 1, Math.max(0, +h[1] - 1)), 0, 1); }
  });

  // start
  requestAnimationFrame(() => {
    const m = /^#s(\d+)$/.exec(location.hash || "");
    show(m ? Math.min(scenes.length - 1, Math.max(0, +m[1] - 1)) : 0, 0, 1);
  });
  return ctx;
}

function detectQuality() {
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return "low";
  return "high";
}
