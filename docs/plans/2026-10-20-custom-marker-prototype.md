# Live custom marker prototype

Goal: evaluate arbitrary React child content, live updates and child gestures on
MapLibre Native, separately from Google tiles and the Android bitmap benchmark.

Design: example-only Marker adapter uses MapLibre's live Marker host, accepting a
Coordinate and ReactNode children inside one non-collapsible RN container. React
owns state and layout; the native map host tracks location. No snapshots or
per-frame JS camera projection. This is native view composition, not a GPU layer.

Demo: stateful counter with nested Pressables and long press; externally changed
color/text/size; independent timer; native-driven pulse; a PanResponder thumb that
owns its touch stream while dragging. Map pans outside markers remain enabled.
Controls move marker coordinates, rotate/pitch camera, toggle mounting and vary
small counts. Show gesture counters and camera idle count. Stop timers/animations
and release gesture locks on unmount.

Validation: contract tests for coordinate validation and child acceptance; workspace
checks/platform bundles; iOS and Android tap/long-press/child-pan/state/resize/remount
smoke checks. Record observed gesture arbitration and movement limitations. No
claim that all third-party gesture libraries or native child surfaces work, and
no new Google/Apple provider support or public package API claim.
