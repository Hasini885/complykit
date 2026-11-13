// Packs extensions/gst-helper into public/downloads/gst-helper.zip, the file
// the site offers. Run after changing the extension: npm run zip:extension
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { zipSync } from "fflate";

const dir = "extensions/gst-helper";
const files = {};
for (const name of readdirSync(dir).sort()) files[`gst-helper/${name}`] = readFileSync(`${dir}/${name}`);
// A fixed date keeps the zip identical when nothing changed.
writeFileSync("public/downloads/gst-helper.zip", zipSync(files, { mtime: new Date(2026, 0, 1) }));
console.log(`packed ${Object.keys(files).length} files`);
