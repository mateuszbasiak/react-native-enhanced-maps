import { createContext } from 'react';
import type { createCalloutSelection } from './calloutSelection';
export const MapContext = createContext<ReturnType<
  typeof createCalloutSelection
> | null>(null);
