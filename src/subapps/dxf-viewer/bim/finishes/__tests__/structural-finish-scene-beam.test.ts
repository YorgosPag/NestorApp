/**
 * ADR-449 Slice 4 — computeBeamFinishFaces unit tests.
 *
 * Επαληθεύει την κεντρική απόφαση του δοκαριού: σοβατίζονται **μόνο οι 2 πλάγιες
 * όψεις** (ακμές ∥ άξονα)· τα **άκρα** (⊥ άξονα = δομική σύνδεση/frame-into)
 * αποκλείονται σημασιολογικά (includeEdge). `heightMm = depth`. Μεμονωμένο δοκάρι
 * (χωρίς τοίχους-περίβλημα) → όλες οι όψεις interior (Knauf).
 */

import { computeBeamFinishFaces } from '../structural-finish-scene';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { BeamEntity } from '../../types/beam-types';
import type { StructuralFinishSpec } from '../structural-finish-types';

const FINISH: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 15,
};

function beam(
  start: { x: number; y: number },
  end: { x: number; y: number },
  finish?: StructuralFinishSpec,
): BeamEntity {
  const params = {
    ...buildDefaultBeamParams(start, end, 'straight', { width: 250, depth: 500 }),
    ...(finish ? { finish } : {}),
  };
  const res = buildBeamEntity(params, '0');
  if (!res.ok) throw new Error('beam fixture invalid: ' + res.hardErrors.join(','));
  return res.entity;
}

function faces(b: BeamEntity) {
  return computeBeamFinishFaces(b, b.geometry.outline.vertices, b.params.depth, []);
}

/** |edge·axis| για μια ακμή segment — ~1 αν ∥ άξονα. */
function parallelism(seg: { a: { x: number; y: number }; b: { x: number; y: number } }, ax: { x: number; y: number }): number {
  const ex = seg.b.x - seg.a.x;
  const ey = seg.b.y - seg.a.y;
  const len = Math.hypot(ex, ey) || 1;
  const alen = Math.hypot(ax.x, ax.y) || 1;
  return Math.abs((ex / len) * (ax.x / alen) + (ey / len) * (ax.y / alen));
}

describe('computeBeamFinishFaces (ADR-449 Slice 4)', () => {
  it('οριζόντιο δοκάρι, ενεργός σοβάς, μηδέν τοίχοι → ΑΚΡΙΒΩΣ 2 πλάγιες όψεις', () => {
    const f = faces(beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, FINISH));
    expect(f).toBeDefined();
    expect(f!.segments).toHaveLength(2);
  });

  it('τα 2 segments είναι ∥ στον άξονα (τα άκρα ⊥ αποκλείστηκαν)', () => {
    const b = beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, FINISH);
    const axis = { x: 1, y: 0 };
    const f = faces(b)!;
    for (const seg of f.segments) {
      expect(parallelism(seg, axis)).toBeGreaterThan(0.99);
    }
  });

  it('μεμονωμένο δοκάρι → όλες interior, exteriorAreaM2 = 0', () => {
    const f = faces(beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, FINISH))!;
    expect(f.interiorAreaM2).toBeGreaterThan(0);
    expect(f.exteriorAreaM2).toBe(0);
    for (const seg of f.segments) expect(seg.classification).toBe('interior');
  });

  it('heightM = structural depth (500mm → 0.5m)', () => {
    const f = faces(beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, FINISH))!;
    expect(f.heightM).toBeCloseTo(0.5, 6);
  });

  it('κάθετο δοκάρι → επίσης 2 πλάγιες όψεις (orientation-agnostic)', () => {
    const f = faces(beam({ x: 0, y: 0 }, { x: 0, y: 3000 }, FINISH))!;
    expect(f.segments).toHaveLength(2);
    const axis = { x: 0, y: 1 };
    for (const seg of f.segments) expect(parallelism(seg, axis)).toBeGreaterThan(0.99);
  });

  it('ανενεργός σοβάς → undefined', () => {
    expect(faces(beam({ x: 0, y: 0 }, { x: 3000, y: 0 }, { ...FINISH, enabled: false }))).toBeUndefined();
  });

  it('απών σοβάς → undefined', () => {
    expect(faces(beam({ x: 0, y: 0 }, { x: 3000, y: 0 }))).toBeUndefined();
  });
});
