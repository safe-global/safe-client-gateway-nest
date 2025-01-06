// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const checkGuardIsApplied = (guard: Function, fn: Function): void => {
  const guards: Array<() => void> = Reflect.getMetadata('__guards__', fn);
  expect(guards?.length ?? 0).toBeGreaterThan(0);
  guards.some((g) => expect(g.name).toBe(guard.name));
};
