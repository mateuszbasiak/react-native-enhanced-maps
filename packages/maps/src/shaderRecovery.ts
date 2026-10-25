/** One configuration lifetime: initial attempt plus at most two device replacements. */
export async function runShaderRecovery(options: {
  run: () => Promise<boolean>;
  stopped: () => boolean;
  wait: (milliseconds: number) => Promise<unknown>;
  exhausted: () => void;
}): Promise<void> {
  const delays = [100, 500] as const;
  let retries = 0;
  while (!options.stopped()) {
    const recover = await options.run();
    if (!recover || options.stopped()) return;
    const delay = delays[retries++];
    if (delay === undefined) {
      options.exhausted();
      return;
    }
    await options.wait(delay);
  }
}
/** Complete every disposal step; a failed teardown must not trigger a replacement. */
export async function releaseShaderResources(
  actions: readonly (() => unknown | Promise<unknown>)[],
  report: (error: unknown) => void,
): Promise<boolean> {
  let clean = true;
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      clean = false;
      try {
        report(error);
      } catch {
        /* Application callbacks cannot interrupt teardown. */
      }
    }
  }
  return clean;
}
