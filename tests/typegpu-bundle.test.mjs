import { test } from 'node:test';
import { transformFileSync, parseSync } from '@babel/core';
import path from 'node:path';

test('example Babel emits parseable JavaScript for TypeGPU namespace exports', () => {
  const result = transformFileSync(
    path.resolve('node_modules/typegpu/tgpu.js'),
    { configFile: path.resolve('example/babel.config.js'), babelrc: false },
  );
  parseSync(result.code, {
    configFile: false,
    babelrc: false,
    sourceType: 'script',
  });
});
