# Shader native-context lifetime regression

Repeatedly initializing a `ShaderLayer` allocated a new Worklets Hermes runtime
and Dawn device each time. Releasing the atlas pool did not promptly collect the
native runtime/device wrappers. A long Android emulator run was killed for low
memory after 59 verified show/render/hide cycles: Android exit history reported
`LOW_MEMORY`, foreground importance, and approximately 1.5 GiB RSS. This was not a
successful 100-cycle run.

Implementation: `79f76e9`; Android repaint prerequisite: `f9c2b7a`.

The renderer now retains one rendering worker per JS bundle and reuses idle GPU
devices. Each active layer owns an exclusive device, so its uncaptured GPU errors
and device loss cannot stop unrelated layers. Clean teardown destroys the layer's
textures, shared-memory imports and buffers, detaches the native layer, releases
the atlas, removes its error/loss subscriptions and returns its device to the idle
pool. Failed cleanup or device loss invalidates that device. Every new device
requests a fresh adapter because Dawn adapters are consumed by `requestDevice`.
Software-adapter consent also applies to reused devices. One native error dispatcher serves each device, because the pinned dependency implements `removeEventListener` as a no-op; returning a lease clears its logical error callback instead of registering another native listener.

Idle devices intentionally remain alive up to peak concurrent layer demand.
Hiding the last layer therefore releases layer resources, not the bundle worker
or every native device context. This removes allocation growth with ordinary
show/hide cycles; it does not establish a physical-device memory budget or prove
that arbitrary repeated driver losses are free of retained native allocations.

## Android memory observation

These are Debug emulator process measurements, not hardware performance results.
The reference setup was the API 36 ARM64 verification emulator, native example
binary built from `9076f0c`, and the example UI from `02dcfb7`. Software GPU use was
explicitly enabled. Each cycle showed the layer, waited for a new ready callback
and a native sampled frame, hid it, and waited for zero native atlas pools. No
forced garbage collection was used. `/proc/<pid>/status` and native thread names
were sampled from the application's own process.

Before the fix, a fresh process grew from 349,620 KiB RSS / 63 threads / two
`hades` threads to 944,884 KiB / 140 threads / 22 `hades` threads after 20 cycles.
Native atlas pools still returned to zero, so atlas counts alone missed the leak.

With worker and device reuse, the matched fresh process started at 369,512 KiB /
75 threads / two `hades` threads and measured 409,340 KiB / 61 threads / three
`hades` threads after 20 cycles. The extra Hermes runtime is the retained rendering
worker. After another 100 cycles with ten deliberately injected losses, the same
process remained alive at 475,248 KiB / 71 threads / three `hades` threads, with
zero atlas pools. Device-associated queue threads rose during injected losses;
full native allocation accounting remains separate work.

## Checks and remaining scope

Regression tests cover worker reuse, factory failure, exclusive concurrent device
leases, idle reuse, stale release protection, owner-only loss notification, idle
device loss, allocation failure and software consent across adapter changes. The
native consumed-adapter restriction is reproduced by the test fixture. Full local
CI passes 230 contract tests plus lint, formatting, types, Codegen, packed-package
checks and both platform production bundles.

Both simulators completed 100 single-layer show/render/hide cycles with ten
injected losses, awaiting a new ready callback and sampled output after each
replacement and zero pools after each hide. The injection follows the package's
unexpected-loss recovery path and deliberately destroys the device; it does not
simulate an unknown native driver failure.

Both platforms also rendered two concurrent layers. Invalid WGSL in the first
layer triggered a native uncaptured validation error and detached that layer;
the second layer stayed registered and its native output counters continued to
advance. Restoring valid WGSL returned to two pools. This specifically checks
error isolation that a single globally shared GPU device would break.

The wider GPU lifecycle matrix, physical-device scheduling/performance and native
allocation accounting remain tracked in `FEATURE_CHECKLIST.md`. Physical-device
validation is maintainer-owned follow-up and does not block implemented features.

## Concurrent map remount regression

The first Android concurrent remount test failed: a warmed process crashed
natively after four verified remounts, and a fresh-process reproduction failed
with `IllegalStateException: invalid native peer` from a queued shader
`triggerRepaint` callback after MapLibre destruction. These exits were separate
from the original low-memory exit.

The Android callback now checks weak view ownership, disposal, style
revision/readiness and current layer-pool ownership on the UI thread before
repainting. The arm64 Debug build passes. Both the Android emulator and iOS
simulator then completed 100 map remounts with two layers, waiting for a fresh
ready callback, two native pools and sampled output at every checkpoint. Final
removal released both pools. Android's fresh process measured 407,040 KiB RSS /
65 threads / three `hades` threads during this run. The earlier warmed Hermes
crash was not reproduced in this follow-up; its original cause is not established
by the repaint exception stack.

A separate garbage-collection regression models a native error listener as an
external JS root. It failed when the dispatch closure captured the device entry.
The dispatcher now captures separate callback state, so an invalidated device can
be collected without relying on the dependency's no-op listener removal. This GC
is confined to the Node regression; the emulator measurements above did not
force garbage collection.

After the final dispatcher callback-state split, both platforms passed a fresh
20 show/render/hide cycle run with two injected losses while the second layer
remained active, followed by ten concurrent map remounts and zero pools after
final removal. This last run checks the final GC ownership correction separately
from the earlier 100-remount observation.
