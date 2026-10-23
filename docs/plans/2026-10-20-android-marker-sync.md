# Android marker synchronization

Goal: keep custom React marker visuals fixed to their map coordinate in every
presented map frame while preserving child state, live updates and standard RN
gesture handlers. The user authorized implementing the renderer integration.

Architecture: for prototype IDs only, capture the mounted RN subtree into an
ARGB bitmap on the UI thread and publish changed pixels as a MapLibre style
image. A symbol layer anchors the image to GeoJSON coordinates inside the map's
own render pass. Suppress overlay drawing but retain the original subtree for
layout, state, accessibility and input; refresh hit positions at touch down.
All visual camera transforms are now performed by the map renderer. iOS stays
on its current live-view implementation.

Alternatives: earlier projection sampling was tested and reverted because it
still mixes map and overlay frames. A native custom GL layer could avoid style
image uploads, but adds GL resource management without improving the anchoring
contract relative to a symbol layer. Start with the smaller style-image route.

Implementation:

1. Add a version-pinned patch plus a Kotlin texture host installed with the
   existing postinstall mechanism. Gate by em-live- marker IDs.
2. Capture changed child pixels, publish image/source/layer, use viewport-aligned
   symbols without collision placement or camera transition. Keep anchor/offset
   in logical pixels. Retire style resources on removal, style replacement and
   map destruction; suspend captures when detached/not visible.
3. Preserve the real RN subtree for gestures and suppress only its drawing.
   Refresh projected input bounds before Android dispatches touch down.
4. Compile Android. Validate movement against GPU dots using recorded frames,
   including pan, camera rotation/pitch, and marker motion. Validate counter,
   long press, timer/animation, resize, remove/add and remount.
5. Run workspace checks and document cost/limits honestly. Normal RN components
   are supported; independently composited native SurfaceViews need separate
   support. Continuous capture CPU cost must be stated and bounded to mounted
   prototype markers.

Acceptance: reference dot and marker ring use the same frame transform during
movement, rather than merely catching up after motion. Live content continues
updating; there is no consumer gesture-wrapper API. Do not claim untested RNGH
compatibility or universal native surface support.
