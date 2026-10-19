import type { MapGpuFrame, MapGpuStatus, CreateMapGpuRenderer } from '../src/index.js';
const lost: MapGpuStatus = { state: 'error', code: 'device-lost', message: 'device reset' };
void lost;
// @ts-expect-error errors carry a reason
const invalid: MapGpuStatus = { state: 'error' };
void invalid;
declare const frame: MapGpuFrame;
// @ts-expect-error frame values are immutable
frame.widthPixels = 100;
declare const create: CreateMapGpuRenderer;
// @ts-expect-error renderer construction requires a real TypeGPU root
create({});

import type { TriangleRasterOptions } from '../src/index.js';
const triangle: TriangleRasterOptions = { bounds: { north: 53, south: 52, west: 20, east: 21 }, color: [0, 0.5, 1, 0.65] };
void triangle;
// @ts-expect-error alpha is required in the shader color tuple
const missingAlpha: TriangleRasterOptions = { bounds: triangle.bounds, color: [0, 0.5, 1] };
void missingAlpha;
