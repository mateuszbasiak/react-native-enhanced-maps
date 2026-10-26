import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createShaderControlChannel } from '../packages/maps/lib/shaderControl.js';
import {
  runShaderRecovery,
  releaseShaderResources,
} from '../packages/maps/lib/shaderRecovery.js';

// Exercise the component's actual async orchestration, with controllable external
// boundaries. GPU correctness and native transport still need runtime acceptance.
const compiled = ts.transpileModule(
  readFileSync(
    new URL('../packages/maps/src/ShaderLayer.tsx', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function fixture(boundary) {
  const reached = deferred(),
    proceed = deferred(),
    finished = deferred();
  const events = [],
    refs = [],
    effects = [];
  let listener,
    control,
    usedGate = false;
  const gate = async (stage) => {
    events.push(stage);
    if (stage === boundary && !usedGate) {
      usedGate = true;
      reached.resolve();
      await proceed.promise;
    }
  };
  const resource = (name) => ({
    destroy: () => events.push(`destroy:${name}`),
  });
  const device = {
    importSharedTextureMemory: () => ({
      ...resource('memory'),
      createTexture: () => resource('texture'),
    }),
    createShaderModule: () => ({
      getCompilationInfo: async () => {
        await gate('compile');
        return { messages: [] };
      },
    }),
    createBindGroupLayout: () => ({}),
    createPipelineLayout: () => ({}),
    createRenderPipelineAsync: async () => {
      await gate('pipeline');
      return {};
    },
    createComputePipelineAsync: async () => {
      await gate('compute');
      return {};
    },
    createBuffer: () => resource('buffer'),
    createBindGroup: () => ({}),
    queue: { onSubmittedWorkDone: async () => events.push('queue-drained') },
    destroy: () => events.push('destroy:device'),
  };
  const host = {
    ready: true,
    request: async ({ action }) => {
      await gate(action);
    },
  };
  const original = () => [1];
  const props = {
    id: 'interrupted',
    shaders: {
      fragment: 'fragment',
      ...(boundary === 'compute' ? { compute: 'compute' } : {}),
    },
    uniforms: original,
    onReady: () => events.push('ready'),
    onError: (error) => events.push(`error:${error.message}`),
  };
  const modules = {
    react: {
      useContext: () => host,
      useMemo: (factory) => factory(),
      useEffect: (effect) => effects.push(effect),
      useRef: (current) => {
        const ref = { current };
        refs.push(ref);
        return ref;
      },
    },
    'react-native': {
      AppState: {
        currentState: 'active',
        addEventListener: (_, callback) => {
          listener = callback;
          return { remove: () => events.push('unsubscribe') };
        },
      },
      NativeModules: {
        EMShaderLayer: {
          install: () => true,
          create: async () => {
            await gate('pool');
            return { id: 'pool', handles: ['1'], format: 'rgba8unorm' };
          },
          release: async () => events.push('release:pool'),
        },
      },
    },
    './shaderContext': { ShaderMapContext: {} },
    './shaderControl': { createShaderControlChannel },
    './shaderRuntime': { getShaderRuntime: (create) => create() },
    './shaderDevice': {
      shaderDevices: {
        acquire: async () => {
          await gate('device');
          return {
            device,
            release: () => events.push('release:device'),
            invalidate: () => events.push('invalidate'),
          };
        },
      },
    },
    './shaderRecovery': { runShaderRecovery, releaseShaderResources },
    './shaderContract': {
      validateShaderOptions: () => {},
      packShaderGrid: () => ({ metadata: [], values: [] }),
      shaderAtlasSize: 1024,
      shaderGridPrelude: '',
      defaultShaderVertex: 'vertex',
      shaderPrelude: '',
    },
    'react-native-webgpu': {
      GPUTextureUsage: { RENDER_ATTACHMENT: 1 },
      GPUShaderStage: { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 },
      GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, STORAGE: 4 },
    },
    'react-native-worklets': {
      isWorkletFunction: (fn) => fn === original,
      createSynchronizable: (value) => {
        const synchronized = {
          value,
          setBlocking: (update) => {
            synchronized.value =
              typeof update === 'function'
                ? update({
                    ...synchronized.value,
                    uniforms: () => {
                      throw new Error('Remote Function');
                    },
                  })
                : update;
            if (synchronized.value.stopped) finished.resolve();
          },
        };
        if ('uniforms' in value) control = synchronized;
        return synchronized;
      },
      createWorkletRuntime: () => ({}),
      scheduleOnRuntime: (_, worklet) => worklet(),
      scheduleOnRN: (callback, ...args) => callback(...args),
    },
    './shaderWorklet': {
      runShaderFrames: async () => {
        await gate('running');
        await finished.promise;
      },
    },
  };
  const context = vm.createContext({
    exports: {},
    __DEV__: true,
    setTimeout,
    clearTimeout,
    __enhancedMapsShader: { open: () => ({}) },
    require: (name) => {
      assert.ok(name in modules, `Unexpected dependency ${name}`);
      return modules[name];
    },
  });
  new vm.Script(compiled).runInContext(context);
  context.exports.ShaderLayer(props);
  effects[0]();
  effects[1]();
  const dispose = effects[2]();
  return {
    reached: reached.promise,
    release: proceed.resolve,
    dispose,
    events,
    settled: () => refs[2].current,
    activity: (state) => listener(state),
    uniforms: () => control.value.uniforms,
    original,
  };
}
for (const boundary of [
  'device',
  'pool',
  'compile',
  'pipeline',
  'compute',
  'attach',
  'running',
]) {
  test(
    `disposal during ${boundary} balances ownership without stale callbacks`,
    { timeout: 3000 },
    async () => {
      const f = fixture(boundary);
      await f.reached;
      f.dispose();
      f.dispose();
      f.release();
      await f.settled();
      assert.equal(
        f.events.filter((event) => event === 'release:device').length,
        1,
      );
      assert.equal(
        f.events.filter((event) => event === 'release:pool').length,
        boundary === 'device' ? 0 : 1,
      );
      const imports = boundary === 'device' ? 0 : 1;
      assert.equal(
        f.events.filter((event) => event === 'destroy:texture').length,
        imports,
      );
      assert.equal(
        f.events.filter((event) => event === 'destroy:memory').length,
        imports,
      );
      assert.ok(
        f.events.indexOf('queue-drained') < f.events.indexOf('release:device'),
      );
      assert.equal(
        f.events.filter((event) => event === 'remove').length,
        ['attach', 'running'].includes(boundary) ? 1 : 0,
      );
      assert.equal(
        f.events.filter((event) => event === 'ready').length,
        boundary === 'running' ? 1 : 0,
      );
      assert.ok(!f.events.some((event) => event.startsWith('error:')));
      assert.ok(!f.events.includes('invalidate'));
    },
  );
}
test(
  'activity changes preserve the original callback across JS deserialization',
  { timeout: 3000 },
  async () => {
    const f = fixture('running');
    await f.reached;
    f.activity('background');
    assert.equal(f.uniforms(), f.original);
    f.activity('active');
    assert.equal(f.uniforms(), f.original);
    f.dispose();
    f.release();
    await f.settled();
  },
);
