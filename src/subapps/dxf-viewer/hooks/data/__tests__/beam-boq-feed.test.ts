/**
 * ADR-449 Slice 4 — beam-boq-feed unit tests.
 *
 * Επαληθεύει: ενεργός σοβάς → payload με `finishContribution` (+`params` για ΑΤΟΕ
 * resolution)· ανενεργός σοβάς ή σκηνή null → minimal payload (byte-identical
 * προ-Slice-4 single-entry path, μηδέν regression).
 */

import { beamBoqEntity } from '../beam-boq-feed';
import { buildDefaultBeamParams, buildBeamEntity } from '../../drawing/beam-completion';
import { buildDefaultColumnParams, buildColumnEntity } from '../../drawing/column-completion';
import type { BeamEntity } from '../../../bim/types/beam-types';
import type { ColumnEntity } from '../../../bim/types/column-types';
import type { SceneModel } from '../../../types/entities';
import type { StructuralFinishSpec } from '../../../bim/finishes/structural-finish-types';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function beam(finish?: StructuralFinishSpec): BeamEntity {
  const params = {
    ...buildDefaultBeamParams({ x: 0, y: 0 }, { x: 3000, y: 0 }, 'straight', { width: 250, depth: 500 }),
    // ADR-449 Slice 5 — ρητό override του factory default finish (undefined χωρίς arg).
    finish,
  };
  const res = buildBeamEntity(params, '0');
  if (!res.ok) throw new Error('beam fixture invalid');
  return res.entity;
}

function columnAt(x: number, y: number, width: number, depth: number): ColumnEntity {
  const params = { ...buildDefaultColumnParams({ x, y }, 'rectangular'), width, depth };
  const res = buildColumnEntity(params, '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

const emptyScene = { entities: [] } as unknown as SceneModel;

describe('beamBoqEntity (ADR-449 Slice 4)', () => {
  it('ενεργός σοβάς → payload με finishContribution + params', () => {
    const out = beamBoqEntity(beam(FINISH), emptyScene);
    expect(out.finishContribution).toBeDefined();
    // ADR-449 PART B — group-by-material: buckets θετικού εμβαδού, εδώ interior plaster.
    const byMat = out.finishContribution!.byMaterial;
    expect(byMat.length).toBeGreaterThan(0);
    expect(byMat.some((b) => b.materialId === 'mat-plaster-int' && b.areaM2 > 0)).toBe(true);
    expect(out.params).toBeDefined();
    expect(out.geometry).toBeDefined();
  });

  it('ανενεργός σοβάς → minimal payload (χωρίς finishContribution/params)', () => {
    const out = beamBoqEntity(beam(), emptyScene);
    expect(out.finishContribution).toBeUndefined();
    expect(out.params).toBeUndefined();
    expect(out.id).toBeDefined();
    expect(out.geometry).toBeDefined();
  });

  it('σκηνή null → minimal payload (δεν προκύπτει contribution)', () => {
    const out = beamBoqEntity(beam(FINISH), null);
    expect(out.finishContribution).toBeUndefined();
    expect(out.params).toBeUndefined();
  });

  // ─── ADR-458 — NET στατικός όγκος (beam-to-column cutback) ──────────────────

  it('κολόνα που τέμνει το δοκάρι → NET area/volume < gross (column wins)', () => {
    const b = beam(); // gross area = 3.0m × 0.25m = 0.75 m²
    const grossArea = b.geometry.area;
    const grossVolume = b.geometry.volume;
    // Κολόνα 600×600 στην αρχή του άξονα → τέμνει το δυτικό άκρο του δοκαριού.
    const scene = { entities: [b, columnAt(0, 0, 600, 600)] } as unknown as SceneModel;
    const out = beamBoqEntity(b, scene);
    expect(out.geometry!.area).toBeLessThan(grossArea);
    expect(out.geometry!.volume).toBeLessThan(grossVolume);
    // overlap ≈ 0.3m × 0.25m = 0.075 m² → net ≈ 0.675 m².
    expect(out.geometry!.area).toBeCloseTo(0.675, 2);
    expect(out.geometry!.volume).toBeCloseTo(0.675 * 0.5, 2);
  });

  it('κολόνα που ΔΕΝ τέμνει → gross αμετάβλητο (zero regression)', () => {
    const b = beam();
    const scene = { entities: [b, columnAt(10000, 10000, 600, 600)] } as unknown as SceneModel;
    const out = beamBoqEntity(b, scene);
    expect(out.geometry!.area).toBeCloseTo(b.geometry.area, 6);
    expect(out.geometry!.volume).toBeCloseTo(b.geometry.volume, 6);
  });
});
