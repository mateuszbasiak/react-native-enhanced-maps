import type { Camera, Region, MapViewRef } from '../packages/maps/src/types';
export interface ControlledCameraTestApi {
  snapshot(): { platform: string; errors: unknown[] };
  parity: {
    map(): MapViewRef;
    setCamera(camera: Camera | undefined): void;
    setRegion(region: Region | undefined): void;
    setRegionFeedback(mode: 'off' | 'change' | 'complete'): void;
    snapshot(): {
      regionCounts: { changes: number; completions: number; feedback: number };
    };
  };
}
export function runControlledCameraChecks(
  api: ControlledCameraTestApi,
): Promise<{
  platform: string;
  passed: string[];
  regionCounts: { changes: number; completions: number; feedback: number };
  camera: Camera;
}>;
