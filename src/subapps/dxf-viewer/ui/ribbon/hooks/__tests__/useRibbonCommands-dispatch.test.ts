/**
 * ADR-587 Φ4 — Coverage test: ribbon command dispatch tables.
 *
 * Καρφώνει ότι η μετατροπή των 4 if-chains (~210 branches) σε ordered route tables +
 * generic runners είναι **behavior-preserving** και ότι το write/read drift είναι
 * **αδύνατο κατά κατασκευή**:
 *   1. Completeness — 30 combobox / 9 badge / 15 visibility routes (ξεχασμένο bridge → σπάει).
 *   2. **No-drift invariant** — κάθε non-readout combobox route έχει `matchWrite === matchRead`
 *      (ΙΔΙΟ reference) ⇒ δεν μπορεί να αποκλίνει· ΜΟΝΟ τα 4 readout routes (hatch/column/
 *      radiator/boiler) έχουν ευρύτερο `matchRead` (read-only readout keys).
 *   3. Runner semantics — first-match-wins + order + fallback (write/read/simple).
 *   4. Real-key routing — normal key → ίδιο bridge σε write+read· readout key → read-only.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-587-entity-type-descriptor-registry-ssot.md
 */

// The dispatch module imports guard predicates from bridge hook files (useRibbonWallBridge
// κ.λπ.) που τραβούν transitively firebase/auth στο import path (fetch under node). Mock it.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import {
  buildComboboxRoutes,
  buildBadgeRoutes,
  buildVisibilityRoutes,
  dispatchComboboxWrite,
  dispatchComboboxRead,
  dispatchSimple,
  type ComboboxRoute,
  type SimpleRoute,
} from '../useRibbonCommands-dispatch';
import type { RibbonComboboxState } from '../../context/RibbonCommandContext';
import { WALL_RIBBON_NUMBER_KEYS } from '../bridge/wall-command-keys';

// ── Mock bridge factories ────────────────────────────────────────────────────────
interface ComboboxMock {
  readonly tag: string;
  readonly writes: Array<[string, string]>;
  onComboboxChange(key: string, value: string): void;
  getComboboxState(key: string): RibbonComboboxState | null;
}
function comboboxMock(tag: string): ComboboxMock {
  const writes: Array<[string, string]> = [];
  return {
    tag,
    writes,
    onComboboxChange: (k, v) => { writes.push([k, v]); },
    // value === tag ⇒ the read result identifies WHICH bridge handled the key.
    getComboboxState: () => ({ value: tag, options: [] }),
  };
}

/** All 33 combobox bridges, each a tagged mock keyed by the bridge prop name. */
function comboboxDeps(): Record<string, ComboboxMock> {
  const names = [
    'stairBridge', 'wallBridge', 'openingBridge', 'slabBridge', 'roofBridge', 'floorFinishBridge',
    'wallCoveringBridge', 'hatchBridge', 'thermalSpaceBridge', 'columnBridge', 'beamBridge',
    'foundationBridge', 'slabOpeningBridge', 'mepFixtureBridge', 'mepManifoldBridge',
    'electricalPanelBridge', 'mepRadiatorBridge', 'mepBoilerBridge', 'mepWaterHeaterBridge',
    'mepUnderfloorBridge', 'mepSegmentBridge', 'furnitureBridge', 'floorplanSymbolBridge',
    'annotationSymbolBridge', 'scaleBarBridge', 'mepFixtureLibraryBridge', 'mepRiserBridge', 'arrayBridge',
    'lineToolBridge', 'dimBridge', 'xlineModeBridge', 'scaleToolBridge',
    // ADR-652 M1.5 — Block Library (numeric-only: rotation/scale· κανένα asset key).
    'blockLibraryBridge',
  ];
  const out: Record<string, ComboboxMock> = {};
  for (const n of names) out[n] = comboboxMock(n);
  return out;
}

function simpleMock(tag: string, method: 'getBadgeState' | 'getPanelVisibility') {
  const m = { [method]: () => true } as Record<string, () => boolean> & { tag: string };
  m.tag = tag;
  return m;
}
function boolDeps(method: 'getBadgeState' | 'getPanelVisibility', names: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const n of names) out[n] = simpleMock(n, method);
  return out;
}

describe('dispatch tables — completeness', () => {
  it('combobox = 35 routes (34 bridges + storey module-handler), badge = 9, visibility = 15', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildComboboxRoutes(comboboxDeps() as any)).toHaveLength(35);
    expect(buildBadgeRoutes(boolDeps('getBadgeState',
      ['stairBridge', 'wallBridge', 'openingBridge', 'slabBridge', 'roofBridge', 'columnBridge',
        'beamBridge', 'foundationBridge', 'slabOpeningBridge']) as never)).toHaveLength(9);
    expect(buildVisibilityRoutes(boolDeps('getPanelVisibility',
      ['stairBridge', 'columnBridge', 'beamBridge', 'slabBridge', 'mepFixtureBridge', 'mepManifoldBridge',
        'electricalPanelBridge', 'mepBoilerBridge', 'mepWaterHeaterBridge', 'mepUnderfloorBridge',
        'mepSegmentBridge', 'furnitureBridge', 'floorplanSymbolBridge', 'hatchBridge', 'lineToolBridge']) as never)).toHaveLength(15);
  });
});

