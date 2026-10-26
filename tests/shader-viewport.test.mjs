import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  expandShaderCamera,
  shaderViewportPadding,
  scaleShaderCamera,
} from '../packages/maps/lib/shaderViewport.js';
test('viewport guard band adds coverage at unchanged physical pixel density', () => {
  const camera = [
    0.49, 0.49, 0.51, 0.51, 12, 800, 600, 0.5, 0.5, 100, 0, 0, 0, -100, 0, 0, 0,
    1, 0.01, 0, 0, 0, -0.01, 0, 0, 0, 1,
  ];
  const expanded = expandShaderCamera(camera, 128);
  assert.equal(expanded[5], 1056);
  assert.equal(expanded[6], 856);
  assert.equal(expanded[9] * expanded[5], camera[9] * camera[5]);
  assert.equal(expanded[13] * expanded[6], camera[13] * camera[6]);
  assert.ok(expanded[0] < camera[0] && expanded[2] > camera[2]);
  assert.deepEqual(camera.slice(5, 7), [800, 600]);
  assert.equal(shaderViewportPadding(800, 600), 150);
  assert.equal(shaderViewportPadding(4000, 3000), 48);
});

test('viewport resolution scale preserves coverage while reducing output pixels', () => {
  const camera = [
    0.49, 0.49, 0.51, 0.51, 12, 800, 600, 0.5, 0.5, 100, 0, 0, 0, -100, 0, 0, 0,
    1, 0.01, 0, 0, 0, -0.01, 0, 0, 0, 1,
  ];
  const scaled = scaleShaderCamera(camera, 0.75);
  assert.deepEqual(scaled.slice(5, 7), [600, 450]);
  assert.deepEqual(scaled.slice(9), camera.slice(9));
  assert.deepEqual(scaled.slice(0, 5), camera.slice(0, 5));
  assert.deepEqual(camera.slice(5, 7), [800, 600]);
});
