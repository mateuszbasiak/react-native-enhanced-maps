# Map GPU layer API contract — proposal

This is an earlier design proposal. The currently implemented experimental component
is documented in [ShaderLayer](shader-layer.md); its bounded contract differs from
the broader renderer API below.

Status: design draft, 2026-10-21. Nothing in this document is an implemented public
API. Names/package paths below are proposed. This replaces the earlier proposed
mandatory WGSL-to-Metal/GLES build step **if** the React Native WebGPU integration
passes the [feasibility conditions](react-native-webgpu-investigation.md).

## 1. Requirements and division of responsibility

Programmers write one WebGPU renderer for iOS and Android. WGSL is accepted
through standard `GPUDevice.createShaderModule`; TypeGPU is optional for typed
shader authoring. No application-authored Metal/GLES duplicate is required.

`react-native-webgpu` supplies the WebGPU device, shader compiler, resources and
command API. The map package supplies a dedicated scheduling runtime, shared
output targets, native synchronization, projection and style-layer composition.
The application supplies its pipelines, data, simulation and effect logic.

The initial presentation contract is a 2D geographic texture layer. A programmer
can encode compute, particle simulation and multiple intermediate passes inside
the renderer, then produce its final image. MapLibre renders that image in its
own layer stack. This does not expose the map's framebuffer, depth, encoder,
basemap pixels, terrain or arbitrary geographic 3D vertices.

The same behavior is required on supported iOS/Android devices. Availability
still depends on hardware, shared-memory features and device limits. Unsupported
operations reject explicitly; there is no CPU-readback fallback.

## 2. Packaging

Proposed imports:

```ts
import MapView from 'react-native-enhanced-maps';
import { GpuLayer, defineGpuLayer } from '@react-native-enhanced-maps/gpu';
```

The GPU companion requires tested, pinned-compatible `react-native-webgpu` and
`react-native-worklets` peers. Reanimated is not required. Core maps does not
acquire a runtime npm dependency on WebGPU. TypeGPU is an optional application
choice. Package ownership and exact peer/version ranges remain release work.

There is no visible WebGPU Canvas over the map. Neither the application nor its
renderer calls `GPUCanvasContext.present()` for a managed map layer.

## 3. Renderer definition

```ts
export interface GpuLayerSetup<Inputs> {
  readonly device: GPUDevice;
  readonly format: GPUTextureFormat;
  readonly initialInputs: Readonly<Inputs>;
  readonly signal: AbortSignal;
}

export interface GpuLayerFrame<Inputs> {
  readonly encoder: GPUCommandEncoder;
  readonly output: GPUTextureView;
  readonly outputSize: readonly [width: number, height: number];
  readonly timeSeconds: number;
  readonly deltaSeconds: number;
  readonly inputs: Readonly<Inputs>;
  readonly inputRevision: number;
}

export interface GpuLayerInstance<Inputs> {
  encode(frame: GpuLayerFrame<Inputs>): void;
  dispose(): void;
}

export interface GpuLayerDefinition<Inputs> {
  readonly name: string;
  readonly requiredFeatures?: readonly GPUFeatureName[];
  readonly requiredLimits?: Readonly<Record<string, number>>;
  readonly create: (
    context: GpuLayerSetup<Inputs>,
  ) => GpuLayerInstance<Inputs> | Promise<GpuLayerInstance<Inputs>>;
}

// Returns an opaque, immutable definition with a phantom input type.
export declare function defineGpuLayer<Inputs>(
  definition: GpuLayerDefinition<Inputs>,
): GpuLayerDefinition<Inputs>;
```

The implementation's returned definition must be branded; accepting structurally
similar arbitrary objects is not required. `defineGpuLayer` must preserve the
input type. The component infers inputs from its definition only, using
`NoInfer<Inputs>` for its `inputs` prop to prevent conflicting inference.

Define the renderer at module scope. `create` runs once per instance/generation
on the dedicated GPU runtime. Its functions and captures must be transferable
under the pinned Worklets version. Strings, numbers, supported typed arrays and
worklet functions are allowed. Arbitrary React closures, DOM objects and objects
from another graphics library are not automatically transferable.

The host creates the device on the main runtime for device-loss/error delivery,
then transfers it to the GPU runtime. Setup, per-frame encoding and resource
mutation have one designated runtime owner. The host's internal AbortSignal must
be implemented inside that runtime; it is not a DOM object captured from React.

`encode` is synchronous, creates/ends its pass encoders using `frame.encoder`,
and fully initializes the output each published frame. The application may
clear it to transparent. It must not submit or finish the borrowed encoder,
retain the output beyond that frame, map the output to CPU memory, or create
another WebGPU device for this layer. The host finishes/submits the encoder and
performs output handoff. Regular `queue.writeBuffer`/`writeTexture` uploads on
the supplied device are allowed; no outstanding asynchronous upload may race
publication of a frame that depends on it.

Persistent buffers/textures/pipelines belong to the renderer instance. Its
`dispose` releases its own resources exactly once after encoding has stopped.
The host alone owns output textures, shared-memory objects, fences, map objects
and the device. Renderer code must not destroy those objects. Late asynchronous
setup completion is disposed and cannot publish into a retired generation.

