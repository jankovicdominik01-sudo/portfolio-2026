/* Slovakia — Erasmus+ deck engine.
   No dependencies. Works offline from a single HTML file. */
(function () {
  "use strict";

  // Where the final route ends. Change to your host city if you like,
  // e.g. { name: "Ankara", sub: "Our host city", lon: 32.86, lat: 39.93 }.
  var DESTINATION = { name: "Turkey", sub: "≈ 1,250 km from Senica", lon: 28.98, lat: 41.01 };

  var MAP = window.DECK_MAP;
  var CREDITS = window.DECK_CREDITS || [];
  var PHOTOS = window.DECK_PHOTOS || [];
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var chrome = document.getElementById("chrome");
  var counter = document.getElementById("counter");
  var chapterBtns = Array.prototype.slice.call(document.querySelectorAll(".chapters button"));
  var chapterCard = document.getElementById("chapter-card");
  var notes = document.getElementById("notes");
  var notesText = document.getElementById("notes-text");
  var credits = document.getElementById("credits");
  var hint = document.getElementById("hint");

  // Chapters come from each slide's data-chapter, so slides can be added freely.
  var CHAPTERS = [
    { roman: "I", name: "Slovakia", sub: "The country" },
    { roman: "II", name: "Senica", sub: "Our town" },
    { roman: "III", name: "Our School", sub: "Where we learn" },
    { roman: "IV", name: "Erasmus+", sub: "Why we are here" }
  ];
  // The intro film (if present) is slide 0 and is not counted as a numbered slide.
  var OFFSET = slides[0] && slides[0].id === "intro" ? 1 : 0;
  CHAPTERS.forEach(function (C, c) {
    slides.forEach(function (sl, i) {
      if (i < OFFSET || parseInt(sl.getAttribute("data-chapter"), 10) !== c) return;
      if (C.start === undefined) C.start = i;
      C.end = i;
    });
  });
  chapterBtns.forEach(function (b, c) { b.setAttribute("data-go", CHAPTERS[c].start); });

  /* ------------------------------------------------------------
     Fit the 1920×1080 stage to any screen
     ------------------------------------------------------------ */
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = "translate(" + (-960 * s) + "px," + (-540 * s) + "px) scale(" + s + ")";
  }
  window.addEventListener("resize", fit);
  fit();

  /* ------------------------------------------------------------
     Split titles into words for the staggered reveal
     ------------------------------------------------------------ */
  function splitWords(root) {
    var i = 0;
    function wrap(node) {
      var w = document.createElement("span");
      w.className = "w";
      var inner = document.createElement("span");
      inner.style.setProperty("--i", i++);
      w.appendChild(inner);
      return { w: w, inner: inner };
    }
    function walk(el) {
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          var parts = node.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var o = wrap();
            o.inner.textContent = p;
            frag.appendChild(o.w);
          });
          el.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          if (node.tagName.toLowerCase() === "svg" || node.tagName.toLowerCase() === "br") {
            if (node.tagName.toLowerCase() === "br") return;
            var o = wrap();
            el.replaceChild(o.w, node);
            o.inner.appendChild(node);
          } else {
            walk(node);
          }
        }
      });
    }
    walk(root);
  }
  Array.prototype.forEach.call(document.querySelectorAll("[data-split]"), function (el) {
    el.classList.add("split");
    splitWords(el);
  });

  /* ------------------------------------------------------------
     Map: projection (Lambert azimuthal equal-area, same as build)
     ------------------------------------------------------------ */
  var R = 6371, LON0 = 22 * Math.PI / 180, LAT0 = 46 * Math.PI / 180;
  function project(lon, lat) {
    var l = lon * Math.PI / 180, p = lat * Math.PI / 180;
    var k = Math.sqrt(2 / (1 + Math.sin(LAT0) * Math.sin(p) + Math.cos(LAT0) * Math.cos(p) * Math.cos(l - LON0)));
    var x = R * k * Math.cos(p) * Math.sin(l - LON0);
    var y = R * k * (Math.cos(LAT0) * Math.sin(p) - Math.sin(LAT0) * Math.cos(p) * Math.cos(l - LON0));
    return [x, -y];
  }

  var SVGNS = "http://www.w3.org/2000/svg";
  var mapSvg = document.getElementById("map");
  var mapLayer = document.getElementById("map-layer");
  var overlay = document.getElementById("map-overlay");
  var arcsGroup;

  function svgEl(tag, attrs, parent) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  var NEIGHBOURS = { "203": 1, "040": 1, "348": 1, "616": 1, "804": 1 };

  function buildMap() {
    if (!MAP) return;
    var defs = svgEl("defs", {}, mapSvg);
    var g1 = svgEl("radialGradient", { id: "seaGlow", cx: "50%", cy: "45%", r: "70%" }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "#10203f" }, g1);
    svgEl("stop", { offset: "100%", "stop-color": "#080d19" }, g1);
    var g2 = svgEl("linearGradient", { id: "skFill", x1: "0", y1: "0", x2: "1", y2: "1" }, defs);
    svgEl("stop", { offset: "0%", "stop-color": "#5b8cf0" }, g2);
    svgEl("stop", { offset: "100%", "stop-color": "#2450b0" }, g2);
    var f = svgEl("filter", { id: "skGlow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
    svgEl("feGaussianBlur", { stdDeviation: "6", result: "b" }, f);
    var m = svgEl("feMerge", {}, f);
    svgEl("feMergeNode", { in: "b" }, m);
    svgEl("feMergeNode", { in: "SourceGraphic" }, m);

    svgEl("rect", { class: "sea-glow", x: -6000, y: -4000, width: 12000, height: 8000 }, mapSvg);

    // graticule every 5°
    var grat = svgEl("g", {}, mapSvg);
    var lon, lat, d, pt;
    for (lon = -30; lon <= 60; lon += 5) {
      d = "";
      for (lat = 25; lat <= 72; lat += 1) { pt = project(lon, lat); d += (d ? "L" : "M") + pt[0].toFixed(0) + "," + pt[1].toFixed(0); }
      svgEl("path", { class: "grat", d: d }, grat);
    }
    for (lat = 25; lat <= 70; lat += 5) {
      d = "";
      for (lon = -30; lon <= 60; lon += 1) { pt = project(lon, lat); d += (d ? "L" : "M") + pt[0].toFixed(0) + "," + pt[1].toFixed(0); }
      svgEl("path", { class: "grat", d: d }, grat);
    }

    var land = svgEl("g", {}, mapSvg);
    var svk;
    MAP.countries.forEach(function (c) {
      var cls = "country";
      if (NEIGHBOURS[c.id]) cls += " nb";
      if (c.id === "792") cls += " tur";
      var p = svgEl("path", { class: cls, d: c.d }, land);
      if (c.id === "703") { p.setAttribute("class", "country svk"); svk = p; }
    });
    // Slovakia on top so its glow is not covered by neighbours
    if (svk) land.appendChild(svk);

    MAP.rivers.forEach(function (r) { svgEl("path", { class: "river", d: r.d }, mapSvg); });

    var regions = svgEl("g", {}, mapSvg);
    MAP.regions.forEach(function (r) {
      svgEl("path", { class: "region" + (r.name === "Trnava" ? " trnava" : ""), d: r.d }, regions);
    });
    arcsGroup = svgEl("g", {}, mapSvg);
  }
  buildMap();

  /* Pins and labels, shown per map state */
  var MARKS = [
    // europe (slide 2)
    { t: "label", text: "Slovakia", cls: "sk", lon: 19.55, lat: 48.72, on: "europe" },
    { t: "label", text: "Czechia", cls: "big", lon: 15.3, lat: 49.85, on: "europe" },
    { t: "label", text: "Poland", cls: "big", lon: 19.3, lat: 52.1, on: "europe" },
    { t: "label", text: "Ukraine", cls: "big", lon: 31.0, lat: 49.3, on: "europe" },
    { t: "label", text: "Hungary", cls: "big", lon: 19.2, lat: 46.95, on: "europe" },
    { t: "label", text: "Austria", cls: "big", lon: 13.2, lat: 47.0, on: "europe" },
    { t: "label", text: "Germany", lon: 10.4, lat: 51.2, on: "europe" },
    { t: "label", text: "Italy", lon: 12.4, lat: 43.1, on: "europe" },
    { t: "label", text: "Turkey", cls: "trl", lon: 34.0, lat: 39.1, on: "europe network" },
    { t: "label", text: "Black Sea", lon: 34.5, lat: 43.3, on: "europe" },
    { t: "pin", text: "Bratislava", sub: "Capital", cls: "small left", lon: 17.108, lat: 48.149, on: "europe journey1 journey2" },
    { t: "pin", text: "Istanbul", cls: "tr small", lon: 28.978, lat: 41.008, on: "europe" },
    { t: "label", html: "Senica → Istanbul <b>≈ 1,250 km</b>", cls: "dist", lon: 25.6, lat: 45.0, on: "europe", delay: 1.9 },
    // journey (slide 6)
    { t: "label", text: "Trnava Region", cls: "big", lon: 17.62, lat: 48.46, on: "journey2", style: "color:#9fe6da" },
    { t: "label", text: "Czechia", lon: 16.9, lat: 49.05, on: "journey2 journey3" },
    { t: "label", text: "Austria", lon: 16.55, lat: 48.2, on: "journey2" },
    { t: "label", text: "Hungary", lon: 18.1, lat: 47.85, on: "journey2" },
    { t: "pin", text: "Trnava", sub: "Regional capital", cls: "small", lon: 17.588, lat: 48.377, on: "journey2" },
    { t: "pin", text: "Senica", sub: "Our town", cls: "hero", lon: 17.367, lat: 48.679, on: "journey3 area network route-start" },
    // area (slide 7)
    { t: "pin", text: "Kunov", cls: "small left", lon: 17.338, lat: 48.702, on: "area" },
    { t: "pin", text: "Branč Castle", cls: "small", lon: 17.467, lat: 48.733, on: "area" },
    { t: "pin", text: "Šaštín", cls: "small left", lon: 17.146, lat: 48.638, on: "area" },
    { t: "pin", text: "Holíč", cls: "small left", lon: 17.157, lat: 48.809, on: "area" },
    { t: "pin", text: "Bradlo", cls: "small", lon: 17.595, lat: 48.665, on: "area" },
    { t: "pin", text: "Skalica", cls: "small left", lon: 17.227, lat: 48.845, on: "area" },
    { t: "label", text: "Záhorie", cls: "big", lon: 17.12, lat: 48.57, on: "area" },
    { t: "label", text: "Little Carpathians", lon: 17.55, lat: 48.585, on: "area" },
    // network (slide 12)
    { t: "pin", text: "Istanbul", cls: "tr small", lon: 28.978, lat: 41.008, on: "network" },
    { t: "pin", text: "Ankara", cls: "tr small", lon: 32.86, lat: 39.93, on: "network" },
    // route (slide 14)
    { t: "pin", text: "Senica", sub: "Slovakia", cls: "hero left", lon: 17.367, lat: 48.679, on: "route" },
    { t: "pin", text: DESTINATION.name, sub: DESTINATION.sub, cls: "tr hero left", lon: DESTINATION.lon, lat: DESTINATION.lat, on: "route", delay: 2.2 }
  ];

  var NETWORK = [
    { name: "Brussels", lon: 4.352, lat: 50.85 }, { name: "Paris", lon: 2.352, lat: 48.857 },
    { name: "Berlin", lon: 13.405, lat: 52.52 }, { name: "Warsaw", lon: 21.012, lat: 52.23 },
    { name: "Prague", lon: 14.438, lat: 50.076 },
    { name: "Budapest", lon: 19.04, lat: 47.498 }, { name: "Rome", lon: 12.496, lat: 41.903 },
    { name: "Athens", lon: 23.728, lat: 37.984 }, { name: "Vilnius", lon: 25.28, lat: 54.687 },
    { name: "Copenhagen", lon: 12.568, lat: 55.676 }
  ];
  NETWORK.forEach(function (n) {
    MARKS.push({ t: "pin", text: n.name, cls: "small", lon: n.lon, lat: n.lat, on: "network" });
  });

  MARKS.forEach(function (mk) {
    mk.xy = project(mk.lon, mk.lat);
    var el = document.createElement("div");
    if (mk.t === "pin") {
      el.className = "pin " + (mk.cls || "");
      el.innerHTML = '<span class="dot"></span><span class="tag"></span>';
      var tag = el.querySelector(".tag");
      tag.textContent = mk.text;
      if (mk.sub) { var sm = document.createElement("small"); sm.textContent = mk.sub; tag.appendChild(sm); }
    } else {
      el.className = "mlabel " + (mk.cls || "");
      if (mk.html) el.innerHTML = mk.html; else el.textContent = mk.text;
      if (mk.style) el.setAttribute("style", mk.style);
    }
    el.style.transitionDelay = (mk.delay || 0) + "s";
    mk.el = el;
    mk.states = mk.on.split(" ");
    overlay.appendChild(el);
  });

  /* Camera: (x, y) = map point at the stage centre, s = km per pixel */
  var cam = { x: 0, y: 0, s: 2 };
  function camAt(lon, lat, sx, sy, s) {
    var p = project(lon, lat);
    return { x: p[0] + (960 - sx) * s, y: p[1] + (540 - sy) * s, s: s };
  }
  var CAMS = {
    europeWide: camAt(19.5, 48.7, 1250, 420, 2.4),
    europe: camAt(19.5, 48.7, 1100, 400, 2.0),
    slovakia: camAt(19.6, 48.7, 1280, 560, 0.62),
    trnava: camAt(17.62, 48.42, 1300, 560, 0.2),
    senica: camAt(17.367, 48.679, 1180, 420, 0.085),
    area: camAt(17.35, 48.72, 1260, 380, 0.052),
    network: camAt(16, 47, 1260, 500, 2.7),
    route: camAt(17.367, 48.679, 1200, 290, 1.6)
  };

  var scalebar = document.getElementById("scalebar");
  var NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  function updateScale() {
    if (!scalebar) return;
    var km = cam.s * 150, v = NICE[0];
    for (var i = 0; i < NICE.length; i++) if (NICE[i] <= km) v = NICE[i];
    scalebar.querySelector("i").style.width = (v / cam.s).toFixed(0) + "px";
    scalebar.querySelector("span").textContent = v + " km";
  }

  function applyCam() {
    updateScale();
    var vw = 1920 * cam.s, vh = 1080 * cam.s;
    var vx = cam.x - 960 * cam.s, vy = cam.y - 540 * cam.s;
    mapSvg.setAttribute("viewBox", vx.toFixed(2) + " " + vy.toFixed(2) + " " + vw.toFixed(2) + " " + vh.toFixed(2));
    for (var i = 0; i < MARKS.length; i++) {
      var mk = MARKS[i];
      var sx = (mk.xy[0] - vx) / cam.s, sy = (mk.xy[1] - vy) / cam.s;
      mk.el.style.transform = "translate3d(" + sx.toFixed(1) + "px," + sy.toFixed(1) + "px,0)" + (mk.t === "label" ? " translate(-50%,-50%)" : "");
    }
  }

  var camAnim = null;
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function moveCam(target, dur, done) {
    if (camAnim) cancelAnimationFrame(camAnim.raf);
    if (reduced || !dur) {
      cam = { x: target.x, y: target.y, s: target.s };
      applyCam();
      if (done) done();
      return;
    }
    var from = { x: cam.x, y: cam.y, ls: Math.log(cam.s) }, to = { x: target.x, y: target.y, ls: Math.log(target.s) };
    var t0 = performance.now();
    camAnim = {};
    (function step(now) {
      var t = Math.min(1, (now - t0) / dur), e = easeInOut(t);
      cam = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, s: Math.exp(from.ls + (to.ls - from.ls) * e) };
      applyCam();
      if (t < 1) camAnim.raf = requestAnimationFrame(step);
      else { camAnim = null; if (done) done(); }
    })(t0);
    camAnim.raf = camAnim.raf || 0;
  }

  function showMarks(state) {
    var list = state.split(" ");
    MARKS.forEach(function (mk) {
      var on = mk.states.some(function (s) { return list.indexOf(s) !== -1; });
      mk.el.classList.toggle("on", on);
    });
  }

  function arcPath(a, b, bend) {
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dy = b[1] - a[1];
    var cx = mx + dy * bend, cy = my - dx * bend;
    return "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + "Q" + cx.toFixed(1) + "," + cy.toFixed(1) + " " + b[0].toFixed(1) + "," + b[1].toFixed(1);
  }
  function clearArcs() { while (arcsGroup && arcsGroup.firstChild) arcsGroup.removeChild(arcsGroup.firstChild); }
  function addArc(from, to, cls, delay, dur, bend) {
    var p = svgEl("path", { class: "arc " + (cls || ""), d: arcPath(project(from[0], from[1]), project(to[0], to[1]), bend || 0.18), pathLength: 1 }, arcsGroup);
    p.style.setProperty("--delay", delay + "s");
    p.style.setProperty("--dur", dur + "s");
    // restart the CSS animation on the next frame
    requestAnimationFrame(function () { requestAnimationFrame(function () { p.classList.add("draw"); }); });
    return p;
  }

  var SENICA = [17.367, 48.679];
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, reduced ? 0 : ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function setMapClasses(list) {
    ["show-tr", "show-regions", "hl-trnava", "zoomed"].forEach(function (c) { mapSvg.classList.toggle(c, list.indexOf(c) !== -1); });
  }

  var crumbs = function () { return Array.prototype.slice.call(document.querySelectorAll("#s6 [data-step]")); };
  function setCrumb(n) { crumbs().forEach(function (c) { c.classList.toggle("cur", +c.getAttribute("data-step") === n); c.classList.toggle("done", +c.getAttribute("data-step") < n); }); }

  function enterMapState(state, slideEl, fromIndex) {
    clearTimers();
    clearArcs();
    if (state === "off") { mapLayer.classList.remove("on"); showMarks(""); return; }
    var wasOff = !mapLayer.classList.contains("on");
    mapLayer.classList.add("on");

    if (state === "europe") {
      setMapClasses(["show-tr"]);
      if (wasOff) moveCam(CAMS.europeWide, 0);
      moveCam(CAMS.europe, 2200);
      showMarks("europe");
      addArc(SENICA, [28.978, 41.008], "tr", 1.2, 1.8, -0.22);
    } else if (state === "journey") {
      var skipIntro = reduced || fromIndex === 6;
      if (skipIntro) {
        setMapClasses(["show-regions", "zoomed"]);
        moveCam(CAMS.senica, wasOff ? 0 : 1400);
        showMarks("journey3");
        setCrumb(3);
        slideEl.classList.add("late");
        return;
      }
      setMapClasses([]);
      moveCam(CAMS.europe, 0);
      showMarks("");
      setCrumb(0);
      later(function () { setMapClasses(["show-regions"]); showMarks("journey1"); setCrumb(1); moveCam(CAMS.slovakia, 1700); }, 500);
      later(function () { setMapClasses(["show-regions", "hl-trnava", "zoomed"]); showMarks("journey2"); setCrumb(2); moveCam(CAMS.trnava, 1500); }, 2500);
      later(function () { setMapClasses(["show-regions", "zoomed"]); showMarks("journey3"); setCrumb(3); moveCam(CAMS.senica, 1500); }, 4300);
      later(function () { slideEl.classList.add("late"); }, 5200);
    } else if (state === "area") {
      setMapClasses(["show-regions", "zoomed"]);
      moveCam(CAMS.area, wasOff ? 0 : 1600);
      showMarks("area");
    } else if (state === "network") {
      setMapClasses(["show-tr"]);
      if (wasOff) moveCam(camAt(16, 47, 1260, 500, 3.6), 0);
      moveCam(CAMS.network, 2000);
      showMarks("network");
      NETWORK.forEach(function (n, i) { addArc(SENICA, [n.lon, n.lat], "", 0.9 + i * 0.12, 1.4, 0.2); });
      addArc(SENICA, [28.978, 41.008], "tr", 0.7, 1.8, -0.22);
      addArc(SENICA, [32.86, 39.93], "tr", 1.0, 1.9, -0.22);
    } else if (state === "route") {
      setMapClasses(["show-tr"]);
      if (wasOff) moveCam(camAt(17.367, 48.679, 1200, 290, 2.6), 0);
      moveCam(CAMS.route, 2400);
      showMarks("route");
      var arc = addArc(SENICA, [DESTINATION.lon, DESTINATION.lat], "tr", 1.0, 2.2, -0.2);
      if (!reduced) {
        var dot = svgEl("circle", { r: (6 * CAMS.route.s).toFixed(1), fill: "#ffffff", opacity: "0" }, arcsGroup);
        var mo = svgEl("animateMotion", { dur: "4.5s", repeatCount: "indefinite", begin: "indefinite", path: arc.getAttribute("d"), keyPoints: "0;1", keyTimes: "0;1", calcMode: "linear" }, dot);
        later(function () { dot.setAttribute("opacity", "0.9"); try { mo.beginElement(); } catch (e) { /* SMIL unsupported */ } }, 3200);
      }
    }
  }

  /* ------------------------------------------------------------
     Counters
     ------------------------------------------------------------ */
  function fmt(v, dec, plain) {
    var s = v.toFixed(dec);
    if (plain) return s;
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  function runCounters(slideEl, baseDelay) {
    Array.prototype.forEach.call(slideEl.querySelectorAll("[data-count]"), function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      var dec = parseInt(el.getAttribute("data-dec") || "0", 10);
      var plain = el.hasAttribute("data-plain");
      var host = el.closest("[data-a]");
      var d = host ? parseFloat(getComputedStyle(host).getPropertyValue("--d")) || 0 : 0;
      if (el.closest("[data-late]")) d += (slideEl.id === "s6" ? 5.3 : 0);
      if (reduced) { el.textContent = fmt(target, dec, plain); return; }
      var start = plain ? Math.round(target * 0.985) : 0;
      el.textContent = fmt(start, dec, plain);
      later(function () {
        var t0 = performance.now(), dur = 1600;
        (function step(now) {
          var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
          el.textContent = fmt(start + (target - start) * e, dec, plain);
          if (t < 1 && slideEl.classList.contains("active")) requestAnimationFrame(step);
          else el.textContent = fmt(target, dec, plain);
        })(t0);
      }, (d + baseDelay) * 1000 + 200);
    });
  }

  /* ------------------------------------------------------------
     Cover outline of Slovakia
     ------------------------------------------------------------ */
  (function coverOutline() {
    var host = document.querySelector("[data-outline]");
    if (!host || !MAP) return;
    var svkD = null;
    MAP.countries.forEach(function (c) { if (c.id === "703") svkD = c.d; });
    if (!svkD) return;
    var vb = [-386, -408, 432, 212];
    var W = 780, H = W * vb[3] / vb[2];
    var svg = svgEl("svg", { viewBox: vb.join(" "), width: W, height: H }, host);
    svgEl("path", { d: svkD, pathLength: 1 }, svg);
    var p = project(17.367, 48.679);
    var cap = document.createElement("div");
    cap.className = "cap";
    cap.style.left = ((p[0] - vb[0]) / vb[2] * W) + "px";
    cap.style.top = ((p[1] - vb[1]) / vb[3] * H) + "px";
    cap.innerHTML = '<span class="dot"></span><span class="label" style="position:absolute;left:16px;top:-7px;white-space:nowrap;color:#fff">Senica · our town</span>';
    host.appendChild(cap);
    host.style.height = H + "px";
  })();

  /* ------------------------------------------------------------
     Credits list
     ------------------------------------------------------------ */
  (function fillCredits() {
    var ol = document.getElementById("credits-list");
    CREDITS.forEach(function (c) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = c.page; a.target = "_blank"; a.rel = "noopener"; a.textContent = c.title;
      li.appendChild(a);
      li.appendChild(document.createTextNode(" — " + c.artist + ", " + c.license + " (" + creditWhere(c) + ")"));
      ol.appendChild(li);
    });
  })();

  /* ------------------------------------------------------------
     Navigation
     ------------------------------------------------------------ */
  var current = -1;
  var busy = false;

  function chapterOf(i) {
    for (var c = 0; c < CHAPTERS.length; c++) if (i >= CHAPTERS[c].start && i <= CHAPTERS[c].end) return c;
    return 0;
  }

  function updateChrome(i) {
    chrome.classList.toggle("hidden", i === OFFSET || i === slides.length - 1 || slides[i].getAttribute("data-chrome") === "off");
    counter.innerHTML = "<b>" + String(Math.max(1, i - OFFSET + 1)).padStart(2, "0") + "</b> / " + (slides.length - OFFSET);
    var ch = chapterOf(i);
    chapterBtns.forEach(function (b, c) {
      var C = CHAPTERS[c];
      var p = c < ch ? 1 : c > ch ? 0 : (i - C.start + 1) / (C.end - C.start + 1);
      b.classList.toggle("cur", c === ch);
      b.querySelector(".bar i").style.setProperty("--p", p);
      if (c === ch) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    notesText.textContent = slides[i].getAttribute("data-notes") || "";
    presenterUpdate(i);
  }

  function playChapterCard(ch) {
    var C = CHAPTERS[ch];
    chapterCard.querySelector(".roman").textContent = "Chapter " + C.roman;
    chapterCard.querySelector(".name").textContent = C.name;
    chapterCard.querySelector(".sub").textContent = C.sub;
    chapterCard.classList.remove("play");
    void chapterCard.offsetWidth;
    chapterCard.classList.add("play");
  }

  function go(i, opts) {
    opts = opts || {};
    if (i < 0 || i >= slides.length || i === current) return;
    var prev = current;
    var next = slides[i];
    var chapterChange = prev !== -1 && chapterOf(prev) !== chapterOf(i) && !reduced;
    var baseDelay = chapterChange ? 0.75 : 0;
    stage.style.setProperty("--base-delay", baseDelay + "s");

    if (prev !== -1) {
      var old = slides[prev];
      old.classList.remove("active");
      old.classList.add("leaving");
      setTimeout(function () {
        if (!old.classList.contains("active")) old.classList.remove("in", "late", "leaving");
      }, 950);
    }
    next.classList.remove("in", "late", "leaving");
    next.classList.add("active");
    void next.offsetWidth;
    requestAnimationFrame(function () { next.classList.add("in"); });

    if (chapterChange) playChapterCard(chapterOf(i));

    current = i;
    updateChrome(i);
    var mapState = next.getAttribute("data-map") || "off";
    if (chapterChange && mapState !== "off") {
      mapLayer.classList.remove("on");
      later(function () { enterMapState(mapState, next, prev); }, 650);
    } else {
      enterMapState(mapState, next, prev);
    }
    runCounters(next, baseDelay + (chapterChange && mapState !== "off" ? 0.65 : 0));
    if (!opts.noHash) { try { history.replaceState(null, "", "#s" + (i - OFFSET + 1)); } catch (e) { /* sandboxed */ } }
    if (prev !== -1 && slides[prev].id === "intro") introLeave();
    if (next.id === "intro") introEnter();
    pauseMedia(prev);
    if (prev !== -1 && hint) hint.style.opacity = "0";
    busy = true;
    setTimeout(function () { busy = false; }, 350);
  }

  function nextSlide() { if (busy) return; if (slides[current].id === "intro" && introNext()) return; go(current + 1); }
  function prevSlide() { if (!busy) go(current - 1); }

  document.getElementById("next").addEventListener("click", function (e) { e.stopPropagation(); go(current + 1); });
  document.getElementById("prev").addEventListener("click", function (e) { e.stopPropagation(); go(current - 1); });
  chapterBtns.forEach(function (b) {
    b.addEventListener("click", function (e) { e.stopPropagation(); go(parseInt(b.getAttribute("data-go"), 10)); });
  });

  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) { var r = document.documentElement.requestFullscreen(); if (r && r.catch) r.catch(function () {}); }
      else document.exitFullscreen();
    } catch (e) { /* not allowed here */ }
  }

  var wakeLock = null;
  function keepAwake() {
    if (wakeLock || !navigator.wakeLock) return;
    navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; l.addEventListener("release", function () { wakeLock = null; }); }).catch(function () {});
  }

  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key;
    keepAwake();
    if (lightboxKey(e)) return;
    if (introKey(e)) return;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); nextSlide(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prevSlide(); }
    else if (k === "Home") { go(0); }
    else if (k === "End") { go(slides.length - 1); }
    else if (k === "f" || k === "F") { toggleFullscreen(); }
    else if (k === "n" || k === "N") { notes.classList.toggle("on"); }
    else if (k === "c" || k === "C") { credits.classList.toggle("on"); }
    else if (k === "p" || k === "P") { openPresenter(); }
    else if (k === "Escape") { notes.classList.remove("on"); credits.classList.remove("on"); }
    else if (/^[1-9]$/.test(k)) { go(parseInt(k, 10) - 1 + OFFSET); }
  });

  stage.addEventListener("click", function (e) {
    keepAwake();
    if (e.target.closest("a, button, video, #credits, #notes, [data-zoom]")) return;
    var rect = stage.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width * 0.25) prevSlide(); else nextSlide();
  });

  var touchX = null;
  stage.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) { if (dx < 0) nextSlide(); else prevSlide(); }
    touchX = null;
  });

  /* subtle parallax driven by the pointer */
  if (!reduced) {
    var tx = 0, ty = 0, px = 0, py = 0;
    window.addEventListener("pointermove", function (e) {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    });
    (function loop() {
      px += (tx - px) * 0.05; py += (ty - py) * 0.05;
      stage.style.setProperty("--px", px.toFixed(3));
      stage.style.setProperty("--py", py.toFixed(3));
      requestAnimationFrame(loop);
    })();
  }


  /* ------------------------------------------------------------
     Photo credits: where each photo appears
     ------------------------------------------------------------ */
  function creditWhere(c) {
    if (c.where) return c.where;
    var ph = PHOTOS.filter(function (x) { return x.title === c.title; })[0];
    if (ph) {
      for (var i = 0; i < slides.length; i++) {
        if (slides[i].querySelector('img[src="img/' + ph.name + '.webp"]')) return "slide " + (i - OFFSET + 1);
      }
    }
    return "slide " + c.slide;
  }

  /* ------------------------------------------------------------
     Films (first slide): → plays the main film full screen; → again
     (or the film ending) moves on to the cover. Other cards play on
     click, Esc returns to the cards, Space pauses.
     Source per film: a local copy (data-local) if it exists, else the
     YouTube embed (needs internet and http(s); from a USB copy the
     film opens on YouTube instead).
     ------------------------------------------------------------ */
  var intro = document.getElementById("intro");
  var player = intro ? intro.querySelector(".player") : null;
  var cards = intro ? Array.prototype.slice.call(intro.querySelectorAll(".film-card")) : [];
  var introState = "menu", ytFrame = null, localVid = null, paused = false;
  var canEmbed = /^https?:$/.test(location.protocol);
  // probe local copies once
  cards.forEach(function (c) {
    var v = document.createElement("video");
    v.preload = "metadata"; v.muted = true;
    v.addEventListener("loadedmetadata", function () { c.setAttribute("data-has-local", ""); });
    v.src = c.getAttribute("data-local");
  });
  function stageRect(el) {
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / 1920;
    return { left: (r.left - s.left) / k, top: (r.top - s.top) / k, width: r.width / k, height: r.height / k };
  }
  function setBox(r) { player.style.left = r.left + "px"; player.style.top = r.top + "px"; player.style.width = r.width + "px"; player.style.height = r.height + "px"; }
  function playFilm(card) {
    var id = card.getAttribute("data-yt");
    if (!card.hasAttribute("data-has-local") && !canEmbed) {
      window.open("https://www.youtube.com/watch?v=" + id, "_blank", "noopener");
      return;
    }
    stopFilm(true);
    introState = "playing"; paused = false;
    intro.classList.add("playing");
    var frame = player.querySelector(".frame");
    if (card.hasAttribute("data-has-local")) {
      localVid = document.createElement("video");
      localVid.src = card.getAttribute("data-local");
      localVid.autoplay = true; localVid.playsInline = true;
      localVid.addEventListener("ended", filmEnded);
      frame.appendChild(localVid);
      localVid.play().catch(function () {});
    } else {
      ytFrame = document.createElement("iframe");
      ytFrame.allow = "autoplay; encrypted-media; picture-in-picture";
      ytFrame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&enablejsapi=1&origin=" + encodeURIComponent(location.origin);
      ytFrame.addEventListener("load", function () {
        try {
          ytFrame.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
          ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], id: 1, channel: "widget" }), "*");
        } catch (e) { /* no API */ }
      });
      frame.appendChild(ytFrame);
    }
    // grow out of the card to the full stage
    player.style.transition = "none";
    setBox(stageRect(card));
    player.classList.add("on");
    void player.offsetWidth;
    player.style.transition = "";
    requestAnimationFrame(function () { setBox({ left: 0, top: 0, width: 1920, height: 1080 }); });
  }
  function stopFilm(instant) {
    var frame = player && player.querySelector(".frame");
    if (!frame) return;
    if (localVid) { localVid.pause(); localVid = null; }
    ytFrame = null;
    introState = "menu";
    intro.classList.remove("playing");
    player.classList.remove("on");
    setTimeout(function () { if (introState === "menu") frame.innerHTML = ""; }, instant ? 0 : 700);
  }
  function filmEnded() { if (slides[current] === intro && introState === "playing") go(current + 1); }
  window.addEventListener("message", function (e) {
    if (!ytFrame || e.source !== ytFrame.contentWindow) return;
    var d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    var st = d && (d.event === "onStateChange" ? d.info : d.info && d.info.playerState);
    if (st === 0) filmEnded();
  });
  function togglePause() {
    paused = !paused;
    if (localVid) { if (paused) localVid.pause(); else localVid.play(); }
    if (ytFrame) ytFrame.contentWindow.postMessage(JSON.stringify({ event: "command", func: paused ? "pauseVideo" : "playVideo", args: [] }), "*");
  }
  function introEnter() { if (intro) stopFilm(true); }
  function introLeave() { if (intro) setTimeout(function () { if (slides[current] !== intro) stopFilm(true); }, 1000); }
  function introNext() {
    if (introState === "menu" && cards[0] && (canEmbed || cards[0].hasAttribute("data-has-local"))) { playFilm(cards[0]); return true; }
    return false; // playing: → moves on to the cover
  }
  function introKey(e) {
    if (!intro || slides[current] !== intro || introState !== "playing") return false;
    var k = e.key;
    if (k === "Escape" || k === "ArrowLeft" || k === "PageUp" || k === "Backspace") { e.preventDefault(); stopFilm(); return true; }
    if (k === " " || k === "k" || k === "K") { e.preventDefault(); togglePause(); return true; }
    return false;
  }
  cards.forEach(function (c) { c.addEventListener("click", function (e) { e.stopPropagation(); playFilm(c); }); });

  function pauseMedia(i) {
    if (i < 0 || !slides[i]) return;
    Array.prototype.forEach.call(slides[i].querySelectorAll("video"), function (v) { v.pause(); });
  }

  /* ------------------------------------------------------------
     Hockey clip: plays media/hockey-2002.mp4 if you put it there,
     otherwise offers the clip on YouTube.
     ------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll(".clip"), function (box) {
    var v = box.querySelector("video");
    if (!v) return;
    v.addEventListener("loadedmetadata", function () { box.classList.add("ready"); });
    v.addEventListener("error", function () { box.classList.add("missing"); });
    var src = v.querySelector("source");
    if (src) src.addEventListener("error", function () { box.classList.add("missing"); });
    box.querySelector(".clip-play").addEventListener("click", function (e) {
      e.stopPropagation();
      if (box.classList.contains("missing")) return;
      box.classList.add("playing");
      v.controls = true;
      v.play();
    });
  });

  /* ------------------------------------------------------------
     Lightbox: every photo opens full screen, growing out of its
     own frame. ← → browse the photos of the slide, Esc closes.
     ------------------------------------------------------------ */
  var FULL = (window.DECK_MEDIA && window.DECK_MEDIA.full) || [];
  var lb = document.createElement("div");
  lb.id = "lightbox";
  lb.innerHTML = '<div class="lb-bg"></div><div class="lb-box"><img alt=""></div>' +
    '<div class="lb-cap"><b></b><span></span><em></em></div>' +
    '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo">‹</button>' +
    '<button type="button" class="lb-nav lb-next" aria-label="Next photo">›</button>' +
    '<button type="button" class="lb-close" aria-label="Close">×</button><div class="lb-count"></div>';
  document.body.appendChild(lb);
  var lbBox = lb.querySelector(".lb-box"), lbImg = lbBox.querySelector("img");
  var lbList = [], lbIdx = 0, lbOpen = false;

  function nameOf(img) { var m = /img\/([^\/]+)\.(webp|png|jpg)$/.exec(img.getAttribute("src") || ""); return m ? m[1] : ""; }
  function captionOf(img) {
    var host = img.closest("figure, .dish, .half, .local, .slide");
    var t = "", d = "";
    var cap = host && host.querySelector(".cap");
    if (cap) {
      var nm = cap.querySelector(".name, b");
      t = nm ? nm.textContent : "";
      var sub = cap.querySelector("p, span");
      d = sub ? sub.textContent : "";
    } else if (host && host.classList.contains("dish")) {
      t = host.querySelector(".name").textContent;
      var pp = host.querySelector("p"); d = pp ? pp.textContent : "";
    }
    if (!t) t = img.getAttribute("alt") || "";
    var ph = PHOTOS.filter(function (x) { return x.name === nameOf(img); })[0];
    var cr = ph ? "Photo: " + ph.artist + " · " + ph.license + " · Wikimedia Commons" : "Photo: SSOŠP Senica";
    return [t, d, cr];
  }
  function zoomables(slide) {
    return Array.prototype.slice.call(slide.querySelectorAll("[data-zoom]"));
  }
  // mark photos as zoomable; full-bleed backgrounds get a small zoom button
  slides.forEach(function (sl) {
    if (sl.id === "intro") return;
    Array.prototype.forEach.call(sl.querySelectorAll("figure img, .ph img, .half img, .local img"), function (img) { img.setAttribute("data-zoom", ""); });
    var bg = sl.querySelector(".bg img");
    if (bg && sl.querySelectorAll("[data-zoom]").length === 0) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "zoom-bg"; b.setAttribute("aria-label", "View the photo");
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
      b.addEventListener("click", function (e) { e.stopPropagation(); openLightbox([bg], 0, bg); });
      sl.appendChild(b);
    }
  });
  document.addEventListener("click", function (e) {
    var img = e.target.closest("[data-zoom]");
    if (!img || lbOpen) return;
    e.stopPropagation();
    var list = zoomables(slides[current]);
    openLightbox(list, Math.max(0, list.indexOf(img)), img);
  }, true);

  function fitBox(w, h) {
    var mw = window.innerWidth * 0.9, mh = window.innerHeight * 0.8;
    var k = Math.min(mw / w, mh / h);
    var W = w * k, H = h * k;
    return { left: (window.innerWidth - W) / 2, top: (window.innerHeight - H) / 2 - window.innerHeight * 0.04, width: W, height: H };
  }
  function place(r) { lbBox.style.left = r.left + "px"; lbBox.style.top = r.top + "px"; lbBox.style.width = r.width + "px"; lbBox.style.height = r.height + "px"; }
  function showCaption(img) {
    var c = captionOf(img);
    lb.querySelector(".lb-cap b").textContent = c[0];
    lb.querySelector(".lb-cap span").textContent = c[1];
    lb.querySelector(".lb-cap em").textContent = c[2];
    lb.querySelector(".lb-count").textContent = lbList.length > 1 ? (lbIdx + 1) + " / " + lbList.length : "";
    lb.classList.toggle("single", lbList.length < 2);
  }
  function srcFor(img) { var n = nameOf(img); return FULL.indexOf(n) !== -1 ? "img/full/" + n + ".webp" : img.getAttribute("src"); }
  function openLightbox(list, idx, from) {
    lbList = list; lbIdx = idx; lbOpen = true;
    var r = from.getBoundingClientRect();
    lbImg.src = from.currentSrc || from.src;
    lb.classList.add("on");
    lbBox.style.transition = "none";
    place(r);
    showCaption(from);
    void lbBox.offsetWidth;
    var w = from.naturalWidth || r.width, h = from.naturalHeight || r.height;
    lbBox.style.transition = "";
    requestAnimationFrame(function () { lb.classList.add("open"); place(fitBox(w, h)); });
    var hi = srcFor(from);
    if (hi !== from.getAttribute("src")) { var pre = new Image(); pre.onload = function () { if (lbList[lbIdx] === from) lbImg.src = hi; }; pre.src = hi; }
  }
  function stepLightbox(d) {
    if (lbList.length < 2) return;
    lbIdx = (lbIdx + d + lbList.length) % lbList.length;
    var img = lbList[lbIdx];
    lb.classList.add("swap");
    setTimeout(function () {
      lbImg.src = img.currentSrc || img.src;
      place(fitBox(img.naturalWidth || 4, img.naturalHeight || 3));
      showCaption(img);
      lb.classList.remove("swap");
      var hi = srcFor(img);
      if (hi !== img.getAttribute("src")) { var pre = new Image(); pre.onload = function () { if (lbList[lbIdx] === img) lbImg.src = hi; }; pre.src = hi; }
    }, reduced ? 0 : 220);
  }
  function closeLightbox() {
    if (!lbOpen) return;
    var img = lbList[lbIdx];
    lb.classList.remove("open");
    if (img && img.offsetParent && !reduced) place(img.getBoundingClientRect());
    setTimeout(function () { lb.classList.remove("on"); lbOpen = false; }, reduced ? 0 : 520);
  }
  lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); stepLightbox(-1); });
  lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); stepLightbox(1); });
  lb.addEventListener("click", function () { closeLightbox(); });
  function lightboxKey(e) {
    if (!lbOpen) return false;
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown" || k === " ") { e.preventDefault(); stepLightbox(1); }
    else if (k === "ArrowLeft" || k === "PageUp") { e.preventDefault(); stepLightbox(-1); }
    else if (k === "Escape" || k === "Enter" || k === "ArrowUp" || k === "ArrowDown" || k === "Backspace") { e.preventDefault(); closeLightbox(); }
    else if (k === "f" || k === "F") { toggleFullscreen(); }
    return true;
  }

  /* ------------------------------------------------------------
     Presenter view (P): a second window with the speaker notes,
     the next slide and a timer. Put the deck on the projector and
     keep this window on the laptop. It also drives the deck.
     ------------------------------------------------------------ */
  var pres = null, presT0 = 0, presTick = 0;
  function titleOf(sl) {
    if (!sl) return "—";
    if (sl.getAttribute("data-title")) return sl.getAttribute("data-title");
    var h = sl.querySelector("h1, h2, .h1, .h2, .mega");
    return h ? h.textContent.replace(/\s+/g, " ").trim() : sl.id;
  }
  function thumbOf(sl) {
    if (!sl) return "";
    var v = sl.querySelector("video[poster]");
    var img = sl.querySelector(".bg img, figure img, .ph img, .half img");
    var src = img ? img.getAttribute("src") : v ? v.getAttribute("poster") : "";
    try { return src ? new URL(src, location.href).href : ""; } catch (e) { return ""; }
  }
  var PRES_CSS = "*{box-sizing:border-box}html,body{margin:0;height:100%;background:#080d19;color:#eef2f8;font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif}" +
    "body{display:grid;grid-template-columns:1.35fr 1fr;grid-template-rows:auto 1fr auto;gap:18px;padding:22px}" +
    "header{grid-column:1/3;display:flex;justify-content:space-between;align-items:center;font:600 14px/1 'Segoe UI',sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(238,242,248,.55)}" +
    "#timer{font:700 40px/1 'Segoe UI',sans-serif;letter-spacing:0;color:#eef2f8;font-variant-numeric:tabular-nums}#clock{font-variant-numeric:tabular-nums}" +
    ".now,.next{background:#0d1528;border:1px solid rgba(214,226,255,.16);border-radius:16px;padding:22px;overflow:auto}" +
    ".lab{font:600 13px/1 'Segoe UI',sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(238,242,248,.5);margin-bottom:10px}" +
    "h1{font:800 34px/1.1 'Segoe UI',sans-serif;margin:0 0 16px}#notes{font:400 28px/1.5 Inter,'Segoe UI',sans-serif;color:#eef2f8}" +
    ".next h2{font:700 24px/1.2 'Segoe UI',sans-serif;margin:8px 0 12px}.next p{font:400 18px/1.45 Inter,sans-serif;color:rgba(238,242,248,.7)}" +
    ".thumb{width:100%;aspect-ratio:16/9;border-radius:10px;background:#142039 center/cover no-repeat;margin-bottom:10px}" +
    "footer{grid-column:1/3;display:flex;gap:12px;align-items:center}button{font:600 18px/1 'Segoe UI',sans-serif;color:#eef2f8;background:#142039;border:1px solid rgba(214,226,255,.25);border-radius:999px;padding:14px 26px;cursor:pointer}" +
    "#notes-sk{display:none;margin-top:22px;padding-top:18px;border-top:1px solid rgba(214,226,255,.16);font:400 20px/1.5 Inter,sans-serif;color:rgba(238,242,248,.6)}body.sk #notes-sk{display:block}body.sk #b-sk{background:#2450b0}" +
    "button:hover{background:#1d2c4f}#count{margin-left:auto;font:700 22px/1 'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}.tip{color:rgba(238,242,248,.45);font-size:14px}";
  var PRES_HTML = "<!doctype html><html lang='en'><head><meta charset='utf-8'><title>Presenter · Slovakia</title><style>" + PRES_CSS + "</style></head><body>" +
    "<header><span>Presenter view · Slovakia &amp; Senica</span><span id='clock'></span><span id='timer'>00:00</span></header>" +
    "<section class='now'><div class='lab' id='now-n'>Now</div><h1 id='now-t'></h1><div id='notes'></div><div id='notes-sk'></div></section>" +
    "<section class='next'><div class='lab'>Next</div><div class='thumb' id='next-img'></div><h2 id='next-t'></h2><p id='next-notes'></p></section>" +
    "<footer><button id='b-prev'>‹ Back</button><button id='b-next'>Next ›</button><button id='b-reset'>Reset timer</button><button id='b-sk'>SK preklad</button><span class='tip'>Keys in this window: → ← · R resets the timer</span><span id='count'></span></footer><\/body><\/html>";
  function fmtTime(ms) { var s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function openPresenter() {
    if (pres && !pres.closed) { pres.focus(); return; }
    pres = window.open("", "svk-presenter", "width=1180,height=760");
    if (!pres) { alert("Please allow pop-ups for this page to open the presenter view."); return; }
    pres.document.open(); pres.document.write(PRES_HTML); pres.document.close();
    presT0 = Date.now();
    var d = pres.document;
    d.getElementById("b-next").onclick = function () { nextSlide(); };
    d.getElementById("b-prev").onclick = function () { prevSlide(); };
    d.getElementById("b-reset").onclick = function () { presT0 = Date.now(); };
    d.getElementById("b-sk").onclick = function () { d.body.classList.toggle("sk"); };
    d.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); nextSlide(); }
      else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prevSlide(); }
      else if (k === "Home") go(0);
      else if (k === "End") go(slides.length - 1);
      else if (k === "r" || k === "R") presT0 = Date.now();
    });
    clearInterval(presTick);
    presTick = setInterval(function () {
      if (!pres || pres.closed) { clearInterval(presTick); return; }
      pres.document.getElementById("timer").textContent = fmtTime(Date.now() - presT0);
      var now = new Date();
      pres.document.getElementById("clock").textContent = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    }, 500);
    presenterUpdate(current);
  }
  function presenterUpdate(i) {
    if (!pres || pres.closed || i < 0) return;
    var d = pres.document, sl = slides[i], nx = slides[i + 1];
    var num = i < OFFSET ? "Intro" : "Slide " + (i - OFFSET + 1) + " of " + (slides.length - OFFSET);
    d.getElementById("now-n").textContent = "Now · " + num;
    d.getElementById("now-t").textContent = titleOf(sl);
    d.getElementById("notes").textContent = sl.getAttribute("data-notes") || "";
    d.getElementById("notes-sk").textContent = sl.getAttribute("data-notes-sk") || "";
    d.getElementById("next-t").textContent = nx ? titleOf(nx) : "End of the presentation";
    d.getElementById("next-notes").textContent = nx ? (nx.getAttribute("data-notes") || "").split(/(?<=[.!?])\s/)[0] : "";
    var th = thumbOf(nx);
    d.getElementById("next-img").style.backgroundImage = th ? "url('" + th + "')" : "none";
    d.getElementById("count").textContent = num;
  }
  window.addEventListener("beforeunload", function () { if (pres && !pres.closed) pres.close(); });

  var start = 0;
  var m = /^#s(\d+)$/.exec(location.hash || "");
  if (m) start = Math.min(slides.length - 1, Math.max(0, parseInt(m[1], 10) - 1 + OFFSET));
  applyCam();
  go(start, { noHash: true });
})();
