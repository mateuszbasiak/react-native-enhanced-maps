import type { ReactNode } from 'react';
import type { ViewProps } from 'react-native';
import type { Coordinate } from './types';
export interface CalloutPressEvent {
  readonly stopPropagation: () => void;
  readonly nativeEvent: {
    readonly action: 'callout-press';
    readonly id: string;
    readonly coordinate: Coordinate;
  };
}
export interface CalloutProps extends ViewProps {
  readonly children?: ReactNode;
  /** Render only custom content, without the default bubble and arrow. */
  readonly tooltip?: boolean;
  readonly onPress?: (event: CalloutPressEvent) => void;
}
/** Content descriptor consumed by Marker; never part of the pin's measured bounds. */
export function Callout(_props: CalloutProps): never {
  throw new Error('Callout must be a direct Marker child or inside a Fragment');
}
