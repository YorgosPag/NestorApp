/**
 * ADR-449 — structural-finish-boq builder tests.
 *
 * parent (στατικός πυρήνας) + finish children **ανά υλικό** (group-by-material, PART B),
 * deterministic IDs, skip σε μηδενικό εμβαδό / άγνωστο υλικό, `finishAreasByMaterial` grouping.
 */

import {
  buildFinishBoqPayloads,
  finishChildBoqId,
  finishChildBoqIds,
  hasFinishContribution,
  type FinishBoqContribution,
} from '../structural-finish-boq';
import { finishAreasByMaterial } from '../../finishes/structural-finish-area';
import type { FinishFaceSegment } from '../../finishes/structural-finish-types';
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

/** Γ-κολώνα: 6 m² Knauf (γυψοσανίδα OIK-7.05) + 3 m² παραδοσιακός σοβάς (OIK-4.01). */
const MIXED: FinishBoqContribution = {
  byMaterial: [
    { materialId: 'mat-gypsum-board', areaM2: 6 },
    { materialId: 'mat-plaster-int', areaM2: 3 },
  ],
};

const noExisting = new Map<string, string | null>();

/** Segment factory (interior/plaster default), lengthM ρητό. */
function seg(materialId: string, lengthM: number, over: Partial<FinishFaceSegment> = {}): FinishFaceSegment {
  return {
    a: { x: 0, y: 0 },
    b: { x: lengthM, y: 0 },
    classification: 'interior',
    materialId,
    thickness: 15,
    lengthM,
    ...over,
  };
}

describe('finishAreasByMaterial (ADR-449 PART B group-by-material)', () => {
  it('αθροίζει lengthM × heightM ανά υλικό, ταξινομημένα, μόνο θετικά', () => {
    const out = finishAreasByMaterial([
      { segments: [seg('mat-gypsum-board', 1.2), seg('mat-gypsum-board', 0.8), seg('mat-plaster-int', 1.0)], heightM: 3 },
    ]);
    expect(out).toEqual([
      { materialId: 'mat-gypsum-board', areaM2: 6 }, // (1.2+0.8)×3
      { materialId: 'mat-plaster-int', areaM2: 3 },  // 1.0×3
    ]);
  });

  it('αθροίζει ΑΝΑ ΖΩΝΗ με διαφορετικό ύψος (banded)', () => {
    const out = finishAreasByMaterial([
      { segments: [seg('mat-plaster-int', 2)], heightM: 2.5 }, // κάτω ζώνη
      { segments: [seg('mat-plaster-int', 2)], heightM: 0.5 }, // πάνω ζώνη
    ]);
    expect(out).toEqual([{ materialId: 'mat-plaster-int', areaM2: 6 }]); // 2×2.5 + 2×0.5
  });

  it('ύψος ≤ 0 → αγνοείται (μηδέν area)', () => {
    expect(finishAreasByMaterial([{ segments: [seg('mat-plaster-int', 2)], heightM: 0 }])).toEqual([]);
  });
});

describe('buildFinishBoqPayloads (group-by-material)', () => {
  it('parent = πυρήνας (m³, isGroupParent) + 1 child ανά υλικό', () => {
    const { parent, children } = buildFinishBoqPayloads(
      { entityId: 'col-1', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 0.75, finish: MIXED, context: CONTEXT },
      noExisting,
    );
    expect(parent.id).toBe('boq_bim_col-1');
    expect(parent.payload.categoryCode).toBe('OIK-2.03');
    expect(parent.payload.unit).toBe('m3');
    expect(parent.payload.estimatedQuantity).toBe(0.75);
    expect(parent.payload.isGroupParent).toBe(true);

    expect(children).toHaveLength(2);
    const knauf = children.find((c) => c.id === finishChildBoqId('col-1', 'mat-gypsum-board'))!;
    const plaster = children.find((c) => c.id === finishChildBoqId('col-1', 'mat-plaster-int'))!;
    expect(knauf.id).toBe('boq_bim_col-1_finish_mat-gypsum-board');
    expect(knauf.payload.categoryCode).toBe('OIK-7.05'); // Γυψοσανίδα
    expect(knauf.payload.unit).toBe('m2');
    expect(knauf.payload.estimatedQuantity).toBe(6);
    expect(knauf.payload.parentBoqItemId).toBe('boq_bim_col-1');
    expect(knauf.payload.materialId).toBe('mat-gypsum-board');
    expect(plaster.payload.categoryCode).toBe('OIK-4.01'); // Επίχρισμα εσωτερικό
    expect(plaster.payload.estimatedQuantity).toBe(3);
  });

  it('ένα μόνο υλικό → ένα child', () => {
    const { children } = buildFinishBoqPayloads(
      { entityId: 'c2', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: { byMaterial: [{ materialId: 'mat-plaster-int', areaM2: 4 }] }, context: CONTEXT },
      noExisting,
    );
    expect(children).toHaveLength(1);
    expect(children[0].id).toBe('boq_bim_c2_finish_mat-plaster-int');
  });

  it('άγνωστο υλικό → skip child (parent παραμένει)', () => {
    const { parent, children } = buildFinishBoqPayloads(
      { entityId: 'c3', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: { byMaterial: [{ materialId: 'mat-bogus-xyz', areaM2: 5 }, { materialId: 'mat-plaster-ext', areaM2: 2 }] }, context: CONTEXT },
      noExisting,
    );
    expect(parent.id).toBe('boq_bim_c3');
    expect(children.map((c) => c.id)).toEqual(['boq_bim_c3_finish_mat-plaster-ext']);
  });

  it('preserve createdAt από existing rows', () => {
    const existing = new Map<string, string | null>([['boq_bim_c4', '2020-01-01T00:00:00.000Z']]);
    const { parent } = buildFinishBoqPayloads(
      { entityId: 'c4', entityType: 'column', coreMapping: CORE_MAPPING, coreQuantity: 1, finish: MIXED, context: CONTEXT },
      existing,
    );
    expect(parent.payload.createdAt).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('finishChildBoqIds / hasFinishContribution', () => {
  it('finishChildBoqIds → ένα id ανά υλικό', () => {
    expect(finishChildBoqIds('col-1', MIXED)).toEqual([
      'boq_bim_col-1_finish_mat-gypsum-board',
      'boq_bim_col-1_finish_mat-plaster-int',
    ]);
  });

  it('hasFinishContribution: false όταν undefined ή κενό byMaterial', () => {
    expect(hasFinishContribution(undefined)).toBe(false);
    expect(hasFinishContribution({ byMaterial: [] })).toBe(false);
  });

  it('hasFinishContribution: true όταν υπάρχει έστω ένα bucket', () => {
    expect(hasFinishContribution(MIXED)).toBe(true);
  });
});
