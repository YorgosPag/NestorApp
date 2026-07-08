/**
 * ADR-594 — Import + shape smoke test for all 24 migrated persistence hooks.
 *
 * Loading each module executes `createBimEntityPersistenceHook(config)` at module
 * scope, so this catches: syntax errors, bad import paths, missing service/helper
 * exports, and malformed config — across the whole fan-out — without a per-hook
 * render. Firebase's node build touches `fetch` at import, so we stub it first,
 * then lazy-`require` each module. Each must export its `useXPersistence` fn.
 */

// Firebase auth (node build) references Web-API globals at module init — stub them
// before require so the transitive import chain evaluates in the node test env.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (typeof g.fetch === 'undefined') {
  g.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }));
}
for (const name of ['Response', 'Request', 'Headers'] as const) {
  if (typeof g[name] === 'undefined') g[name] = class {};
}

const HOOKS: ReadonlyArray<[string, string]> = [
  ['../useBeamPersistence', 'useBeamPersistence'],
  ['../useSlabPersistence', 'useSlabPersistence'],
  ['../useRoofPersistence', 'useRoofPersistence'],
  ['../useColumnPersistence', 'useColumnPersistence'],
  ['../useFoundationPersistence', 'useFoundationPersistence'],
  ['../useRailingPersistence', 'useRailingPersistence'],
  ['../useSlabOpeningPersistence', 'useSlabOpeningPersistence'],
  ['../useHatchPersistence', 'useHatchPersistence'],
  ['../useFloorFinishPersistence', 'useFloorFinishPersistence'],
  ['../useThermalSpacePersistence', 'useThermalSpacePersistence'],
  ['../useSpaceSeparatorPersistence', 'useSpaceSeparatorPersistence'],
  ['../useWallCoveringPersistence', 'useWallCoveringPersistence'],
  ['../useFurniturePersistence', 'useFurniturePersistence'],
  ['../useFloorplanSymbolPersistence', 'useFloorplanSymbolPersistence'],
  ['../useMepBoilerPersistence', 'useMepBoilerPersistence'],
  ['../useMepRadiatorPersistence', 'useMepRadiatorPersistence'],
  ['../useMepManifoldPersistence', 'useMepManifoldPersistence'],
  ['../useMepWaterHeaterPersistence', 'useMepWaterHeaterPersistence'],
  ['../useMepFixturePersistence', 'useMepFixturePersistence'],
  ['../useMepUnderfloorPersistence', 'useMepUnderfloorPersistence'],
  ['../useElectricalPanelPersistence', 'useElectricalPanelPersistence'],
  // ADR-594 Phase 2 — the formerly-bespoke divergent members, now factory-built.
  ['../useMepSegmentPersistence', 'useMepSegmentPersistence'],
  ['../useOpeningPersistence', 'useOpeningPersistence'],
  ['../useWallPersistence', 'useWallPersistence'],
];

describe('ADR-594 migrated persistence hooks — import + shape', () => {
  it('covers exactly 24 migrated hooks', () => {
    expect(HOOKS).toHaveLength(24);
  });

  it.each(HOOKS)('%s → %s is a function', (modulePath, exportName) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const mod = require(modulePath) as Record<string, unknown>;
    expect(typeof mod[exportName]).toBe('function');
  });
});
