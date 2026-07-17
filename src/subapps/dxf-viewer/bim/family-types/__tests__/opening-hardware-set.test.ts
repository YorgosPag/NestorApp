/**
 * Tests για ADR-674 Φ Α — Opening Hardware-Set SSoT (hardware take-off model).
 *
 * Locks the catalog decided in ADR-674: per-kind Revit-standard hardware sets,
 * exhaustive over `OpeningKind`, with `materialId` flowing from the ADR-611
 * material resolver (`resolveOpeningMaterial().hardware`) and
 * `openingHasOperableHardware` in exact parity with the 3D `buildHardwareSpecs`
 * handle dispatch.
 *
 * @see ../opening-hardware-set.ts
 * @see ../../../bim-3d/converters/opening-hardware-builders.ts — 3D handle parity
 */

import type { OpeningKind, OpeningParams } from '../../types/opening-types';
import {
  OPENING_HARDWARE_CATALOG,
  HARDWARE_COMPONENT_LABEL_KEY,
  openingHasOperableHardware,
  resolveOpeningHardwareSet,
} from '../opening-hardware-set';
import type {
  OpeningHardwareComponent,
  ResolvedHardwareItem,
} from '../opening-hardware-set';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ALL_KINDS: readonly OpeningKind[] = [
  'door',
  'double-door',
  'sliding-door',
  'double-sliding-door',
  'pocket-door',
  'bifold-door',
  'overhead-door',
  'revolving-door',
  'french-door',
  'window',
  'fixed',
  'double-hung-window',
  'sliding-window',
  'awning-window',
  'hopper-window',
  'tilt-turn-window',
  'bay-window',
];

const EMPTY_KINDS: readonly OpeningKind[] = [
  'fixed',
  'bay-window',
  'overhead-door',
  'revolving-door',
];

function makeParams(
  kind: OpeningKind,
  overrides: Partial<OpeningParams> = {},
): OpeningParams {
  return {
    kind,
    wallId: 'wall-1',
    offsetFromStart: 500,
    width: 900,
    height: 2100,
    sillHeight: kind.endsWith('window') || kind === 'window' || kind === 'fixed' ? 900 : 0,
    ...overrides,
  } as OpeningParams;
}

/** Sum a resolved set into a { component: quantity } map for exact assertions. */
function countMap(
  items: ReadonlyArray<ResolvedHardwareItem>,
): Partial<Record<OpeningHardwareComponent, number>> {
  const out: Partial<Record<OpeningHardwareComponent, number>> = {};
  for (const item of items) out[item.component] = item.quantity;
  return out;
}

// ─── Catalog exhaustiveness ───────────────────────────────────────────────────

describe('OPENING_HARDWARE_CATALOG — exhaustiveness (ADR-674 Φ Α)', () => {
  test('every OpeningKind resolves to a set (never undefined)', () => {
    for (const kind of ALL_KINDS) {
      expect(OPENING_HARDWARE_CATALOG[kind]).toBeDefined();
      expect(Array.isArray(OPENING_HARDWARE_CATALOG[kind])).toBe(true);
    }
  });

  test('every catalogued component has a label-key stem', () => {
    for (const kind of ALL_KINDS) {
      for (const entry of OPENING_HARDWARE_CATALOG[kind]) {
        expect(HARDWARE_COMPONENT_LABEL_KEY[entry.component]).toMatch(/^hardwareComponent\./);
      }
    }
  });

  test('all quantities are positive integers', () => {
    for (const kind of ALL_KINDS) {
      for (const entry of OPENING_HARDWARE_CATALOG[kind]) {
        expect(Number.isInteger(entry.quantity)).toBe(true);
        expect(entry.quantity).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Exact quantities ──────────────────────────────────────────────────────────

describe('resolveOpeningHardwareSet — exact quantities (Revit standard)', () => {
  test('door → lever×1, lockset×1, hinge×3', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('door')));
    expect(counts).toEqual({ lever: 1, lockset: 1, hinge: 3 });
  });

  test('double-door → lever×2, lockset×1, hinge×6, flush-bolt×2', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('double-door')));
    expect(counts).toEqual({ lever: 2, lockset: 1, hinge: 6, 'flush-bolt': 2 });
  });

  test('french-door mirrors double-door (glazed double leaf)', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('french-door')));
    expect(counts).toEqual({ lever: 2, lockset: 1, hinge: 6, 'flush-bolt': 2 });
  });

  test('sliding-door → pull-handle×1, sliding-track×1', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('sliding-door')));
    expect(counts).toEqual({ 'pull-handle': 1, 'sliding-track': 1 });
  });

  test('casement window → window-handle×1, hinge×2', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('window')));
    expect(counts).toEqual({ 'window-handle': 1, hinge: 2 });
  });

  test('awning window → window-handle×1, friction-stay×2', () => {
    const counts = countMap(resolveOpeningHardwareSet(makeParams('awning-window')));
    expect(counts).toEqual({ 'window-handle': 1, 'friction-stay': 2 });
  });

  test.each(EMPTY_KINDS)('%s → empty set', (kind) => {
    expect(resolveOpeningHardwareSet(makeParams(kind))).toEqual([]);
  });
});

// ─── Material flow (ADR-611 resolver) ───────────────────────────────────────────

describe('resolveOpeningHardwareSet — materialId from resolveOpeningMaterial().hardware', () => {
  test('default → every item carries mat-metal', () => {
    const items = resolveOpeningHardwareSet(makeParams('door'));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.materialId).toBe('mat-metal');
  });

  test('per-part hardware override flows to every item', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('double-door', { materials: { hardware: 'mat-brass' } }),
    );
    for (const item of items) expect(item.materialId).toBe('mat-brass');
  });

  test('legacy single `material` does NOT touch hardware (stays metal)', () => {
    const items = resolveOpeningHardwareSet(makeParams('door', { material: 'mat-wood' }));
    for (const item of items) expect(item.materialId).toBe('mat-metal');
  });

  test('labelKey stems come from the SSoT mapping', () => {
    const items = resolveOpeningHardwareSet(makeParams('door'));
    const lever = items.find((i) => i.component === 'lever');
    expect(lever?.labelKey).toBe('hardwareComponent.lever');
  });
});

// ─── Predicate parity with the 3D handle dispatch ────────────────────────────────

describe('openingHasOperableHardware — parity (ADR-674)', () => {
  test('equals (resolved set length > 0) for every kind', () => {
    for (const kind of ALL_KINDS) {
      const setLen = resolveOpeningHardwareSet(makeParams(kind)).length;
      expect(openingHasOperableHardware(kind)).toBe(setLen > 0);
    }
  });

  test('TRUE for the kinds where buildHardwareSpecs draws a handle', () => {
    const withHandle: readonly OpeningKind[] = [
      'door',
      'double-door',
      'french-door',
      'sliding-door',
      'double-sliding-door',
      'pocket-door',
      'bifold-door',
      'window',
      'double-hung-window',
      'sliding-window',
      'awning-window',
      'hopper-window',
      'tilt-turn-window',
    ];
    for (const kind of withHandle) expect(openingHasOperableHardware(kind)).toBe(true);
  });

  test('FALSE for fixed / bay-window / overhead-door / revolving-door', () => {
    for (const kind of EMPTY_KINDS) expect(openingHasOperableHardware(kind)).toBe(false);
  });
});
