/**
 * ADR-358 Phase 6 — Stair validator tests.
 *
 * Coverage: hard errors + 4 code profiles (NOK κύρια/δευτερεύουσα, IBC,
 * Eurocode, ADA) + cheap 2D headroom proxy + idempotency + 'none' profile.
 *
 * Idempotency assertions exclude `lastValidatedAt` (Timestamp.now()).
 *
 * @see ../stair-validator.ts
 */

import { validateStairParams } from '../stair-validator';
import type { Entity } from '../../../types/entities';
import type {
  StairCodeProfile,
  StairNokSubType,
  StairParams,
  StairVariantStraight,
} from '../../../types/stair';

const STRAIGHT: StairVariantStraight = { kind: 'straight' };

interface BaseOverrides {
  readonly rise?: number;
  readonly tread?: number;
  readonly width?: number;
  readonly stepCount?: number;
  readonly totalRise?: number;
  readonly codeProfile?: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;
  readonly handrailHeight?: number;
  readonly topExtension?: number;
  readonly bottomExtension?: StairParams['handrails']['bottomExtension'];
  readonly adaContrastStrip?: boolean;
  readonly basePointZ?: number;
}

function buildParams(overrides: BaseOverrides = {}): StairParams {
  const rise = overrides.rise ?? 175;
  const stepCount = overrides.stepCount ?? 10;
  const tread = overrides.tread ?? 280;
  return {
    basePoint: { x: 0, y: 0, z: overrides.basePointZ ?? 0 },
    direction: 0,
    rise,
    tread,
    nosing: 25,
    nosingSide: 'front',
    width: overrides.width ?? 1200,
    stepCount,
    totalRise: overrides.totalRise ?? rise * stepCount,
    totalRun: tread * (stepCount - 1),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: overrides.adaContrastStrip ?? false,
    variant: STRAIGHT,
    walklineOffset: 300,
    handrails: {
      inner: true,
      outer: true,
      height: overrides.handrailHeight ?? 900,
      topExtension: overrides.topExtension ?? 305,
      bottomExtension: overrides.bottomExtension ?? 'one-tread',
    },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: overrides.codeProfile ?? 'none',
    nokSubType: overrides.nokSubType,
  };
}

function ceilingEntity(elevationMm: number, layer = 'CEILING'): Entity {
  return {
    id: `ceiling-${elevationMm}`,
    type: 'line',
    layer,
    startPoint: { x: -1000, y: -1000 },
    endPoint: { x: 1000, y: 1000 },
    metadata: { elevation: elevationMm },
  } as Entity;
}

// ─── Hard errors ─────────────────────────────────────────────────────────────

describe('validateStairParams — hard errors', () => {
  test('stepCount < 2 emits hardError.stepCount', () => {
    const r = validateStairParams(buildParams({ stepCount: 1 }));
    expect(r.violationKeys).toContain('tools.stair.validator.hardError.stepCount');
  });

  test('width <= 0 emits hardError.width', () => {
    const r = validateStairParams(buildParams({ width: 0 }));
    expect(r.violationKeys).toContain('tools.stair.validator.hardError.width');
  });

  test('rise <= 0 emits hardError.rise', () => {
    const r = validateStairParams(buildParams({ rise: 0, totalRise: 1750 }));
    expect(r.violationKeys).toContain('tools.stair.validator.hardError.rise');
  });

  test('tread <= 0 emits hardError.tread', () => {
    const r = validateStairParams(buildParams({ tread: 0 }));
    expect(r.violationKeys).toContain('tools.stair.validator.hardError.tread');
  });

  test('totalRise <= 0 emits hardError.totalRise', () => {
    const r = validateStairParams(buildParams({ totalRise: 0 }));
    expect(r.violationKeys).toContain('tools.stair.validator.hardError.totalRise');
  });
});

// ─── NOK κύρια ───────────────────────────────────────────────────────────────

describe('validateStairParams — NOK κύρια (main)', () => {
  test('width 1100 emits nok.widthMin', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'nok', width: 1100 }));
    expect(r.violationKeys).toContain('tools.stair.validator.nok.widthMin');
  });

  test('width 1200 + nominal params: no nok violations', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', width: 1200, rise: 175, tread: 280 }),
    );
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.nok.'))).toHaveLength(0);
  });

  test('rise 200 (> 180) emits nok.riseRange', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'nok', rise: 200 }));
    expect(r.violationKeys).toContain('tools.stair.validator.nok.riseRange');
  });

  test('2R+G = 700 (> 640) emits nok.twoRPlusG (main)', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', rise: 175, tread: 350 }),
    );
    expect(r.violationKeys).toContain('tools.stair.validator.nok.twoRPlusG');
  });
});

// ─── NOK δευτερεύουσα ────────────────────────────────────────────────────────

