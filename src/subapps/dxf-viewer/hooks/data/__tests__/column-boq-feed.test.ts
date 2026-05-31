/**
 * ADR-401 Phase F.2 — column profile-aware BOQ feed (integration).
 *
 * Επαληθεύει ότι το `columnBoqEntity` διαχέει τον μεταβλητό ύψος attached κολώνας
 * στο BOQ geometry:
 *   - μη-attached κολώνα → reuse του flat geometry (fast path)
 *   - top-attach κάτω από πλάκα (underside 2300mm) → effective ύψος < nominal
 *   - λείπει scene → flat geometry
 *
 * Slab host (απλό outline polygon) ως host — reuse `buildWallHostInputs` →
 * `makeColumnHostResolver`. Footprint coverage στο ίδιο plan space.
 */

import { columnBoqEntity } from '../column-boq-feed';
import { computeColumnGeometry } from '../../../bim/geometry/column-geometry';
import type { ColumnEntity, ColumnParams } from '../../../bim/types/column-types';
import type { SlabEntity, SlabParams } from '../../../bim/types/slab-types';
import type { SceneModel } from '../../../types/entities';

/** 400×400 rectangular κολώνα στο (1,1) ('m' scene → footprint ~0.8..1.2). */
function makeColumn(o?: Partial<ColumnParams>): ColumnEntity {
  const params = {
    kind: 'rectangular', position: { x: 1, y: 1, z: 0 }, anchor: 'center',
    width: 400, depth: 400, height: 3000, rotation: 0,
    baseBinding: 'storey-floor', topBinding: 'storey-ceiling', baseOffset: 0, topOffset: 0,
    sceneUnits: 'm', ...o,
  } as ColumnParams;
  return {
    id: 'c1', type: 'column', kind: params.kind, layerId: '0', params,
    geometry: computeColumnGeometry(params),
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as ColumnEntity;
}

/** Πλάκα που καλύπτει την κολώνα, underside = levelElevation − thickness. */
function makeSlab(levelElevation: number, thickness: number): SlabEntity {
  const params = {
    kind: 'ceiling',
    outline: { vertices: [
      { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }, { x: 5, y: 5, z: 0 }, { x: 0, y: 5, z: 0 },
    ] },
    levelElevation, thickness, heightOffsetFromLevel: 0, sceneUnits: 'm',
  } as unknown as SlabParams;
  return {
    id: 'slab1', type: 'slab', kind: 'ceiling', layerId: '0', params,
    geometry: {} as never,
    validation: { hasCodeViolations: false, violationKeys: [], lastValidatedAt: null }, visible: true,
  } as unknown as SlabEntity;
}

function makeScene(entities: unknown[]): SceneModel {
  return { entities, units: 'm' } as unknown as SceneModel;
}

describe('F.2 BOQ — columnBoqEntity', () => {
  it('μη-attached κολώνα → reuse flat geometry (height 3000)', () => {
    const col = makeColumn();
    const boq = columnBoqEntity(col, makeScene([col]));
    expect(boq.geometry?.volume).toBeCloseTo(0.48, 4); // 0.16 × 3.0
  });

  it('λείπει scene → flat geometry', () => {
    const col = makeColumn({ topBinding: 'attached', attachTopToIds: ['slab1'] });
    const boq = columnBoqEntity(col, null);
    expect(boq.geometry?.volume).toBeCloseTo(0.48, 4);
  });

  it('top-attach κάτω από πλάκα (underside 2300mm) → effective ύψος 2300', () => {
    // Slab levelElevation 2500 / thickness 200 → underside 2300mm.
    const col = makeColumn({ topBinding: 'attached', attachTopToIds: ['slab1'] });
    const slab = makeSlab(2500, 200);
    const boq = columnBoqEntity(col, makeScene([col, slab]));
    // effective ύψος = 2300 − 0 = 2300mm → volume = 0.16 × 2.3.
    expect(boq.geometry?.volume).toBeCloseTo(0.16 * 2.3, 3);
  });

  it('attach σε ανύπαρκτο host → flat (hasAttach=false → nominal)', () => {
    const col = makeColumn({ topBinding: 'attached', attachTopToIds: ['ghost'] });
    const boq = columnBoqEntity(col, makeScene([col]));
    expect(boq.geometry?.volume).toBeCloseTo(0.48, 4);
  });
});
