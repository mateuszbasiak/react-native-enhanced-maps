# Marker gesture ownership

**Goal:** Prevent the map from beginning a gesture on touches targeting ordinary React marker descendants before the asynchronous JS responder grant.

**Design:** On Android, use React Native's pointer-event-aware touch target path at ACTION_DOWN to reserve the stream when it targets a marker descendant. Suppress only the SDK touch handler, preserving normal child dispatch. Retain reservation through intermediate responder release, pointer changes and marker removal; clear it after UP/CANCEL, detach and disposal. A later native disallow-intercept claim cancels the SDK stream once and remains reserved until its terminal event. Background-touch streams remain SDK-owned unless a descendant explicitly claims them. On iOS, reject SDK recognizers' receipt of a touch whose initial UIKit target has a package marker annotation ancestor; also exclude the package feature picker. UIKit then owns touch lifecycle without polling JS responder state. Child pointerEvents and native hit testing decide whether decorative areas pass through.

This prefers deterministic native ownership to the existing delayed responder checks. A public manual gesture-lock prop would require application glue and still race when set through JS. Reserving every marker rectangle would incorrectly block pointerEvents-none regions.

**Implementation plan:**

1. Write and run failing Java ownership-gate scenarios for begin, late claim/cancel transition, release, cancellation, removal semantics and fresh streams. Implement a map-owned stream gate.
2. Integrate Android pointer-event-aware target lookup before native event dispatch; retain normal child input dispatch and reset the gate at lifecycle boundaries.
3. Replace iOS responder polling with initial-touch ancestor checks for SDK and feature-picker gesture delegates. Preserve normal SDK recognizer-begin behavior.
4. Run targeted tests, workspace checks and native SDK builds; document bounded implementation and remaining device/nested-scroll coverage. No device interaction.

The user authorized this item and continued autonomous checklist work. Existing unrelated migration changes remain in place; no staging or commits are required for this work.

SDK references inspected: MapLibre Native [Android MapView](https://github.com/maplibre/maplibre-native/blob/android-v13.6.1/platform/android/MapLibreAndroid/src/main/java/org/maplibre/android/maps/MapView.java) and [iOS MLNMapView](https://github.com/maplibre/maplibre-native/blob/ios-v6.31.0/platform/ios/src/MLNMapView.mm). The pinned iOS class has no shouldReceiveTouch implementation to forward; its gestureRecognizerShouldBegin remains in use.
