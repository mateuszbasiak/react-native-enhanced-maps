import { createContext } from 'react';
export interface ShaderMapHost {
  readonly ready: boolean;
  readonly revision: number;
  request(input: Record<string, string | number>): Promise<unknown>;
}
export const ShaderMapContext = createContext<ShaderMapHost | null>(null);
