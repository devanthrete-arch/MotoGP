/**
 * Generates the branded 1200x630 Open Graph card at public/og-cover.png.
 *
 * Deliberately dependency-free: a minimal PNG encoder (zlib + CRC32) plus a
 * hand-rolled 5x7 bitmap font. No external image service is contacted at build
 * or at runtime, so the card ships with the static bundle and is served from
 * our own origin (which the CSP `img-src 'self'` already allows).
 *
 * Run: node scripts/generate-og-image.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 1200;
const HEIGHT = 630;

// Obsidian Velocity palette (must stay in sync with src/styles.css).
const SURFACE = [0x14, 0x13, 0x13];
const SURFACE_LIFT = [0x24, 0x23, 0x23];
const PRIMARY = [0xc7, 0xc6, 0xcb];
const ON_SURFACE = [0xe5, 0xe2, 0xe1];
const MUTED = [0x91, 0x90, 0x95];

const font = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
};

const pixels = new Uint8Array(WIDTH * HEIGHT * 3);

const clamp = (value) => (value < 0 ? 0 : value > 255 ? 255 : Math.round(value));

const blend = (x, y, colour, alpha = 1) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT || alpha <= 0) return;
  const offset = (y * WIDTH + x) * 3;
  for (let channel = 0; channel < 3; channel += 1) {
    const existing = pixels[offset + channel];
    pixels[offset + channel] = clamp(existing + (colour[channel] - existing) * Math.min(alpha, 1));
  }
};

const fillRect = (x, y, width, height, colour, alpha = 1) => {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) blend(column, row, colour, alpha);
  }
};

// --- Background: vertical gradient + off-centre glow + diagonal speed lines ---
for (let y = 0; y < HEIGHT; y += 1) {
  const verticalMix = y / HEIGHT;
  for (let x = 0; x < WIDTH; x += 1) {
    const horizontalMix = x / WIDTH;
    const lift = verticalMix * 0.55 + horizontalMix * 0.25;
    const offset = (y * WIDTH + x) * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[offset + channel] = clamp(SURFACE[channel] + (SURFACE_LIFT[channel] - SURFACE[channel]) * lift);
    }
  }
}

const glowX = 980;
const glowY = 150;
const glowRadius = 460;
for (let y = 0; y < HEIGHT; y += 1) {
  for (let x = 0; x < WIDTH; x += 1) {
    const distance = Math.hypot(x - glowX, y - glowY);
    if (distance > glowRadius) continue;
    const falloff = 1 - distance / glowRadius;
    blend(x, y, PRIMARY, falloff * falloff * 0.1);
  }
}

for (let line = -HEIGHT; line < WIDTH; line += 46) {
  for (let y = 0; y < HEIGHT; y += 1) {
    const x = line + Math.round(y * 0.55);
    const fade = 0.05 + (y / HEIGHT) * 0.05;
    blend(x, y, PRIMARY, fade);
    blend(x + 1, y, PRIMARY, fade * 0.6);
  }
}

// --- Text rendering -----------------------------------------------------------
const drawText = (text, x, y, scale, colour, letterSpacing = 1, alpha = 1) => {
  let cursor = x;
  for (const rawCharacter of text.toUpperCase()) {
    const glyph = font[rawCharacter] ?? font[" "];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((cell, columnIndex) => {
        if (cell !== "1") return;
        fillRect(cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, colour, alpha);
      });
    });
    cursor += (5 + letterSpacing) * scale;
  }
  return cursor - x;
};

const textWidth = (text, scale, letterSpacing = 1) => text.length * (5 + letterSpacing) * scale;

// --- Composition --------------------------------------------------------------
fillRect(88, 74, 34, 34, PRIMARY);
fillRect(96, 82, 18, 18, SURFACE);
drawText("AUTOFLEX", 146, 78, 5, ON_SURFACE, 2);

const footer = "LOCAL-FIRST · YOUR DATA STAYS YOURS";
drawText(footer, WIDTH - 88 - textWidth(footer, 3, 1), 84, 3, MUTED, 1);

drawText("OWNER NOTES", 88, 196, 13, ON_SURFACE, 1);
drawText("THAT SURVIVE", 88, 306, 13, PRIMARY, 1);

fillRect(88, 434, 240, 3, PRIMARY, 0.85);

drawText("GARAGE · KNOW YOUR VEHICLE · DOC VAULT", 88, 476, 4, MUTED, 1);
drawText("RUNNING COSTS · OWNER COMMUNITY · INDIA", 88, 524, 4, MUTED, 1);

// --- PNG encoding -------------------------------------------------------------
const crcTable = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = -1;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
};

const header = Buffer.alloc(13);
header.writeUInt32BE(WIDTH, 0);
header.writeUInt32BE(HEIGHT, 4);
header[8] = 8; // bit depth
header[9] = 2; // colour type: truecolour
header[10] = 0; // deflate
header[11] = 0; // adaptive filtering
header[12] = 0; // no interlace

const raw = Buffer.alloc(HEIGHT * (WIDTH * 3 + 1));
for (let y = 0; y < HEIGHT; y += 1) {
  const rowStart = y * (WIDTH * 3 + 1);
  raw[rowStart] = 0; // filter: none
  Buffer.from(pixels.buffer, y * WIDTH * 3, WIDTH * 3).copy(raw, rowStart + 1);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/og-cover.png");
writeFileSync(target, png);
console.log(`Wrote ${target} (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(1)} kB)`);
