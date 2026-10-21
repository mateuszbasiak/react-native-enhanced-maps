/** Deterministic, prefix-stable workload. No clustering or culling. */
export function markerCoordinates(count: number) {
  if (!Number.isInteger(count) || count < 0 || count > 5000)
    throw new RangeError('Marker count must be 0–5000');
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  return Array.from({ length: count }, () => ({
    latitude: 52.2297 + (random() - 0.5) * 0.06,
    longitude: 21.0122 + (random() - 0.5) * 0.1,
  }));
}
