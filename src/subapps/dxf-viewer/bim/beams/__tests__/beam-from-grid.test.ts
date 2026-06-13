/**
 * ADR-441 Slice GEN-BEAM — `buildBeamGridFromGuides` tests.
 *
 * Pure builder — μηδέν mocks πέρα από ένα minimal AxisGuideReader. Reuse του
 * `enumerateGridStrips` της εσχάρας → ίδια segments. Καλύπτει: πλήθος δοκαριών
 * nX·(nY-1)+nY·(nX-1), born-bound start/end x/y bindings, centerline ΠΑΝΩ στον
 * άξονα (μηδέν extend), invisible-skip, edge (<2 άξονες).
 */

import { buildBeamGridFromGuides } from '../beam-from-grid';
import { buildColumnGridFromGuides } from '../../columns/column-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
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

describe('buildBeamGridFromGuides', () => {
  it('παράγει nX·(nY-1) + nY·(nX-1) δοκούς (3×3 → 12)', () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.beams).toHaveLength(12);
    expect(result.ignoredCount).toBe(0);
  });

  it('2×2 → 4 δοκοί', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const result = buildBeamGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.beams).toHaveLength(4);
  });

  it('<2 άξονες ανά διεύθυνση → ok:false insufficient-guides (όχι throw)', () => {
    const result = buildBeamGridFromGuides(reader([guide('x0', 'X', 0), ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(result.beams).toHaveLength(0);
  });

  it("born-bound (mode center): η πρώτη κατακόρυφη φέρει καθαρά start/end x/y bindings (μηδέν extend)", () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    const first = result.beams[0];
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
    // centerline ΠΑΝΩ στον άξονα x0=0, από y0=0 έως y1=4000.
    expect(first.params.startPoint).toMatchObject({ x: 0, y: 0 });
    expect(first.params.endPoint).toMatchObject({ x: 0, y: 4000 });
  });

  it('born-bound δοκός = straight kind', () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.beams.every((b) => b.kind === 'straight')).toBe(true);
  });

  it("mode center: καμία δοκός δεν έχει binding extend (centerline location line)", () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    for (const b of result.beams) {
      expect((b.guideBindings ?? []).every((bd) => bd.extend === undefined)).toBe(true);
    }
  });

  it('αόρατοι άξονες φιλτράρονται (1 αόρατος X → 2×3 → 7 δοκοί)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000, false), ...Y3];
    const result = buildBeamGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.beams).toHaveLength(7);
  });
});

describe('buildBeamGridFromGuides — frame-into column faces (Revit)', () => {
  it('mode center, χωρίς κολώνες → καμία αλλαγή (centerline στον άξονα, μηδέν extend)', () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    expect(result.beams[0].params.startPoint).toMatchObject({ x: 0, y: 0 });
    expect(result.beams[0].params.endPoint).toMatchObject({ x: 0, y: 4000 });
    expect((result.beams[0].guideBindings ?? []).every((b) => b.extend === undefined)).toBe(true);
  });

  it('mode center, κολώνες στις τομές → άκρα δοκαριού τραβιούνται στην παρειά (extend ± half-extent)', () => {
    // Centered columns (mode center) → συμμετρικό footprint → καθαρό half-extent.
    const cols = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', undefined, 'center').columns;
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', cols, 'center');
    const first = result.beams[0]; // κατακόρυφος x0, y0→y1
    // half-extent της κολώνας κατά Y (από το πραγματικό footprint).
    const half = Math.max(...cols[0].geometry.footprint.vertices.map((v) => Math.abs(v.y)));
    expect(half).toBeGreaterThan(0);
    expect(first.params.startPoint.y).toBeCloseTo(half); // y0=0 → +half (παρειά)
    expect(first.params.endPoint.y).toBeCloseTo(4000 - half); // y1=4000 → −half
    const startY = first.guideBindings?.find((b) => b.slot === 'start-y');
    const endY = first.guideBindings?.find((b) => b.slot === 'end-y');
    expect(startY?.extend).toBeCloseTo(half); // mm (sceneUnits='mm')
    expect(endY?.extend).toBeCloseTo(-half);
    // x-bindings (σταθερός άξονας) μένουν χωρίς extend.
    expect(first.guideBindings?.find((b) => b.slot === 'start-x')?.extend).toBeUndefined();
  });
});

describe('buildBeamGridFromGuides — 3-mode justification (ADR-441)', () => {
  it("inner (default): η περιμετρική κατακόρυφη x0 μετατοπίζεται +X & κλειδώνει extend στα x-slots", () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', []);
    const first = result.beams[0]; // x0 = αριστερότερος (perimeter)
    expect(first.params.startPoint.x).toBeGreaterThan(0);
    const startX = first.guideBindings?.find((b) => b.slot === 'start-x');
    expect(startX?.extend).toBeCloseTo(first.params.startPoint.x);
  });

  it("inner: εσωτερικό δοκάρι (μη-περιμετρικός X) μένει κεντραρισμένο (μηδέν x-extend)", () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', []);
    const midVertical = result.beams.find(
      (b) => b.guideBindings?.some((bd) => bd.slot === 'start-x' && bd.guideId === 'x1'),
    );
    expect(midVertical?.params.startPoint.x).toBeCloseTo(4000);
    expect(midVertical?.guideBindings?.find((bd) => bd.slot === 'start-x')?.extend).toBeUndefined();
  });

  it("outer = αντίστροφο του inner (περιμετρική x0 μετατοπίζεται −X)", () => {
    const result = buildBeamGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'outer');
    expect(result.beams[0].params.startPoint.x).toBeLessThan(0);
  });
});
