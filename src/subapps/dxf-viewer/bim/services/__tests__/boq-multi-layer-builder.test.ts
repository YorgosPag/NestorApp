/**
 * Tests για boq-multi-layer-builder (ADR-363 Phase 6.1)
 */

import {
  buildMultiLayerBoqPayloads,
  parentBoqId,
  layerChildBoqId,
  type ExistingCreatedAtMap,
  type MultiLayerBuildInput,
} from '../boq-multi-layer-builder';
import type { WallDna } from '../../types/wall-dna-types';
import type { AtoeMappingEntry } from '../../config/bim-to-atoe-mapping';

jest.mock('@/lib/date-local', () => ({ nowISO: () => '2026-05-19T12:00:00.000Z' }));
jest.mock('@/utils/firestore-sanitize', () => ({
  stripUndefinedDeep: (v: unknown) => v,
}));

const context = { companyId: 'c1', projectId: 'p1', buildingId: 'b1' };

const parentMapping: AtoeMappingEntry = {
  categoryCode: 'OIK-3.05',
  unit: 'm2',
  titleEL: 'Τοιχοποιία εξωτερική (BIM)',
};

function makeExteriorDna(): WallDna {
  return {
    totalThickness: 250,
    layers: [
      { id: 'L0', name: 'Plaster Out', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' },
      { id: 'L1', name: 'RC Core',     thickness: 210, materialId: 'mat-concrete-c25', side: 'core' },
      { id: 'L2', name: 'Plaster In',  thickness: 20, materialId: 'mat-plaster-int', side: 'interior' },
    ],
  };
}

function makeInput(overrides: Partial<MultiLayerBuildInput> = {}): MultiLayerBuildInput {
  return {
    entityId: 'wall-001',
    entityType: 'wall',
    dna: makeExteriorDna(),
    wallNetArea: 30, // m²
    parentMapping,
    context,
    ...overrides,
  };
}

const emptyExisting: ExistingCreatedAtMap = new Map();

describe('buildMultiLayerBoqPayloads — IDs', () => {
  it('parent uses deterministic boq_bim_<entityId> (back-compat with single-entry)', () => {
    const { parent } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    expect(parent.id).toBe('boq_bim_wall-001');
    expect(parent.id).toBe(parentBoqId('wall-001'));
  });

  it('children use boq_bim_<entityId>_layer_<layerId>', () => {
    const { children } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    expect(children).toHaveLength(3);
    expect(children[0]!.id).toBe('boq_bim_wall-001_layer_L0');
    expect(children[1]!.id).toBe('boq_bim_wall-001_layer_L1');
    expect(children[2]!.id).toBe('boq_bim_wall-001_layer_L2');
    expect(children[0]!.id).toBe(layerChildBoqId('wall-001', 'L0'));
  });
});

describe('buildMultiLayerBoqPayloads — parent payload', () => {
  it('isGroupParent=true, parentBoqItemId=null, layerIndex=null', () => {
    const { parent } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    expect(parent.payload.isGroupParent).toBe(true);
    expect(parent.payload.parentBoqItemId).toBeNull();
    expect(parent.payload.layerIndex).toBeNull();
    expect(parent.payload.materialId).toBeNull();
  });

  it('parent quantity = wallNetArea (m²) με parentMapping.categoryCode + unit', () => {
    const { parent } = buildMultiLayerBoqPayloads(makeInput({ wallNetArea: 42 }), emptyExisting);
    expect(parent.payload.estimatedQuantity).toBe(42);
    expect(parent.payload.categoryCode).toBe('OIK-3.05');
    expect(parent.payload.unit).toBe('m2');
    expect(parent.payload.title).toBe('Τοιχοποιία εξωτερική (BIM)');
  });

  it('sourceType=bim-auto, sourceEntityId=entityId, sourceEntityType=wall', () => {
    const { parent } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    expect(parent.payload.sourceType).toBe('bim-auto');
    expect(parent.payload.sourceEntityId).toBe('wall-001');
    expect(parent.payload.sourceEntityType).toBe('wall');
    expect(parent.payload.detached).toBeNull();
  });
});

describe('buildMultiLayerBoqPayloads — children quantities', () => {
  it('plaster layer (area kind) → quantity = wallNetArea (m²) one-sided', () => {
    const { children } = buildMultiLayerBoqPayloads(makeInput({ wallNetArea: 30 }), emptyExisting);
    const plasterExt = children.find((c) => c.payload.materialId === 'mat-plaster-ext');
    expect(plasterExt!.payload.estimatedQuantity).toBe(30);
    expect(plasterExt!.payload.unit).toBe('m2');
    expect(plasterExt!.payload.categoryCode).toBe('OIK-4.03');
  });

  it('concrete layer (volume kind) → quantity = wallNetArea × thickness_m', () => {
    const { children } = buildMultiLayerBoqPayloads(makeInput({ wallNetArea: 30 }), emptyExisting);
    const concrete = children.find((c) => c.payload.materialId === 'mat-concrete-c25');
    // 30 m² × 0.210 m = 6.3 m³
    expect(concrete!.payload.estimatedQuantity).toBeCloseTo(6.3, 6);
    expect(concrete!.payload.unit).toBe('m3');
    expect(concrete!.payload.categoryCode).toBe('OIK-2.03');
  });

  it('children carry layerIndex 0..N-1 in dna order', () => {
    const { children } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    expect(children[0]!.payload.layerIndex).toBe(0);
    expect(children[1]!.payload.layerIndex).toBe(1);
    expect(children[2]!.payload.layerIndex).toBe(2);
  });

  it('net wallNetArea (ADR-395 G6) propagates identically to parent + area children', () => {
    // After G6 the wall geometry feeds NET area; parent summary and every
    // single-side (area-kind) layer child must reflect the SAME net value —
    // no path re-derives from gross (parent == Σ-consistent with children).
    const netArea = 13; // gross 15 − openings 2
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput({ wallNetArea: netArea }), emptyExisting);
    expect(parent.payload.estimatedQuantity).toBe(netArea);
    const areaChildren = children.filter((c) => c.payload.unit === 'm2');
    expect(areaChildren.length).toBeGreaterThan(0);
    for (const c of areaChildren) {
      expect(c.payload.estimatedQuantity).toBe(netArea);
    }
  });

  it('children parentBoqItemId points to parent.id', () => {
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    for (const c of children) {
      expect(c.payload.parentBoqItemId).toBe(parent.id);
      expect(c.payload.isGroupParent).toBe(false);
    }
  });

  it('children inherit sourceEntityId from wall (for cascade query later)', () => {
    const { children } = buildMultiLayerBoqPayloads(makeInput(), emptyExisting);
    for (const c of children) {
      expect(c.payload.sourceEntityId).toBe('wall-001');
      expect(c.payload.sourceEntityType).toBe('wall');
    }
  });
});

