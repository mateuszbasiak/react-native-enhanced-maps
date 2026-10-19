# Enhanced Maps / TypeGPU

Private feasibility package. `renderTriangleRaster` executes a TypeGPU triangle
shader offscreen with a typed RGBA uniform and returns a bounded geographic texture.
Pass its result to core `MapView.experimentalRasterOverlay`.

```tsx
import 'react-native-webgpu'; // install WebGPU globals before rendering
import { renderTriangleRaster } from '@react-native-enhanced-maps/typegpu';

const raster = await renderTriangleRaster({
  bounds: { north: 52.24, south: 52.22, west: 20.995, east: 21.03 },
  color: [0.05, 0.6, 1, 0.65],
  size: 128,
  signal: abortController.signal,
});
// <MapView experimentalRasterOverlay={raster} ... />
```

This is a **shader snapshot experiment**, not a live custom GPU render pass.
GPU readback and base64 transfer happen on replacement; the SDK then owns geographic
projection, with no camera-frame transport through JS. Do not update this prop every
frame. Max 256 × 256 RGBA8; no antimeridian crossing or polar regions. Row zero is
north, straight alpha. Remove the prop to remove the overlay. Bounds mapping is
provider-owned; no portable projection matrix or depth buffer is exposed.

The triangle authoring uses TypeGPU's typed stage interfaces and uniform schema
with WGSL bodies, so no shader compiler Babel plugin is required. The example
includes Babel syntax transforms and a tested RN 0.85 string-export workaround
needed by TypeGPU 0.12; see `example/babel.config.js` and `example/babel/`.

TypeGPU and react-native-webgpu are peers. No mandatory Worklets, Reanimated,
Skia, Three.js, or @typegpu/react dependency is introduced. Core does not import
either GPU peer. Device creation, readback and encoding costs have not been
benchmarked on physical release devices. Animated shaders, GPU-native camera
synchronization, arbitrary layer ordering, shared depth, and picking remain pending.
