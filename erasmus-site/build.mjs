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
// Also:  dist/agriculture/presenter.html  presenter window (press P in the deck)
//        dist/agriculture/script.html     printable speaker script + presenter map
// Our own photos live in assets/agriculture/field (composting plant) and
// assets/agriculture/coop (farming cooperative); see tools/prepare_photos.py.

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { renderScript } from "./tools/render-script.mjs";

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

// ---------- agriculture: images ----------
// img/*.webp (Wikimedia + Sentinel-2), img/field/* (our visit to the composting
// plant), img/coop/* (photos the farming cooperative shared with us)
const imgOut = join(dist, "agriculture", "img");
mkdirSync(imgOut, { recursive: true });
for (const f of readdirSync(join(here, "assets", "agriculture", "img"))) cpSync(join(here, "assets", "agriculture", "img", f), join(imgOut, f));
for (const d of ["field", "coop"]) {
  const src = join(here, "assets", "agriculture", d);
  if (existsSync(src)) cpSync(src, join(imgOut, d), { recursive: true });
}
const credits = Object.entries(JSON.parse(read("assets/agriculture/credits.json"))).map(([, c]) =>
  `${c.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")} — ${c.artist} · ${c.license} · Wikimedia Commons`);
credits.push("Satellite images: Sentinel-2 cloudless 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data), CC BY-NC-SA 4.0");
const assets = { credits };

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

// ---------- agriculture: presenter window (P) ----------
const presenterHtml = read("src/agriculture/presenter.html").replace("/*FONTS*/", () => hubFontCss + "\n" + face("IBM Plex Sans", "normal", 500, `${PS}latin-500-normal.woff2`) + "\n" + face("IBM Plex Mono", "normal", 400, `${PM}latin-400-normal.woff2`));
writeFileSync(join(dist, "agriculture", "presenter.html"), presenterHtml);
console.log(`agriculture/presenter.html ${kb(presenterHtml)}`);

// ---------- agriculture: printable speaker script + presenter map ----------
const metaBuild = await build({ entryPoints: [join(here, "src/agriculture/meta.js")], bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const metaFile = join(here, ".meta.tmp.mjs");
writeFileSync(metaFile, metaBuild.outputFiles[0].text);
const { META } = await import(pathToFileURL(metaFile).href + "?t=" + Date.now());
rmSync(metaFile, { force: true });
const { SCRIPT, PRESENTERS } = await import(pathToFileURL(join(here, "src/agriculture/notes.js")).href);
const scriptHtml = renderScript(META, SCRIPT, PRESENTERS);
writeFileSync(join(dist, "agriculture", "script.html"), scriptHtml);
console.log(`agriculture/script.html  ${kb(scriptHtml)}`);

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