describe('buildMultiLayerBoqPayloads — unknown material skip', () => {
  it('skips child row για layer με unknown materialId (parent unchanged)', () => {
    const dna: WallDna = {
      totalThickness: 230,
      layers: [
        { id: 'L0', name: 'Plaster', thickness: 20, materialId: 'mat-plaster-ext', side: 'exterior' },
        { id: 'L1', name: 'Mystery', thickness: 200, materialId: 'mat-unicorn-fluff', side: 'core' },
        { id: 'L2', name: 'Plaster', thickness: 10, materialId: 'mat-plaster-int', side: 'interior' },
      ],
    };
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput({ dna }), emptyExisting);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.payload.materialId)).toEqual(['mat-plaster-ext', 'mat-plaster-int']);
    // layerIndex still preserves position (0 + 2, NOT renumbered 0 + 1)
    expect(children[0]!.payload.layerIndex).toBe(0);
    expect(children[1]!.payload.layerIndex).toBe(2);
    // parent untouched
    expect(parent.payload.estimatedQuantity).toBe(30);
  });
});

describe('buildMultiLayerBoqPayloads — createdAt preservation', () => {
  it('parent + each child preserve createdAt από existing map', () => {
    const existing: ExistingCreatedAtMap = new Map([
      ['boq_bim_wall-001', '2026-01-01T00:00:00Z'],
      ['boq_bim_wall-001_layer_L0', '2026-02-01T00:00:00Z'],
    ]);
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput(), existing);
    expect(parent.payload.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(children[0]!.payload.createdAt).toBe('2026-02-01T00:00:00Z');
    // child without existing entry → now()
    expect(children[1]!.payload.createdAt).toBe('2026-05-19T12:00:00.000Z');
  });

  it('all rows get fresh updatedAt regardless of createdAt', () => {
    const existing: ExistingCreatedAtMap = new Map([
      ['boq_bim_wall-001', '2026-01-01T00:00:00Z'],
    ]);
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput(), existing);
    expect(parent.payload.updatedAt).toBe('2026-05-19T12:00:00.000Z');
    for (const c of children) {
      expect(c.payload.updatedAt).toBe('2026-05-19T12:00:00.000Z');
    }
  });
});

describe('buildMultiLayerBoqPayloads — edge cases', () => {
  it('single-layer dna still produces parent + 1 child (caller decides routing)', () => {
    const dna: WallDna = {
      totalThickness: 150,
      layers: [{ id: 'L0', name: 'Concrete', thickness: 150, materialId: 'mat-concrete-c25', side: 'core' }],
    };
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput({ dna }), emptyExisting);
    expect(parent.id).toBe('boq_bim_wall-001');
    expect(children).toHaveLength(1);
  });

  it('zero wallNetArea → all quantities zero', () => {
    const { parent, children } = buildMultiLayerBoqPayloads(makeInput({ wallNetArea: 0 }), emptyExisting);
    expect(parent.payload.estimatedQuantity).toBe(0);
    for (const c of children) {
      expect(c.payload.estimatedQuantity).toBe(0);
    }
  });
});
