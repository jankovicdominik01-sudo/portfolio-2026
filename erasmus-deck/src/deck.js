/* Slovakia — Erasmus+ deck engine.
   No dependencies. Works offline from a single HTML file. */
(function () {
  "use strict";

  // Where the final route ends. Change to your host city if you like,
  // e.g. { name: "Ankara", sub: "Our host city", lon: 32.86, lat: 39.93 }.
  var DESTINATION = { name: "Turkey", sub: "≈ 1,250 km from Senica", lon: 28.98, lat: 41.01 };

  var MAP = window.DECK_MAP;
  var CREDITS = window.DECK_CREDITS || [];
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

  var CHAPTERS = [
    { roman: "I", name: "Slovakia", sub: "The country", start: 0, end: 4 },
    { roman: "II", name: "Senica", sub: "Our town", start: 5, end: 7 },
    { roman: "III", name: "Our School", sub: "Where we learn", start: 8, end: 10 },
    { roman: "IV", name: "Erasmus+", sub: "Why we are here", start: 11, end: 13 }
  ];

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
      li.appendChild(document.createTextNode(" — " + c.artist + ", " + c.license + " (slide " + c.slide + ")"));
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
    chrome.classList.toggle("hidden", i === 0 || i === slides.length - 1);
    counter.innerHTML = "<b>" + String(i + 1).padStart(2, "0") + "</b> / " + slides.length;
    var ch = chapterOf(i);
    chapterBtns.forEach(function (b, c) {
      var C = CHAPTERS[c];
      var p = c < ch ? 1 : c > ch ? 0 : (i - C.start + 1) / (C.end - C.start + 1);
      b.classList.toggle("cur", c === ch);
      b.querySelector(".bar i").style.setProperty("--p", p);
      if (c === ch) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    notesText.textContent = slides[i].getAttribute("data-notes") || "";
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
    if (!opts.noHash) { try { history.replaceState(null, "", "#s" + (i + 1)); } catch (e) { /* sandboxed */ } }
    if (prev !== -1 && hint) hint.style.opacity = "0";
    busy = true;
    setTimeout(function () { busy = false; }, 350);
  }

  function nextSlide() { if (!busy) go(current + 1); }
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
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " " || k === "Enter") { e.preventDefault(); nextSlide(); }
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp" || k === "Backspace") { e.preventDefault(); prevSlide(); }
    else if (k === "Home") { go(0); }
    else if (k === "End") { go(slides.length - 1); }
    else if (k === "f" || k === "F") { toggleFullscreen(); }
    else if (k === "n" || k === "N") { notes.classList.toggle("on"); }
    else if (k === "c" || k === "C") { credits.classList.toggle("on"); }
    else if (k === "Escape") { notes.classList.remove("on"); credits.classList.remove("on"); }
    else if (/^[1-9]$/.test(k)) { go(parseInt(k, 10) - 1); }
  });

  stage.addEventListener("click", function (e) {
    keepAwake();
    if (e.target.closest("a, button, #credits, #notes")) return;
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

  var start = 0;
  var m = /^#s(\d+)$/.exec(location.hash || "");
  if (m) start = Math.min(slides.length - 1, Math.max(0, parseInt(m[1], 10) - 1));
  applyCam();
  go(start, { noHash: true });
})();
