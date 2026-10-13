// Printable speaker script + presenter map (dist/agriculture/script.html),
// generated from src/agriculture/notes.js and the scene titles.
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LOOP = ["Soil", "Agriculture", "Food", "Waste", "Recovery", "Back to soil"];
const SKIP_IF_SHORT = ["s-partridge", "s-drought", "s-biogas3d", "s-fail"];

export function renderScript(META, SCRIPT, PRESENTERS) {
  const byId = Object.fromEntries(SCRIPT.map((n) => [n.id, n]));
  const main = META.filter((m) => !m.backup);
  const backup = META.filter((m) => m.backup);
  const total = main.reduce((a, m) => a + (byId[m.id]?.time || 0), 0);
  const per = {};
  main.forEach((m) => { const n = byId[m.id]; if (n) { per[n.presenter] = per[n.presenter] || { t: 0, n: 0 }; per[n.presenter].t += n.time; per[n.presenter].n++; } });
  const short = total - main.filter((m) => SKIP_IF_SHORT.includes(m.id)).reduce((a, m) => a + (byId[m.id]?.time || 0), 0);
  const num = (m) => (m.backup ? "B" + (backup.indexOf(m) + 1) : String(main.indexOf(m) + 1).padStart(2, "0"));
  const row = (m) => {
    const n = byId[m.id] || {};
    return `<tr class="${m.backup ? "bk" : ""}"><td class="n">${num(m)}</td><td><b>${esc(m.title)}</b><span>${LOOP[m.loop]}</span></td><td><i class="dot p-${slug(n.presenter || "x")}"></i>${esc(n.presenter)}</td><td class="t">${fmt(n.time || 0)}</td><td>${esc(n.level)}</td><td>${esc(n.message)}</td></tr>`;
  };
  const block = (m) => {
    const n = byId[m.id] || { say: [] };
    return `<section class="scene" id="${m.id}">
      <header><span class="n">${num(m)}</span><h2>${esc(m.title)}</h2><span class="who p-${slug(n.presenter || "x")}">${esc(n.presenter)}</span></header>
      <p class="meta">≈ ${fmt(n.time || 0)} · ${esc(n.level)} · ${m.steps} click${m.steps > 1 ? "s" : ""} · chapter: ${LOOP[m.loop]}</p>
      <p class="msg">${esc(n.message)}</p>
      <div class="grid">
        <div><h3>On the screen</h3><p>${esc(n.screen)}</p></div>
        <div><h3>Point at / interact</h3><p>${esc(n.point)}</p></div>
      </div>
      <h3>Speaker notes</h3>
      <ol class="say">${n.say.map((t, i) => `<li><span class="k">${i === 0 ? "when the scene opens" : "click " + i}</span>${esc(t)}</li>`).join("")}</ol>
      <p class="tr"><b>Transition →</b> ${esc(n.transition)}</p>
    </section>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Speaker script · Back to Soil?</title>
<style>
:root { --ink: #1c1712; --ink2: #4d4337; --ink3: #8a7e6e; --line: #dcd3c4; --paper: #f7f3ea; --leaf: #5f8a2f; --p-dominik: #b8892a; --p-adam: #3d74c9; --p-sara: #5f8a2f; --p-karolina: #c4643f; --p-x: #8a7e6e; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 400 15px/1.5 "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif; }
.wrap { max-width: 1060px; margin: 0 auto; padding: 48px 32px 80px; }
h1 { font: 400 46px/1.05 Fraunces, Georgia, serif; margin: 0; letter-spacing: -.02em; }
.lead { color: var(--ink2); margin: 10px 0 0; }
.totals { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
.totals div { background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 12px 16px; min-width: 150px; }
.totals b { display: block; font: 400 26px/1.1 Fraunces, Georgia, serif; }
.totals span { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink3); }
.keys { background: #fff; border: 1px solid var(--line); border-radius: 6px; padding: 14px 18px; font-size: 14px; color: var(--ink2); }
.keys kbd { font: 500 12px/1 ui-monospace, Menlo, monospace; border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 3px; padding: 2px 6px; background: var(--paper); color: var(--ink); }
h2.sec { font: 400 30px/1.1 Fraunces, Georgia, serif; margin: 44px 0 12px; }
table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid var(--line); font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink3); font-weight: 500; }
td.n, td.t { font-family: ui-monospace, Menlo, monospace; white-space: nowrap; }
td b { display: block; font-weight: 500; } td span { font-size: 12px; color: var(--ink3); }
tr.bk td { color: var(--ink3); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; background: var(--c); }
.p-dominik { --c: var(--p-dominik); color: var(--p-dominik); } .p-adam { --c: var(--p-adam); color: var(--p-adam); } .p-sara { --c: var(--p-sara); color: var(--p-sara); } .p-karolina { --c: var(--p-karolina); color: var(--p-karolina); } .p-x { --c: var(--p-x); }
td .dot + * , td:has(.dot) { color: var(--ink); }
.note { font-size: 14px; color: var(--ink2); margin-top: 10px; }
.scene { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 20px 24px; margin: 18px 0; break-inside: avoid; page-break-inside: avoid; }
.scene header { display: flex; align-items: baseline; gap: 14px; }
.scene .n { font: 500 15px ui-monospace, Menlo, monospace; color: var(--ink3); }
.scene h2 { font: 400 26px/1.15 Fraunces, Georgia, serif; margin: 0; flex: 1; }
.scene .who { font: 500 12px/1 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; padding: 6px 10px; border-radius: 20px; border: 1.5px solid currentColor; }
.meta { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink3); margin: 6px 0 10px; }
.msg { font: italic 400 18px/1.4 Fraunces, Georgia, serif; margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
h3 { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink3); margin: 12px 0 4px; font-weight: 500; }
.grid p { margin: 0; color: var(--ink2); font-size: 14px; }
.say { margin: 4px 0 0; padding-left: 0; list-style: none; }
.say li { padding: 10px 0 10px 14px; border-left: 3px solid var(--line); margin: 6px 0; font-size: 16px; line-height: 1.55; }
.say .k { display: block; font: 500 11px/1 ui-monospace, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--ink3); margin-bottom: 4px; }
.tr { margin: 10px 0 0; color: var(--leaf); font-size: 15px; }
.tr b { font-weight: 500; }
@media print { body { background: #fff; } .wrap { padding: 0; max-width: none; } .scene, table { border-color: #ccc; } a { color: inherit; } @page { margin: 14mm; } }
</style></head><body><div class="wrap">
<h1>Back to Soil? — speaker script & presenter map</h1>
<p class="lead">Erasmus+ <i>Young Ambassadors of Ecological Agriculture</i> · Mezitli / Mersin · 8–14 October 2026 · SSOŠP Senica — Dominik, Adam, Sara, Karolína</p>
<div class="totals"><div><b>${fmt(total)}</b><span>speaking time · ${main.length} scenes</span></div>${Object.entries(per).map(([p, v]) => `<div><b class="p-${slug(p)}">${fmt(v.t)}</b><span>${esc(p)} · ${v.n} scenes · ${Math.round((v.t / total) * 100)} %</span></div>`).join("")}</div>
<div class="keys"><b>On the laptop:</b> <kbd>P</kbd> presenter window (notes, timer, next scene) · <kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd> next · <kbd>←</kbd> back · <kbd>B</kbd> black screen · <kbd>F</kbd> fullscreen · <kbd>G</kbd> scene overview · <kbd>12</kbd> <kbd>Enter</kbd> go to scene 12 · <kbd>S</kbd> our research · <kbd>M</kbd> menu. Times are estimates at a calm speaking speed (≈ 120 words a minute) plus a little time per click.</div>
<h2 class="sec">Presenter map</h2>
<table><thead><tr><th>#</th><th>Scene</th><th>Presenter</th><th>Time</th><th>Level</th><th>Main message</th></tr></thead><tbody>${main.map(row).join("")}${backup.map(row).join("")}</tbody></table>
<p class="note"><b>If time is short (≈ ${fmt(short)}):</b> skip ${SKIP_IF_SHORT.map((id) => { const m = main.find((x) => x.id === id); return m ? `${num(m)} ${esc(m.title)}` : ""; }).join(" · ")} — type the next scene's number and press Enter to jump over them.</p>
<h2 class="sec">Scene by scene</h2>
${main.map(block).join("")}
<h2 class="sec">Backup scenes (only if someone asks)</h2>
${backup.map(block).join("")}
</div></body></html>`;
}
