/**
 * ADR-441 Slice GEN-WALL — `buildWallGridFromGuides` tests.
 *
 * Pure builder — μηδέν mocks πέρα από ένα minimal AxisGuideReader. Reuse του
 * `enumerateGridStrips` της εσχάρας → ίδια segments. Καλύπτει: πλήθος τοίχων
 * nX·(nY-1)+nY·(nX-1), born-bound start/end x/y bindings, centerline ΠΑΝΩ στον
 * άξονα (μηδέν extend), invisible-skip, edge (<2 άξονες).
 */

import { buildWallGridFromGuides } from '../wall-from-grid';
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

describe('buildWallGridFromGuides', () => {
  it('παράγει nX·(nY-1) + nY·(nX-1) τοίχους (3×3 → 12)', () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.walls).toHaveLength(12);
    expect(result.ignoredCount).toBe(0);
  });

  it('2×2 → 4 τοίχοι', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const result = buildWallGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.walls).toHaveLength(4);
  });

  it('<2 άξονες ανά διεύθυνση → ok:false insufficient-guides (όχι throw)', () => {
    const result = buildWallGridFromGuides(reader([guide('x0', 'X', 0), ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(result.walls).toHaveLength(0);
  });

  it("born-bound (mode center): η πρώτη κατακόρυφη φέρει καθαρά start/end x/y bindings (μηδέν extend)", () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    const first = result.walls[0];
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
    // centerline ΠΑΝΩ στον άξονα x0=0, από y0=0 έως y1=4000.
    expect(first.params.start).toMatchObject({ x: 0, y: 0 });
    expect(first.params.end).toMatchObject({ x: 0, y: 4000 });
  });

  it("mode center: κανένας τοίχος δεν έχει binding extend (centerline location line)", () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    for (const w of result.walls) {
      expect((w.guideBindings ?? []).every((b) => b.extend === undefined)).toBe(true);
    }
  });

  it('αόρατοι άξονες φιλτράρονται (1 αόρατος X → 2×3 → 7 τοίχοι)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000, false), ...Y3];
    const result = buildWallGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.walls).toHaveLength(7);
  });
});

describe('buildWallGridFromGuides — trim to column faces (Revit face-to-face)', () => {
  it('mode center, χωρίς κολώνες → καμία αλλαγή (centerline στον άξονα)', () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'center');
    expect(result.walls[0].params.start).toMatchObject({ x: 0, y: 0 });
    expect(result.walls[0].params.end).toMatchObject({ x: 0, y: 4000 });
  });

  it('mode center, κολώνες στις τομές → άκρα τοίχου τραβιούνται στην παρειά (extend ± half-extent)', () => {
    // Centered columns (mode center) → συμμετρικό footprint → καθαρό half-extent.
    const cols = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', undefined, 'center').columns;
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', cols, 'center');
    const first = result.walls[0]; // κατακόρυφος x0, y0→y1
    // half-extent της κολώνας κατά Y (από το πραγματικό footprint, ό,τι κι αν είναι το default).
    const half = Math.max(...cols[0].geometry.footprint.vertices.map((v) => Math.abs(v.y)));
    expect(half).toBeGreaterThan(0);
    expect(first.params.start.y).toBeCloseTo(half); // y0=0 → +half
    expect(first.params.end.y).toBeCloseTo(4000 - half); // y1=4000 → −half
    const startY = first.guideBindings?.find((b) => b.slot === 'start-y');
    const endY = first.guideBindings?.find((b) => b.slot === 'end-y');
    expect(startY?.extend).toBeCloseTo(half); // mm (sceneUnits='mm')
    expect(endY?.extend).toBeCloseTo(-half);
    // x-bindings (constant άξονας) μένουν χωρίς extend.
    expect(first.guideBindings?.find((b) => b.slot === 'start-x')?.extend).toBeUndefined();
  });
});

describe('buildWallGridFromGuides — 3-mode justification (ADR-441)', () => {
  // 250mm default thickness → half = 125 (mm scene units).
  it("inner (default): η περιμετρική κατακόρυφη x0 μετατοπίζεται +X & κλειδώνει extend στα x-slots", () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', []);
    const first = result.walls[0]; // x0 = αριστερότερος (perimeter)
    // V αριστερότερη → 'right' → σώμα +X κατά half (εξωτερική −X παρειά στον άξονα).
    expect(first.params.start.x).toBeGreaterThan(0);
    const startX = first.guideBindings?.find((b) => b.slot === 'start-x');
    expect(startX?.extend).toBeCloseTo(first.params.start.x); // extend(mm) == offset (sceneUnits mm)
  });

  it("inner: εσωτερικός τοίχος (μη-περιμετρικός X) μένει κεντραρισμένος (μηδέν x-extend)", () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', []);
    // x1 (μεσαίος) κατακόρυφοι: τα segments του x1 ξεκινούν μετά τους 2 του x0.
    const midVertical = result.walls.find(
      (w) => w.guideBindings?.some((b) => b.slot === 'start-x' && b.guideId === 'x1'),
    );
    expect(midVertical?.params.start.x).toBeCloseTo(4000);
    expect(midVertical?.guideBindings?.find((b) => b.slot === 'start-x')?.extend).toBeUndefined();
  });

  it("outer = αντίστροφο του inner (περιμετρική x0 μετατοπίζεται −X)", () => {
    const result = buildWallGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', [], 'outer');
    expect(result.walls[0].params.start.x).toBeLessThan(0);
  });
});
