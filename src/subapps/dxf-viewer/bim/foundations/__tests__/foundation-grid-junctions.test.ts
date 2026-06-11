/**
 * ADR-441 Slice 8 — `computeGridJunctionExtends` tests.
 *
 * Revit-grade auto-join: inward (default) → μηδέν extend (zero-regression)· outward
 * περιμετρική έδραση → οι κάθετες termini επεκτείνονται (miter) ώστε η γωνία να κλείνει·
 * idempotent· εσωτερικοί κόμβοι (συνεχόμενη γραμμή) δεν παίρνουν miter· non-grid → [].
 */

import { computeGridJunctionExtends } from '../foundation-grid-junctions';
import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import { computeFoundationGeometry } from '../../geometry/foundation-geometry';
import type { Guide } from '../../../systems/guides/guide-types';
import type { FoundationEntity, StripFootingParams } from '../../types/foundation-types';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({ id, axis, offset, visible: true, label: null, style: null, locked: false, createdAt: '', parentId: null, groupId: null } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

// 2×2 κάναβος → 4 περιμετρικές λωρίδες (όλες inward).
const GRID_2x2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 8000)];

function build2x2(): FoundationEntity[] {
  const r = buildStripGridFromGuides(reader(GRID_2x2), {}, '0', 'mm');
  expect(r.ok).toBe(true);
  return [...r.strips];
}

/** Γύρνα την πάνω οριζόντια (μέγιστο y) σε outward έδραση ('left'). */
function flipTopHorizontalOutward(strips: readonly FoundationEntity[]): FoundationEntity[] {
  const isH = (s: FoundationEntity) => 'start' in s.params && s.params.start.y === s.params.end.y;
  const topY = Math.max(...strips.filter(isH).map((s) => (s.params as StripFootingParams).start.y));
  return strips.map((s) => {
    if (!isH(s) || (s.params as StripFootingParams).start.y !== topY) return s;
    const params: StripFootingParams = { ...(s.params as StripFootingParams), justification: 'left', justificationManual: true };
    return { ...s, params, geometry: computeFoundationGeometry(params) };
  });
}

describe('computeGridJunctionExtends', () => {
  it('inward 2×2 → μηδέν miter (zero-regression)', () => {
    expect(computeGridJunctionExtends(build2x2())).toHaveLength(0);
  });

  it('inward 3×3 → μηδέν miter (εσωτερικοί κόμβοι δεν παίρνουν extend)', () => {
    const r = buildStripGridFromGuides(
      reader([guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)]),
      {}, '0', 'mm',
    );
    expect(computeGridJunctionExtends([...r.strips])).toHaveLength(0);
  });

  it('outward πάνω οριζόντια → οι κάθετες επεκτείνονται (γωνία κλείνει)', () => {
    const flipped = flipTopHorizontalOutward(build2x2());
    const updates = computeGridJunctionExtends(flipped);
    // 2 κατακόρυφες (xi=0, xi=1) επεκτείνονται προς τα πάνω μέχρι τη μακρινή παρειά.
    expect(updates).toHaveLength(2);
    for (const u of updates) {
      const p = u.rehosted.params as StripFootingParams;
      expect(p.start.x).toBe(p.end.x); // κατακόρυφη
      const before = (u.original.geometry.bbox.max.y);
      expect(u.rehosted.geometry.bbox.max.y).toBeGreaterThan(before); // footprint επεκτάθηκε πάνω
      const hasExtend = (u.rehosted.guideBindings ?? []).some((b) => b.extend !== undefined && Math.abs(b.extend) > 0);
      expect(hasExtend).toBe(true);
    }
  });

  it('idempotent: εφαρμογή miter → 2η κλήση μηδέν αλλαγή', () => {
    const flipped = flipTopHorizontalOutward(build2x2());
    const updates = computeGridJunctionExtends(flipped);
    const applied = flipped.map((s) => updates.find((u) => u.rehosted.id === s.id)?.rehosted ?? s);
    expect(computeGridJunctionExtends(applied)).toHaveLength(0);
  });

  it('non-grid λωρίδα (χωρίς bindings) → αγνοείται', () => {
    const orphan = { ...build2x2()[0], guideBindings: undefined };
    expect(computeGridJunctionExtends([orphan])).toHaveLength(0);
  });
});
