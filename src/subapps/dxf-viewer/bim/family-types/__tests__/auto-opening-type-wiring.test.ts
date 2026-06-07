/**
 * ADR-421 SLICE C follow-up — auto-type-on-create/load WIRING tests.
 *
 * The pure policy (`resolveAutoOpeningTypeId`) is covered by
 * `auto-opening-type.test.ts`; here we verify it is correctly threaded into the
 * two opening lifecycle points (mirror of the wall precedent):
 *   - creation  → `buildOpeningEntity` attaches the built-in `typeId` for a
 *     default-dimensioned opening, leaves a custom-dimensioned one ad-hoc.
 *   - load      → `openingDocToEntity` self-links a legacy untyped doc to the
 *     built-in type (non-destructive), while an explicit `doc.typeId` wins.
 */

import { buildOpeningEntity } from '../../../hooks/drawing/opening-completion';
import { openingDocToEntity } from '../../walls/opening-doc-hydration';
import { getBuiltInOpeningTypeId, getBuiltInOpeningTypes } from '../built-in-types';
import { useBimFamilyTypeStore } from '../bim-family-type-store';
import { computeWallGeometry } from '../../geometry/wall-geometry';
import { OPENING_KIND_DEFAULTS } from '../../types/opening-types';
import type { WallEntity, WallParams } from '../../types/wall-types';
import type { OpeningParams } from '../../types/opening-types';
import type { OpeningDoc } from '../../walls/opening-firestore-service';

const CO = 'company_1';

function makeWall(): WallEntity {
  const params: WallParams = {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 5000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
  };
  return {
    id: 'wall_test',
    type: 'wall',
    kind: 'straight',
    layerId: '0',
    params,
    geometry: computeWallGeometry(params, 'straight'),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null },
    visible: true,
  } as unknown as WallEntity;
}

function doorParams(overrides: Partial<OpeningParams> = {}): OpeningParams {
  const def = OPENING_KIND_DEFAULTS.door;
  return {
    kind: 'door',
    wallId: 'wall_test',
    offsetFromStart: 1000,
    width: def.width,
    height: def.height,
    sillHeight: def.sillHeight,
    handing: 'left',
    openDirection: 'inward',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATION — buildOpeningEntity
// ─────────────────────────────────────────────────────────────────────────────

describe('auto-type-on-create — buildOpeningEntity', () => {
  it('links a default-dimensioned opening to the built-in type', () => {
    const result = buildOpeningEntity(doorParams(), makeWall(), '0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.typeId).toBe(getBuiltInOpeningTypeId('door'));
  });

  it('leaves a custom-dimensioned opening ad-hoc (no typeId)', () => {
    const result = buildOpeningEntity(doorParams({ width: 1000 }), makeWall(), '0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entity.typeId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOAD — openingDocToEntity (built-ins seeded, mirror of the production catalog)
// ─────────────────────────────────────────────────────────────────────────────

describe('auto-type-on-load — openingDocToEntity', () => {
  beforeEach(() => {
    useBimFamilyTypeStore.getState().setTypes(getBuiltInOpeningTypes(CO));
  });

  function makeDoc(overrides: Partial<OpeningDoc> = {}): OpeningDoc {
    return {
      id: 'op_1',
      layerId: '0',
      params: doorParams(),
      ...overrides,
    } as unknown as OpeningDoc;
  }

  it('self-links a legacy untyped default opening to the built-in type', () => {
    const entity = openingDocToEntity(makeDoc(), makeWall());
    expect(entity?.typeId).toBe(getBuiltInOpeningTypeId('door'));
    // Non-destructive: the built-in match leaves the dimensions unchanged.
    expect(entity?.params.width).toBe(OPENING_KIND_DEFAULTS.door.width);
    expect(entity?.params.height).toBe(OPENING_KIND_DEFAULTS.door.height);
  });

  it('leaves a legacy custom-dimensioned opening untyped', () => {
    const entity = openingDocToEntity(makeDoc({ params: doorParams({ width: 1000 }) }), makeWall());
    expect(entity?.typeId).toBeUndefined();
  });

  it('an explicit doc.typeId wins over the auto-resolution', () => {
    const explicit = getBuiltInOpeningTypeId('window');
    const entity = openingDocToEntity(makeDoc({ typeId: explicit }), makeWall());
    expect(entity?.typeId).toBe(explicit);
  });
});
