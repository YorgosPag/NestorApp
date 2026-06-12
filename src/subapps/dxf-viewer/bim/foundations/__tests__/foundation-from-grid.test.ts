/**
 * ADR-441 Slice 2 — `buildStripGridFromGuides` tests.
 *
 * Pure builder — μηδέν mocks πέρα από ένα minimal AxisGuideReader. Καλύπτει:
 * σωστό πλήθος segments N×M, intersection-to-intersection geometry, slot-based
 * guideBindings tagging (X vs Y strips), invisible-skip, dedup, edge (<2 guides).
 */

import {
  buildStripGridFromGuides,
  enumerateGridStrips,
  gridAxesFromReader,
  type AxisGuideReader,
  type GridStripSpec,
} from '../foundation-from-grid';
import { gridStripJustification } from '../foundation-grid-justification';
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

  // ADR-441 Slice 5a-grid — auto-justification αντικαθιστά το corner-fill. Helper:
  const just = (s: { params: { kind: string; justification?: string } }): string =>
    s.params.kind === 'pad' ? 'pad' : (s.params.justification ?? 'center');

  it('born-hosted: η πρώτη X-λωρίδα φέρει καθαρά slot-based guideBindings (μηδέν extend) + inward justification', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const first = result.strips[0];
    // xi=0 (αριστερότερη κατακόρυφη = περιμετρική) → καθαρά bindings, inward 'right'.
    expect(first.guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
    if (first.params.kind === 'pad') throw new Error('expected line kind');
    expect(first.params.start).toMatchObject({ x: 0, y: 0 }); // καθαρό axis offset (μηδέν corner-fill)
    expect(first.params.end).toMatchObject({ x: 0, y: 4000 });
    expect(first.params.justification).toBe('right'); // εξωτερική παρειά +X → ΠΑΝΩ στον άξονα
  });

  it('Y-λωρίδα φέρει bindings με τον X να ελέγχει start/end-x + inward justification', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // Οι X-λωρίδες είναι nX·(nY-1) = 6· η πρώτη Y-λωρίδα είναι στο index 6.
    const firstY = result.strips[6];
    expect(firstY.guideBindings).toEqual([
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y0', slot: 'end-y' },
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x1', slot: 'end-x' },
    ]);
    if (firstY.params.kind === 'pad') throw new Error('expected line kind');
    expect(firstY.params.justification).toBe('left'); // κάτω οριζόντια (yi=0) → inward +Y
  });

  it('auto-justification: περιμετρικές κατακόρυφες inward, εσωτερική center (xi=0→right, 1→center, 2→left)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // verticals (index 0-5): xi=0 → [0,1], xi=1 → [2,3], xi=2 → [4,5].
    expect([just(result.strips[0]), just(result.strips[1])]).toEqual(['right', 'right']);
    expect([just(result.strips[2]), just(result.strips[3])]).toEqual(['center', 'center']);
    expect([just(result.strips[4]), just(result.strips[5])]).toEqual(['left', 'left']);
  });

  it('auto-justification: περιμετρικές οριζόντιες inward, εσωτερική center (yi=0→left, 1→center, 2→right)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    // horizontals (index 6-11): yi=0 → [6,7], yi=1 → [8,9], yi=2 → [10,11].
    expect([just(result.strips[6]), just(result.strips[7])]).toEqual(['left', 'left']);
    expect([just(result.strips[8]), just(result.strips[9])]).toEqual(['center', 'center']);
    expect([just(result.strips[10]), just(result.strips[11])]).toEqual(['right', 'right']);
  });

  it('μηδέν corner-fill: καμία λωρίδα δεν έχει binding extend, top άκρο = καθαρό axis offset', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    for (const s of result.strips) {
      expect((s.guideBindings ?? []).every((b) => b.extend === undefined)).toBe(true);
    }
    // πρώην γωνιακή κατακόρυφη (strips[1], xi=0 i=1) → end = y2 ακριβώς (όχι 8300).
    const topV = result.strips[1];
    if (topV.params.kind === 'pad') throw new Error('expected line kind');
    expect(topV.params.end).toMatchObject({ x: 0, y: 8000 });
  });

  it('εσωτερική λωρίδα: params.justification = undefined (center default, Firestore-clean)', () => {
    const result = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    const interior = result.strips[2]; // xi=1 (εσωτερική κατακόρυφη)
    if (interior.params.kind === 'pad') throw new Error('expected line kind');
    expect(interior.params.justification).toBeUndefined();
  });

  it('2×2: κάθε λωρίδα περιμετρική → inward justification (καμία center)', () => {
    const guides = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];
    const result = buildStripGridFromGuides(reader(guides), {}, '0', 'mm');
    expect(result.strips).toHaveLength(4);
    for (const s of result.strips) {
      if (s.params.kind === 'pad') throw new Error('expected line kind');
      expect(s.params.justification).toBeDefined();
      expect(s.params.justification).not.toBe('center');
    }
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

// ADR-441 Slice GEN-TIE — kind param: ίδια segments/bindings, διαφορετικό foundation kind.
describe('buildStripGridFromGuides — kind param (strip default / tie-beam)', () => {
  it('default kind → όλες οι λωρίδες είναι πεδιλοδοκοί (strip)', () => {
    const r = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(r.strips).toHaveLength(12);
    for (const s of r.strips) expect(s.params.kind).toBe('strip');
  });

  it("kind='tie-beam' + mode='center' → συνδετήριες, ίδιο πλήθος/bindings, center έδραση", () => {
    const r = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 'center', 'tie-beam');
    expect(r.strips).toHaveLength(12);
    for (const s of r.strips) {
      expect(s.params.kind).toBe('tie-beam');
      if (s.params.kind === 'pad') throw new Error('expected line kind');
      expect(s.params.justification).toBeUndefined(); // center → Firestore-clean
    }
    // Τα bindings είναι ΑΚΡΙΒΩΣ τα ίδια slots με τις πεδιλοδοκούς (ίδιος enumerator).
    expect(r.strips[0].guideBindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
  });

  it('συνδετήρια ΠΑΝΩ από πεδιλοδοκό: top −500 (κάτω παρειά = άνω παρειά strip −1000), δεν θάβεται', () => {
    const strips = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 'inner', 'strip');
    const ties = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 'center', 'tie-beam');
    const strip = strips.strips[0].params;
    const tie = ties.strips[0].params;
    // top παρειές: strip −1000, tie −500 (ψηλότερη → δεν συμπίπτουν).
    expect(strip.topElevationMm).toBe(-1000);
    expect(tie.topElevationMm).toBe(-500);
    expect(tie.topElevationMm).toBeGreaterThan(strip.topElevationMm);
    // Στοίβαγμα: κάτω παρειά συνδετήριας (top−depth = −500−500 = −1000) = άνω παρειά πεδιλοδοκού.
    expect(tie.topElevationMm - tie.thicknessMm).toBe(strip.topElevationMm);
  });
});

