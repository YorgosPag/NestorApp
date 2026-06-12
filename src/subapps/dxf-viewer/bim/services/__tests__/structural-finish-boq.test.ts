/**
 * ADR-449 — structural-finish-boq builder tests.
 *
 * parent (στατικός πυρήνας) + finish children (interior/exterior σοβάς),
 * deterministic IDs, skip σε μηδενικό εμβαδό / άγνωστο υλικό.
 */

import {
  buildFinishBoqPayloads,
  finishChildBoqId,
  hasFinishContribution,
  type FinishBoqContribution,
} from '../structural-finish-boq';
import type { AtoeMappingEntry } from '../../config/bim-to-atoe-mapping';
import type { MultiLayerBuildContext } from '../boq-multi-layer-builder';

const CORE_MAPPING: AtoeMappingEntry = {
  categoryCode: 'OIK-2.03',
  unit: 'm3',
  titleEL: 'Σκυρόδεμα κολώνας (BIM)',
};

const CONTEXT: MultiLayerBuildContext = {
  companyId: 'co1',
  projectId: 'pr1',
  buildingId: 'b1',
  floorId: 'f1',
};

const FULL: FinishBoqContribution = {
  interiorAreaM2: 6,
  exteriorAreaM2: 2,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
};

const noExisting = new Map<string, string | null>();

describe('buildFinishBoqPayloads', () => {
  it('parent = πυρήνας (m³, isGroupParent) + 2 finish children', () => {
    const { parent, children } = buildFinishBoqPayloads(
      { entityId: 'col-1', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 0.75, finish: FULL, context: CONTEXT },
      noExisting,
    );
    expect(parent.id).toBe('boq_bim_col-1');
    expect(parent.payload.categoryCode).toBe('OIK-2.03');
    expect(parent.payload.unit).toBe('m3');
    expect(parent.payload.estimatedQuantity).toBe(0.75);
    expect(parent.payload.isGroupParent).toBe(true);

    expect(children).toHaveLength(2);
    const int = children.find((c) => c.id === finishChildBoqId('col-1', 'interior'))!;
    const ext = children.find((c) => c.id === finishChildBoqId('col-1', 'exterior'))!;
    expect(int.id).toBe('boq_bim_col-1_finish_int');
    expect(int.payload.categoryCode).toBe('OIK-4.01');
    expect(int.payload.unit).toBe('m2');
    expect(int.payload.estimatedQuantity).toBe(6);
    expect(int.payload.parentBoqItemId).toBe('boq_bim_col-1');
    expect(int.payload.materialId).toBe('mat-plaster-int');
    expect(ext.payload.categoryCode).toBe('OIK-4.03');
    expect(ext.payload.estimatedQuantity).toBe(2);
  });

  it('μηδενικό exterior → μόνο interior child', () => {
    const { children } = buildFinishBoqPayloads(
      { entityId: 'c2', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: { ...FULL, exteriorAreaM2: 0 }, context: CONTEXT },
      noExisting,
    );
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('boq_bim_c2_finish_int');
  });

  it('άγνωστο υλικό → skip child (parent παραμένει)', () => {
    const { parent, children } = buildFinishBoqPayloads(
      { entityId: 'c3', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: { ...FULL, interiorMaterialId: 'mat-bogus-xyz' }, context: CONTEXT },
      noExisting,
    );
    expect(parent.id).toBe('boq_bim_c3');
    // interior skip (unknown), exterior παραμένει
    expect(children.map((c) => c.id)).toEqual(['boq_bim_c3_finish_ext']);
  });

  it('preserve createdAt από existing rows', () => {
    const existing = new Map<string, string | null>([['boq_bim_c4', '2020-01-01T00:00:00.000Z']]);
    const { parent } = buildFinishBoqPayloads(
      { entityId: 'c4', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: FULL, context: CONTEXT },
      existing,
    );
    expect(parent.payload.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('hasFinishContribution', () => {
  it('false όταν undefined ή μηδενικά εμβαδά', () => {
    expect(hasFinishContribution(undefined)).toBe(false);
    expect(hasFinishContribution({ ...FULL, interiorAreaM2: 0, exteriorAreaM2: 0 })).toBe(false);
  });
  it('true όταν έστω ένα θετικό', () => {
    expect(hasFinishContribution({ ...FULL, interiorAreaM2: 0 })).toBe(true);
  });
});
