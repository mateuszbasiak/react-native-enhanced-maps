import React, { useEffect, useRef, useState } from 'react';
import { Button, Pressable, Text, View } from 'react-native';
import { MapView, Marker, Callout } from 'react-native-maplibre-maps';
import type {
  MapViewRef,
  MarkerRef,
  Coordinate,
  MarkerSelectionEvent,
  Camera,
  MapBounds,
  MapCapabilities,
} from 'react-native-maplibre-maps';
import ExampleControls from '../ExampleControls';
const center = { latitude: 54.37, longitude: 18.662 };
const camera = { center, zoom: 15, heading: 0, pitch: 0 };
type Evidence = {
  selectionCoordinates?: MarkerSelectionEvent['nativeEvent'][];
  dragEndpoint?: Coordinate;
  ready: boolean;
  readyEvents: number;
  events: string[];
  actions: number;
  mapPresses: number;
  calloutPresses: number;
  errors: string[];
  coordinates: { a: Coordinate; b: Coordinate };
};
type DebugGlobal = typeof globalThis & {
  __enhancedMapsCallouts?: {
    snapshot(): Evidence;
    show(id: 'a' | 'b'): void;
    hide(): void;
    configure(value: {
      present?: boolean;
      moved?: boolean;
      clustered?: boolean;
      title?: string;
      backdrop?: boolean;
      tooltip?: boolean;
    }): void;
    animate(): void;
    reloadStyle(): void;
    remount(): void;
    fit(): Promise<void>;
    probe(): Promise<{
      camera: Camera;
      bounds: MapBounds;
      capabilities: MapCapabilities | null;
    }>;
    verifyDragReopen(): void;
  };
};
export default function CalloutVerification() {
  const map = useRef<MapViewRef>(null),
    a = useRef<MarkerRef>(null),
    b = useRef<MarkerRef>(null);
  const [generation, setGeneration] = useState(0),
    [style, setStyle] = useState(0),
    [present, setPresent] = useState(true),
    [moved, setMoved] = useState(false),
    [clustered, setClustered] = useState(false),
    [title, setTitle] = useState('Vessel A');
  const [summary, setSummary] = useState('Loading');
  const [backdrop, setBackdrop] = useState(false),
    [tooltip, setTooltip] = useState(false);
  const evidence = useRef<Evidence>({
    ready: false,
    readyEvents: 0,
    events: [],
    actions: 0,
    mapPresses: 0,
    calloutPresses: 0,
    errors: [],
    coordinates: {
      a: { latitude: 54.37, longitude: 18.66 },
      b: { latitude: 54.37, longitude: 18.664 },
    },
  });
  const coordinateA = {
    latitude: 54.37 + (moved ? 0.0007 : 0),
    longitude: 18.66,
  };
  evidence.current.coordinates = {
    a: coordinateA,
    b: { latitude: 54.37, longitude: 18.664 },
  };
  const record = (value: string) => {
    evidence.current.events.push(value);
    evidence.current.events = evidence.current.events.slice(-64);
    setSummary(value);
  };
  useEffect(() => {
    if (!__DEV__) return;
    const target = globalThis as DebugGlobal;
    const api = {
      snapshot: () => JSON.parse(JSON.stringify(evidence.current)) as Evidence,
      show: (id: 'a' | 'b') => (id === 'a' ? a : b).current?.showCallout(),
      hide: () => {
        a.current?.hideCallout();
        b.current?.hideCallout();
      },
      configure: (value: {
        present?: boolean;
        moved?: boolean;
        clustered?: boolean;
        title?: string;
        backdrop?: boolean;
        tooltip?: boolean;
      }) => {
        if (value.present !== undefined) setPresent(value.present);
        if (value.moved !== undefined) setMoved(value.moved);
        if (value.title !== undefined) setTitle(value.title);
        if (value.backdrop !== undefined) setBackdrop(value.backdrop);
        if (value.tooltip !== undefined) setTooltip(value.tooltip);
        if (value.clustered !== undefined) {
          setClustered(value.clustered);
          map.current?.animateCamera(
            { ...camera, zoom: value.clustered ? 12 : 15 },
            0,
          );
        }
      },
      animate: () =>
        map.current?.animateCamera(
          { ...camera, heading: 35, pitch: 40, zoom: 16 },
          500,
        ),
      reloadStyle: () => {
        evidence.current.ready = false;
        setStyle((v) => v + 1);
      },
      remount: () => {
        evidence.current.ready = false;
        setGeneration((v) => v + 1);
      },
      fit: async () => {
        if (!map.current) throw new Error('Map missing');
        await map.current.fitElements({ durationMs: 0, padding: 50 });
      },
      probe: async () => {
        if (!map.current) throw new Error('Map missing');
        const camera = await map.current.getCamera();
        const bounds = await map.current.getVisibleBounds();
        return { camera, bounds, capabilities: map.current.getCapabilities() };
      },
      verifyDragReopen: () => {
        const end = evidence.current.dragEndpoint;
        if (!end) throw new Error('Drag marker A first');
        const before = evidence.current.selectionCoordinates?.length ?? 0;
        a.current?.showCallout();
        a.current?.hideCallout();
        a.current?.showCallout();
        const events =
          evidence.current.selectionCoordinates?.slice(before) ?? [];
        if (
          events.length < 2 ||
          events.some(
            (event) =>
              Math.abs(event.coordinate.latitude - end.latitude) > 1e-9 ||
              Math.abs(event.coordinate.longitude - end.longitude) > 1e-9,
          )
        )
          throw new Error(
            'Callout selection differs from native drag endpoint',
          );
        evidence.current.events.push('verified-drag');
        setSummary('Verified drag callout');
      },
    };
    target.__enhancedMapsCallouts = api;
    return () => {
      if (target.__enhancedMapsCallouts === api)
        delete target.__enhancedMapsCallouts;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text testID="callout-status">
        {summary} · actions {evidence.current.actions}
      </Text>
      <ExampleControls>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          <Button title="Show A" onPress={() => a.current?.showCallout()} />
          <Button title="Show B" onPress={() => b.current?.showCallout()} />
          <Button
            title="Hide"
            onPress={() => {
              a.current?.hideCallout();
              b.current?.hideCallout();
            }}
          />
          <Button title="Move A" onPress={() => setMoved((v) => !v)} />
          <Button title="Remove A" onPress={() => setPresent((v) => !v)} />
          <Button
            title="Update title"
            onPress={() => setTitle('Updated vessel A')}
          />
        </View>
      </ExampleControls>
      <MapView
        key={generation}
        ref={map}
        style={{ flex: 1 }}
        styleURL={`https://tiles.openfreemap.org/styles/liberty?callout=${style}`}
        initialCamera={camera}
        onMapReady={() => {
          evidence.current.ready = true;
          evidence.current.readyEvents++;
          setSummary('Ready');
        }}
        onError={(event) => {
          evidence.current.errors.push(event.code);
          setSummary(event.code);
        }}
        onPress={() => {
          evidence.current.mapPresses++;
          record('map-press');
        }}
      >
        {present && (
          <Marker
            ref={a}
            id="a"
            coordinate={coordinateA}
            title={title}
            description="Moored vessel"
            accessibilityLabel="Vessel A marker"
            cluster={clustered}
            draggable={!clustered}
            onSelect={(event) => {
              (evidence.current.selectionCoordinates ??= []).push(
                event.nativeEvent,
              );
              record('select:a');
            }}
            onDeselect={(event) => {
              (evidence.current.selectionCoordinates ??= []).push(
                event.nativeEvent,
              );
              record('deselect:a');
            }}
            onCalloutPress={() => {
              evidence.current.calloutPresses++;
              record('callout:a');
            }}
            onDragStart={() => record('drag:a')}
            onDragEnd={(event) => {
              evidence.current.dragEndpoint = event.nativeEvent.coordinate;
              record('drag-end:a');
            }}
          />
        )}
        <Marker
          ref={b}
          id="b"
          coordinate={evidence.current.coordinates.b}
          accessibilityLabel="Vessel B marker"
          cluster={clustered}
          onSelect={() => record('select:b')}
          onDeselect={() => record('deselect:b')}
        >
          <Callout
            tooltip={tooltip}
            accessibilityLabel="Vessel B details"
            style={{ width: 180 }}
          >
            <Text>Custom vessel B</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Inspect vessel B"
              onPress={() => {
                evidence.current.actions++;
                record('inspect:b');
              }}
              style={{ padding: 10, backgroundColor: '#dbeafe' }}
            >
              <Text>Inspect vessel B</Text>
            </Pressable>
          </Callout>
        </Marker>
        {backdrop && (
          <Marker
            id="callout-underlay"
            coordinate={coordinateA}
            zIndex={1e20}
            offset={{ x: 0, y: -32 }}
            accessibilityLabel="High zIndex marker"
            onPress={() => record('underlay')}
          >
            <View
              style={{ width: 240, height: 120, backgroundColor: '#c4b5fd' }}
            >
              <Text>High zIndex marker</Text>
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}
