// Landscape cross-section for scene 05: one slope, two ways of farming it.
// st.mosaic 0 → a large uniform field (runoff carries soil away, wind lifts dust,
// the bare surface heats up); 1 → windbreaks, grass strips and a copse slow
// water down so it soaks in, and break the wind.
import { rng, loop } from "./stepper.js";

export function createLandscape(canvas, { quality = "high" } = {}) {
  const W = (canvas.width = 1920), H = (canvas.height = 1080);
  const g = canvas.getContext("2d");
  const R = rng(11);
  const ground = (x) => 600 + x * 0.1 + Math.sin(x / 260) * 10;
  const st = { mosaic: 0, rain: 0, wind: 0, heat: 0 };

  // mosaic features along the slope
  const trees = [];
  [[330, 11], [1180, 9]].forEach(([x0, n]) => { for (let i = 0; i < n; i++) trees.push({ x: x0 + i * 14 + R() * 8, h: 120 + R() * 70, r: 26 + R() * 16, d: i / n }); });
  for (let i = 0; i < 7; i++) trees.push({ x: 1560 + R() * 150, h: 90 + R() * 80, r: 30 + R() * 20, d: 0.3 + R() * 0.5 });
  const strips = [[720, 110], [1440, 90]];
  const inStrip = (x) => strips.some(([a, w]) => x > a && x < a + w);
  const shelter = (x) => (x > 330 && x < 760) || (x > 1180 && x < 1560);

  // ---- static layers ----
  const base = document.createElement("canvas"); base.width = W; base.height = H;
  const b = base.getContext("2d");
  const sky = b.createLinearGradient(0, 0, 0, 700);
  sky.addColorStop(0, "#1a1712"); sky.addColorStop(1, "#2a241b");
  b.fillStyle = sky; b.fillRect(0, 0, W, H);
  const soilPath = (off) => { b.beginPath(); b.moveTo(0, ground(0) + off); for (let x = 0; x <= W; x += 10) b.lineTo(x, ground(x) + off); b.lineTo(W, H); b.lineTo(0, H); b.closePath(); };
  soilPath(0); b.fillStyle = "#3a2b1c"; b.fill();
  soilPath(70); b.fillStyle = "#4d3a25"; b.fill();
  soilPath(190); b.fillStyle = "#65502f"; b.fill();
  for (let i = 0; i < 6000; i++) {
    const x = R() * W, y = ground(x) + 4 + R() * (H - ground(x));
    b.fillStyle = R() < 0.5 ? "rgba(0,0,0,.18)" : "rgba(230,200,150,.06)";
    b.fillRect(x, y, 1 + R() * 2.5, 1 + R() * 2);
  }
  // uniform crop stubble (the monoculture surface)
  const stubble = document.createElement("canvas"); stubble.width = W; stubble.height = H;
  const sb = stubble.getContext("2d");
  for (let x = 0; x < W; x += 9) {
    sb.strokeStyle = "rgba(205,180,120,.55)"; sb.lineWidth = 1.5;
    sb.beginPath(); sb.moveTo(x, ground(x)); sb.lineTo(x + 1, ground(x) - 14); sb.stroke();
  }
  // grass strips (drawn once, faded in by mosaic)
  const grass = document.createElement("canvas"); grass.width = W; grass.height = H;
  const gb = grass.getContext("2d");
  strips.forEach(([a, w]) => {
    for (let x = a; x < a + w; x += 2.2) {
      const h = 18 + R() * 30;
      gb.strokeStyle = `rgba(${110 + R() * 60 | 0},${160 + R() * 50 | 0},${70 + R() * 30 | 0},.85)`; gb.lineWidth = 1.4;
      gb.beginPath(); gb.moveTo(x, ground(x) + 2); gb.quadraticCurveTo(x + (R() - 0.5) * 10, ground(x) - h / 2, x + (R() - 0.5) * 14, ground(x) - h); gb.stroke();
    }
    // roots under the strip hold soil and open pores
    for (let k = 0; k < 40; k++) {
      let x = a + R() * w, y = ground(x);
      gb.strokeStyle = "rgba(220,200,160,.35)"; gb.lineWidth = 1; gb.beginPath(); gb.moveTo(x, y);
      for (let t = 0; t < 12; t++) { x += (R() - 0.5) * 8; y += 8; gb.lineTo(x, y); }
      gb.stroke();
    }
  });

  function drawTree(t, grow) {
    const gy = ground(t.x), s = Math.max(0, Math.min(1, (grow - t.d * 0.4) / 0.6));
    if (s <= 0) return;
    const h = t.h * s, r = t.r * s;
    g.strokeStyle = "#2a1d12"; g.lineWidth = 4 * s + 1;
    g.beginPath(); g.moveTo(t.x, gy); g.lineTo(t.x, gy - h * 0.7); g.stroke();
    g.fillStyle = "rgba(78,104,52,.95)";
    g.beginPath(); g.arc(t.x, gy - h * 0.72, r, 0, 7); g.fill();
    g.fillStyle = "rgba(112,140,70,.9)";
    g.beginPath(); g.arc(t.x - r * 0.35, gy - h * 0.8, r * 0.7, 0, 7); g.arc(t.x + r * 0.4, gy - h * 0.66, r * 0.6, 0, 7); g.fill();
    // roots
    g.strokeStyle = `rgba(215,190,150,${0.35 * s})`; g.lineWidth = 1.2;
    g.beginPath(); for (let k = -2; k <= 2; k++) { g.moveTo(t.x, gy); g.quadraticCurveTo(t.x + k * 14 * s, gy + 40 * s, t.x + k * 26 * s, gy + 90 * s); } g.stroke();
  }

  // ---- particles ----
  const NR = quality === "low" ? 260 : 520;
  const rain = Array.from({ length: NR }, () => ({ x: R() * W, y: R() * 600 - 600, v: 9 + R() * 6 }));
  const run = []; // runoff + infiltration particles
  const wind = Array.from({ length: quality === "low" ? 50 : 110 }, () => ({ x: R() * W, y: 200 + R() * 450, v: 6 + R() * 8, l: 30 + R() * 70 }));
  const dust = [];
  let lost = 0, soaked = 0;

  function render(dt) {
    const m = st.mosaic, f = dt * 60;
    g.drawImage(base, 0, 0);
    // heat haze over bare ground
    if (st.heat > 0.01) {
      const a = 0.28 * st.heat * (1 - m);
      const hg = g.createLinearGradient(0, 480, 0, 760);
      hg.addColorStop(0, "rgba(224,112,63,0)"); hg.addColorStop(1, `rgba(224,112,63,${a})`);
      g.fillStyle = hg; g.fillRect(0, 480, W, 280);
    }
    g.globalAlpha = 1 - m * 0.75; g.drawImage(stubble, 0, 0); g.globalAlpha = 1;
    if (m > 0.01) { g.globalAlpha = Math.min(1, m * 1.4); g.drawImage(grass, 0, 0); g.globalAlpha = 1; }
    trees.forEach((t) => drawTree(t, m));

    // wind streaks; they weaken in the shelter of trees
    if (st.wind > 0.01) {
      g.strokeStyle = `rgba(236,229,216,${0.22 * st.wind})`; g.lineWidth = 1.2; g.beginPath();
      wind.forEach((w) => {
        const k = shelter(w.x) && w.y > 420 ? 1 - m * 0.8 : 1;
        w.x += w.v * f * k;
        if (w.x > W + 100) { w.x = -100; w.y = 200 + Math.random() * 450; }
        g.moveTo(w.x, w.y); g.lineTo(w.x - w.l * k, w.y);
        // lifting dust from bare soil
        if (k > 0.5 && m < 0.6 && w.y > ground(w.x) - 90 && Math.random() < 0.3 * st.wind && dust.length < 400) dust.push({ x: w.x, y: ground(w.x) - 2, vx: 3 + Math.random() * 4, vy: -0.6 - Math.random() * 1.2, a: 1 });
      });
      g.stroke();
    }
    g.fillStyle = "rgba(170,130,85,.8)";
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i]; d.x += d.vx * f; d.y += d.vy * f; d.vy += 0.01 * f; d.a -= 0.008 * f;
      if (d.a <= 0 || d.x > W) { dust.splice(i, 1); continue; }
      g.globalAlpha = d.a; g.fillRect(d.x, d.y, 2.2, 2.2);
    }
    g.globalAlpha = 1;

    // rain → hits the ground → runoff (brown, downhill) or infiltration (blue, down)
    if (st.rain > 0.01) {
      g.strokeStyle = `rgba(160,215,230,${0.55 * st.rain})`; g.lineWidth = 1.4; g.beginPath();
      const active = Math.floor(rain.length * st.rain);
      for (let i = 0; i < active; i++) {
        const r = rain[i];
        r.y += r.v * f; r.x += 1.2 * f;
        const gy = ground(r.x);
        if (r.y >= gy) {
          const pSoak = inStrip(r.x) || shelter(r.x) ? 0.12 + 0.86 * m : 0.1 + 0.55 * m;
          if (run.length < 900) run.push(Math.random() < pSoak ? { x: r.x, y: gy + 2, mode: 1, a: 1 } : { x: r.x, y: gy - 1, mode: 0, v: 1 + Math.random(), a: 1 });
          r.y = -20 - Math.random() * 300; r.x = Math.random() * W;
        }
        g.moveTo(r.x, r.y); g.lineTo(r.x - 1.5, r.y + 12);
      }
      g.stroke();
    }
    for (let i = run.length - 1; i >= 0; i--) {
      const p = run[i];
      if (p.mode === 0) { // runoff: accelerates downhill, carries soil
        p.v = Math.min(9, p.v + 0.06 * f); p.x += p.v * f; p.y = ground(p.x) - 1.5;
        if (m > 0.4 && inStrip(p.x) && Math.random() < 0.08 * m * f) { p.mode = 1; p.y += 2; p.a = 1; continue; }
        if (p.x > W) { run.splice(i, 1); lost++; continue; }
        g.fillStyle = "rgba(160,112,66,.95)"; g.fillRect(p.x, p.y - 1, 3.2, 2.4);
        g.fillStyle = "rgba(150,205,220,.8)"; g.fillRect(p.x - 3, p.y - 1.5, 2, 1.6);
      } else { // infiltration: sinks and fades into the soil
        p.y += 1.4 * f; p.x += (Math.random() - 0.5) * 0.8; p.a -= 0.006 * f;
        if (p.a <= 0) { run.splice(i, 1); soaked++; continue; }
        g.fillStyle = `rgba(120,200,215,${p.a * 0.85})`; g.fillRect(p.x, p.y, 2.2, 2.2);
      }
    }
  }
  const L = loop(render);
  return { state: st, start: () => L.start(), stop: () => L.stop(), renderOnce: () => render(0.016), get counts() { return { lost, soaked }; } };
}
