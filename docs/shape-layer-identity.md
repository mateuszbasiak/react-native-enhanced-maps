# Stable shape layer identity

Private fill/stroke layer IDs derive from the stable shape ID, rather than its
position in the sorted source list. Removing or inserting a sibling therefore
never reassigns an existing layer ID to a different source. The pinned native
renderers can retain layer state when an ID is reused in the same update; index
IDs made a remaining polygon disappear after a sibling was removed.

Public shape/source IDs remain 1–128 supported characters. Private SDK layer IDs
add the kind prefix and are bounded to 135 characters. This is internal transport;
it does not change public shape identifiers, presses, ordering or source limits.
SDK style-layer identifiers do not impose the public input's 128-character bound.
The maximum-ID regression retains public rejection above 128 and verifies the
bounded generated transport.

A compiler regression verifies identity and source ownership across sibling
removal and insertion. Debug smoke on Android API 36 / MapLibre 13.6.1 and iOS
26.1 / MapLibre 6.31.0 reproduced disappearing fill and map-press fall-through
before the fix, then retained the polygon and selected its filled area after it.
Those binaries included the separate native hole-query filter under development;
that filter does not change SDK source/layer rendering. Physical-device checks
remain maintainer-owned follow-up.
