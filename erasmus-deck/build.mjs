// Builds the Erasmus+ deck into one self-contained HTML file.
// Fonts, CSS, map data and JS are inlined so the deck also works offline;
// photos stay as separate files in public/erasmus/img.
//
//   node erasmus-deck/build.mjs                 -> public/erasmus/index.html
//   node erasmus-deck/build.mjs --fragment f    -> also writes a body-only copy to f

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = (p) => join(here, "src", p);
const read = (p) => readFileSync(src(p), "utf8");

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

const faces = [
  ["Manrope", "normal", "200 800", "manrope-latin-wght-normal.woff2", LATIN],
  ["Manrope", "normal", "200 800", "manrope-latin-ext-wght-normal.woff2", LATIN_EXT],
  ["Inter", "normal", "100 900", "inter-latin-wght-normal.woff2", LATIN],
  ["Inter", "normal", "100 900", "inter-latin-ext-wght-normal.woff2", LATIN_EXT],
  ["Instrument Serif", "italic", "400", "instrument-serif-latin-400-italic.woff2", LATIN],
  ["Instrument Serif", "italic", "400", "instrument-serif-latin-ext-400-italic.woff2", LATIN_EXT],
  ["Instrument Serif", "normal", "400", "instrument-serif-latin-400-normal.woff2", LATIN],
];

const fontCss = faces
  .map(([family, style, weight, file, range]) => {
    const b64 = readFileSync(src(join("fonts", file))).toString("base64");
    return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range}}`;
  })
  .join("\n");

const data =
  `window.DECK_MAP=${read("map-data.json").trim()};\n` +
  `window.DECK_CREDITS=${JSON.stringify(JSON.parse(read("credits.json")))};`;

const body = read("index.html")
  .replace("/*@FONTS@*/", () => fontCss)
  .replace("/*@CSS@*/", () => read("deck.css"))
  .replace("/*@DATA@*/", () => data)
  .replace("/*@JS@*/", () => read("deck.js"));

// Pull <title> and <meta> into <head> for the standalone document.
const headBits = [];
const rest = body.replace(/^(<title>[\s\S]*?<\/title>\s*|<meta[^>]*>\s*)+/, (m) => {
  headBits.push(m.trim());
  return "";
});
const styleMatch = rest.match(/^<style>[\s\S]*?<\/style>\s*/);
const style = styleMatch ? styleMatch[0].trim() : "";
const content = styleMatch ? rest.slice(styleMatch[0].length) : rest;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${headBits.join("\n")}
${style}
</head>
<body>
${content}</body>
</html>
`;

const outDir = join(here, "..", "public", "erasmus");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), full);
console.log(`public/erasmus/index.html  ${(full.length / 1024).toFixed(0)} KB`);

const i = process.argv.indexOf("--fragment");
if (i !== -1 && process.argv[i + 1]) {
  writeFileSync(process.argv[i + 1], body);
  console.log(`fragment -> ${process.argv[i + 1]}`);
}