// ADR-441 (Giorgio 2026-06-12) — περιμετρικό mode «Έδραση εσχάρας» (center/inner/outer).
describe('gridStripJustification — perimeter mode', () => {
  it('default = inner (περιμετρική προς τα μέσα· zero behavior change)', () => {
    expect(gridStripJustification('V', 0, 3)).toBe('right'); // αριστερότερη inward
    expect(gridStripJustification('V', 2, 3)).toBe('left'); // δεξιότερη inward
    expect(gridStripJustification('H', 0, 3)).toBe('left');
  });

  it('center → ΟΛΕΣ center (και περιμετρικές)', () => {
    expect(gridStripJustification('V', 0, 3, 'center')).toBe('center');
    expect(gridStripJustification('V', 2, 3, 'center')).toBe('center');
    expect(gridStripJustification('H', 0, 3, 'center')).toBe('center');
  });

  it('outer → περιμετρικές αντίστροφα από inner (προεξέχουν)', () => {
    expect(gridStripJustification('V', 0, 3, 'outer')).toBe('left'); // inner ήταν 'right'
    expect(gridStripJustification('V', 2, 3, 'outer')).toBe('right'); // inner ήταν 'left'
    expect(gridStripJustification('H', 0, 3, 'outer')).toBe('right');
  });

  it('εσωτερικές λωρίδες → ΠΑΝΤΑ center σε κάθε mode', () => {
    for (const m of ['center', 'inner', 'outer'] as const) {
      expect(gridStripJustification('V', 1, 3, m)).toBe('center');
    }
  });
});

describe('buildStripGridFromGuides — perimeter mode', () => {
  const just = (s: { params: { kind: string; justification?: string } }): string =>
    s.params.kind === 'pad' ? 'pad' : (s.params.justification ?? 'center');

  it('center → κάθε λωρίδα center (καμία εκκεντρότητα)', () => {
    const r = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 'center');
    for (const s of r.strips) expect(just(s)).toBe('center');
  });

  it('outer → περιμετρικές flipped vs inner (strips[0] left→ τώρα... outer)', () => {
    const r = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm', 'outer');
    // verticals 0-5: xi=0 → 'left' (outer), xi=1 → 'center', xi=2 → 'right'.
    expect([just(r.strips[0]), just(r.strips[1])]).toEqual(['left', 'left']);
    expect([just(r.strips[2]), just(r.strips[3])]).toEqual(['center', 'center']);
    expect([just(r.strips[4]), just(r.strips[5])]).toEqual(['right', 'right']);
  });

  it('default (χωρίς mode) = inner (αμετάβλητη συμπεριφορά)', () => {
    const r = buildStripGridFromGuides(reader([...X3, ...Y3]), {}, '0', 'mm');
    expect(just(r.strips[0])).toBe('right'); // inner αριστερότερη
  });
});

// ADR-441 Slice 7 — SSoT enumeration helpers (κοινά builder + live ghost).
describe('gridAxesFromReader + enumerateGridStrips', () => {
  it('gridAxesFromReader: <2 άξονες → null', () => {
    expect(gridAxesFromReader(reader([guide('x0', 'X', 0), ...Y3]))).toBeNull();
  });

  it('enumerateGridStrips: 3×3 → 12 specs με σωστά bindings/justification (ίδια με builder)', () => {
    const axes = gridAxesFromReader(reader([...X3, ...Y3]));
    expect(axes).not.toBeNull();
    const specs: GridStripSpec[] = [];
    enumerateGridStrips(axes!, (s) => specs.push(s));
    expect(specs).toHaveLength(12);
    // πρώτη κατακόρυφη (xi=0) = inward 'right' με καθαρά bindings (μηδέν extend).
    expect(specs[0].justification).toBe('right');
    expect(specs[0].bindings).toEqual([
      { guideId: 'x0', slot: 'start-x' },
      { guideId: 'x0', slot: 'end-x' },
      { guideId: 'y0', slot: 'start-y' },
      { guideId: 'y1', slot: 'end-y' },
    ]);
  });
});