describe('dispatch tables — no-drift invariant (write ≡ read except readouts)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = buildComboboxRoutes(comboboxDeps() as any);

  it('exactly 4 routes have a wider matchRead (hatch/column/radiator/boiler readouts)', () => {
    const drifting = routes.filter((r) => r.matchWrite !== r.matchRead);
    expect(drifting).toHaveLength(4);
  });

  it('every other route shares ONE matcher for write & read (cannot drift)', () => {
    const same = routes.filter((r) => r.matchWrite === r.matchRead);
    expect(same).toHaveLength(31); // 35 total − 4 readout routes
  });
});

describe('runners — first-match / order / fallback', () => {
  const route = (id: string, match: (k: string) => boolean): ComboboxRoute & { id: string } => ({
    id,
    matchWrite: match,
    matchRead: match,
    onChange: () => {},
    getState: () => ({ value: id, options: [] }),
  });

  it('dispatchComboboxWrite calls the FIRST matching route, else fallback', () => {
    const hits: string[] = [];
    const a: ComboboxRoute = { matchWrite: (k) => k.startsWith('a'), matchRead: () => false, onChange: () => hits.push('a'), getState: () => null };
    const b: ComboboxRoute = { matchWrite: (k) => k.startsWith('a') || k.startsWith('b'), matchRead: () => false, onChange: () => hits.push('b'), getState: () => null };
    let fell = false;
    dispatchComboboxWrite([a, b], 'a.x', 'v', () => { fell = true; });
    dispatchComboboxWrite([a, b], 'b.x', 'v', () => { fell = true; });
    dispatchComboboxWrite([a, b], 'z.x', 'v', () => { fell = true; });
    expect(hits).toEqual(['a', 'b']); // 'a.x' → a (first), 'b.x' → b
    expect(fell).toBe(true);          // 'z.x' → fallback
  });

  it('dispatchComboboxRead returns the FIRST matching route state, else fallback', () => {
    const routes = [route('r1', (k) => k === 'k1'), route('r2', (k) => k === 'k2')];
    expect(dispatchComboboxRead(routes, 'k1', () => null)?.value).toBe('r1');
    expect(dispatchComboboxRead(routes, 'k2', () => null)?.value).toBe('r2');
    expect(dispatchComboboxRead(routes, 'k9', () => ({ value: 'FB', options: [] }))?.value).toBe('FB');
  });

  it('dispatchSimple returns the fallbackValue when nothing matches', () => {
    const routes: SimpleRoute[] = [{ match: (k) => k === 'hit', handle: () => true }];
    expect(dispatchSimple(routes, 'hit', false)).toBe(true);
    expect(dispatchSimple(routes, 'miss', false)).toBe(false); // badge default
    expect(dispatchSimple(routes, 'miss', true)).toBe(true);   // visibility default
  });
});

describe('routing — real keys', () => {
  const deps = comboboxDeps();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = buildComboboxRoutes(deps as any);

  it('a normal wall key routes to wallBridge for BOTH write and read', () => {
    const wallKey = WALL_RIBBON_NUMBER_KEYS[0];
    dispatchComboboxWrite(routes, wallKey, '42', () => { throw new Error('should not fall through'); });
    expect(deps.wallBridge.writes).toEqual([[wallKey, '42']]);
    expect(dispatchComboboxRead(routes, wallKey, () => null)?.value).toBe('wallBridge');
  });

  it('hatch readout key is READ-ONLY: read → hatchBridge, write → fallback', () => {
    const readoutKey = 'hatch.readout.area';
    expect(dispatchComboboxRead(routes, readoutKey, () => null)?.value).toBe('hatchBridge');
    let fellThrough = false;
    dispatchComboboxWrite(routes, readoutKey, 'x', () => { fellThrough = true; });
    expect(fellThrough).toBe(true);
    expect(deps.hatchBridge.writes).toEqual([]); // never written
  });

  it('column structural readout key is READ-ONLY: read → columnBridge, write → fallback', () => {
    const readoutKey = 'column.structural.readout.concreteWeight';
    expect(dispatchComboboxRead(routes, readoutKey, () => null)?.value).toBe('columnBridge');
    let fellThrough = false;
    dispatchComboboxWrite(routes, readoutKey, 'x', () => { fellThrough = true; });
    expect(fellThrough).toBe(true);
    expect(deps.columnBridge.writes).toEqual([]);
  });

  it('an unknown key falls through to the fallback on both paths', () => {
    let wroteFallback = false;
    dispatchComboboxWrite(routes, '__nope__.x', 'v', () => { wroteFallback = true; });
    expect(wroteFallback).toBe(true);
    expect(dispatchComboboxRead(routes, '__nope__.x', () => ({ value: 'FB', options: [] }))?.value).toBe('FB');
  });
});
