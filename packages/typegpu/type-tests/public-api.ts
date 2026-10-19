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
