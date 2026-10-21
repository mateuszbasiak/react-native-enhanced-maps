# Confirmed feature taps

**Bug:** On the running iOS simulator, double-tapping the interactive verification
point increased hit count from 3 to 5 while zoom changed 13 to 14. Android kept
hit count 3 while zoom changed 13 to 14.

**Cause:** The package feature picker recognized single taps simultaneously with
SDK double-tap zoom, without waiting for confirmation. The pinned iOS SDK's own
single tap waits for both double-tap and continuous quick-zoom recognizers.

**Fix:** Use public UIKit recognizer types and configuration to make the picker
require the existing one-finger multi-tap and continuous quick-zoom recognizers
to fail. Preserve SDK recognition and marker touch ownership.

**Verification:** Rebuild/install iOS, single-tap a feature and assert one callback,
double-tap it and assert zero additional callbacks plus gesture-origin zoom,
then verify long hold and quick zoom do not select features. Retain raw runtime
snapshots and confirm existing contracts/types/bundles. Do not infer full GEST-04
completion from this routing fix; public map long-press callbacks remain open.

**Additional reproduced failure:** After the double-tap fix, a 900 ms stationary
hold increased iOS feature hits from 1 to 2. Android's same hold left hits unchanged.
UIKit's single tap accepts this hold without another recognizer winning. Add an
observation-only 500 ms long-press exclusion, filtered by the same marker delegate,
and require it to fail before selecting. Verify single tap, hold, double tap and
quick zoom on the installed build.
