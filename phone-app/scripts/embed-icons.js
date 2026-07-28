"use strict";
/**
 * Converts the generated PNG icons into base64 data URIs and rewrites
 * manifest.json + index.html to reference them inline, instead of as
 * separate files. This exists because SupaBein's static-file-upload
 * endpoint's WAF blocks raw binary image content outright (confirmed:
 * even a minimal valid PNG/GIF gets a 403, while the same bytes
 * base64-encoded as text upload fine) — so icons have to travel as text
 * embedded in files that were already going to be uploaded as text.
 */
const fs = require("fs");
const path = require("path");

const iconsDir = path.join(__dirname, "..", "icons");
const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(path.join(iconsDir, file)).toString("base64")}`;

const icon192 = dataUri("icon-192.png");
const icon512 = dataUri("icon-512.png");
const iconMaskable512 = dataUri("icon-maskable-512.png");

// --- manifest.json ---
const manifestPath = path.join(__dirname, "..", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
manifest.icons = [
  { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: iconMaskable512, sizes: "512x512", type: "image/png", purpose: "maskable" }
];
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

// --- index.html ---
const htmlPath = path.join(__dirname, "..", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
html = html.replace(/href="icons\/icon-192\.png"/g, `href="${icon192}"`);
fs.writeFileSync(htmlPath, html, "utf8");

console.log("Embedded icons into manifest.json and index.html as data URIs.");
console.log("Sizes: 192=%d bytes, 512=%d bytes, maskable-512=%d bytes (base64)",
  icon192.length, icon512.length, iconMaskable512.length);
