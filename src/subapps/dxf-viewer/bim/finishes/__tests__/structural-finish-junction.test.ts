/**
 * ADR-449 Slice 6 — beam↔column junction (mutual structural obstacles, height-aware).
 *
 * Επαληθεύει ότι στη διεπαφή δοκαριού↔κολόνας ΔΕΝ μένει σοβάς, ΑΛΛΑ μόνο στη **ζώνη
 * ύψους του δοκαριού** (όχι σε όλο το ύψος της κολόνας):
 *   - plan resolver: κολόνα + δοκάρι-obstacle → η καλυμμένη παρειά κόβεται,
 *   - `computeColumnFinishBands`: 2 ζώνες (κάτω = πλήρης παρειά· πάνω = junction cut),
 *   - η **κάτω** ζώνη κρατά ΠΛΗΡΗ σοβά (regression guard: το full-height κόψιμο έκανε
 *     τις κολόνες να φαίνονται γυμνές),
 *   - δοκάρι + κολόνα-obstacle → η πλάγια όψη κόβεται στη σύνδεση (height-correct),
 *   - control: χωρίς γειτονικό στοιχείο → σοβάς αμετάβλητος.
 */

import {
  computeColumnFinishFaces,
  computeColumnFinishBands,
  computeBeamFinishFaces,
} from '../structural-finish-scene';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import type { ColumnEntity } from '../../types/column-types';
import type { BeamEntity } from '../../types/beam-types';
import type { StructuralFinishFaces } from '../structural-finish-types';

function column(at = { x: 0, y: 0 }): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams(at, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

function beam(start: { x: number; y: number }, end: { x: number; y: number }): BeamEntity {
  const res = buildBeamEntity(
    buildDefaultBeamParams(start, end, 'straight', { width: 250, depth: 500 }),
    '0',
  );
  if (!res.ok) throw new Error('beam fixture invalid: ' + res.hardErrors.join(','));
  return res.entity;
}

/** Συνολικό εκτεθειμένο μήκος (Σ segment.lengthM). */
function totalLen(f: StructuralFinishFaces | undefined): number {
  return (f?.segments ?? []).reduce((s, seg) => s + seg.lengthM, 0);
}

function colFaces(col: ColumnEntity, beams: BeamEntity[]): StructuralFinishFaces | undefined {
  return computeColumnFinishFaces(col, col.geometry.footprint.vertices, col.params.height, [], beams);
}
function colBands(col: ColumnEntity, beams: BeamEntity[]) {
  return computeColumnFinishBands(col, col.geometry.footprint.vertices, col.params.height, [], beams);
}
function beamFaces(b: BeamEntity, columns: ColumnEntity[]): StructuralFinishFaces | undefined {
  return computeBeamFinishFaces(b, b.geometry.outline.vertices, b.params.depth, [], columns);
}

/** 4 δοκάρια από το κέντρο της κολόνας σε ±X / ±Y (interior column σε frame). */
function fourBeams(): BeamEntity[] {
  return [
    beam({ x: 0, y: 0 }, { x: 6000, y: 0 }),
    beam({ x: 0, y: 0 }, { x: -6000, y: 0 }),
    beam({ x: 0, y: 0 }, { x: 0, y: 6000 }),
    beam({ x: 0, y: 0 }, { x: 0, y: -6000 }),
  ];
}

describe('ADR-449 Slice 6 — plan resolver (κολόνα με δοκάρι-obstacle)', () => {
  it('δοκάρι που καρφώνεται → η καλυμμένη παρειά κόβεται (plan-level)', () => {
    const col = column();
    const baseline = totalLen(colFaces(col, []));
    const withBeam = totalLen(colFaces(col, [beam({ x: 0, y: 0 }, { x: 6000, y: 0 })]));
    expect(withBeam).toBeLessThan(baseline);
  });

  it('control: μακρινό δοκάρι → καμία μείωση', () => {
    const col = column();
    const baseline = totalLen(colFaces(col, []));
    const far = totalLen(colFaces(col, [beam({ x: 9000, y: 9000 }, { x: 12000, y: 9000 })]));
    expect(far).toBeCloseTo(baseline, 6);
  });
});

describe('ADR-449 Slice 6 — height-aware bands (κολόνα)', () => {
  it('χωρίς δοκάρια → 1 ζώνη, πλήρες ύψος', () => {
    const bands = colBands(column(), [])!;
    expect(bands).toHaveLength(1);
    expect(bands[0].zBottomMm).toBe(0);
    expect(bands[0].zTopMm).toBe(3000);
  });

  it('με δοκάρια → 2 ζώνες· κάτω = πλήρης παρειά, πάνω = junction cut στη ζώνη depth', () => {
    const col = column();
    const fullLen = totalLen(colFaces(col, []));
    const bands = colBands(col, fourBeams())!;
    expect(bands).toHaveLength(2);
    // Κάτω ζώνη [0, 3000−500] = πλήρης παρειά (regression guard: ΟΧΙ γυμνή κολόνα).
    expect(bands[0].zBottomMm).toBe(0);
    expect(bands[0].zTopMm).toBe(2500);
    expect(totalLen(bands[0].faces)).toBeCloseTo(fullLen, 6);
    // Πάνω ζώνη [2500, 3000] = junction cut (λιγότερο μήκος από την πλήρη παρειά).
    expect(bands[1].zBottomMm).toBe(2500);
    expect(bands[1].zTopMm).toBe(3000);
    expect(totalLen(bands[1].faces)).toBeLessThan(fullLen);
    expect(totalLen(bands[1].faces)).toBeGreaterThan(0);
  });

  it('control: μακρινά δοκάρια → 1 ζώνη πλήρους ύψους (καμία ζώνη σύνδεσης)', () => {
    const bands = colBands(column(), [beam({ x: 9000, y: 9000 }, { x: 12000, y: 9000 })])!;
    expect(bands).toHaveLength(1);
    expect(bands[0].zTopMm).toBe(3000);
  });
});

describe('ADR-449 Slice 6 — beam με κολόνα-obstacle (height-correct)', () => {
  it('κολόνα στο άκρο → το τμήμα της πλάγιας όψης στη σύνδεση κόβεται', () => {
    const b = beam({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const baseline = totalLen(beamFaces(b, []));
    const withCol = totalLen(beamFaces(b, [column({ x: 0, y: 0 })]));
    expect(withCol).toBeLessThan(baseline);
  });

  it('control: μακρινή κολόνα → καμία μείωση', () => {
    const b = beam({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const baseline = totalLen(beamFaces(b, []));
    const far = totalLen(beamFaces(b, [column({ x: 9000, y: 9000 })]));
    expect(far).toBeCloseTo(baseline, 6);
  });
});
