# Android camera command ownership

The installed MapLibre 13.6.1 Transform implementation dispatches
`REASON_API_ANIMATION` (3) for public camera commands. Its compass also dispatches 3. Changing the constant mapping cannot fix application provenance.

1. Add native map-owned command generations. A late completion/cancellation from
   a superseded command must not clear its replacement's ownership.
2. Skip the SDK's exact camera-position no-op before claiming ownership. Preserve
   the last movement's origin when a callback finishes before idle delivery.
3. Observe native gesture recognition independently of JS event subscriptions:
   the SDK dispatcher can suppress another move-start while already moving.
4. Verify animated and immediate commands, repeated/no-op commands and gesture
   interruption on the Android emulator, comparing iOS behavior where applicable.
5. Observe the native compass click notification without replacing SDK handlers.
   This supplies evidence even when the SDK suppresses another movement-start.
6. Repair asynchronous SDK child layout requests under Fabric while keeping
   marker subtree measurement owned by Yoga. Verify controls from a fresh mount
   and marker child touch behavior afterward.
7. Keep CAM-06 open for the iOS compass interruption defect found by the comparison
   run and for the broader timing/control matrix.

Regression coverage: standalone Java tracker tests (command classification,
callback generations, no-op callback cleanup, gesture override, reset).
