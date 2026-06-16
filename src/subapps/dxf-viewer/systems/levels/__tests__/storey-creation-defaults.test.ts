/**
 * ADR-448 Phase 2 — storey-creation-defaults SSoT unit tests.
 *
 * Locks the `override → active-storey default → legacy fallback` precedence for
 * height / ceiling-elevation / foundation-warning, the floor-relative ceiling
 * math, and the store-backed (`readActiveStoreyContext`) default-argument path.
 */

import {
  buildActiveStoreyContext,
  type ActiveStoreyContext,
  type StoreyFloorRef,
} from '../active-storey-context';
import { useActiveStoreyStore } from '../active-storey-store';
import {
  readActiveStoreyContext,
  resolveStoreyCeilingRelativeMm,
  resolveStoreyHeightMm,
  resolveStoreyCeilingElevationMm,
  shouldWarnFoundationOnStorey,
  shouldWarnBeamOnFoundation,
  resolveStoreyDefaultEntityTypes,
} from '../storey-creation-defaults';

// Full stack with ground (datum 0) + basement + foundation below + upper @3m.
const FULL_STACK: StoreyFloorRef[] = [
  { id: 'fnd', number: -2, elevation: -4, height: 1, kind: 'foundation' },
  { id: 'bsm', number: -1, elevation: -3, height: 3, kind: 'basement' },
  { id: 'grd', number: 0, elevation: 0, height: 3, kind: 'ground' },
  { id: 'upr', number: 1, elevation: 3, height: 3.5, kind: 'standard' },
];

const ctxFor = (id: string): ActiveStoreyContext => {
  const c = buildActiveStoreyContext(FULL_STACK, id);
  if (!c) throw new Error(`no ctx for ${id}`);
  return c;
};

afterEach(() => {
  // No leak across suites — restore the default (null) store state.
  useActiveStoreyStore.setState({ context: null });
});

describe('resolveStoreyHeightMm', () => {
  it('explicit override wins over storey + fallback', () => {
    expect(resolveStoreyHeightMm(2700, 3000, ctxFor('upr'))).toBe(2700);
  });
  it('storey height when no override (3.5m floor → 3500)', () => {
    expect(resolveStoreyHeightMm(undefined, 3000, ctxFor('upr'))).toBe(3500);
  });
  it('legacy fallback when storey is null', () => {
    expect(resolveStoreyHeightMm(undefined, 3000, null)).toBe(3000);
  });
});

describe('resolveStoreyCeilingElevationMm — floor-relative', () => {
  it('override wins', () => {
    expect(resolveStoreyCeilingElevationMm(2800, 3000, ctxFor('grd'))).toBe(2800);
  });
  it('ground (next=upper @3m) → floor-relative 3000, NOT datum-relative', () => {
    // ground FFL=0, next floor FFL=3000 → ceiling = 3000 - 0 = 3000.
    expect(resolveStoreyCeilingElevationMm(undefined, 3000, ctxFor('grd'))).toBe(3000);
  });
  it('upper storey ceiling stays floor-relative (NOT absolute datum)', () => {
    // upper FFL=3000 (datum-rel), no next floor → next = FFL + height(3500) = 6500.
    // floor-relative ceiling = 6500 - 3000 = 3500 (the storey height), not 6500.
    expect(resolveStoreyCeilingElevationMm(undefined, 3000, ctxFor('upr'))).toBe(3500);
  });
  it('legacy fallback when storey null', () => {
    expect(resolveStoreyCeilingElevationMm(undefined, 3000, null)).toBe(3000);
  });
});

// ADR-450 §2 — column height & beam/slab ceiling resolve to ONE source.
describe('resolveStoreyCeilingRelativeMm — SSoT unify (ADR-450)', () => {
  it('returns the storey height (floor.height) for an upper storey', () => {
    expect(resolveStoreyCeilingRelativeMm(ctxFor('upr'))).toBe(3500);
  });
  it('returns the storey height for the ground storey', () => {
    expect(resolveStoreyCeilingRelativeMm(ctxFor('grd'))).toBe(3000);
  });
  it('returns null when there is no active storey (caller falls back)', () => {
    expect(resolveStoreyCeilingRelativeMm(null)).toBeNull();
  });
  it('column height and beam/slab ceiling resolve to the SAME number — cannot diverge', () => {
    for (const id of ['grd', 'upr', 'bsm']) {
      const ctx = ctxFor(id);
      expect(resolveStoreyHeightMm(undefined, 9999, ctx)).toBe(
        resolveStoreyCeilingElevationMm(undefined, 9999, ctx),
      );
    }
  });
});

