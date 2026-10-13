// Procedural soil cross-section: horizons, growing roots, an infiltration
// front and micro-life. Used by scene 01 and again by scene 21 (the loop closes).
// Everything is drawn in stage pixels (1920×1080); the stage transform scales it.
import { rng, loop } from "./stepper.js";

export function createSoil(canvas, { quality = "high", seed = 7, surface = 250 } = {}) {
  const W = (canvas.width = 1920), H = (canvas.height = 1080);
  const g = canvas.getContext("2d");
  const R = rng(seed);
  const S = surface; // y of the ground surface

  // ---- static base layer (drawn once) ----
  const base = document.createElement("canvas");
  base.width = W; base.height = H;
  const b = base.getContext("2d");
  // sky/air above ground: dark, the page ground colour
  b.fillStyle = "#14100c"; b.fillRect(0, 0, W, H);
  // horizons: O (litter), A (humus), B (transition), C (loess parent material)
  const hz = [
    [S, S + 22, "#2b2116", "#241b12"],
    [S + 22, S + 330, "#231a12", "#2d2217"],
    [S + 330, S + 560, "#3b2c1d", "#5a4429"],
    [S + 560, H, "#6d5434", "#7b6240"]
  ];
  hz.forEach(([y0, y1, c0, c1]) => {
    const gr = b.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    b.fillStyle = gr; b.fillRect(0, y0, W, y1 - y0);
  });
  // soft, wavy horizon boundaries
  [[S + 330, "rgba(35,26,18,.9)"], [S + 560, "rgba(59,44,29,.85)"]].forEach(([y, c]) => {
    b.fillStyle = c; b.beginPath(); b.moveTo(0, y - 60);
    for (let x = 0; x <= W; x += 40) b.lineTo(x, y + Math.sin(x / 170) * 18 + Math.sin(x / 57) * 7 + (R() - 0.5) * 10);
    b.lineTo(W, y - 60); b.closePath(); b.fill();
  });
  // texture: aggregates, pores, stones, root channels, carbonate specks in loess
  const n = quality === "low" ? 9000 : 18000;
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = S + 8 + R() * (H - S);
    const d = (y - S) / (H - S);
    const r = 0.6 + R() * (d < 0.4 ? 2.4 : 1.6);
    const light = R() < 0.5;
    b.fillStyle = light ? `rgba(236,215,180,${0.03 + R() * 0.06 + d * 0.05})` : `rgba(8,5,3,${0.12 + R() * 0.2})`;
    b.beginPath(); b.ellipse(x, y, r * (1 + R()), r, R() * 3, 0, 7); b.fill();
  }
  for (let i = 0; i < 70; i++) { // stones
    const x = R() * W, y = S + 360 + R() * (H - S - 360), r = 4 + R() * 12;
    b.fillStyle = `rgba(${150 + R() * 40 | 0},${130 + R() * 30 | 0},${105 + R() * 20 | 0},.55)`;
    b.beginPath(); b.ellipse(x, y, r * 1.4, r, R() * 3, 0, 7); b.fill();
  }
  for (let i = 0; i < 26; i++) { // old earthworm burrows (vertical, humus-lined)
    let x = R() * W, y = S + 20;
    b.strokeStyle = "rgba(10,7,5,.45)"; b.lineWidth = 3 + R() * 2; b.beginPath(); b.moveTo(x, y);
    const len = 200 + R() * 500;
    for (let t = 0; t < len; t += 12) { x += (R() - 0.5) * 7; y += 12; b.lineTo(x, y); }
    b.stroke();
  }
  // surface: a thin crop/grass fringe
  for (let x = 0; x < W; x += 3) {
    const h = 6 + R() * 26;
    b.strokeStyle = `rgba(${120 + R() * 50 | 0},${150 + R() * 50 | 0},${70 + R() * 30 | 0},${0.35 + R() * 0.4})`;
    b.lineWidth = 1.2; b.beginPath(); b.moveTo(x, S + 2); b.quadraticCurveTo(x + (R() - 0.5) * 8, S - h / 2, x + (R() - 0.5) * 10, S - h); b.stroke();
  }
  b.fillStyle = "rgba(0,0,0,.18)"; b.fillRect(0, S, W, 3);

  // ---- roots: branching growth, pre-generated then revealed over t ----
  const segs = [];
  const plants = quality === "low" ? 9 : 14;
  for (let p = 0; p < plants; p++) {
    const x0 = 60 + (p + R() * 0.8) * (W - 120) / plants;
    const deep = 0.55 + R() * 0.45;
    grow(x0, S + 2, Math.PI / 2 + (R() - 0.5) * 0.2, 4.6, 0, deep * 70, 0);
  }
  function grow(x, y, a, w, t, life, depth) {
    for (let i = 0; i < life; i++) {
      const nx = x + Math.cos(a) * 7, ny = y + Math.sin(a) * 7;
      segs.push({ x, y, nx, ny, w, t: t + i * 0.012 + depth * 0.05 });
      x = nx; y = ny;
      a += (R() - 0.5) * 0.35 + (Math.PI / 2 - a) * 0.04;
      w *= 0.985;
      if (w > 0.7 && R() < 0.07 + depth * 0.02 && depth < 4) grow(x, y, a + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.7), w * 0.62, t + i * 0.012, life * (0.35 + R() * 0.3), depth + 1);
      if (y > H - 10) break;
    }
  }
  const tMax = Math.max(...segs.map((s) => s.t));
  segs.forEach((s) => (s.t /= tMax));
  segs.sort((a, b) => a.t - b.t);
  const roots = document.createElement("canvas");
  roots.width = W; roots.height = H;
  const rg = roots.getContext("2d");
  rg.lineCap = "round";
  let drawn = 0;
  function drawRootsTo(t) {
    if (t < (segs[drawn - 1]?.t ?? 0)) { rg.clearRect(0, 0, W, H); drawn = 0; }
    while (drawn < segs.length && segs[drawn].t <= t) {
      const s = segs[drawn++];
      rg.strokeStyle = `rgba(226,204,160,${0.55 + Math.min(0.35, s.w / 8)})`;
      rg.lineWidth = Math.max(0.6, s.w);
      rg.beginPath(); rg.moveTo(s.x, s.y); rg.lineTo(s.nx, s.ny); rg.stroke();
    }
  }

  // ---- micro-life: slow Brownian dots in the humus layer ----
  const life = Array.from({ length: quality === "low" ? 60 : 140 }, () => ({ x: R() * W, y: S + 30 + R() * 280, vx: 0, vy: 0, r: 0.8 + R() * 1.6 }));
  // ---- water: infiltration front + drops ----
  const drops = Array.from({ length: quality === "low" ? 60 : 140 }, () => ({ x: R() * W, y: S - R() * 400, v: 5 + R() * 5 }));

  const st = { roots: 0, water: 0, rain: 0, alpha: 1 };
  let time = 0;
  function frontY(x) {
    const depth = st.water * 620;
    return S + depth + Math.sin(x / 140 + time * 0.6) * 14 * st.water + Math.sin(x / 47 - time) * 6 * st.water;
  }
  function render(dt) {
    time += dt;
    g.clearRect(0, 0, W, H);
    g.globalAlpha = st.alpha;
    g.drawImage(base, 0, 0);
    if (st.water > 0.001) {
      g.fillStyle = "rgba(90,170,190,.07)";
      g.beginPath(); g.moveTo(0, S);
      for (let x = 0; x <= W; x += 24) g.lineTo(x, frontY(x));
      g.lineTo(W, S); g.closePath(); g.fill();
      g.strokeStyle = "rgba(140,215,228,.4)"; g.lineWidth = 1.5;
      g.beginPath();
      for (let x = 0; x <= W; x += 24) (x ? g.lineTo : g.moveTo).call(g, x, frontY(x));
      g.stroke();
    }
    drawRootsTo(st.roots);
    g.drawImage(roots, 0, 0);
    // micro-life
    g.fillStyle = "rgba(236,220,190,.55)";
    life.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 12 * dt; p.vy += (Math.random() - 0.5) * 12 * dt;
      p.vx *= 0.96; p.vy *= 0.96; p.x += p.vx; p.y += p.vy;
      if (p.y < S + 20) p.vy += 0.5; if (p.y > S + 320) p.vy -= 0.5;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill();
    });
    // rain above ground, which disappears into the soil at the surface
    if (st.rain > 0.01) {
      g.strokeStyle = `rgba(160,215,230,${0.5 * st.rain})`; g.lineWidth = 1.5;
      g.beginPath();
      drops.forEach((d) => {
        d.y += d.v * dt * 60;
        if (d.y > S) { d.y = S - 300 - Math.random() * 200; d.x = Math.random() * W; }
        g.moveTo(d.x, d.y); g.lineTo(d.x - 1, d.y + 14);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  const L = loop(render);
  return {
    state: st,
    start: () => L.start(),
    stop: () => L.stop(),
    renderOnce: () => render(0.016),
    get running() { return L.running; }
  };
}
