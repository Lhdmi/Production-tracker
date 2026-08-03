import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const BG = hex("0f172a");
const INNER = hex("1e293b");
const AMBER = hex("fbbf24");
const WHITE = hex("f8fafc");

function roundedRect(x, y, w, h, r, px, py) {
  const cx = Math.max(x + r, Math.min(px, x + w - r));
  const cy = Math.max(y + r, Math.min(py, y + h - r));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function circle(cx, cy, r, px, py) {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function rect(x, y, w, h, px, py) {
  return px >= x && px < x + w && py >= y && py < y + h;
}

function pixel(x, y, size) {
  const s = size / 512;
  const inside = roundedRect(0, 0, size, size, 112 * s, x, y);
  if (!inside) return [0, 0, 0, 0];
  if (!roundedRect(96 * s, 96 * s, 320 * s, 320 * s, 56 * s, x, y)) return [...BG, 255];
  const col = x / s;
  const row = y / s;
  if (rect(248 * s, 330 * s, 16 * s, 110 * s, x, y)) return [...WHITE, 255];
  if (circle(256 * s, 444 * s, 26 * s, x, y)) return [...WHITE, 255];
  if (circle(256 * s, 250 * s, 120 * s, x, y)) return [...AMBER, 255];
  if (circle(256 * s, 250 * s, 58 * s, x, y)) return [...INNER, 255];
  if (circle(256 * s, 250 * s, 44 * s, x, y)) return [...BG, 255];
  return [...INNER, 255];
}

for (const size of [192, 512]) {
  writeFileSync(path.join(outDir, `icon-${size}.png`), encodePng(size, pixel));
  console.log(`✓ icon-${size}.png`);
}
