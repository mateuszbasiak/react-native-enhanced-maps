// Deterministic local imagery for the Debug UrlTile scenario; no external tiles.
import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
const crc32 = (data) => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function png(color) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(256);
  header.writeUInt32BE(256, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(256 * 1025);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const index = y * 1025 + 1 + x * 4;
      rows.set([...color, 255], index);
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const images = { red: png([229, 57, 53]), blue: png([36, 99, 235]) };
const requests = [];
const style = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#ffffff' },
    },
  ],
};
createServer((request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (path === '/style.json') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(style));
    return;
  }
  if (path === '/requests') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(requests));
    return;
  }
  const match = /^\/(red|blue)\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(path);
  if (!match) {
    response.writeHead(404);
    response.end();
    return;
  }
  requests.push({
    variant: match[1],
    z: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4]),
  });
  if (requests.length > 2048) requests.shift();
  response.setHeader('Content-Type', 'image/png');
  response.end(images[match[1]]);
}).listen(8099, '0.0.0.0', () =>
  console.log('UrlTile fixture listening on port 8099'),
);
