import { createServer } from 'node:http';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const crc = (data) => {
  let c = 0xffffffff;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, sum]);
};
function png(quadrants = false, width = 32, height = 32) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4 + 1;
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const colors = quadrants
        ? [
            [229, 57, 53, 255],
            [0, 180, 0, 255],
            [36, 99, 235, 255],
            [255, 200, 0, 255],
          ]
        : [[0, 180, 220, 255]];
      rows.set(
        colors[
          quadrants ? (y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0) : 0
        ],
        y * stride + 1 + x * 4,
      );
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const image = png(true),
  tile = png(),
  wide = png(true, 50000, 2),
  requests = [],
  transport = [];
const directory = process.argv[2] ?? '/private/tmp/rendering-tiles';
for (let z = 0; z <= 4; z++)
  for (let x = 0; x < 2 ** z; x++)
    for (let y = 0; y < 2 ** z; y++) {
      const folder = `${directory}/${z}/${x}`;
      mkdirSync(folder, { recursive: true });
      writeFileSync(`${folder}/${y}.png`, tile);
    }
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/style.json') {
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        version: 8,
        sources: {},
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#ffffff' },
          },
        ],
      }),
    );
    return;
  }
  if (url.pathname === '/requests') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(requests));
    return;
  }
  if (url.pathname === '/transport') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(transport));
    return;
  }
  transport.push({ event: 'request', path: url.pathname, time: Date.now() });
  res.on('close', () =>
    transport.push({
      event: 'close',
      path: url.pathname,
      time: Date.now(),
      finished: res.writableFinished,
    }),
  );
  if (url.pathname === '/wide.png') {
    res.setHeader('Content-Type', 'image/png');
    res.end(wide);
    return;
  }
  if (url.pathname === '/corrupt') {
    res.end('invalid image data');
    return;
  }
  if (url.pathname === '/slow') {
    const delay = Number(url.searchParams.get('delay') ?? 1500);
    if (!Number.isFinite(delay) || delay < 0) {
      res.writeHead(400);
      res.end();
      return;
    }
    const timer = setTimeout(() => {
      res.setHeader('Content-Type', 'image/png');
      res.end(image);
    }, delay);
    res.on('close', () => clearTimeout(timer));
    return;
  }
  requests.push(url.pathname + url.search);
  if (requests.length > 1024) requests.shift();
  if (url.pathname === '/image.png' || url.pathname === '/wms') {
    res.setHeader('Content-Type', 'image/png');
    res.end(url.pathname === '/image.png' ? image : tile);
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(
  Number(process.env.ENHANCED_MAPS_FIXTURE_PORT ?? 8102),
  '0.0.0.0',
  () =>
    console.log(
      `Rendering fixture on ${process.env.ENHANCED_MAPS_FIXTURE_PORT ?? 8102}; local tiles in ${directory}`,
    ),
);
