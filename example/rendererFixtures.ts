import type { Coordinate } from 'react-native-enhanced-maps';
export const routes: readonly (readonly Coordinate[])[] = [
  [
    { latitude: 52.24, longitude: 20.99 },
    { latitude: 52.225, longitude: 21.01 },
    { latitude: 52.22, longitude: 21.035 },
  ],
  [
    { latitude: 52.22, longitude: 20.99 },
    { latitude: 52.235, longitude: 21.01 },
    { latitude: 52.24, longitude: 21.035 },
  ],
];
export const area: readonly Coordinate[] = [
  { latitude: 52.22, longitude: 20.995 },
  { latitude: 52.22, longitude: 21.03 },
  { latitude: 52.24, longitude: 21.03 },
  { latitude: 52.24, longitude: 20.995 },
];
export const holes: readonly (readonly Coordinate[])[] = [
  [
    { latitude: 52.226, longitude: 21.005 },
    { latitude: 52.234, longitude: 21.005 },
    { latitude: 52.234, longitude: 21.02 },
    { latitude: 52.226, longitude: 21.02 },
  ],
];
