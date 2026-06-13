/**
 * ADR-449 Slice 6 — beam↔column junction (mutual structural obstacles).
 *
 * Επαληθεύει ότι στη διεπαφή δοκαριού↔κολόνας ΔΕΝ μένει σοβάς:
 *   - κολόνα + δοκάρι-obstacle → η καλυμμένη παρειά κόβεται (μικρότερο exposed length),
 *   - δοκάρι + κολόνα-obstacle → το τμήμα της πλάγιας όψης μέσα στη σύνδεση κόβεται,
 *   - **flush** σύνδεση (μηδέν overlap, born-from-grid framing) πιάνεται χάρη στη
 *     join-tolerance dilation (αλλιώς coverage = 0),
 *   - control: χωρίς γειτονικό στοιχείο → σοβάς αμετάβλητος (regression).
 *
 * Differential assertions (μικρότερο/ίσο) → ανεξάρτητα από exact default διαστάσεις.
 */

import { computeColumnFinishFaces, computeBeamFinishFaces } from '../structural-finish-scene';
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
function beamFaces(b: BeamEntity, columns: ColumnEntity[]): StructuralFinishFaces | undefined {
  return computeBeamFinishFaces(b, b.geometry.outline.vertices, b.params.depth, [], columns);
}

/** Μέγιστο X του footprint (δεξιά παρειά). */
function maxX(col: ColumnEntity): number {
  return Math.max(...col.geometry.footprint.vertices.map((v) => v.x));
}

describe('ADR-449 Slice 6 — column με δοκάρι-obstacle', () => {
  it('δοκάρι που καρφώνεται (overlap) → η καλυμμένη παρειά κόβεται (μικρότερο exposed length)', () => {
    const col = column();
    const baseline = totalLen(colFaces(col, []));
    // Δοκάρι από το κέντρο της κολόνας προς τα δεξιά → επικαλύπτει τη δεξιά παρειά.
    const withBeam = totalLen(colFaces(col, [beam({ x: 0, y: 0 }, { x: 3000, y: 0 })]));
    expect(withBeam).toBeLessThan(baseline);
  });

  it('FLUSH δοκάρι (start στην παρειά, μηδέν overlap) → πιάνεται χάρη στη join-tolerance', () => {
    const col = column();
    const baseline = totalLen(colFaces(col, []));
    // Δοκάρι που ξεκινά ΑΚΡΙΒΩΣ στη δεξιά παρειά → χωρίς dilation coverage = 0.
    const flush = totalLen(colFaces(col, [beam({ x: maxX(col), y: 0 }, { x: maxX(col) + 3000, y: 0 })]));
    expect(flush).toBeLessThan(baseline);
  });

  it('control: μακρινό δοκάρι → καμία μείωση (σοβάς αμετάβλητος)', () => {
    const col = column();
    const baseline = totalLen(colFaces(col, []));
    const far = totalLen(colFaces(col, [beam({ x: 5000, y: 5000 }, { x: 8000, y: 5000 })]));
    expect(far).toBeCloseTo(baseline, 6);
  });
});

describe('ADR-449 Slice 6 — beam με κολόνα-obstacle', () => {
  it('κολόνα στο άκρο → το τμήμα της πλάγιας όψης στη σύνδεση κόβεται', () => {
    const b = beam({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const baseline = totalLen(beamFaces(b, []));
    // Κολόνα στην αρχή του δοκαριού → επικαλύπτει τις πλάγιες όψεις κοντά στη σύνδεση.
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
