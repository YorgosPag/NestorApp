/**
 * ADR-441 Slice 2 — `buildStripGridFromGuides` tests.
 *
 * Pure builder — μηδέν mocks πέρα από ένα minimal AxisGuideReader. Καλύπτει:
 * σωστό πλήθος segments N×M, intersection-to-intersection geometry, slot-based
 * guideBindings tagging (X vs Y strips), invisible-skip, dedup, edge (<2 guides).
 */

import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';

const guide = (id: string, axis: Guide['axis'], offset: number, visible = true): Guide =>
  ({
    id,
    axis,
    offset,
    visible,
    label: null,
    style: null,
    locked: false,
    createdAt: '',
    parentId: null,
    groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

// 3×3 κάναβος (X σε 0/4000/8000, Y σε 0/4000/8000).
const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];

describe('buildStripGridFromGuides', () => {
  it('παράγει nX·(nY-1) + nY·(nX-1) λωρίδες (3×3 → 12)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.strips).toHaveLength(12);
    expect(result.ignoredCount).toBe(0);
  });

  it('2×2 → 4 λωρίδες', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.strips).toHaveLength(4);
  });

  it('<2 άξονες ανά διεύθυνση → ok:false insufficient-guides (όχι throw)', () => {
    const result = buildStripGridFromGuides(reader([guide('x0', 'X', 0), ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(result.strips).toHaveLength(0);
  });

  it('born-hosted: η πρώτη X-λωρίδα φέρει σωστά slot-based guideBindings', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const first = result.strips[0];
    // xi=0 (xOff=0, x0), i=0 (y0→y1): κατακόρυφη λωρίδα κατά τον Y.
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
    if (first.params.kind === 'pad') throw new Error('expected line kind');
    expect(first.params.start).toMatchObject({ x: 0, y: 0 });
    expect(first.params.end).toMatchObject({ x: 0, y: 4000 });
  });

  it('Y-λωρίδα φέρει bindings με τον X να ελέγχει start/end-x', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // Οι X-λωρίδες είναι nX·(nY-1) = 6· η πρώτη Y-λωρίδα είναι στο index 6.
    const firstY = result.strips[6];
    expect(firstY.guideBindings).toEqual([
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y0', slot: 'end-y' },
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x1', slot: 'end-x' },
    ]);
  });

  it('αόρατοι άξονες φιλτράρονται (1 αόρατος X → επανέρχεται σε 2×3 grid)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000, false), ...Y3];
    const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
    // nX=2, nY=3 → 2·2 + 3·1 = 7.
    expect(result.strips).toHaveLength(7);
  });

  it('dedup σχεδόν-ταυτόσημων offsets → αποφυγή zero-length', () => {
    const guides = [guide('x0', 'X', 0), guide('x0b', 'X', 0.4), guide('x1', 'X', 4000), ...Y3];
    const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
    // x0 και x0b dedup → nX=2, nY=3 → 7.
    expect(result.strips).toHaveLength(7);
  });
});
