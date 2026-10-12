// The "follow one load" rail: the eight stations of the Senica composting plant,
// as the operator described them (email of 23 Sep 2026). It sits in the same
// place in scenes 14, 15 and 17, so the load keeps travelling between scenes.
export const STATIONS = [
  ["Arrive", "trucks · residents"],
  ["Check", "weigh · look · record"],
  ["Store", "piles in the yard"],
  ["Prepare", "chip · cut · mix"],
  ["Heat", "kitchen waste · 70 °C"],
  ["Compost", "windrows · 3–5 months"],
  ["Screen", "sieve · quality check"],
  ["Return", "gardens · green areas"]
];
const X0 = 110, X1 = 1500;
export const railX = (i) => X0 + (i * (X1 - X0)) / (STATIONS.length - 1);

export function railHTML() {
  return `<div class="rail" aria-label="The route of one load through the composting plant">
    <svg class="rail-svg" viewBox="0 0 1920 120" aria-hidden="true"><line class="rail-track" x1="${X0}" y1="40" x2="${X1}" y2="40"/><line class="rail-done" x1="${X0}" y1="40" x2="${X1}" y2="40" pathLength="1"/></svg>
    <ol>${STATIONS.map((s, i) => `<li data-i="${i}" style="left:${railX(i)}px"><i></i><b class="mono">${String(i + 1).padStart(2, "0")} ${s[0]}</b><span>${s[1]}</span></li>`).join("")}</ol>
    <span class="rail-token" style="left:${X0}px"></span>
  </div>`;
}

// set the rail to station i immediately
export function railSet(el, i) {
  el.querySelectorAll(".rail li").forEach((li) => { li.classList.toggle("on", +li.dataset.i <= i); li.classList.toggle("now", +li.dataset.i === i); });
  const tok = el.querySelector(".rail-token");
  if (tok) tok.style.left = railX(i) + "px";
  const done = el.querySelector(".rail-done");
  if (done) done.style.strokeDashoffset = 1 - i / (STATIONS.length - 1);
}

// animate the load from station a to station b inside a step timeline; the
// station classes follow the token, so playing, reversing and jumping all agree
export function railTo(tl, el, a, b, at = 0, d = 1.2) {
  const lis = [...el.querySelectorAll(".rail li")];
  const tok = el.querySelector(".rail-token"), done = el.querySelector(".rail-done");
  const n = STATIONS.length - 1, o = { p: a };
  const paint = () => {
    tok.style.left = railX(o.p) + "px";
    done.style.strokeDashoffset = 1 - o.p / n;
    const cur = Math.round(o.p * 100) / 100;
    lis.forEach((li, i) => { li.classList.toggle("on", i <= cur + 0.001); li.classList.toggle("now", Math.abs(i - cur) < 0.35); });
  };
  return tl.fromTo(o, { p: a }, { p: b, duration: d, ease: "power2.inOut", immediateRender: false, onUpdate: paint, onStart: paint }, at);
}
