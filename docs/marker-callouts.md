# Marker selection and callouts

`Marker` supports React-rendered callouts on iOS and Android. Supply `title` and
`description` for a default bubble, or place one `Callout` directly inside the
marker (a Fragment is also allowed). Other children remain the marker pin;
callout content does not change its measured bounds.

```tsx
import { useRef } from 'react';
import { Button, Text } from 'react-native';
import { Callout, Marker, type MarkerRef } from 'react-native-maplibre-maps';

const marker = useRef<MarkerRef>(null);

// Inside MapView:
<Marker ref={marker} identifier="vessel" coordinate={coordinate} title="Vessel">
  <Callout onPress={onCalloutPress}>
    <Text>Moored vessel</Text>
    <Button title="Inspect" onPress={inspectVessel} />
  </Callout>
</Marker>;

marker.current?.showCallout();
marker.current?.hideCallout();
```

Custom content overrides title/description. `tooltip` removes the default white
bubble and arrow so the application can draw its own container. `Callout` accepts
React Native View props, including style and accessibility props. Keep content
within normal React Native view/layout capabilities. Nested controls retain their
own input handlers; pressing a child button does not imply a callout press.
`MapCallout` and `MapCalloutProps` are aliases.

One marker is selected per map. Pressing a marker with callout content or
`onSelect` selects it before `onPress`;
switching selection emits the old marker's `onDeselect` before the new marker's
`onSelect`. Events contain `nativeEvent.action` (`marker-select` or
`marker-deselect`), `id` and `coordinate`. A marker with `onSelect` can participate
without bubble content. `showCallout()` requires content; `hideCallout()` affects
only that marker. Repeated show/hide operations are idempotent. Use stable React
keys or explicit IDs when replacing marker lists.

Pressing the bubble invokes `Callout.onPress` and `Marker.onCalloutPress`, with
`nativeEvent.action === 'callout-press'`, marker `id` and `coordinate`, plus
`stopPropagation()`. Bubble and nested-control touches do not become map presses.
Map/shape presses, drag start, marker removal (including clustering), style
replacement, map failure and map unmount clear selection. A successful drag's
native endpoint remains the callout coordinate until the coordinate prop changes.

`calloutAnchor` defaults to `{x: 0.5, y: 0}` in the measured pin's coordinate
space. `calloutOffset` adds logical points. Together with the pin's anchor and
offset they place the bubble tip; values must be finite. Native geographic
anchoring follows camera movement, heading, pitch and zoom. Callouts draw above
ordinary markers regardless of their zIndex and are excluded from marker fitting.
There is no automatic camera pan to keep a bubble visible. A mounted callout uses
the ordinary native marker host, including its existing snapshot composition.

Title and description must each be strings of at most 4096 UTF-16 code units.
Default marker actions expose a button role and expanded state. Set a meaningful
`accessibilityLabel` for custom pins; custom callout children remain separately
accessible by default. Full screen-reader and physical-device acceptance remains
maintainer follow-up; RN Maps provider-specific callout parity is not promised.

## Verification

The Debug `callouts` fixture exercises default/custom bubbles, selection events,
refs, nested buttons, controlled movement, drag endpoints and cleanup. Both
iOS 26.1 and Android 16 simulators passed removal, style replacement, map remount,
clustering removal and reopening checks. Both also passed bubble hit ordering
against a marker with zIndex `1e20`, tooltip button input, camera heading/pitch/zoom
input and fitting with an open callout. Native builds, production bundle checks
and the 305-test integrated check passed. Selection lifetime, React key scopes,
attachment geometry and Java/C++ native ordering have automated coverage.
