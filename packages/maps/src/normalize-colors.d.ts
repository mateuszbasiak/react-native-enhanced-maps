/** The pinned standalone RN normalizer ships JavaScript without TypeScript declarations. */
declare module '@react-native/normalize-colors' {
  export default function normalizeColor(value: unknown): number | null;
}
