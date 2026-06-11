/**
 * ADR-441 Slice 4 — foundation strip-grid NET BOQ tests.
 *
 * Επαληθεύει ότι ο καθαρός όγκος (safeUnion) αφαιρεί τη διπλομέτρηση κόμβων και ότι
 * το άθροισμα των per-strip net μεριδίων ισούται με το union total.
 *
 * Reference 2×2 κάναβος (X 0/4000, Y 0/4000· default width 600, thickness 400, mm):
 *   - 4 corner-filled λωρίδες, καθεμία -300→4300 (μήκος 4600), πλάτος 600.
 *   - gross area/λωρίδα = 4600×600 = 2.76 m²· Σgross = 11.04 m²· Σvol = 4.416 m³.
 *   - 4 κόμβοι × (600×600) = 1.44 m² επικάλυψη → union = 9.6 m²· net vol = 3.84 m³.
 */

import {
  computeFoundationGridNet,
  foundationStripNetGeometry,
} from '../foundation-grid-boq';
import { buildStripGridFromGuides, type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { FoundationEntity } from '../../types/foundation-types';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

/** 2×2 grid → 4 corner-filled strips. */
function grid2x2(): FoundationEntity[] {
  const guides = [
    guide('x0', 'X', 0), guide('x1', 'X', 4000),
    guide('y0', 'Y', 0), guide('y1', 'Y', 4000),
  ];
  const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
  return [...result.strips];
}

describe('computeFoundationGridNet — union (anti-double-count)', () => {
  it('net < gross· union αφαιρεί τους κόμβους (2×2 → 9.6 m² / 3.84 m³)', () => {
    const net = computeFoundationGridNet(grid2x2());
    expect(net.grossVolumeM3).toBeCloseTo(4.416, 2);
    expect(net.netAreaM2).toBeCloseTo(9.6, 1);
    expect(net.netVolumeM3).toBeCloseTo(3.84, 2);
    expect(net.overlapVolumeM3).toBeCloseTo(0.576, 2);
    expect(net.netVolumeM3).toBeLessThan(net.grossVolumeM3);
  });

  it('μη-επικαλυπτόμενες παράλληλες λωρίδες → net == gross (καμία ένωση)', () => {
    // Δύο μακρινές κατακόρυφες (απόσταση 4000 >> width 600), ίδιο Y-bay.
    const guides = [
      guide('x0', 'X', 0), guide('x1', 'X', 4000),
      guide('y0', 'Y', 0), guide('y1', 'Y', 4000),
    ];
    const all = buildStripGridFromGuides(reader(guides), {}, '0', 'mm').strips;
    const verticals = all.filter((s) => s.params.kind === 'strip'
      && (s.params.start.x === s.params.end.x)); // x-constant = κατακόρυφες
    const net = computeFoundationGridNet(verticals);
    const gross = verticals.reduce((sum, s) => sum + s.geometry.volume, 0);
    expect(net.netVolumeM3).toBeCloseTo(gross, 4);
    expect(net.overlapVolumeM3).toBeCloseTo(0, 4);
  });
});

describe('foundationStripNetGeometry — per-strip net share', () => {
  it('Σ per-strip net area == union total (exact, uniform thickness)', () => {
    const strips = grid2x2();
    const sumNetArea = strips.reduce(
      (sum, s) => sum + foundationStripNetGeometry(s, strips).area, 0,
    );
    expect(sumNetArea).toBeCloseTo(computeFoundationGridNet(strips).netAreaM2, 1);
  });

  it('κάθε γωνιακή λωρίδα 2×2 χάνει 2 μισά-κόμβων (net area = 2.40 m²)', () => {
    const strips = grid2x2();
    for (const s of strips) {
      const net = foundationStripNetGeometry(s, strips);
      expect(net.area).toBeCloseTo(2.4, 1); // gross 2.76 − 0.72/2
      expect(net.volume).toBeLessThan(s.geometry.volume);
    }
  });

  it('χωρίς siblings → επιστρέφει το gross geometry ως έχει', () => {
    const [first] = grid2x2();
    expect(foundationStripNetGeometry(first, [first])).toBe(first.geometry);
  });
});
