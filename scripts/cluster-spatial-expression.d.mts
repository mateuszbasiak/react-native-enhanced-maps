import type {
  Camera,
  ClusterComponentProps,
  ClusterMember,
} from '../packages/maps/src/types';
interface Partition {
  count: number;
  coordinate: ClusterComponentProps['coordinate'];
  clusterGroup?: string;
  members: readonly ClusterMember[];
}
interface ClusterSpatialApi {
  snapshot(): {
    ready: number;
    platform: string;
    errors: string[];
    viewport: { width: number; height: number };
  };
  configure(options: {
    count?: number;
    layout?: 'coincident' | 'spatial' | 'antimeridian';
    grouped?: boolean;
    custom?: boolean;
    present?: boolean;
    clustered?: boolean;
    identityCases?: boolean;
  }): void;
  moveCamera(camera: Camera): Promise<void>;
  getCamera(): Promise<Camera>;
  capture(): ClusterComponentProps | undefined;
  inspectAll(): Promise<Partition[]>;
  reloadStyle(): void;
  remount(): void;
}
export function assertClusterRun(result: unknown): void;
export function assertObsoleteCluster(
  handle: ClusterComponentProps | undefined,
): Promise<void>;
export function runClusterSpatialChecks(
  api: ClusterSpatialApi,
): Promise<unknown>;
export function assertClusterPartition(
  partition: unknown,
  layout: string,
  grouped: boolean,
): string[];
