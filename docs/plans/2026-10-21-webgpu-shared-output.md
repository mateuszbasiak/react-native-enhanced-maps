# WebGPU shared-output prototype implementation plan

Goal: test one JS-owned WGSL program rendered through React Native WebGPU and
shared as a geographic MapLibre layer on iOS and Android, without pixel readback.

1. Test a bounded three-slot producer/front/readers state machine in standalone C++.
2. Add Debug prototype allocation/ownership bridges: IOSurface on iOS and
   AHardwareBuffer on Android. Keep resources alive independently of map lifetime.
3. Add native map compositors: MLNCustomStyleLayer/Metal and pinned CustomLayerHost/GLES.
4. Add one JS renderer importing each surface once, rendering WGSL, ending access,
   waiting asynchronously for producer completion, then publishing to native.
   Native consumer completion controls slot reuse. This first spike deliberately
   uses completion-mediated handoff/main-JS scheduling; fences/worklets remain a
   separate performance step, and JS-block animation independence is not claimed.
5. Build both native apps and check types/contracts/bundles. Install on available
   simulators, exercise output/order/camera/remove and record errors/limits.

The public API remains unchanged. No RN WebGPU vendor modifications, map engine
fork, CPU readback fallback, unbounded queue or production performance claim.
