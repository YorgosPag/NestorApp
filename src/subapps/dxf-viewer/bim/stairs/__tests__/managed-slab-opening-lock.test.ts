/**
 * ADR-632 Φ5 — Managed slab-opening lock / override tests.
 *
 * Καλύπτει: (1) τα SSoT predicates (`managed-slab-opening-lock`), (2) το grip
 * lock (`getSlabOpeningGrips` → [] για managed), (3) το param-edit guard
 * (`UpdateSlabOpeningParamsCommand.validate` — block managed πλην Override).
 */

import type { Entity } from '../../../types/entities';
import type { SlabOpeningEntity, SlabOpeningParams } from '../../types/slab-opening-types';
import type { ISceneManager } from '../../../core/commands/interfaces';
import {
  isManagedOpeningParams,
  isManagedSlabOpening,
  isStairwellOverridePatch,
  buildStairwellOverridePatch,
} from '../managed-slab-opening-lock';
import { getSlabOpeningGrips } from '../../slab-openings/slab-opening-grips';
import { computeSlabOpeningGeometry } from '../../geometry/slab-opening-geometry';
import { UpdateSlabOpeningParamsCommand } from '../../../core/commands/entity-commands/UpdateSlabOpeningParamsCommand';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function mkParams(overrides: Partial<SlabOpeningParams> = {}): SlabOpeningParams {
  return {
    kind: 'well',
    slabId: 'slab-1',
    outline: {
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1000, y: 0, z: 0 },
        { x: 1000, y: 1000, z: 0 },
        { x: 0, y: 1000, z: 0 },
      ],
    },
    ...overrides,
  };
}

function mkEntity(params: SlabOpeningParams): SlabOpeningEntity {
  return {
    id: 'slbopn_test',
    type: 'slab-opening',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: computeSlabOpeningGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as SlabOpeningEntity;
}

// ─── Predicates ──────────────────────────────────────────────────────────────

describe('managed-slab-opening-lock predicates', () => {
  it('isManagedOpeningParams — autoStairId & !detached → true', () => {
    expect(isManagedOpeningParams(mkParams({ autoStairId: 'stair-1' }))).toBe(true);
  });

  it('isManagedOpeningParams — detached → false (user-owned)', () => {
    expect(isManagedOpeningParams(mkParams({ autoStairId: 'stair-1', autoStairDetached: true }))).toBe(false);
  });

  it('isManagedOpeningParams — manual (χωρίς autoStairId) → false', () => {
    expect(isManagedOpeningParams(mkParams())).toBe(false);
  });

  it('isManagedSlabOpening — entity guard + managed', () => {
    expect(isManagedSlabOpening(mkEntity(mkParams({ autoStairId: 'stair-1' })) as Entity)).toBe(true);
    expect(isManagedSlabOpening(mkEntity(mkParams()) as Entity)).toBe(false);
    expect(isManagedSlabOpening({ id: 'w', type: 'wall' } as unknown as Entity)).toBe(false);
  });

  it('isStairwellOverridePatch — managed prev + next.detached → true (μόνη νόμιμη μετάβαση)', () => {
    const prev = mkParams({ autoStairId: 'stair-1' });
    expect(isStairwellOverridePatch(prev, buildStairwellOverridePatch(prev))).toBe(true);
    // managed prev + non-detach next → false
    expect(isStairwellOverridePatch(prev, mkParams({ autoStairId: 'stair-1', kind: 'shaft' }))).toBe(false);
    // manual prev → false (τίποτα να ξεκλειδώσει)
    expect(isStairwellOverridePatch(mkParams(), mkParams({ autoStairDetached: true }))).toBe(false);
  });

  it('buildStairwellOverridePatch — θέτει detached, κρατά autoStairId, εφαρμόζει changes', () => {
    const patch = buildStairwellOverridePatch(mkParams({ autoStairId: 'stair-1' }), { kind: 'shaft' });
    expect(patch.autoStairDetached).toBe(true);
    expect(patch.autoStairId).toBe('stair-1'); // pair identity διατηρείται
    expect(patch.kind).toBe('shaft');
  });
});

// ─── Grip lock ───────────────────────────────────────────────────────────────

describe('getSlabOpeningGrips — Φ5 lock', () => {
  it('managed opening → μηδέν grips (κλειδωμένο)', () => {
    expect(getSlabOpeningGrips(mkEntity(mkParams({ autoStairId: 'stair-1' })))).toEqual([]);
  });

  it('detached (Override) opening → κανονικά grips (ξεκλειδωμένο)', () => {
    expect(getSlabOpeningGrips(mkEntity(mkParams({ autoStairId: 'stair-1', autoStairDetached: true })))).toHaveLength(8);
  });

  it('manual opening → κανονικά grips (μη-regression)', () => {
    expect(getSlabOpeningGrips(mkEntity(mkParams()))).toHaveLength(8);
  });
});

// ─── Param-edit command guard ────────────────────────────────────────────────

describe('UpdateSlabOpeningParamsCommand.validate — Φ5 lock', () => {
  const sm = { getEntity: () => null } as unknown as ISceneManager;
  const mkCmd = (prev: SlabOpeningParams, next: SlabOpeningParams) =>
    new UpdateSlabOpeningParamsCommand('op-1', next, prev, sm, false);

  it('managed prev + κανονικό edit → blocked (returns error string)', () => {
    const prev = mkParams({ autoStairId: 'stair-1' });
    const next = mkParams({ autoStairId: 'stair-1', kind: 'shaft' });
    expect(mkCmd(prev, next).validate()).not.toBeNull();
  });

  it('managed prev + Override (detached) patch → allowed', () => {
    const prev = mkParams({ autoStairId: 'stair-1' });
    const next = buildStairwellOverridePatch(prev, { kind: 'shaft' });
    expect(mkCmd(prev, next).validate()).toBeNull();
  });

  it('manual prev → allowed (μη-regression)', () => {
    expect(mkCmd(mkParams(), mkParams({ kind: 'shaft' })).validate()).toBeNull();
  });

  it('detached prev (ήδη ξεκλείδωτο) → allowed', () => {
    const prev = mkParams({ autoStairId: 'stair-1', autoStairDetached: true });
    const next = mkParams({ autoStairId: 'stair-1', autoStairDetached: true, kind: 'shaft' });
    expect(mkCmd(prev, next).validate()).toBeNull();
  });
});