describe('validateStairParams — NOK δευτερεύουσα (secondary)', () => {
  test('width 800 emits nok.widthMin', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', nokSubType: 'secondary', width: 800 }),
    );
    expect(r.violationKeys).toContain('tools.stair.validator.nok.widthMin');
  });

  test('width 900 + nominal params: no nok violations', () => {
    const r = validateStairParams(
      buildParams({
        codeProfile: 'nok',
        nokSubType: 'secondary',
        width: 900,
        rise: 175,
        tread: 260,
      }),
    );
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.nok.'))).toHaveLength(0);
  });

  test('rise 220 (> 200) emits nok.riseRange', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', nokSubType: 'secondary', rise: 220, width: 900 }),
    );
    expect(r.violationKeys).toContain('tools.stair.validator.nok.riseRange');
  });
});

// ─── IBC ─────────────────────────────────────────────────────────────────────

describe('validateStairParams — IBC', () => {
  test('width 900 emits ibc.widthMin', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'ibc', width: 900 }));
    expect(r.violationKeys).toContain('tools.stair.validator.ibc.widthMin');
  });

  test('rise 200 (> 177.8) emits ibc.riseMax', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'ibc', rise: 200, width: 1200 }));
    expect(r.violationKeys).toContain('tools.stair.validator.ibc.riseMax');
  });

  test('tread 250 (< 279.4) emits ibc.treadMin', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'ibc', tread: 250, width: 1200 }));
    expect(r.violationKeys).toContain('tools.stair.validator.ibc.treadMin');
  });
});

// ─── Eurocode ────────────────────────────────────────────────────────────────

describe('validateStairParams — Eurocode', () => {
  test('width 900 emits eurocode.widthMin', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'eurocode', width: 900, rise: 180, tread: 280 }));
    expect(r.violationKeys).toContain('tools.stair.validator.eurocode.widthMin');
  });

  test('2R+G = 550 (< 600) emits eurocode.twoRPlusG', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'eurocode', rise: 170, tread: 210, width: 1000 }),
    );
    expect(r.violationKeys).toContain('tools.stair.validator.eurocode.twoRPlusG');
  });

  test('2R+G = 620 within band: no twoRPlusG violation', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'eurocode', rise: 170, tread: 280, width: 1000 }),
    );
    expect(r.violationKeys).not.toContain('tools.stair.validator.eurocode.twoRPlusG');
  });
});

// ─── ADA ─────────────────────────────────────────────────────────────────────

describe('validateStairParams — ADA', () => {
  function adaCompliantParams(): BaseOverrides {
    return {
      codeProfile: 'ada',
      rise: 175,
      tread: 280,
      width: 1200,
      handrailHeight: 900,
      topExtension: 305,
      bottomExtension: 'one-tread',
      adaContrastStrip: true,
    };
  }

  test('rise 200 emits ada.riseMax', () => {
    const r = validateStairParams(buildParams({ ...adaCompliantParams(), rise: 200 }));
    expect(r.adaViolations).toContain('tools.stair.validator.ada.riseMax');
  });

  test('tread 260 emits ada.treadMin', () => {
    const r = validateStairParams(buildParams({ ...adaCompliantParams(), tread: 260 }));
    expect(r.adaViolations).toContain('tools.stair.validator.ada.treadMin');
  });

  test('handrail height 800 emits ada.handrailHeight', () => {
    const r = validateStairParams(buildParams({ ...adaCompliantParams(), handrailHeight: 800 }));
    expect(r.adaViolations).toContain('tools.stair.validator.ada.handrailHeight');
  });

  test('topExtension 250 emits ada.topExtension', () => {
    const r = validateStairParams(buildParams({ ...adaCompliantParams(), topExtension: 250 }));
    expect(r.adaViolations).toContain('tools.stair.validator.ada.topExtension');
  });

  test('contrastStrip false emits ada.contrastStrip', () => {
    const r = validateStairParams(buildParams({ ...adaCompliantParams(), adaContrastStrip: false }));
    expect(r.adaViolations).toContain('tools.stair.validator.ada.contrastStrip');
  });

  test('fully compliant ADA params: no ada violations', () => {
    const r = validateStairParams(buildParams(adaCompliantParams()));
    expect(r.adaViolations ?? []).toHaveLength(0);
  });
});

// ─── Headroom (cheap 2D proxy) ───────────────────────────────────────────────

