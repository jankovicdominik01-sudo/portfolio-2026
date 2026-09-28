// Entry point for the agriculture deck (bundled into one IIFE for file:// use).
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { createEngine } from "./engine.js";
import act1 from "./scenes/act1.js";
import act2 from "./scenes/act2.js";
import act3 from "./scenes/act3.js";
import act4 from "./scenes/act4.js";
import act5 from "./scenes/act5.js";

gsap.registerPlugin(Flip, MotionPathPlugin, MorphSVGPlugin, DrawSVGPlugin);

// film grain: one pre-rendered 256 px noise tile (a blended SVG filter over the
// whole stage cost ~40 fps on weak GPUs)
function grain() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d"), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
  document.getElementById("grain").style.backgroundImage = `url(${c.toDataURL()})`;
}

function start() {
  grain();
  createEngine([...act1, ...act2, ...act3, ...act4, ...act5], {
    otherDeck: { title: "Slovakia & Senica", href: "../slovakia/index.html" },
    hubHref: "../index.html"
  });
  // arriving from the hub: fade the curtain away
  const c = document.getElementById("curtain");
  if (c) gsap.to(c, { autoAlpha: 0, duration: 0.9, delay: 0.1, ease: "power2.out", onComplete: () => c.remove() });
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
