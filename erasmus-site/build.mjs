// Builds the Erasmus+ Mersin 2026 site into dist/:
//
//   dist/index.html              hub: choose a presentation
//   dist/slovakia/index.html     "Slovakia & Senica" (built from ../erasmus-deck)
//   dist/agriculture/index.html  "Back to Soil?" (this folder, src/agriculture)
//   dist/vercel.json             trailing slashes so relative paths always work
//
// Every page inlines its fonts, CSS and JS, and links to the others with
// relative paths, so the whole dist/ folder also runs offline from a USB stick
// (double-click index.html).
//
// Optional photos, picked up automatically if present:
//   assets/agriculture/ecofarm/*.jpg|webp  (+ captions.json)  → scene 09
//   assets/agriculture/field/*.jpg|webp    (+ captions.json)  → scene 19

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
const nm = (p) => join(here, "node_modules", p);
const read = (p) => readFileSync(join(here, p), "utf8");
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// ---------- fonts (inlined as base64: file:// pages can't load font files cross-origin) ----------
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
function face(family, style, weight, file) {
  const b64 = readFileSync(nm(file)).toString("base64");
  const range = file.includes("latin-ext") ? LATIN_EXT : LATIN;
  return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range}}`;
}
const F = "@fontsource-variable/fraunces/files/fraunces-";
const PS = "@fontsource/ibm-plex-sans/files/ibm-plex-sans-";
const PM = "@fontsource/ibm-plex-mono/files/ibm-plex-mono-";
const fonts = [];
for (const sub of ["latin", "latin-ext"]) {
  fonts.push(face("Fraunces", "normal", "100 900", `${F}${sub}-full-normal.woff2`));
  fonts.push(face("Fraunces", "italic", "100 900", `${F}${sub}-full-italic.woff2`));
  for (const w of [400, 500, 600]) fonts.push(face("IBM Plex Sans", "normal", w, `${PS}${sub}-${w}-normal.woff2`));
  for (const w of [400, 500]) fonts.push(face("IBM Plex Mono", "normal", w, `${PM}${sub}-${w}-normal.woff2`));
}
const fontCss = fonts.join("\n");
// the hub needs only a few cuts
const hubFontCss = [
  face("Fraunces", "normal", "100 900", `${F}latin-full-normal.woff2`),
  face("Fraunces", "italic", "100 900", `${F}latin-full-italic.woff2`),
  face("IBM Plex Sans", "normal", 400, `${PS}latin-400-normal.woff2`),
  face("IBM Plex Mono", "normal", 500, `${PM}latin-500-normal.woff2`),
  face("IBM Plex Mono", "normal", 500, `${PM}latin-ext-500-normal.woff2`)
].join("\n");

// ---------- agriculture: optional photo folders ----------
const IMG = /\.(jpe?g|png|webp)$/i;
function photoSet(name) {
  const dir = join(here, "assets", "agriculture", name);
  if (!existsSync(dir)) return [];
  const caps = existsSync(join(dir, "captions.json")) ? JSON.parse(readFileSync(join(dir, "captions.json"), "utf8")) : {};
  const out = join(dist, "agriculture", "img", name);
  mkdirSync(out, { recursive: true });
  return readdirSync(dir).filter((f) => IMG.test(f)).sort().map((f) => {
    cpSync(join(dir, f), join(out, f));
    const c = caps[f] || {};
    return { src: `img/${name}/${f}`, caption: (typeof c === "string" ? c : c.caption) || "", credit: c.credit || "" };
  });
}
mkdirSync(join(dist, "agriculture", "img"), { recursive: true });
for (const f of readdirSync(join(here, "assets", "agriculture", "img"))) cpSync(join(here, "assets", "agriculture", "img", f), join(dist, "agriculture", "img", f));
const credits = Object.entries(JSON.parse(read("assets/agriculture/credits.json"))).map(([, c]) =>
  `${c.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")} — ${c.artist} · ${c.license} · Wikimedia Commons`);
credits.push("Satellite images: Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data), CC BY-NC-SA 4.0");
const assets = { ecofarm: photoSet("ecofarm"), field: photoSet("field"), credits };

// ---------- agriculture: bundle ----------
const js = await build({
  entryPoints: [join(here, "src/agriculture/main.js")],
  bundle: true, minify: true, format: "iife", target: "es2020", write: false, legalComments: "none",
  define: { __ASSETS__: JSON.stringify(assets) }
});
const agriJs = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const agriCss = fontCss + "\n" + read("src/agriculture/style.css") + "\n" + read("src/agriculture/scenes.css");
const agriHtml = read("src/agriculture/index.html")
  .replace("/*INLINE_CSS*/", () => agriCss)
  .replace("/*INLINE_JS*/", () => agriJs);
writeFileSync(join(dist, "agriculture", "index.html"), agriHtml);
console.log(`agriculture/index.html   ${kb(agriHtml)}  (js ${kb(agriJs)})`);

// ---------- slovakia: the original deck, unchanged, plus a small hub control ----------
const slovakDir = join(dist, "slovakia");
execFileSync(process.execPath, [join(here, "..", "erasmus-deck", "build.mjs"), "--out", slovakDir], { stdio: "inherit" });
const nav = read("src/hub/deck-nav.html");
const slovakPath = join(slovakDir, "index.html");
writeFileSync(slovakPath, readFileSync(slovakPath, "utf8").replace("</body>", () => nav + "\n</body>"));

// ---------- hub ----------
const hubHtml = read("src/hub/index.html").replace("/*FONTS*/", () => hubFontCss);
writeFileSync(join(dist, "index.html"), hubHtml);
console.log(`index.html (hub)         ${kb(hubHtml)}`);

writeFileSync(join(dist, "vercel.json"), JSON.stringify({ trailingSlash: true, cleanUrls: false }, null, 2) + "\n");
console.log("dist/ ready");
