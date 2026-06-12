/**
 * ADR-449 Slice 4 — beam-boq-feed unit tests.
 *
 * Επαληθεύει: ενεργός σοβάς → payload με `finishContribution` (+`params` για ΑΤΟΕ
 * resolution)· ανενεργός σοβάς ή σκηνή null → minimal payload (byte-identical
 * προ-Slice-4 single-entry path, μηδέν regression).
 */

import { beamBoqEntity } from '../beam-boq-feed';
import { buildDefaultBeamParams, buildBeamEntity } from '../../drawing/beam-completion';
import type { BeamEntity } from '../../../bim/types/beam-types';
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

const emptyScene = { entities: [] } as unknown as SceneModel;

describe('beamBoqEntity (ADR-449 Slice 4)', () => {
  it('ενεργός σοβάς → payload με finishContribution + params', () => {
    const out = beamBoqEntity(beam(FINISH), emptyScene);
    expect(out.finishContribution).toBeDefined();
    expect(out.finishContribution!.interiorAreaM2).toBeGreaterThan(0);
    expect(out.finishContribution!.interiorMaterialId).toBe('mat-plaster-int');
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
});
