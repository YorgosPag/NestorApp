/**
 * Tests για ADR-674 (editable hardware-set) — the per-component quantity FOLD in
 * `resolveOpeningHardwareSet`. Locks the «type default, instance override» model
 * (mirror ADR-672 materials): the per-kind catalog default is overridden by the
 * family Type's `hardwareOverrides`, which is in turn overridden per placement by
 * the instance's `hardwareOverrides` (LAST wins). Overriding to `0` removes a
 * component; a positive override for a component absent from the kind's default
 * ADDS it. Un-overridden params reproduce the catalog exactly (zero regression).
 *
 * @see ../opening-hardware-set.ts §resolveOpeningHardwareSet
 * @see ../__tests__/opening-hardware-set.test.ts — the catalog-default lock (Φ Α)
 */

import type { OpeningKind, OpeningParams, OpeningHardwareOverrides } from '../../types/opening-types';
import type { OpeningTypeParams } from '../../types/bim-family-type';
import { resolveOpeningHardwareSet } from '../opening-hardware-set';
import type {
  OpeningHardwareComponent,
  ResolvedHardwareItem,
} from '../opening-hardware-set';

// ─── Fixtures ───────────────────────────────────────────────────────────────

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
    sillHeight: 0,
    ...overrides,
  } as OpeningParams;
}

function makeType(hardwareOverrides?: OpeningHardwareOverrides): OpeningTypeParams {
  return { kind: 'door', width: 900, height: 2100, hardwareOverrides } as OpeningTypeParams;
}

/** Collapse a resolved set into a { component: quantity } map for exact assertions. */
function countMap(
  items: ReadonlyArray<ResolvedHardwareItem>,
): Partial<Record<OpeningHardwareComponent, number>> {
  const out: Partial<Record<OpeningHardwareComponent, number>> = {};
  for (const item of items) out[item.component] = item.quantity;
  return out;
}

// ─── Zero regression ────────────────────────────────────────────────────────

describe('resolveOpeningHardwareSet — zero regression (no overrides)', () => {
  test('door with no overrides == catalog default (lever×1, lockset×1, hinge×3)', () => {
    expect(countMap(resolveOpeningHardwareSet(makeParams('door')))).toEqual({
      lever: 1,
      lockset: 1,
      hinge: 3,
    });
  });

  test('empty-set kind stays empty even with an undefined-only override object', () => {
    const items = resolveOpeningHardwareSet(makeParams('fixed', { hardwareOverrides: {} }));
    expect(items).toEqual([]);
  });

  test('catalog order is preserved (lever, lockset, hinge)', () => {
    const items = resolveOpeningHardwareSet(makeParams('door'));
    expect(items.map((i) => i.component)).toEqual(['lever', 'lockset', 'hinge']);
  });
});

// ─── Instance override («this door: 4 hinges») ──────────────────────────────

describe('resolveOpeningHardwareSet — instance override', () => {
  test('bumps a catalog component quantity (hinge 3 → 4) keeping its slot', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { hinge: 4 } }),
    );
    expect(countMap(items)).toEqual({ lever: 1, lockset: 1, hinge: 4 });
    expect(items.map((i) => i.component)).toEqual(['lever', 'lockset', 'hinge']);
  });

  test('override to 0 removes a component', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { lockset: 0 } }),
    );
    expect(countMap(items)).toEqual({ lever: 1, hinge: 3 });
  });

  test('a component absent from the kind default is ADDED (positive override)', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { 'flush-bolt': 2 } }),
    );
    expect(countMap(items)).toEqual({ lever: 1, lockset: 1, hinge: 3, 'flush-bolt': 2 });
    // Added component appends after the catalog components.
    expect(items[items.length - 1].component).toBe('flush-bolt');
  });

  test('added components still carry the resolved metal material + labelKey', () => {
    const added = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { 'flush-bolt': 2 } }),
    ).find((i) => i.component === 'flush-bolt');
    expect(added?.materialId).toBe('mat-metal');
    expect(added?.labelKey).toBe('hardwareComponent.flushBolt');
  });
});

// ─── Type-level default ─────────────────────────────────────────────────────

describe('resolveOpeningHardwareSet — family-type default override', () => {
  test('type-level hinge×4 applies when the instance has no override', () => {
    const items = resolveOpeningHardwareSet(makeParams('door'), makeType({ hinge: 4 }));
    expect(countMap(items)).toEqual({ lever: 1, lockset: 1, hinge: 4 });
  });
});

// ─── Fold precedence (type default < instance override) ─────────────────────

describe('resolveOpeningHardwareSet — instance wins over type (LAST wins)', () => {
  test('instance hinge×5 overrides type hinge×4', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { hinge: 5 } }),
      makeType({ hinge: 4 }),
    );
    expect(countMap(items).hinge).toBe(5);
  });

  test('type and instance override different components — both apply', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { lever: 2 } }),
      makeType({ hinge: 4 }),
    );
    expect(countMap(items)).toEqual({ lever: 2, lockset: 1, hinge: 4 });
  });

  test('instance can re-enable a component the type removed (0 → 1)', () => {
    const items = resolveOpeningHardwareSet(
      makeParams('door', { hardwareOverrides: { lockset: 1 } }),
      makeType({ lockset: 0 }),
    );
    expect(countMap(items).lockset).toBe(1);
  });
});