describe('validateStairParams — headroom proxy', () => {
  test('ceiling well above stair top: no headroom violation', () => {
    const params = buildParams({ codeProfile: 'nok', basePointZ: 0, rise: 175, stepCount: 10 });
    const r = validateStairParams(params, [ceilingEntity(4000)]);
    expect(r.headroomViolations ?? []).toHaveLength(0);
  });

  test('ceiling too close to stair top: emits headroomBelowMin', () => {
    const params = buildParams({ codeProfile: 'nok', basePointZ: 0, rise: 175, stepCount: 10 });
    // stairTopZ = 1750; clearance = 3000 - 1750 = 1250 < 2030 → warn
    const r = validateStairParams(params, [ceilingEntity(3000)]);
    expect(r.headroomViolations).toContain('tools.stair.validator.headroomBelowMin');
  });

  test('non-ceiling layer ignored', () => {
    const params = buildParams({ codeProfile: 'nok' });
    const r = validateStairParams(params, [ceilingEntity(3000, 'WALLS')]);
    expect(r.headroomViolations ?? []).toHaveLength(0);
  });

  test('entity without elevation metadata is skipped silently', () => {
    const params = buildParams({ codeProfile: 'nok' });
    const noMeta: Entity = {
      id: 'no-meta',
      type: 'line',
      layer: 'CEILING',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    } as Entity;
    const r = validateStairParams(params, [noMeta]);
    expect(r.headroomViolations ?? []).toHaveLength(0);
  });

  test('codeProfile none: headroom skipped', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'none' }), [ceilingEntity(0)]);
    expect(r.headroomViolations ?? []).toHaveLength(0);
  });
});

// ─── Egress (G20, Phase 6.5) ─────────────────────────────────────────────────

describe('validateStairParams — egress capacity (G20)', () => {
  test('width 900 + occupancyLoad 200 (req=1524mm) emits egress.widthBelowOccupancy', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', width: 900 }),
      [],
      200,
    );
    expect(r.egressViolations).toContain('tools.stair.validator.egress.widthBelowOccupancy');
  });

  test('width 2000 + occupancyLoad 100 (req=762mm): no egress violation', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', width: 2000 }),
      [],
      100,
    );
    expect(r.egressViolations ?? []).toHaveLength(0);
  });

  test('occupancyLoad undefined: no egress check', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'nok', width: 100 }));
    expect(r.egressViolations ?? []).toHaveLength(0);
  });

  test('occupancyLoad 0: no egress check (disabled)', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', width: 100 }),
      [],
      0,
    );
    expect(r.egressViolations ?? []).toHaveLength(0);
  });

  test('codeProfile none: no egress check', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'none', width: 100 }),
      [],
      500,
    );
    expect(r.egressViolations ?? []).toHaveLength(0);
  });

  test('projectOccupancyLoad overrides params.occupancyLoad', () => {
    // params.occupancyLoad would not trigger (50 × 7.62 = 381 < width 1200),
    // but projectOccupancyLoad 500 (× 7.62 = 3810) does → violation.
    const params: StairParams = {
      ...buildParams({ codeProfile: 'nok', width: 1200 }),
      occupancyLoad: 50,
    };
    const r = validateStairParams(params, [], 500);
    expect(r.egressViolations).toContain('tools.stair.validator.egress.widthBelowOccupancy');
  });

  test('params.occupancyLoad used when projectOccupancyLoad absent', () => {
    const params: StairParams = {
      ...buildParams({ codeProfile: 'nok', width: 800 }),
      occupancyLoad: 200,
    };
    const r = validateStairParams(params);
    expect(r.egressViolations).toContain('tools.stair.validator.egress.widthBelowOccupancy');
  });

  test('egress key sits under expected namespace', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'ibc', width: 500 }),
      [],
      100,
    );
    expect(r.egressViolations?.every((k) => k.startsWith('tools.stair.validator.egress.'))).toBe(true);
  });
});

// ─── Profile 'none' + idempotency ────────────────────────────────────────────

describe('validateStairParams — profile none + idempotency', () => {
  test('codeProfile none: only hard errors possible, zero code violations', () => {
    const r = validateStairParams(buildParams({ codeProfile: 'none', width: 100 }));
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.nok.'))).toHaveLength(0);
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.ibc.'))).toHaveLength(0);
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.eurocode.'))).toHaveLength(0);
    expect(r.violationKeys.filter((k) => k.startsWith('tools.stair.validator.ada.'))).toHaveLength(0);
  });

  test('same input twice → same violation keys (excluding timestamp)', () => {
    const params = buildParams({ codeProfile: 'nok', rise: 200, width: 1100 });
    const a = validateStairParams(params);
    const b = validateStairParams(params);
    expect(b.violationKeys).toEqual(a.violationKeys);
    expect(b.hasCodeViolations).toBe(a.hasCodeViolations);
  });

  test('hasCodeViolations false when fully clean (nominal NOK main)', () => {
    const r = validateStairParams(
      buildParams({ codeProfile: 'nok', width: 1200, rise: 175, tread: 280 }),
    );
    expect(r.hasCodeViolations).toBe(false);
    expect(r.violationKeys).toHaveLength(0);
  });
});
