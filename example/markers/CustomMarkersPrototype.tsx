import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Button,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GeoJSONSource, Layer, MapView } from 'react-native-enhanced-maps';
import type { MapViewRef, GeoJSONData } from 'react-native-enhanced-maps';
import { Marker } from 'react-native-enhanced-maps';
import { MarkerStackingDemo } from './MarkerStackingDemo';

const initial = {
  center: [18.66, 54.37] as [number, number],
  zoom: 13,
  bearing: 0,
  pitch: 0,
};

function CounterCard({
  pink,
  expanded,
  revision,
  live,
  animate,
}: {
  pink: boolean;
  expanded: boolean;
  revision: number;
  live: boolean;
  animate: boolean;
}) {
  const [count, setCount] = useState(0);
  const [longPresses, setLongPresses] = useState(0);
  const [ticks, setTicks] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setTicks((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [live]);
  useEffect(() => {
    if (!animate) {
      pulse.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [animate, pulse]);
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.card,
        {
          width: expanded ? 220 : 170,
          backgroundColor: pink ? '#a32367' : '#145e99',
        },
      ]}
    >
      <View pointerEvents="none" style={styles.row}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Text style={styles.title}>Live child · revision {revision}</Text>
      </View>
      <Text pointerEvents="none" style={styles.light} testID="custom-counter">
        Count {count} · long {longPresses}
      </Text>
      <Text pointerEvents="none" style={styles.light}>
        Child timer: {ticks}
      </Text>
      {expanded && (
        <Text pointerEvents="none" style={styles.light}>
          This extra content changes the marker layout.
        </Text>
      )}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Increment marker counter"
          onPress={() => setCount((value) => value + 1)}
          onLongPress={() => setLongPresses((value) => value + 1)}
          style={styles.childButton}
        >
          <Text>+1 / hold</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset marker counter"
          onPress={() => {
            setCount(0);
            setLongPresses(0);
          }}
          style={styles.childButton}
        >
          <Text>Reset</Text>
        </Pressable>
      </View>
    </View>
  );
}
function GestureCard() {
  const position = useRef(new Animated.Value(0)).current;
  const committed = useRef(0);
  const [value, setValue] = useState(0);
  const [drags, setDrags] = useState(0);
  const [active, setActive] = useState(false);
  const finish = useCallback(() => {
    setActive(false);
    setDrags((v) => v + 1);
  }, []);
  const responder = useMemo(() => {
    let start = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start = committed.current;
        setActive(true);
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.max(0, Math.min(120, start + gesture.dx));
        committed.current = next;
        position.setValue(next);
        setValue(Math.round(next / 1.2));
      },
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    });
  }, [finish, position]);
  return (
    <View
      pointerEvents="box-none"
      style={[styles.card, { backgroundColor: '#234536', width: 184 }]}
    >
      <Text pointerEvents="none" style={styles.title}>
        Child pan gesture
      </Text>
      <Text pointerEvents="none" style={styles.light} testID="custom-slider">
        Value {value}% · drags {drags}
      </Text>
      <Text pointerEvents="none" style={styles.light}>
        {active ? 'Dragging child' : 'Drag the thumb →'}
      </Text>
      <View
        accessibilityLabel="Marker slider gesture area"
        style={styles.track}
        {...responder.panHandlers}
      >
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX: position }] }]}
        />
      </View>
    </View>
  );
}

