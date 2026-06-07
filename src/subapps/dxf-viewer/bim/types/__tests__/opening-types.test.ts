/**
 * Tests — Opening Kind SSoT predicates + plan-symbol map (ADR-421 SLICE B).
 *
 * Coverage:
 *   - Exhaustiveness: OPENING_KIND_DEFAULTS, OPENING_PLAN_SYMBOL cover every
 *     OpeningKind (no kind silently dropped from a Record map).
 *   - Predicate routing (isWindowKind / isGlazedKind / isSlidingKind /
 *     isFoldingKind / isHingedKind / isDoubleLeafKind) per Revit family.
 *   - Door↔window partition is total + disjoint (every kind is exactly one).
 */

import {
  OPENING_KIND_DEFAULTS,
  OPENING_PLAN_SYMBOL,
  isWindowKind,
  isGlazedKind,
  isSlidingKind,
  isFoldingKind,
  isHingedKind,
  isDoubleLeafKind,
} from '../opening-types';
import type { OpeningKind } from '../opening-types';

const ALL_KINDS = Object.keys(OPENING_KIND_DEFAULTS) as OpeningKind[];

const DOOR_KINDS: OpeningKind[] = [
  'door', 'double-door', 'sliding-door', 'double-sliding-door', 'pocket-door',
  'bifold-door', 'overhead-door', 'revolving-door', 'french-door',
];
const WINDOW_KINDS: OpeningKind[] = [
  'window', 'fixed', 'double-hung-window', 'sliding-window', 'awning-window',
  'hopper-window', 'tilt-turn-window', 'bay-window',
];

describe('OpeningKind catalog (17 types)', () => {
  it('has all 17 kinds with defaults', () => {
    expect(ALL_KINDS).toHaveLength(17);
  });

  it('OPENING_PLAN_SYMBOL covers every kind (exhaustive)', () => {
    for (const kind of ALL_KINDS) {
      expect(OPENING_PLAN_SYMBOL[kind]).toBeDefined();
    }
  });

  it('defaults are positive width/height with finite sill', () => {
    for (const kind of ALL_KINDS) {
      const d = OPENING_KIND_DEFAULTS[kind];
      expect(d.width).toBeGreaterThan(0);
      expect(d.height).toBeGreaterThan(0);
      expect(Number.isFinite(d.sillHeight)).toBe(true);
    }
  });
});

describe('isWindowKind partition', () => {
  it('is total + disjoint vs door kinds', () => {
    for (const kind of WINDOW_KINDS) expect(isWindowKind(kind)).toBe(true);
    for (const kind of DOOR_KINDS) expect(isWindowKind(kind)).toBe(false);
  });
});

describe('isGlazedKind', () => {
  it('all windows + french-door are glazed; opaque doors are not', () => {
    for (const kind of WINDOW_KINDS) expect(isGlazedKind(kind)).toBe(true);
    expect(isGlazedKind('french-door')).toBe(true);
    expect(isGlazedKind('door')).toBe(false);
    expect(isGlazedKind('overhead-door')).toBe(false);
  });
});

describe('isSlidingKind (sliding-door family)', () => {
  it('covers sliding/double-sliding/pocket only', () => {
    expect(isSlidingKind('sliding-door')).toBe(true);
    expect(isSlidingKind('double-sliding-door')).toBe(true);
    expect(isSlidingKind('pocket-door')).toBe(true);
    expect(isSlidingKind('sliding-window')).toBe(false);
    expect(isSlidingKind('door')).toBe(false);
  });
});

describe('isFoldingKind / isHingedKind / isDoubleLeafKind', () => {
  it('folding = bifold only', () => {
    expect(isFoldingKind('bifold-door')).toBe(true);
    expect(isFoldingKind('door')).toBe(false);
  });

  it('hinged = door + double-leaf only (no new SLICE B kinds)', () => {
    expect(isHingedKind('door')).toBe(true);
    expect(isHingedKind('double-door')).toBe(true);
    expect(isHingedKind('french-door')).toBe(true);
    expect(isHingedKind('bifold-door')).toBe(false);
    expect(isHingedKind('sliding-door')).toBe(false);
  });

  it('double-leaf = double-door + french-door', () => {
    expect(isDoubleLeafKind('double-door')).toBe(true);
    expect(isDoubleLeafKind('french-door')).toBe(true);
    expect(isDoubleLeafKind('double-sliding-door')).toBe(false);
  });
});

describe('plan symbol routing', () => {
  it('doors map to door symbols; windows to glazing symbols', () => {
    expect(OPENING_PLAN_SYMBOL['sliding-door']).toBe('sliding');
    expect(OPENING_PLAN_SYMBOL['pocket-door']).toBe('sliding');
    expect(OPENING_PLAN_SYMBOL['bifold-door']).toBe('folding');
    expect(OPENING_PLAN_SYMBOL['overhead-door']).toBe('overhead');
    expect(OPENING_PLAN_SYMBOL['revolving-door']).toBe('revolving');
    expect(OPENING_PLAN_SYMBOL['sliding-window']).toBe('glazing-slide-h');
    expect(OPENING_PLAN_SYMBOL['double-hung-window']).toBe('glazing-slide-v');
    expect(OPENING_PLAN_SYMBOL['awning-window']).toBe('glazing-awning');
    expect(OPENING_PLAN_SYMBOL['hopper-window']).toBe('glazing-hopper');
    expect(OPENING_PLAN_SYMBOL['tilt-turn-window']).toBe('glazing-tilt-turn');
    expect(OPENING_PLAN_SYMBOL['bay-window']).toBe('bay');
  });
});
