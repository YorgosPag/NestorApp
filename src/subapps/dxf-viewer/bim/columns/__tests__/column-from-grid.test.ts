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
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { buildActiveStoreyContext } from '../../../systems/levels/active-storey-context';

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

describe('buildColumnGridFromGuides — στατική συνέχεια στη θεμελίωση (ADR-441 GEN-COL)', () => {
  it('foundationBaseLevelMm=-1000 → βάση −1000 + height 4000 (κορυφή μένει 3000)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', -1000);
    const c = result.columns[0];
    expect(c.params.baseOffset).toBe(-1000); // βάση στη θεμελίωση
    expect(c.params.height).toBe(4000);      // 3000 + 1000 → top = -1000 + 4000 = 3000
  });

  it('χωρίς foundationBaseLevelMm → καμία αλλαγή (βάση 0, height 3000)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const c = result.columns[0];
    expect(c.params.baseOffset).toBe(0);
    expect(c.params.height).toBe(3000);
  });

  it('θεμελίωση στο/πάνω από το δάπεδο (>=0) → no-op (καμία επέκταση)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 0);
    expect(result.columns[0].params.baseOffset).toBe(0);
    expect(result.columns[0].params.height).toBe(3000);
  });

  it('σέβεται custom height override (height 2800 → 3800 με βάση −1000)', () => {
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), { height: 2800 }, '0', 'mm', -1000);
    expect(result.columns[0].params.height).toBe(3800);
  });
});

// ADR-448 Phase 2 — storey-aware height combined with GEN-COL foundation continuity.
describe('buildColumnGridFromGuides — storey-aware height (ADR-448 Phase 2)', () => {
  const setStorey = (heightM: number) =>
    useActiveStoreyStore.setState({
      context: buildActiveStoreyContext(
        [{ id: 'f1', number: 1, elevation: 0, height: heightM, kind: 'standard' }],
        'f1',
      ),
    });
  afterEach(() => useActiveStoreyStore.setState({ context: null }));

  it('grid κολώνες κληρονομούν storey height (3.5m → 3500)', () => {
    setStorey(3.5);
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(result.columns[0].params.height).toBe(3500);
    expect(result.columns[0].params.baseOffset).toBe(0);
  });

  it('GEN-COL continuity με storey height: 3500 + baseDrop 1000 → height 4500, βάση −1000', () => {
    setStorey(3.5);
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', -1000);
    expect(result.columns[0].params.baseOffset).toBe(-1000);
    expect(result.columns[0].params.height).toBe(4500); // top μένει στο storey ceiling 3500
  });

  it('explicit override υπερισχύει του storey (2800 + drop 1000 → 3800)', () => {
    setStorey(3.5);
    const result = buildColumnGridFromGuides(reader([...X3, ...Y3]), { height: 2800 }, '0', 'mm', -1000);
    expect(result.columns[0].params.height).toBe(3800);
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
