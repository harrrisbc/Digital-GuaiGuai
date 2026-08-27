#!/usr/bin/env node
/**
 * Generates placeholder 乖乖 sprite sheet PNGs for v1.
 * Run: npm run generate-sprites
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/assets/sprites');

const FRAME_W = 96;
const FRAME_H = 128;

const COLORS = {
  bagGreen: [0x6d, 0xbf, 0x4a, 255],
  bagGreenDark: [0x4a, 0x9e, 0x2e, 255],
  mascotBlue: [0x3b, 0x7f, 0xd9, 255],
  mascotOrange: [0xf0, 0x78, 0x30, 255],
  bowYellow: [0xf0, 0xc0, 0x30, 255],
  whiteBox: [0xf8, 0xf8, 0xf8, 255],
  trafficGreen: [0x30, 0xd0, 0x30, 255],
  trafficAmber: [0xd0, 0xa0, 0x30, 255],
  trafficRed: [0xd0, 0x30, 0x30, 255],
  black: [0x1a, 0x1a, 0x1a, 255],
  skin: [0xf0, 0xc0, 0x90, 255],
  transparent: [0, 0, 0, 0],
};

function setPixel(buf, w, x, y, color) {
  if (x < 0 || y < 0 || x >= w) return;
  const i = (y * w + x) * 4;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}

function fillRect(buf, w, h, x, y, rw, rh, color) {
  for (let py = y; py < y + rh && py < h; py++) {
    for (let px = x; px < x + rw && px < w; px++) {
      setPixel(buf, w, px, py, color);
    }
  }
}

function drawFrame(buf, sheetW, frameIndex, anim) {
  const ox = frameIndex * FRAME_W;
  let sway = 0;
  if (anim === 'idle') sway = frameIndex % 2;

  // Bag body
  fillRect(buf, sheetW, FRAME_H, ox + 8 + sway, 16, 80, 96, COLORS.bagGreen);
  fillRect(buf, sheetW, FRAME_H, ox + 8 + sway, 96, 80, 16, COLORS.bagGreenDark);

  // Mascot
  fillRect(buf, sheetW, FRAME_H, ox + 36 + sway, 28, 24, 10, COLORS.mascotBlue);
  fillRect(buf, sheetW, FRAME_H, ox + 34 + sway, 38, 28, 22, COLORS.skin);
  fillRect(buf, sheetW, FRAME_H, ox + 40 + sway, 44, 4, 4, COLORS.black);
  fillRect(buf, sheetW, FRAME_H, ox + 52 + sway, 44, 4, 4, COLORS.black);
  fillRect(buf, sheetW, FRAME_H, ox + 30 + sway, 58, 36, 18, COLORS.mascotOrange);
  fillRect(buf, sheetW, FRAME_H, ox + 42 + sway, 62, 4, 4, COLORS.bowYellow);
  fillRect(buf, sheetW, FRAME_H, ox + 50 + sway, 62, 4, 4, COLORS.bowYellow);

  // Traffic light pole
  fillRect(buf, sheetW, FRAME_H, ox + 72 + sway, 48, 4, 28, COLORS.black);
  fillRect(buf, sheetW, FRAME_H, ox + 68 + sway, 40, 12, 32, COLORS.black);
  fillRect(buf, sheetW, FRAME_H, ox + 73 + sway, 44, 4, 4, anim === 'fall' ? COLORS.trafficAmber : COLORS.trafficRed);
  fillRect(buf, sheetW, FRAME_H, ox + 73 + sway, 52, 4, 4, COLORS.trafficAmber);
  fillRect(buf, sheetW, FRAME_H, ox + 73 + sway, 60, 4, 4, COLORS.trafficGreen);

  // 造句 white box
  fillRect(buf, sheetW, FRAME_H, ox + 14 + sway, 88, 68, 22, COLORS.whiteBox);

  if (anim === 'fall' && frameIndex === 2) {
    fillRect(buf, sheetW, FRAME_H, ox + 8 + sway, 100, 80, 12, COLORS.bagGreenDark);
  }
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const chunks = [
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ];

  return Buffer.concat([signature, ...chunks]);
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeSheet(filename, frameCount, anim) {
  const sheetW = FRAME_W * frameCount;
  const rgba = Buffer.alloc(sheetW * FRAME_H * 4, 0);
  for (let f = 0; f < frameCount; f++) {
    drawFrame(rgba, sheetW, f, anim);
  }
  const png = encodePng(sheetW, FRAME_H, rgba);
  writeFileSync(join(OUT_DIR, filename), png);
  console.log(`Wrote ${filename} (${frameCount} frames)`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeSheet('guaiguai-idle.png', 4, 'idle');
writeSheet('guaiguai-drag.png', 1, 'drag');
writeSheet('guaiguai-fall.png', 3, 'fall');
writeSheet('guaiguai-focus.png', 2, 'focus');
console.log('Done.');
