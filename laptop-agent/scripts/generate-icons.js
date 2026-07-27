"use strict";
/**
 * Generates the tray/app icons as plain PNGs using only Node's built-in
 * zlib — no image libraries, no network fetches. Produces a solid-color
 * circle on a transparent background at a couple of sizes:
 *   - assets/icon.png            (512x512 app icon, green)
 *   - assets/tray-connected.png  (32x32, green  = connected & allowed)
 *   - assets/tray-blocked.png    (32x32, red    = internet blocked)
 *   - assets/tray-disconnected.png (32x32, gray = no server connection)
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
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

/** Draws a filled circle of [r,g,b] on transparent RGBA, PNG-encodes it. */
function circlePng(size, [r, g, b]) {
  const raw = Buffer.alloc(size * (1 + size * 4)); // +1 filter byte per row
  const cx = size / 2, cy = size / 2, radius = size * 0.42;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const inside = dx * dx + dy * dy <= radius * radius;
      const o = rowStart + 1 + x * 4;
      if (inside) {
        raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
      } else {
        raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0;
      }
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const GREEN = [0x1a, 0x8a, 0x4f];
const RED = [0xc9, 0x38, 0x2b];
const GRAY = [0x8a, 0x8a, 0x8a];

const outDir = path.join(__dirname, "..", "assets");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon.png"), circlePng(512, GREEN));
fs.writeFileSync(path.join(outDir, "tray-connected.png"), circlePng(32, GREEN));
fs.writeFileSync(path.join(outDir, "tray-blocked.png"), circlePng(32, RED));
fs.writeFileSync(path.join(outDir, "tray-disconnected.png"), circlePng(32, GRAY));
console.log("Generated icons in", outDir);
