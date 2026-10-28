// Erzeugt die App-Icons (PNG + SVG) ohne externe Abhängigkeiten.
// Aufruf: node tools/icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const HINTERGRUND = [0, 66, 37];     // #004225 British Racing Green
const TELLER = [244, 239, 225];      // #f4efe1
const TELLER_INNEN = [201, 165, 90]; // Messing

// Formen in Einheitskoordinaten (0…1)
const kreis = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const rechteck = (x0, y0, x1, y1, r = 0) => (x, y) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return dx * dx + dy * dy <= r * r;
};
const oder = (...f) => (x, y) => f.some((g) => g(x, y));

const besteck = oder(
  // Gabel
  rechteck(0.143, 0.24, 0.155, 0.37, 0.006),
  rechteck(0.164, 0.24, 0.176, 0.37, 0.006),
  rechteck(0.185, 0.24, 0.197, 0.37, 0.006),
  rechteck(0.143, 0.35, 0.197, 0.42, 0.02),
  rechteck(0.158, 0.40, 0.182, 0.78, 0.012),
  // Messer
  rechteck(0.805, 0.24, 0.857, 0.53, 0.026),
  rechteck(0.818, 0.50, 0.844, 0.78, 0.013),
);

function farbeBei(x, y, vollflaechig) {
  const bg = vollflaechig ? true : rechteck(0, 0, 1, 1, 0.22)(x, y);
  if (!bg) return null;
  if (kreis(0.5, 0.51, 0.18)(x, y)) return TELLER_INNEN;
  if (kreis(0.5, 0.51, 0.25)(x, y) || besteck(x, y)) return TELLER;
  return HINTERGRUND;
}

function zeichne(groesse, vollflaechig) {
  const n = 4; // 4×4 Unterabtastung für glatte Kanten
  const daten = Buffer.alloc(groesse * (groesse * 4 + 1));
  for (let py = 0; py < groesse; py++) {
    daten[py * (groesse * 4 + 1)] = 0;
    for (let px = 0; px < groesse; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const f = farbeBei((px + (sx + 0.5) / n) / groesse, (py + (sy + 0.5) / n) / groesse, vollflaechig);
          if (f) { r += f[0]; g += f[1]; b += f[2]; a++; }
        }
      }
      const o = py * (groesse * 4 + 1) + 1 + px * 4;
      if (a) { daten[o] = r / a; daten[o + 1] = g / a; daten[o + 2] = b / a; }
      daten[o + 3] = Math.round((a / (n * n)) * 255);
    }
  }
  return png(groesse, groesse, daten);
}

const CRC = new Int32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function block(typ, inhalt) {
  const laenge = Buffer.alloc(4); laenge.writeUInt32BE(inhalt.length);
  const typUndInhalt = Buffer.concat([Buffer.from(typ), inhalt]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(typUndInhalt));
  return Buffer.concat([laenge, typUndInhalt, crc]);
}
function png(b, h, roh) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(b, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 Bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    block('IHDR', ihdr), block('IDAT', zlib.deflateSync(roh, { level: 9 })), block('IEND', Buffer.alloc(0)),
  ]);
}

const ziel = path.join(__dirname, '..', 'icons');
fs.mkdirSync(ziel, { recursive: true });
fs.writeFileSync(path.join(ziel, 'icon-192.png'), zeichne(192, false));
fs.writeFileSync(path.join(ziel, 'icon-512.png'), zeichne(512, false));
fs.writeFileSync(path.join(ziel, 'maskable-512.png'), zeichne(512, true));
fs.writeFileSync(path.join(ziel, 'apple-touch-icon.png'), zeichne(180, true));

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
fs.writeFileSync(path.join(ziel, 'icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${hex(HINTERGRUND)}"/>
  <circle cx="50" cy="51" r="25" fill="${hex(TELLER)}"/>
  <circle cx="50" cy="51" r="18" fill="${hex(TELLER_INNEN)}"/>
  <g fill="${hex(TELLER)}">
    <rect x="14.3" y="24" width="1.2" height="13" rx=".6"/><rect x="16.4" y="24" width="1.2" height="13" rx=".6"/><rect x="18.5" y="24" width="1.2" height="13" rx=".6"/>
    <rect x="14.3" y="35" width="5.4" height="7" rx="2"/><rect x="15.8" y="40" width="2.4" height="38" rx="1.2"/>
    <rect x="80.5" y="24" width="5.2" height="29" rx="2.6"/><rect x="81.8" y="50" width="2.6" height="28" rx="1.3"/>
  </g>
</svg>
`);
console.log('Icons erzeugt in', ziel);