## 4. Map component

```ts
export interface GeographicBounds {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

export interface GpuLayerProps<Inputs> {
  readonly id: string;
  readonly renderer: GpuLayerDefinition<Inputs>;
  readonly inputs: Readonly<NoInfer<Inputs>>;
  readonly bounds: GeographicBounds;
  readonly beforeId?: string;
  readonly visible?: boolean; // default true
  readonly paused?: boolean; // default false
  readonly opacity?: number; // default 1; native composition multiplier
  readonly maxFrameRate?: number; // default 60, requested cap 1..120
  readonly resolution?: readonly [width: number, height: number]; // default 512²
  readonly onStatus?: (event: GpuLayerStatus) => void;
  readonly onError?: (error: GpuLayerError) => void;
}
```

`id` is map-local, stable and unique across package/style layers; collisions
reject. `bounds` must be finite, north > south and east > west, within Mercator
latitude ±85.05112878 degrees and longitude ±180 degrees, with span <=180 degrees.
The initial contract rejects antimeridian crossing instead of choosing a wrap.

`resolution` is explicit physical texture pixels, independent of React layout
points/device density. Initial dimensions are integers 1..2048, within device
limits. An unchanged resolution does not allocate on camera movement. These are
proposed allocation ceilings, not measured performance budgets. There are at
most three output buffers per layer and 64 MiB of output storage per map;
allocation beyond the map budget rejects. Padding/driver allocation can exceed
width × height × bytes-per-pixel and must be accounted for. This does not impose
a hard quota on arbitrary resources allocated directly by application GPU code.

`opacity` is finite in [0,1]. `maxFrameRate` is an upper bound, not a frame-rate
guarantee; actual display rate, worklet scheduling, GPU workload and availability
can lower it. Device limits apply to all programmable passes.

`beforeId` inserts the native compositor before an existing style/package layer;
omission puts it above existing style layers. An absent target is an error;
there is no silent fallback to the top. A later target removal suspends the GPU
layer until the target exists again. No ordering against view-based native
markers is implied: iOS annotation markers remain above the map render surface.

## 5. Inputs and types

TypeScript checks the `Inputs` contract. Example:

```ts
interface WindInputs {
  speed: number;
  tint: readonly [number, number, number, number];
}

// Defined in wind.ts. Its implementation uses ordinary WebGPU calls and WGSL.
const wind = defineGpuLayer<WindInputs>({
  name: 'wind',
  create: createWindRenderer, // a transferable/worklet factory
});

// Inside MapView:
<GpuLayer
  id="wind"
  renderer={wind}
  bounds={{ north: 55, south: 54, west: 18, east: 20 }}
  beforeId="waterway_line_label"
  inputs={{ speed: 1.5, tint: [0.1, 0.5, 1, 0.7] }}
/>;
```

`speed: 'fast'`, missing fields and incorrect tuple shapes must fail type tests.
A raw WGSL string is compiler-validated shader code, not TypeScript-typed shader
logic. TypeGPU may build pipelines from the supplied device (`tgpu.initFromDevice`
was verified in TypeGPU 0.12.8 during investigation; TypeGPU is no longer installed), but TypeGPU object/worklet compatibility
must be verified. Do not create a TypeGPU root/device on React and assume all
library objects can be transferred to the GPU runtime.

Input packets are immutable snapshots of finite numbers, booleans, strings,
plain objects/arrays and supported numeric typed arrays. Functions, cyclic
objects, GPU HostObjects and raw native handles are excluded from `inputs`.
GPU objects are created/owned inside setup instead. Initial limits: 64 KiB
ordinary metadata and 16 MiB typed-array bytes per update, depth <=16; invalid
packets reject before replacing accepted inputs. These are transport limits,
not a shader ABI or a generic serializer guarantee.

Unchanged immutable references are not resent. New snapshots are normalized;
accepted input revisions increase monotonically. Pending updates coalesce to
the newest whole snapshot. `encode` sees one complete revision per frame; it
never sees half of a React update. The renderer uploads changed resources based
on `inputRevision`; the host does not implicitly upload every input every frame.
Renderer-specific relationships, such as field dimensions versus array length,
are validated during setup/encoding and reported as renderer errors.

## 6. Coordinates, color and clock

The output image is north-up in geographic space: UV (0,0) is northwest and (1,1)
is southeast, linear in Web Mercator coordinates, not in latitude. Uniformly
spaced latitude/longitude grids need explicit resampling or coordinate conversion
in the shader. Native composition handles geographic projection, camera tilt,
rotation, viewport resize and map padding at draw time.

The shader is not given the native map encoder or SDK matrix. This avoids
per-frame main-JS camera transport and stale screen-space projection. Effects
requiring basemap pixels, shared depth or frame-exact camera-dependent simulation
are outside this presentation contract. They need a separate mode/design.

The host supplies the actual output format in `setup.format`; the renderer uses
it for its WebGPU pipeline target rather than hardcoding BGRA/RGBA. Both backends
must agree on logical linear RGBA, premultiplied alpha and native composition's
color conversion. Formats/origins/sRGB behavior must pass explicit fixtures;
unchecked platform defaults are not an accepted implementation.

