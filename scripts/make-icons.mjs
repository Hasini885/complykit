// Builds the installed-app icons (PWA) from src/app/icon.svg.
// Run: node scripts/make-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url));
const out = (p) => new URL(`../${p}`, import.meta.url);
const BG = "#12131f";

const png = (size) => sharp(svg, { density: 1024 }).resize(size, size).png().toBuffer();

// Square, full-bleed versions (the logo already has rounded corners).
await writeFile(out("public/icons/icon-192.png"), await png(192));
await writeFile(out("public/icons/icon-512.png"), await png(512));

// Maskable: phones crop icons to their own shape, so the logo sits inside a
// safe zone on a solid background.
const inner = await png(360);
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("public/icons/maskable-512.png").pathname.replace(/^\/(\w:)/, "$1"));

// iPhone home screen icon (iOS adds its own rounded corners).
const apple = await png(150);
await sharp({ create: { width: 180, height: 180, channels: 4, background: BG } })
  .composite([{ input: apple, gravity: "center" }])
  .png()
  .toFile(out("src/app/apple-icon.png").pathname.replace(/^\/(\w:)/, "$1"));

console.log("icons written");
