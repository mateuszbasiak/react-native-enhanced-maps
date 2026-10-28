# Controlled camera and region

`MapView.camera` and `MapView.region` use the RN Maps update-driven model.
A changed controlled value moves the native viewport without animation. Camera
wins when both are supplied. Removing camera activates a retained region; removing
both leaves the viewport in place. Initial props remain mount-only.

Gestures and imperative ref methods can move the map while controlled prop values
remain unchanged. There is no continuous reset to the last prop. To move it again,
supply a changed value. Object identity and property order do not define changes.

Region callbacks may be fed back into state, including reconstructed objects:

```tsx
const [region, setRegion] = useState(initialRegion);

<MapView region={region} onRegionChangeComplete={setRegion} />;
```

The last emitted region is recognized as a callback echo and does not refit the
viewport. Native bounds can expand a requested envelope due to aspect ratio,
padding, heading, pitch or zoom limits, so echo suppression uses the emitted
values. It does not promise equality between requested and visible bounds.

Camera commands retain the existing serialized native read/merge/dispatch path.
Obsolete queued controlled requests are skipped; a camera read already in progress
also checks ownership before dispatch. Already-dispatched commands are not undone
by the JS queue. New controlled updates interrupt native animations. Native query
revisions and readiness guards continue to reject stale/unavailable views.

Unsupported camera properties, including altitude, still fail validation. Their
presence remains part of the controlled signature, so adding one to an otherwise
unchanged camera cannot bypass validation. Missing and invalid fields also remain
distinct. No new public prop or native rendering implementation is introduced.

## Acceptance, 2026-10-28

Checked against main `a11b9fd` plus this change, using the existing Debug native
example binaries and the changed JS on a dedicated Metro port. No native source
or Codegen surface changed, and no fresh native build is claimed for this change.
The iOS host was iPhone SE (2nd generation), iOS 26.1; Android was
EnhancedMapsVerification (`emulator-5554`), API 36.

Both hosts passed:

- Camera precedence and region activation after removing camera.
- Twenty reordered equivalent camera rerenders and twenty equivalent region
  rerenders after imperative movement: zero extra region events and no reset.
- Twenty rapid camera updates and twenty rapid region updates: latest target wins
  and event counts stop increasing at idle.
- Camera and region updates interrupting a 2-second native animation: the old
  target does not return after its original completion window.
- Both change and completion callbacks feeding reconstructed regions into state:
  callback feedback is actually invoked, each animation completes once, change
  event counts stay below the bounded scenario limit, and events stop at idle.
- Releasing controlled props preserves subsequent imperative movement.
- Native horizontal pans while unchanged camera and region props remain supplied:
  the viewport moves away from the requested longitude and stays there, with no
  additional region events during the one-second post-idle check.

The automated run recorded 77 change events, 50 completions and 26 feedback
callbacks on iOS; Android recorded 24 changes, 50 completions and 9 feedback
callbacks. These are scenario observations, not a fixed event-rate contract.
The pan checks ran separately afterward. Counters are monotonic and independent
of the bounded 128-entry event history, so history truncation cannot hide loops.

`npm run check` passed 327 contracts, lint, formatting, TypeScript, Codegen and
packed declaration checks. Both minified production bundles passed the existing
release verifier for Debug globals and configured maps secrets. Contract tests
also cover 100 queued controlled requests behind a blocked command: only the
latest request executes, and failed queue tasks do not poison later commands.

## Repeating the checks

With only verification apps attached to a dedicated Metro port:

```sh
METRO_PORT=8093 npm run verify:rn-maps -- --controlled <logicalDeviceId>
```

The runner selects the runtime scenario and writes
`artifacts/rn-maps-parity/controlled-<platform>.json` (ignored). It changes map
state. The Debug example also offers **Controlled camera: idle** on the
Verification screen to run the same assertions without attaching a JS debugger;
its final result is displayed and logged with `[controlled-camera]`.

Use **Arm camera pan** or **Arm region pan**, wait for the requested viewport,
then drag horizontally in the map. The summary and `[controlled-camera-pan]`
record whether the moved camera remains in place with stable event counts.

The Android CDP attempt crashed on the JS thread with a Hermes SIGSEGV. That run
is excluded from acceptance. The passing Android run used the native UI trigger
without a JS debugger and scoped logcat evidence, following the existing
[debugger limitation](map-lifecycle-acceptance.md).

Broader gesture cancellation/ownership, camera geometry, lifecycle and animation
completion matrices remain under their own checklist IDs. Physical-device
validation is maintainer-owned follow-up and is not recorded as passed.
