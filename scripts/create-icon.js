// יוצר SVG ומחליר אותו ל-PNG דרך sharp אם קיים, אחרת יוצר PNG ידני
const fs = require("fs");
const path = require("path");

const extDir = path.join(__dirname, "..", "extension");

// PNG 1x1 pixel שחור פשוט כ-placeholder
// בפועל נשתמש ב-SVG icon דרך manifest או נשתמש בקובץ PNG אמיתי
// ניצור PNG בסיסי עם Buffer ידני

function createMinimalPng(size, r, g, b) {
  // PNG header + IHDR + IDAT + IEND
  // Simple approach: use a base64 encoded small PNG
  const pngs = {
    16: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABOSURBVDiNY/z//z8DJYCJgUJAuQEsMFYDAxMDAwMDAwMDAwMDmA0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMAB6kBhPKCJjLAAAAAElFTkSuQmCC",
      "base64"
    ),
  };

  // יצירת PNG פשוט בגודל הנדרש
  // נשתמש ב-PNG signature + chunks
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crcData = Buffer.concat([typeBytes, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData));
    return Buffer.concat([length, typeBytes, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Create raw image data
  const zlib = require("zlib");
  const rowSize = size * 3;
  const rawData = Buffer.alloc(size * (rowSize + 1));
  for (let y = 0; y < size; y++) {
    rawData[y * (rowSize + 1)] = 0; // filter type none
    for (let x = 0; x < size; x++) {
      const i = y * (rowSize + 1) + 1 + x * 3;
      rawData[i] = r;
      rawData[i + 1] = g;
      rawData[i + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", ihdr), idat, iend]);
}

// כחול כהה #1e40af → R:30 G:64 B:175
const color = { r: 30, g: 64, b: 175 };

[16, 48, 128].forEach((size) => {
  const png = createMinimalPng(size, color.r, color.g, color.b);
  fs.writeFileSync(path.join(extDir, `icon${size}.png`), png);
  console.log(`Created icon${size}.png`);
});
