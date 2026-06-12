/**
 * ADR-441 Slice GEN-COL — `buildColumnGridFromGuides` tests.
 *
 * Pure builder — μηδέν mocks πέρα από ένα minimal AxisGuideReader. Καλύπτει:
 * σωστό πλήθος κολωνών nX·nY, single-intersection (minPerAxis=1), born-bound
 * center-x/center-y bindings, θέση = τομή, invisible-skip, edge (0 άξονες).
 */

import {
  buildColumnGridFromGuides,
  enumerateGridIntersections,
  type GridColumnSpec,
} from '../column-from-grid';
import { gridAxesFromReader, type AxisGuideReader } from '../../foundations/foundation-from-grid';
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

describe('buildColumnGridFromGuides', () => {
  it('παράγει nX·nY κολώνες (3×3 → 9)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.columns).toHaveLength(9);
    expect(result.ignoredCount).toBe(0);
  });

  it('μία τομή (1×1) → 1 κολώνα (minPerAxis=1, σε αντίθεση με την εσχάρα)', () => {
    const guides = [guide('x0', 'X', 0), guide('y0', 'Y', 0)];
    const result = buildColumnGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.columns).toHaveLength(1);
  });

  it('καμία διεύθυνση άξονα → ok:false insufficient-guides (όχι throw)', () => {
    const result = buildColumnGridFromGuides(reader([...X3]), {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
    expect(result.columns).toHaveLength(0);
  });

  it('born-bound: η πρώτη κολώνα φέρει center-x/center-y bindings στο (x0,y0)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const first = result.columns[0];
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'center-x' },
      { guideId: 'y0', slot: 'center-y' },
    ]);
    expect(first.params.position).toMatchObject({ x: 0, y: 0 });
  });

  it('η θέση κάθε κολώνας είναι ακριβώς η τομή των δεμένων αξόνων (x1,y2)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // enumeration: xi-major → index = xi*nY + yi· (x1,y2) = 1*3 + 2 = 5.
    const col = result.columns[5];
    expect(col.guideBindings).toEqual([
      { guideId: 'x1', slot: 'center-x' },
      { guideId: 'y2', slot: 'center-y' },
    ]);
    expect(col.params.position).toMatchObject({ x: 4000, y: 8000 });
  });

  it('αόρατοι άξονες φιλτράρονται (1 αόρατος X → 2×3 = 6 κολώνες)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000, false), ...Y3];
    const result = buildColumnGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.columns).toHaveLength(6);
  });
});

describe('enumerateGridIntersections', () => {
  it('3×3 → 9 specs με σωστά center bindings', () => {
    const axes = gridAxesFromReader(reader([...X3, ...Y3]), 1);
    expect(axes).not.toBeNull();
    const specs: GridColumnSpec[] = [];
    enumerateGridIntersections(axes!, (s) => specs.push(s));
    expect(specs).toHaveLength(9);
    expect(specs[0].position).toEqual({ x: 0, y: 0 });
    expect(specs[0].bindings).toEqual([
      { guideId: 'x0', slot: 'center-x' },
      { guideId: 'y0', slot: 'center-y' },
    ]);
  });
});
