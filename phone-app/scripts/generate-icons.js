"use strict";
/**
 * Generates the PWA's icons as plain PNGs using only Node's built-in
 * zlib — no image libraries, no network fetches. A green circle (regular
 * icons, transparent background) and a maskable variant (opaque
 * background, smaller centered shape so Android's masking doesn't crop
 * it).
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

/** Draws a filled circle on RGBA (bg color under it, or transparent if bg is null). */
function circlePng(size, fg, bg, radiusRatio) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const cx = size / 2, cy = size / 2, radius = size * radiusRatio;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const inside = dx * dx + dy * dy <= radius * radius;
      const o = rowStart + 1 + x * 4;
      const color = inside ? fg : bg;
      if (color) {
        raw[o] = color[0]; raw[o + 1] = color[1]; raw[o + 2] = color[2]; raw[o + 3] = 255;
      } else {
        raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0;
      }
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const GREEN = [0x1a, 0x8a, 0x4f];
const DARK = [0x0f, 0x15, 0x12];

const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), circlePng(192, GREEN, null, 0.42));
fs.writeFileSync(path.join(outDir, "icon-512.png"), circlePng(512, GREEN, null, 0.42));
// Maskable: opaque background fill, shape kept within the ~safe zone.
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), circlePng(512, GREEN, DARK, 0.32));
console.log("Generated icons in", outDir);