export default function CustomMarkersPrototype() {
  const [stacking, setStacking] = useState(false);
  const [pink, setPink] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(1);
  const [live, setLive] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [moved, setMoved] = useState(false);
  const [status, setStatus] = useState('Loading map…');
  const [idle, setIdle] = useState(0);
  const camera = useRef<MapViewRef>(null);
  const cameraStep = useRef(0);
  const [generation, setGeneration] = useState(0);
  const anchors = useMemo<GeoJSONData>(
    () => ({
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          id: 'anchor-counter',
          properties: {},
          geometry: {
            type: 'Point' as const,
            coordinates: [moved ? 18.661 : 18.655, 54.373],
          },
        },
        {
          type: 'Feature' as const,
          id: 'anchor-slider',
          properties: {},
          geometry: { type: 'Point' as const, coordinates: [18.666, 54.365] },
        },
      ],
    }),
    [moved],
  );
  if (stacking) return <MarkerStackingDemo onBack={() => setStacking(false)} />;
  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Text style={styles.heading}>Live custom component markers</Text>
        <Text testID="custom-marker-status">
          {status} · camera idle {idle} · standard child handlers
        </Text>
        <View style={styles.row}>
          <Button
            title="Change props"
            onPress={() => {
              setRevision((v) => v + 1);
              setPink((v) => !v);
            }}
          />
          <Button
            title={expanded ? 'Shrink child' : 'Expand child'}
            onPress={() => setExpanded((v) => !v)}
          />
          <Button
            title={live ? 'Stop timer' : 'Start timer'}
            onPress={() => setLive((v) => !v)}
          />
          <Button
            title={animate ? 'Stop pulse' : 'Animate child'}
            onPress={() => setAnimate((v) => !v)}
          />
          <Button title="Move marker" onPress={() => setMoved((v) => !v)} />
          <Button
            title="Camera path"
            disabled={status !== 'Ready'}
            onPress={() => {
              const step = ++cameraStep.current % 3;
              camera.current?.animateCamera(
                {
                  center: {
                    latitude: initial.center[1],
                    longitude: initial.center[0],
                  },
                  zoom: initial.zoom,
                  heading: step * 70,
                  pitch: step ? 45 : 0,
                },
                2000,
              );
            }}
          />
          <Button
            title={mounted ? 'Remove markers' : 'Add markers'}
            onPress={() => {
              setMounted((v) => !v);
            }}
          />
          <Button
            title="Remount map"
            onPress={() => {
              setStatus('Loading map…');
              setGeneration((v) => v + 1);
            }}
          />
          <Button title="Test zIndex" onPress={() => setStacking(true)} />
        </View>
      </View>
      <MapView
        ref={camera}
        key={generation}
        style={styles.map}
        styleURL="https://tiles.openfreemap.org/styles/liberty"
        onMapReady={() => setStatus('Ready')}
        onError={() => setStatus('Map load failed')}
        onCameraIdle={() => setIdle((v) => v + 1)}
        initialCamera={{
          center: { latitude: 54.37, longitude: 18.66 },
          zoom: 13,
          heading: 0,
          pitch: 0,
        }}
      >
        {mounted && status === 'Ready' && (
          <>
            <GeoJSONSource id="marker-reference-anchors" data={anchors}>
              <Layer
                id="marker-reference-dots"
                type="circle"
                style={{ circleRadius: 6, circleColor: '#ff2626' }}
              />
            </GeoJSONSource>
            <Marker
              offset={{ x: 0, y: 6 }}
              id="live-counter"
              coordinate={{
                latitude: 54.373,
                longitude: moved ? 18.661 : 18.655,
              }}
            >
              <CounterCard
                pink={pink}
                expanded={expanded}
                revision={revision}
                live={live}
                animate={animate}
              />
              <View
                pointerEvents="none"
                style={{
                  alignSelf: 'center',
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 3,
                  borderColor: '#111',
                }}
              />
            </Marker>
            <Marker
              offset={{ x: 0, y: 6 }}
              id="live-gesture"
              coordinate={{ latitude: 54.365, longitude: 18.666 }}
            >
              <GestureCard />
              <View
                pointerEvents="none"
                style={{
                  alignSelf: 'center',
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  borderWidth: 3,
                  borderColor: '#111',
                }}
              />
            </Marker>
          </>
        )}
      </MapView>
      <Text style={styles.footer}>
        Red dots are GPU anchors; black rings belong to live markers. Separation
        during map movement reveals tracking lag. Test child gestures
        separately.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { padding: 8, backgroundColor: '#fff' },
  heading: { fontSize: 17, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  map: { flex: 1 },
  footer: { padding: 8, fontSize: 12, backgroundColor: '#fff' },
  card: { padding: 10, borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  title: { fontSize: 13, fontWeight: '700', color: '#fff' },
  light: { fontSize: 12, color: '#fff', marginVertical: 3 },
  childButton: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginRight: 6,
    marginTop: 5,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#6ff',
    marginRight: 5,
  },
  track: {
    height: 44,
    width: 160,
    backgroundColor: '#ccdcd3',
    borderRadius: 20,
    marginTop: 6,
    justifyContent: 'center',
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fbb541',
    marginLeft: 2,
  },
});