describe('shouldWarnFoundationOnStorey', () => {
  it('false on the lowest occupied storey (basement — foundation kind excluded)', () => {
    // FULL_STACK: foundation(-2) εξαιρείται → lowest occupied = basement(-1).
    expect(shouldWarnFoundationOnStorey(ctxFor('bsm'))).toBe(false);
  });
  it('false on the dedicated FOUNDATION level — the correct home for footings (incident 2026-06-16)', () => {
    expect(shouldWarnFoundationOnStorey(ctxFor('fnd'))).toBe(false);
  });
  it('true on the ground storey when a basement is below it', () => {
    expect(shouldWarnFoundationOnStorey(ctxFor('grd'))).toBe(true);
  });
  it('true on an upper storey', () => {
    expect(shouldWarnFoundationOnStorey(ctxFor('upr'))).toBe(true);
  });
  it('false (no opinion) when storey is null', () => {
    expect(shouldWarnFoundationOnStorey(null)).toBe(false);
  });
});

describe('shouldWarnBeamOnFoundation', () => {
  it('true ONLY on the dedicated foundation level (suggest tie-beam — never blocks)', () => {
    expect(shouldWarnBeamOnFoundation(ctxFor('fnd'))).toBe(true);
  });
  it('false on ground / upper / basement storeys (regular beams are normal there)', () => {
    expect(shouldWarnBeamOnFoundation(ctxFor('grd'))).toBe(false);
    expect(shouldWarnBeamOnFoundation(ctxFor('upr'))).toBe(false);
    expect(shouldWarnBeamOnFoundation(ctxFor('bsm'))).toBe(false);
  });
  it('false (no opinion) when storey is null', () => {
    expect(shouldWarnBeamOnFoundation(null)).toBe(false);
  });
});

describe('store-backed default argument (readActiveStoreyContext)', () => {
  it('reads null by default', () => {
    expect(readActiveStoreyContext()).toBeNull();
  });
  it('resolvers fall back to the store when no storey arg passed', () => {
    useActiveStoreyStore.setState({ context: ctxFor('upr') });
    expect(readActiveStoreyContext()).not.toBeNull();
    expect(resolveStoreyHeightMm(undefined, 3000)).toBe(3500);
    expect(resolveStoreyCeilingElevationMm(undefined, 3000)).toBe(3500);
    expect(shouldWarnFoundationOnStorey()).toBe(true);
  });
});

// ADR-461 Phase C1 — per-kind creation-tool recommendation SSoT.
describe('resolveStoreyDefaultEntityTypes', () => {
  it('counted storeys recommend everything (mode = all)', () => {
    for (const kind of ['ground', 'standard', 'basement', 'mezzanine'] as const) {
      const r = resolveStoreyDefaultEntityTypes(kind);
      expect(r.mode).toBe('all');
      expect(r.categories.has('wall')).toBe(true);
      expect(r.categories.has('foundation')).toBe(true);
    }
  });

  it('null/unknown kind collapses to all (zero regression)', () => {
    expect(resolveStoreyDefaultEntityTypes(null).mode).toBe('all');
  });

  it('foundation → foundation/beam/slab only', () => {
    const r = resolveStoreyDefaultEntityTypes('foundation');
    expect(r.mode).toBe('subset');
    expect([...r.categories].sort()).toEqual(['beam', 'foundation', 'slab']);
    expect(r.categories.has('wall')).toBe(false);
    expect(r.categories.has('column')).toBe(false);
  });

  it('stair-penthouse → stair/slab/wall/railing', () => {
    const r = resolveStoreyDefaultEntityTypes('stair-penthouse');
    expect(r.mode).toBe('subset');
    expect([...r.categories].sort()).toEqual(['railing', 'slab', 'stair', 'wall']);
    expect(r.categories.has('foundation')).toBe(false);
  });

  it('roof → slab/roof/railing', () => {
    const r = resolveStoreyDefaultEntityTypes('roof');
    expect([...r.categories].sort()).toEqual(['railing', 'roof', 'slab']);
  });
});
