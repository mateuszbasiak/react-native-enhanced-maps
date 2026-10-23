# iOS compass camera ownership

Recorded failure: interrupting a ten-second application camera animation with the
SDK compass emits sdk for the interrupted callback, then application at heading
zero. Per-callback reason masks do not identify the entire SDK operation.

1. Track explicit native SDK camera operations across their internal programmatic
   callbacks. Observe the public `resetNorth`/`resetPosition` operations in the
   existing MLNMapView subclass, preserving their implementations.
2. Package application commands and native gesture begin replace that ownership.
   Skip SDK-equal camera commands before claiming application ownership.
3. Test callback sequences in standalone C++, including SDK interruption, a later
   application command, gesture override and unknown fallback.
4. Build iOS and verify normal commands, compass interruption, reverse replacement,
   no-op and gesture interruption on the simulator. Retain raw evidence and keep
   full lifecycle/completion work open until its separate matrix is established.
