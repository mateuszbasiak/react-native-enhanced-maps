import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
// Deterministic local style: an opaque red sprite symbol at (0,0) tests label
// placement without remote fonts, tiles, credentials or changing map styles.
const port = Number(process.argv[2] ?? 8107);
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, bytes) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
function sprite(size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const offset = y * (size * 4 + 1) + 1 + x * 4;
      pixels[offset] = 255;
      pixels[offset + 3] = 255;
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
createServer((request, response) => {
  const path = request.url.split('?')[0];
  if (path === '/style.json') {
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        version: 8,
        sprite: `http://localhost:${port}/sprite`,
        sources: {
          reference: {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'Point', coordinates: [0, 0] },
                },
              ],
            },
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#ffffff' },
          },
          {
            id: 'reference-label',
            type: 'symbol',
            source: 'reference',
            layout: { 'icon-image': 'reference', 'icon-allow-overlap': true },
          },
        ],
      }),
    );
  } else if (path === '/sprite.json' || path === '/sprite@2x.json') {
    const scale = path.includes('@2x') ? 2 : 1;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        reference: {
          x: 0,
          y: 0,
          width: 32 * scale,
          height: 32 * scale,
          pixelRatio: scale,
        },
      }),
    );
  } else if (path === '/sprite.png' || path === '/sprite@2x.png') {
    response.setHeader('Content-Type', 'image/png');
    response.end(sprite(path.includes('@2x') ? 64 : 32));
  } else {
    response.writeHead(404);
    response.end();
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Shader reference style listening on ${port}`),
);
