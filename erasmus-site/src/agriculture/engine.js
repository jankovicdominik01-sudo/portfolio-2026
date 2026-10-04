// Presentation engine: a fixed 1920×1080 stage, scenes with numbered steps,
// deterministic navigation (keyboard, clicker, wheel/touchpad, touch, click),
// presenter window, source drawer, research panel, overview, lightbox.
//
// Reliability rules (this runs live on a projector in Turkey):
//  - one input = exactly one step; input is never dropped and never doubled
//  - a running animation is finished instantly when the next input arrives
//  - a held key does not auto-repeat through the deck
//  - one wheel/touchpad gesture = one step (inertia is ignored)
//  - the URL hash (#s7.2) always holds scene + step, so a refresh resumes
import { gsap } from "gsap";
import { SOURCES, LEVELS, LEVEL_ORDER } from "./sources.js";
import { SCRIPT, PRESENTERS, slug } from "./notes.js";
import { PHOTO_LOG } from "./evidence.js";

/* global __ASSETS__ */
const CREDITS = (typeof __ASSETS__ !== "undefined" && __ASSETS__.credits) || [];
const LOOP = ["Soil", "Agriculture", "Food", "Waste", "Recovery", "Back to soil"];
const CHANNEL = "back-to-soil-presenter";

export function createEngine(allScenes, opts) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const quality = detectQuality();
  const stage = document.getElementById("stage");
  const root = document.getElementById("scenes");
  const notesById = Object.fromEntries(SCRIPT.map((n) => [n.id, n]));
  const scenes = allScenes.map((s) => ({ ...s, note: notesById[s.id] || null }));
  const mainCount = scenes.filter((s) => !s.backup).length;
  const ctx = { gsap, reduced, quality, stage, openLightbox, openSource, flash, scale: 1 };

  let current = -1, step = 0, overlay = null, fade = [];

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
  ctx.isActive = (el) => el.classList.contains("active");
  // run fn after the crossfade, unless the scene became active again
  ctx.whenHidden = (el, fn, ms = 800) => setTimeout(() => { if (!el.classList.contains("active")) fn(); }, ms);
  scenes.forEach((sc) => sc.init && sc.init(sc.el, ctx));

  // ---------- lazy images: current scene ±2 ----------
  function loadScene(i) {
    const sc = scenes[i];
    if (!sc || sc.loaded) return;
    sc.loaded = true;
    sc.el.querySelectorAll("img[data-img]").forEach((img) => { img.decoding = "async"; img.src = img.dataset.img; });
    sc.el.querySelectorAll("[data-bg]").forEach((d) => (d.style.backgroundImage = `url("${d.dataset.bg}")`));
    sc.el.querySelectorAll("video[data-img]").forEach((v) => { v.src = v.dataset.img; v.preload = "auto"; });
  }
  function preload(i) { [i, i + 1, i - 1, i + 2].forEach(loadScene); }

  // ---------- loop navigator (top right) ----------
  const nav = document.getElementById("loopnav");
  (function buildLoopNav() {
    const R = 44, cx = 60, cy = 60;
    let h = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${R}" class="ring"/><circle cx="${cx}" cy="${cy}" r="${R}" class="prog" pathLength="1"/>`;
    LOOP.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / LOOP.length) * Math.PI * 2;
      h += `<circle class="node" data-n="${i}" cx="${cx + Math.cos(a) * R}" cy="${cy + Math.sin(a) * R}" r="5"/>`;
    });
    h += `</svg><div class="navtext"><span class="stage-name"></span><span class="count mono"></span></div>`;
    nav.innerHTML = h;
  })();
  function updateNav() {
    const sc = scenes[current];
    const node = sc.loop ?? 0;
    nav.querySelectorAll(".node").forEach((n, i) => n.classList.toggle("on", i <= node));
    const k = sc.backup ? 1 : (current + 1) / mainCount;
    nav.querySelector(".prog").style.strokeDashoffset = 1 - k;
    nav.querySelector(".stage-name").textContent = sc.backup ? "Backup" : LOOP[node];
    nav.querySelector(".count").textContent = sc.backup ? "extra" : `${String(current + 1).padStart(2, "0")} / ${mainCount}`;
    const hide = typeof sc.hideNav === "function" ? sc.hideNav(step) : !!sc.hideNav;
    nav.classList.toggle("hidden", hide);
    document.getElementById("notes-text").innerHTML = noteHTML(sc, step);
    document.getElementById("progress").style.transform = `scaleX(${sc.backup ? 1 : (current + (step + 1) / (sc.steps || 1)) / mainCount})`;
  }

  // ---------- navigation core ----------
  function finishFade() { fade.forEach((t) => t.progress(1)); fade = []; }
  function show(i, targetStep = 0, dir = 1) {
    if (i < 0 || i >= scenes.length) return;
    finishFade();
    const prev = current >= 0 ? scenes[current] : null;
    const next = scenes[i];
    targetStep = Math.max(0, Math.min((next.steps || 1) - 1, targetStep));
    if (prev && prev !== next) {
      prev.leave && prev.leave(prev.el, ctx);
      prev.el.classList.remove("active");
      prev.el.setAttribute("aria-hidden", "true");
      fade.push(gsap.to(prev.el, { autoAlpha: 0, duration: reduced ? 0 : 0.6, ease: "power2.inOut" }));
    }
    current = i; step = targetStep;
    preload(i);
    next.el.classList.add("active");
    next.el.setAttribute("aria-hidden", "false");
    if (prev !== next) fade.push(gsap.fromTo(next.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: reduced ? 0 : 0.6, ease: "power2.inOut" }));
    next.enter && next.enter(next.el, ctx, { dir, step });
    changed();
  }
  function changed() {
    updateNav();
    try { history.replaceState(null, "", `#s${current + 1}${step ? "." + step : ""}`); } catch (e) { /* sandboxed */ }
    try { sessionStorage.setItem("bts-pos", JSON.stringify([current, step])); } catch (e) { /* private mode */ }
    broadcast();
  }
  function next() {
    const sc = scenes[current];
    if (step < (sc.steps || 1) - 1) { finishFade(); step++; sc.go && sc.go(sc.el, ctx, step, 1); changed(); return; }
    const lastMain = mainCount - 1;
    if (current === lastMain) { flash("End of the presentation · M = menu"); return; }
    if (current < scenes.length - 1) show(current + 1, 0, 1);
  }
  function prev() {
    const sc = scenes[current];
    if (step > 0) { finishFade(); step--; sc.go && sc.go(sc.el, ctx, step, -1); changed(); return; }
    if (current === mainCount) { show(mainCount - 1, (scenes[mainCount - 1].steps || 1) - 1, -1); return; }
    if (current > 0) show(current - 1, (scenes[current - 1].steps || 1) - 1, -1);
  }
  function jump(i, s = 0) { closeOverlay(true); show(Math.max(0, Math.min(scenes.length - 1, i)), s, 1); }
  ctx.goto = (i) => jump(i, 0);
  ctx.scenes = scenes; // read-only use: QA scripts and the presenter
  ctx.state = () => ({ current, step, overlay });
  ctx.next = next; ctx.prev = prev;
  ctx.openSources = () => openOverlay("sources");

  // ---------- keyboard / clicker ----------
  let digits = "", digitTimer = 0;
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (overlay === "lightbox") {
      if (["ArrowRight", "PageDown", " "].includes(k)) { e.preventDefault(); lightboxStep(1); }
      else if (["ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); lightboxStep(-1); }
      else if (k === "Escape" || k === "Enter") { e.preventDefault(); closeLightbox(); }
      return;
    }
    if (overlay === "blackout") { e.preventDefault(); toggleBlackout(false); return; }
    if (overlay && k === "Escape") { closeOverlay(); return; }
    if (overlay === "overview") {
      if (k === "Enter" || k === "g" || k === "G") { e.preventDefault(); const f = document.querySelector("#overview button.sel"); if (f) jump(+f.dataset.go); else closeOverlay(); }
      else if (k.startsWith("Arrow")) { e.preventDefault(); moveOverviewSel(k); }
      return;
    }
    if (overlay) return; // menu, sources, source drawer: their own controls
    if (/^[0-9]$/.test(k)) { digits += k; clearTimeout(digitTimer); digitTimer = setTimeout(() => (digits = ""), 1600); flash(`Go to scene ${digits} · Enter`); return; }
    if (k === "Enter" && digits) { e.preventDefault(); const n = +digits; digits = ""; if (n >= 1 && n <= scenes.length) jump(n - 1); return; }
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); if (!e.repeat) next(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); if (!e.repeat) prev(); }
    else if (k === "Home") { e.preventDefault(); jump(0); }
    else if (k === "End") { e.preventDefault(); jump(mainCount - 1); }
    else if (k === "f" || k === "F") toggleFullscreen();
    else if (k === "n" || k === "N") document.getElementById("notes").classList.toggle("on");
    else if (k === "p" || k === "P") openPresenter();
    else if (k === "s" || k === "S") openOverlay("sources");
    else if (k === "g" || k === "G" || k === "o" || k === "O") openOverlay("overview");
    else if (k === "b" || k === "B" || k === "." || k === ",") toggleBlackout(true);
    else if (k === "?" || k === "h" || k === "H") openOverlay("menu");
    else if (k === "m" || k === "M" || k === "Escape") openOverlay("menu");
  });

  // ---------- wheel / touchpad: one gesture = one step ----------
  let wheelAcc = 0, wheelLock = false, wheelIdle = 0;
  addEventListener("wheel", (e) => {
    if (overlay && overlay !== "blackout") return; // menus and panels scroll normally
    e.preventDefault();
    const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    const px = e.deltaMode === 1 ? raw * 16 : e.deltaMode === 2 ? raw * 400 : raw;
    clearTimeout(wheelIdle);
    wheelIdle = setTimeout(() => { wheelLock = false; wheelAcc = 0; }, 240);
    if (wheelLock) return;
    wheelAcc += px;
    if (Math.abs(wheelAcc) >= 40) {
      wheelLock = true;
      if (overlay === "blackout") toggleBlackout(false); else if (wheelAcc > 0) next(); else prev();
      wheelAcc = 0;
    }
  }, { passive: false });

  // ---------- click / touch ----------
  stage.addEventListener("click", (e) => {
    if (overlay) return;
    if (e.target.closest("button, a, input, [data-src], [data-lightbox], .interactive")) return;
    if (window.getSelection && String(window.getSelection())) return;
    const r = stage.getBoundingClientRect();
    if (e.clientX - r.left < r.width * 0.18) prev(); else next();
  });
  let tx = null, ty = null;
  stage.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (tx == null || overlay) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
    tx = ty = null;
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const d = document.documentElement;
        (d.requestFullscreen ? d.requestFullscreen() : d.webkitRequestFullscreen && d.webkitRequestFullscreen())?.catch?.(() => {});
      } else (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
    } catch (e) { /* not allowed */ }
  }
  ["fullscreenchange", "webkitfullscreenchange"].forEach((ev) => document.addEventListener(ev, () => setTimeout(fit, 50)));

  // ---------- cursor hides when idle (projector) ----------
  let idle = 0;
  addEventListener("mousemove", () => { document.body.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add("idle"), 2500); });

  // ---------- blackout ----------
  function toggleBlackout(on) {
    const b = document.getElementById("blackout");
    if (on) { closeOverlay(true); overlay = "blackout"; b.classList.add("on"); }
    else { b.classList.remove("on"); overlay = null; }
  }

  // ---------- source pills → tooltip + drawer ----------
  const tip = document.getElementById("srctip");
  document.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-src]");
    if (!pill) return;
    e.stopPropagation();
    openSource(pill.dataset.src);
  });
  document.addEventListener("keydown", (e) => {
    const pill = document.activeElement && document.activeElement.closest && document.activeElement.closest("[data-src]");
    if (pill && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); e.stopImmediatePropagation(); openSource(pill.dataset.src); }
  }, true);
  document.addEventListener("mouseover", (e) => {
    const pill = e.target.closest("[data-src]");
    if (!pill || overlay) { tip.classList.remove("on"); return; }
    const s = SOURCES[pill.dataset.src];
    if (!s) return;
    tip.innerHTML = `<b>${s.title}</b><span>${s.author} · ${s.date}</span><em class="mono">${LEVELS[s.level].name} · click for details</em>`;
    const r = pill.getBoundingClientRect(), st = stage.getBoundingClientRect(), k = ctx.scale;
    const x = Math.min(1920 - 560, Math.max(20, (r.left - st.left) / k));
    const y = (r.top - st.top) / k;
    tip.style.left = x + "px";
    tip.style.top = (y > 300 ? y - 14 : y + r.height / k + 14) + "px";
    tip.classList.toggle("below", y <= 300);
    tip.classList.add("on");
  });
  document.addEventListener("mouseout", (e) => { if (e.target.closest("[data-src]")) tip.classList.remove("on"); });

  function decoratePills(rootEl = document) {
    rootEl.querySelectorAll("[data-src]").forEach((p) => {
      const s = SOURCES[p.dataset.src];
      if (!s) { console.warn("unknown source", p.dataset.src); return; }
      p.classList.add("pill", "lv" + s.level);
      if (!p.textContent.trim()) p.textContent = s.pill;
      p.setAttribute("role", "button");
      p.setAttribute("tabindex", "0");
      p.setAttribute("aria-label", `Source: ${s.title}`);
    });
  }
  decoratePills();
  ctx.decorate = decoratePills;

  function openSource(id) {
    const s = SOURCES[id];
    if (!s) return;
    tip.classList.remove("on");
    const d = document.getElementById("drawer");
    const L = LEVELS[s.level];
    d.innerHTML = `<button class="x" aria-label="Close">×</button>
      <span class="pill lv${s.level}">${s.pill}</span>
      <p class="lvl mono">${L.name}</p>
      <h3>${s.title}</h3>
      <dl><dt>Who</dt><dd>${s.author}</dd>${s.publisher ? `<dt>Published by</dt><dd>${s.publisher}</dd>` : ""}<dt>Date</dt><dd>${s.date}</dd><dt>Type</dt><dd>${s.type}</dd>
      <dt>Context</dt><dd>${s.context}</dd><dt>Why we use it</dt><dd>${s.use}</dd><dt>We do not claim</dt><dd>${s.avoid}</dd></dl>
      ${s.url ? `<p class="url mono">${s.url}</p><a class="open" href="${s.url}" target="_blank" rel="noopener">Open the original ↗ <small>(needs internet)</small></a>` : ""}`;
    d.querySelector(".x").onclick = () => closeOverlay();
    openOverlay("source");
  }

  // ---------- research panel (S) ----------
  (function buildSourcesPanel() {
    const p = document.getElementById("sources");
    const groups = {};
    Object.entries(SOURCES).forEach(([id, s]) => (groups[s.level] = groups[s.level] || []).push([id, s]));
    const tabs = [["all", "All sources"], ...LEVEL_ORDER.map((L) => [L, LEVELS[L].short]), ["photos", "Photo log"]];
    p.innerHTML = `<button class="x" aria-label="Close">×</button>
      <header><h2>Our research</h2><p class="lead">Who says what — and how sure we are. Our own field work comes first; every coloured pill in the presentation opens one of these.</p>
      <nav class="tabs">${tabs.map(([k, n], i) => `<button data-tab="${k}" class="${i ? "" : "on"}">${n}${groups[k] ? ` <small>${groups[k].length}</small>` : ""}</button>`).join("")}</nav></header>
      <div class="panes">
      ${LEVEL_ORDER.map((L) => `<section data-level="${L}"><h3><span class="pill lv${L}">${LEVELS[L].short}</span> ${LEVELS[L].name}</h3><p class="why">${LEVELS[L].rule}</p><ul>` +
        (groups[L] || []).map(([id, s]) => `<li><button data-src="${id}" class="srcline"><b>${s.title}</b><span>${s.author} · ${s.date}</span></button></li>`).join("") + `</ul></section>`).join("")}
      <section data-level="photos" class="photolog"><h3>Photo log</h3><p class="why">Every photo we show, who took it, when — and what we can and cannot read from it.</p>
        <ul>${PHOTO_LOG.map((ph) => `<li><figure><img data-img="${ph.src}" alt="${ph.title}" loading="lazy"><figcaption><b>${ph.title}</b><span class="mono">${ph.by} · ${ph.date}</span><span>${ph.what}</span>${ph.unknown ? `<span class="unk">? ${ph.unknown}</span>` : ""}</figcaption></figure></li>`).join("")}</ul></section>
      ${CREDITS.length ? `<section data-level="credits"><h3>Other photos & imagery</h3><ul class="credits">${CREDITS.map((c) => `<li>${c}</li>`).join("")}</ul></section>` : ""}
      </div>`;
    p.querySelector(".x").onclick = () => closeOverlay();
    p.querySelectorAll(".srcline").forEach((b) => b.classList.remove("pill"));
    const showTab = (k) => {
      p.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === k));
      p.querySelectorAll(".panes > section").forEach((s) => (s.hidden = !(k === "all" ? s.dataset.level !== "photos" : s.dataset.level === k)));
      if (k === "photos") p.querySelectorAll(".photolog img[data-img]").forEach((im) => { if (!im.src) im.src = im.dataset.img; });
    };
    p.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
    showTab("all");
  })();

  // ---------- menu (M) ----------
  (function buildMenu() {
    const m = document.getElementById("menu");
    const other = opts.otherDeck;
    const row = (s, i) => `<li><button data-go="${i}"><span class="mono">${s.backup ? "B" + (i - mainCount + 1) : String(i + 1).padStart(2, "0")}</span>${s.title}${s.note ? `<em class="who p-${slug(s.note.presenter)}">${s.note.presenter}</em>` : ""}</button></li>`;
    m.innerHTML = `<button class="x" aria-label="Close">×</button>
      <div class="menu-grid">
        <div><p class="mono dim">Scenes</p><ol class="scene-list">${scenes.map((s, i) => (s.backup ? "" : row(s, i))).join("")}</ol>
          <p class="mono dim" style="margin-top:28px">Backup — only if someone asks</p><ol class="scene-list backup">${scenes.map((s, i) => (s.backup ? row(s, i) : "")).join("")}</ol></div>
        <div class="menu-side">
          <p class="mono dim">Presenting</p>
          <div class="menu-actions"><button class="act" data-act="presenter">Presenter view <kbd>P</kbd></button><button class="act" data-act="overview">Scene overview <kbd>G</kbd></button><button class="act" data-act="sources">Our research <kbd>S</kbd></button><button class="act" data-act="full">Fullscreen <kbd>F</kbd></button><a class="act" href="script.html" target="_blank" rel="noopener">Speaker script & presenter map ↗</a></div>
          <p class="mono dim">Presentations</p>
          <ul class="decks"><li class="cur">✓ Ecological agriculture</li><li><button class="switch">${other.title}</button><button class="confirm" hidden>Switch now →</button></li></ul>
          <a class="hub" href="${opts.hubHref}">← Back to the Erasmus hub</a>
          <dl class="keys mono"><dt>→ Space PgDn</dt><dd>next</dd><dt>← PgUp</dt><dd>back</dd><dt>12 Enter</dt><dd>go to scene 12</dd><dt>B</dt><dd>black screen</dd><dt>N</dt><dd>notes on this screen</dd><dt>Home / End</dt><dd>first / last scene</dd></dl>
        </div>
      </div>`;
    m.querySelector(".x").onclick = () => closeOverlay();
    m.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => jump(+b.dataset.go)));
    m.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.act;
      if (a === "presenter") { closeOverlay(true); openPresenter(); }
      else if (a === "overview") openOverlay("overview");
      else if (a === "sources") openOverlay("sources");
      else if (a === "full") { closeOverlay(true); toggleFullscreen(); }
    }));
    const sw = m.querySelector(".switch"), cf = m.querySelector(".confirm");
    sw.onclick = () => { cf.hidden = false; sw.classList.add("armed"); };
    cf.onclick = () => (location.href = other.href);
  })();
  document.getElementById("menubtn").onclick = (e) => { e.stopPropagation(); openOverlay("menu"); };

  // ---------- overview (G) ----------
  (function buildOverview() {
    const o = document.getElementById("overview");
    o.innerHTML = `<button class="x" aria-label="Close">×</button><p class="mono dim">Scene overview · arrows + Enter · Esc closes</p><div class="ov-grid">${scenes.map((s, i) => s.backup ? "" : `<button data-go="${i}" style="--c:var(--p-${s.note ? slug(s.note.presenter) : "x"})"><span class="mono n">${String(i + 1).padStart(2, "0")}</span><span class="mono ch">${LOOP[s.loop ?? 0]}</span><b>${s.title}</b><em class="mono">${s.note ? `${s.note.presenter} · ${fmtTime(s.note.time)}` : ""}</em></button>`).join("")}</div>`;
    o.querySelector(".x").onclick = () => closeOverlay();
    o.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => jump(+b.dataset.go)));
  })();
  function moveOverviewSel(k) {
    const btns = [...document.querySelectorAll("#overview [data-go]")];
    let i = btns.findIndex((b) => b.classList.contains("sel"));
    if (i < 0) i = Math.max(0, Math.min(btns.length - 1, current));
    const cols = 6;
    i += k === "ArrowRight" ? 1 : k === "ArrowLeft" ? -1 : k === "ArrowDown" ? cols : -cols;
    i = Math.max(0, Math.min(btns.length - 1, i));
    btns.forEach((b, j) => b.classList.toggle("sel", j === i));
    btns[i].focus();
  }

  function openOverlay(name) {
    closeOverlay(true);
    overlay = name;
    tip.classList.remove("on");
    const el = document.getElementById(name === "source" ? "drawer" : name);
    el.classList.add("on");
    document.body.classList.add("has-overlay");
    if (name === "overview") {
      const btns = [...el.querySelectorAll("[data-go]")];
      btns.forEach((b) => b.classList.toggle("sel", +b.dataset.go === current));
      const sel = btns.find((b) => +b.dataset.go === current);
      sel && sel.focus();
    }
  }
  function closeOverlay(silent) {
    ["drawer", "menu", "sources", "overview"].forEach((id) => document.getElementById(id).classList.remove("on"));
    const cf = document.querySelector("#menu .confirm");
    if (cf) { cf.hidden = true; document.querySelector("#menu .switch").classList.remove("armed"); }
    if (overlay !== "lightbox" && overlay !== "blackout") { overlay = null; document.body.classList.remove("has-overlay"); }
    if (!silent) stage.focus && stage.focus({ preventScroll: true });
  }

  // ---------- cinematic lightbox (shared element) ----------
  const lb = document.getElementById("lightbox");
  let lbList = [], lbIndex = 0, lbSource = null;
  document.addEventListener("click", (e) => {
    const img = e.target.closest("[data-lightbox]");
    if (!img || overlay) return;
    e.stopPropagation();
    lbList = [...img.closest(".scene").querySelectorAll(`[data-lightbox="${img.dataset.lightbox}"]`)];
    openLightbox(img, lbList.indexOf(img));
  });
  function srcOf(img) { return img.dataset.full || img.currentSrc || img.src || img.dataset.img; }
  function openLightbox(img, idx) {
    lbIndex = idx; lbSource = img;
    const big = lb.querySelector("img");
    big.src = srcOf(img);
    lb.querySelector(".cap").innerHTML = img.dataset.caption || img.alt || "";
    lb.classList.add("on"); overlay = "lightbox";
    lb.querySelectorAll(".nav").forEach((n) => (n.hidden = lbList.length < 2));
    if (!reduced) {
      const go = () => {
        const a = img.getBoundingClientRect(), b = big.getBoundingClientRect();
        if (!b.width) return;
        gsap.fromTo(big, { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2), scale: a.width / b.width },
          { x: 0, y: 0, scale: 1, duration: 0.65, ease: "expo.out" });
      };
      big.complete ? go() : big.addEventListener("load", go, { once: true });
      gsap.fromTo(lb.querySelector(".bg"), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    }
  }
  function lightboxStep(d) {
    if (lbList.length < 2) return;
    lbIndex = (lbIndex + d + lbList.length) % lbList.length;
    const img = lbList[lbIndex];
    const big = lb.querySelector("img");
    gsap.to(big, { opacity: 0, x: -40 * d, duration: reduced ? 0 : 0.2, onComplete: () => {
      big.src = srcOf(img);
      lb.querySelector(".cap").innerHTML = img.dataset.caption || img.alt || "";
      gsap.fromTo(big, { opacity: 0, x: 40 * d }, { opacity: 1, x: 0, duration: reduced ? 0 : 0.35 });
    } });
    lbSource = img;
  }
  function closeLightbox() {
    const big = lb.querySelector("img");
    const done = () => { lb.classList.remove("on"); gsap.set(big, { clearProps: "all" }); overlay = null; };
    if (reduced || !lbSource || !lbSource.getBoundingClientRect().width) return done();
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
    gsap.killTweensOf(f);
    f.textContent = msg;
    gsap.fromTo(f, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.25, yoyo: true, repeat: 1, repeatDelay: 1.4 });
  }

  // ---------- presenter window (P) ----------
  // The presenter window is opened by this window, so postMessage works even
  // from file:// (USB stick). BroadcastChannel is a second path when served.
  let presenterWin = null, bc = null;
  try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = (e) => onPresenterMsg(e.data); } catch (e) { bc = null; }
  addEventListener("message", (e) => {
    if (!e.data || !e.data.bts) return;
    if (e.data.from === "presenter" && e.source && e.source !== window) presenterWin = e.source; // survives a reload of the slides
    onPresenterMsg(e.data);
  });
  function openPresenter() {
    try {
      if (presenterWin && !presenterWin.closed) { presenterWin.focus(); broadcast(true); return; }
      presenterWin = window.open("presenter.html", "bts-presenter", "width=1280,height=800");
      if (!presenterWin) flash("Pop-up blocked · allow pop-ups for this page");
    } catch (e) { flash("Presenter view could not open"); }
  }
  function meta() {
    return scenes.map((s, i) => ({ i, id: s.id, title: s.title, steps: s.steps || 1, loop: s.loop ?? 0, backup: !!s.backup, note: s.note }));
  }
  function broadcast(full) {
    const msg = { bts: true, type: "state", current, step, mainCount, presenters: PRESENTERS };
    if (full) msg.scenes = meta();
    try { presenterWin && !presenterWin.closed && presenterWin.postMessage(msg, "*"); } catch (e) { /* closed */ }
    try { bc && bc.postMessage(msg); } catch (e) { /* not cloneable */ }
  }
  const seen = [];
  function onPresenterMsg(m) {
    if (!m || !m.bts || m.from !== "presenter") return;
    if (m.id) { if (seen.includes(m.id)) return; seen.push(m.id); if (seen.length > 50) seen.shift(); }
    if (m.type === "hello") broadcast(true);
    else if (m.type === "cmd") {
      if (m.cmd === "next") next();
      else if (m.cmd === "prev") prev();
      else if (m.cmd === "goto") jump(m.i, m.step || 0);
      else if (m.cmd === "blackout") toggleBlackout(overlay !== "blackout");
    }
  }

  // wake lock for projector use
  addEventListener("keydown", () => { if (navigator.wakeLock && !ctx.lock) navigator.wakeLock.request("screen").then((l) => (ctx.lock = l)).catch(() => {}); }, { once: true });

  // a typed or bookmarked #s7 / #s7.2 jumps there (replaceState never fires this)
  function parseHash() {
    const m = /^#s(\d+)(?:\.(\d+))?$/.exec(location.hash || "");
    return m ? [Math.min(scenes.length - 1, Math.max(0, +m[1] - 1)), +(m[2] || 0)] : null;
  }
  addEventListener("hashchange", () => {
    const h = parseHash();
    if (h && (h[0] !== current || h[1] !== step)) { closeOverlay(true); show(h[0], h[1], 1); }
  });

  // start: hash first, then the last position of this tab (refresh), else scene 1
  requestAnimationFrame(() => {
    let pos = parseHash();
    if (!pos) { try { const s = JSON.parse(sessionStorage.getItem("bts-pos") || "null"); if (Array.isArray(s)) pos = s; } catch (e) { /* none */ } }
    pos = pos || [0, 0];
    show(pos[0], pos[1], 1);
  });
  return ctx;
}

export function noteHTML(sc, step) {
  const n = sc.note;
  if (!n) return "";
  const say = n.say[Math.min(step, n.say.length - 1)] || "";
  return `<b class="p-${slug(n.presenter)}">${n.presenter}</b> · step ${step + 1}/${sc.steps || 1} — ${say}`;
}
export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function detectQuality() {
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return "low";
  return "high";
}