`timeSeconds` starts at zero on first activation. It advances only while visible,
unpaused and the app is active. `deltaSeconds` is zero on first/resumed frame and
otherwise capped at 0.1 seconds. Native/worklet timestamps use a monotonic clock.
Camera-only redraws reuse the last completed texture and do not advance the
simulation. The host does not replay missed frames or catch up after background.
A deterministic simulation may implement bounded fixed steps inside `encode`.

Pause/hidden/background keeps the last completed output but stops producer
scheduling. A newly created paused layer gets one initialization frame at time
zero. Input changes while paused request one redraw with delta zero. Hidden
layers defer it until visible. Remount resets instance state/time; compatible
hot replacement preserves host time but recreates renderer-owned simulation.

## 7. Scheduling and native handoff

A dedicated GPU runtime is required for the main-JS-contention target; running
application encoding on the UI thread is not the performance baseline. Installing
WebGPU on a worklet does not itself provide a clock: the package must supply and
verify display scheduling and lifecycle cancellation.

The package obtains a free output, begins WebGPU access, invokes `encode`,
submits, ends access and passes the completion fence to its native compositor.
Native sampling starts only after the producer's fence. A buffer cannot be
written again until all native readers have finished and it is no longer the
retained front image. GPU waits must be encoded at a legal pre-pass boundary.
Native handles and fences never cross the public API.

At most one encoding job per layer is scheduled at once. When no output is free,
skip that tick. Publish the newest completed image, retain the previous one when
late, and discard obsolete ready outputs. No CPU pixel readback, unbounded job
queues, per-frame React renders or whole-source serialization are permitted.
Shared memory avoids CPU copies; offscreen rendering, sampling and fence traffic
still have a GPU cost. No frame-perfect/FPS claim is implied by this contract.

## 8. Live code updates

WGSL strings are regular imported JS/TS module values; Metro observes edits.
No Naga watcher/manual shader build is required with this runtime. TypeGPU uses
its required Babel transform when that authoring option is selected.

A new renderer definition under the same layer ID prepares a candidate instance
and first output while the old one remains displayed. Ordinary React renders
with the same definition do not rebuild resources. A replacement is committed
atomically only after its first completed output is valid. Failure reports an
error and retains the old instance/output. Commit retires old jobs/resources
once native reads finish; newer replacements invalidate older candidates.

Preserve inputs, geographic placement and host clock across replacement.
Renderer-owned simulation is reinitialized; preserving arbitrary buffers across
shader changes is not promised. Resolution changes also prepare a new pool,
subject to the combined live/candidate budget. There is at most one candidate;
rapid edits coalesce to the newest definition. Native adapter changes require
an app rebuild. Fast Refresh behavior and error reporting are acceptance tests,
not existing prototype features.

## 9. Status, failure and lifetime

```ts
export interface GpuLayerStatus {
  readonly id: string;
  readonly state:
    'initializing' | 'ready' | 'updating' | 'suspended' | 'unavailable';
  readonly generation: number;
  readonly displayingPrevious: boolean;
}

export interface GpuLayerError {
  readonly id: string;
  readonly generation: number;
  readonly code:
    | 'unsupported'
    | 'inputs'
    | 'budget'
    | 'shader'
    | 'pipeline'
    | 'renderer'
    | 'interop'
    | 'device-lost'
    | 'placement';
  readonly message: string;
  readonly recoverable: boolean;
}
```

Ready means the first valid output can be sampled, not merely command acceptance.
Events are transition/error based, not frame telemetry. Status callbacks run on
React's JS runtime and may be delayed while it is blocked. Device-loss events in
the installed WebGPU runtime also arrive on main JS; immediate recovery during a
main-JS stall is not promised. The ordinary map remains operational.

Unmount/style replacement/remount/context loss retires the associated native
generation and cancels outstanding work. Results carry map/style/renderer
revisions and cannot publish into another generation. After style reload, replay
accepted descriptors and re-resolve `beforeId`; GPU/renderer state restoration
is best effort and may initialize again. Setup cancellation is cooperative;
abort does not mean the GPU has stopped. Native fences govern final release.

Expected unsupported hardware returns unavailable. No invisible software-GPU or
CPU-readback substitute is allowed. Recovery recreates device-bound resources;
no stale WebGPU handle may survive a lost device. Failure of one renderer must
not invalidate the ordinary map; actual device loss can affect all GPU layers
sharing that device.

## 10. Acceptance before publishing this API

Prove shared writable output and two-way ownership on both pinned native
backends first, then type-test the interface and run the same WGSL/input fixtures
on both. Cover live edits (including failed edits), multiple layers/maps, style
reload, replacement, resize, pause/resume, main-JS stalls and disposal.

Measure native-map baseline versus shared-output overhead on physical reference
devices. Agree numeric frame-time, memory, frame-age and size budgets before
acceptance. Compile success or documentation does not satisfy these gates.
See [investigation and primary sources](react-native-webgpu-investigation.md).
