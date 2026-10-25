import type { Observation, Scenario } from './scenarioSession';
/** Existing fixture evidence, read only after App acknowledges this generation. */
export function inspectScenario(scenario: Scenario): Observation | undefined {
  if (!__DEV__) return;
  const names: Partial<Record<Scenario, string>> = {
    shapes: '__enhancedMapsShapes',
    settings: '__enhancedMapsSettings',
    runtime: '__enhancedMapsVerification',
    clusters: '__enhancedMapsClusters',
    'shape-picking': '__enhancedMapsShapePicking',
    gradients: '__enhancedMapsGradient',
  };
  const name = names[scenario];
  if (!name) return;
  const api = (
    globalThis as unknown as Record<
      string,
      { snapshot(): Record<string, unknown> } | undefined
    >
  )[name];
  if (!api) return;
  const evidence = api.snapshot();
  const value = scenario === 'runtime' ? evidence.readyCount : evidence.ready;
  const error =
    (typeof evidence.error === 'string' && evidence.error.length > 0) ||
    (Array.isArray(evidence.errors) && evidence.errors.length > 0);
  return {
    ready: value === true || (typeof value === 'number' && value > 0),
    evidence,
    ...(error ? { error: 'Fixture reported an error' } : {}),
  };
}
