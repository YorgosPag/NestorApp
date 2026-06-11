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

  it('born-hosted: η πρώτη X-λωρίδα φέρει σωστά slot-based guideBindings (γωνιακή → extend)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const first = result.strips[0];
    // xi=0 (extreme X), i=0 (y0→y1, κάτω άκρο = global min Y): ΓΩΝΙΑΚΗ → start-y extend -300.
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y', extend: -300 },
      { guideId: 'y1', slot: 'end-y' },
    ]);
    if (first.params.kind === 'pad') throw new Error('expected line kind');
    expect(first.params.start).toMatchObject({ x: 0, y: -300 }); // corner-fill προς τα κάτω
    expect(first.params.end).toMatchObject({ x: 0, y: 4000 });
  });

  it('Y-λωρίδα φέρει bindings με τον X να ελέγχει start/end-x (γωνιακή → extend)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // Οι X-λωρίδες είναι nX·(nY-1) = 6· η πρώτη Y-λωρίδα είναι στο index 6.
    // yi=0 (extreme Y), i=0 (x0→x1, αριστερό άκρο = global min X): ΓΩΝΙΑΚΗ → start-x extend -300.
    const firstY = result.strips[6];
    expect(firstY.guideBindings).toEqual([
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y0', slot: 'end-y' },
      { guideId: 'x0', slot: 'start-x', extend: -300 },
      { guideId: 'x1', slot: 'end-x' },
    ]);
  });

  it('corner-fill: ΜΟΝΟ τα 4 γωνιακά endpoints έχουν extend (3×3 → 8 endpoints, μεσαία καθαρά)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const extendsByStrip = result.strips.map((s) =>
      (s.guideBindings ?? []).filter((b) => b.extend !== undefined).length,
    );
    // 8 endpoints σε 8 διαφορετικές λωρίδες (4 vertical corners + 4 horizontal corners).
    const total = extendsByStrip.reduce((a, b) => a + b, 0);
    expect(total).toBe(8);
    // Καμία λωρίδα δεν έχει >1 extend στο 3×3 (κάθε γωνιακή ακμή ανήκει σε άλλη λωρίδα).
    expect(Math.max(...extendsByStrip)).toBe(1);
  });

  it('corner-fill: η μεσαία κατακόρυφη λωρίδα (xi=1) ΔΕΝ έχει extend (αποφυγή «δοντιών»)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // xi=1 bays → strips[2], strips[3] (μη-extreme X).
    for (const idx of [2, 3]) {
      expect((result.strips[idx].guideBindings ?? []).every((b) => b.extend === undefined)).toBe(true);
    }
  });

  it('corner-fill: top άκρο γωνιακής κατακόρυφης λωρίδας → end-y extend +300', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // xi=0, i=1 (y1→y2, πάνω άκρο = global max Y): strips[1].
    const topCorner = result.strips[1];
    expect(topCorner.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y1', slot: 'start-y' },
      { guideId: 'y2', slot: 'end-y', extend: 300 },
    ]);
    if (topCorner.params.kind === 'pad') throw new Error('expected line kind');
    expect(topCorner.params.end).toMatchObject({ x: 0, y: 8300 }); // 8000 + 300
  });

  it('corner-fill: 2×2 → κάθε λωρίδα ενώνει 2 γωνίες (single bay → 2 extends ανά λωρίδα)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.strips).toHaveLength(4);
    for (const s of result.strips) {
      expect((s.guideBindings ?? []).filter((b) => b.extend !== undefined)).toHaveLength(2);
    }
  });

  it('corner-fill: custom width 800 → extend = ±400', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), { width: 800 }, '0', 'mm');
    const startY = (result.strips[0].guideBindings ?? []).find((b) => b.slot === 'start-y');
    expect(startY?.extend).toBe(-400);
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
