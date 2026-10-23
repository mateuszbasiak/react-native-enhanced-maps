# Marker zIndex

Expose finite numeric zIndex (default zero) on the example Marker adapter. Higher
values draw and receive hits first; ties use stable mount order, later on top.
Ordering is relative to other markers, above the basemap.

Android: preserve translationZ for retained input views; sort texture layer order
by the same zIndex/mount order. Rebuild only the affected layer stack when order
or style changes, retaining bitmap/source resources and dirty-capture behavior.
Map-level marker picking iterates the same order from top to bottom.

iOS: use explicit marker zIndex plus stable construction order for prototype
annotation sibling draw/hit order; reapply before map hit testing because the SDK
can reorder annotations during selection. Keep upstream annotations untouched.

Validation: overlapping Pressable markers, dynamic order reversal, ties, negative
values, remove/re-add, remount, and Android capture counters. Compile native
platforms and run workspace checks. No custom marker gesture API.

Verification completed 2026-10-20: fresh Android ARM64 and iOS simulator builds
installed and launched. Both platforms routed overlap presses to B initially,
A after priority reversal (A 20/B -10), and B after equalizing both to zero.
Android also preserved that result after removing/re-adding B and remounting the
map. Workspace checks passed with 54 tests. This closes prototype verification;
package-owned MapLibre bridge migration is separate work.
