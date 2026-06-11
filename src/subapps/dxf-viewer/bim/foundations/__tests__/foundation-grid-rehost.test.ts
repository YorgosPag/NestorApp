/**
 * ADR-441 Slice 6b — `rehostOrphanStrips` pure matcher tests.
 *
 * Επαληθεύει: ευθυγραμμισμένος ορφανός (vertical/horizontal) → υιοθετεί bindings +
 * coords του target φατνώματος (ίδιο signature) κρατώντας id+width· εκτός κανάβου →
 * skip· κλίμακα μέτρων (scale-aware tol)· ορφανός με bindings → εξαιρείται· 2 ορφανοί
 * ίδιο segment → πρώτος κερδίζει.
 */

import { rehostOrphanStrips } from '../foundation-grid-rehost';
import { buildStripGridFromGuides, type AxisGuideReader } from '../foundation-from-grid';
import { gridStripSignature } from '../foundation-grid-segments';
import type { Guide } from '../../../systems/guides/guide-types';
import type { SceneUnits } from '../../../utils/scene-units';
import type { FoundationEntity, FoundationKind } from '../../types/foundation-types';

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

const reader = (guides: readonly Guide[]): AxisGuideReader => ({
  getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis),
});

let idSeq = 0;
/** Legacy ορφανός γραμμικός πεδιλοδοκός (ΧΩΡΙΣ guideBindings). */
const orphan = (
  start: { x: number; y: number },
  end: { x: number; y: number },
  opts: { width?: number; units?: SceneUnits; kind?: FoundationKind } = {},
): FoundationEntity => ({
  id: `orphan${idSeq++}`,
  type: 'foundation',
  kind: opts.kind ?? 'strip',
  params: {
    kind: opts.kind ?? 'strip',
    start: { x: start.x, y: start.y, z: 0 },
    end: { x: end.x, y: end.y, z: 0 },
    width: opts.width ?? 800,
    topElevationMm: -1000,
    thicknessMm: 400,
    sceneUnits: opts.units ?? 'mm',
  },
} as unknown as FoundationEntity);

const X3 = [guide('x0', 'X', 0), guide('x1', 'X', 4000), guide('x2', 'X', 8000)];
const Y3 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000), guide('y2', 'Y', 8000)];

function buildTarget(guides: readonly Guide[], units: SceneUnits = 'mm'): readonly FoundationEntity[] {
  return buildStripGridFromGuides(reader(guides), {}, '0', units).strips;
}

describe('rehostOrphanStrips', () => {
  it('vertical ορφανός ευθυγραμμισμένος → υιοθετεί bindings+coords του target (ίδιο signature)', () => {
    const target = buildTarget([...X3, ...Y3]);
    const o = orphan({ x: 0, y: 0 }, { x: 0, y: 4000 }, { width: 800 });
    const res = rehostOrphanStrips([o], target, X3, Y3);

    expect(res).toHaveLength(1);
    const { original, rehosted } = res[0];
    expect(original.id).toBe(o.id);
    expect(rehosted.id).toBe(o.id); // ίδιο id
    // bindings + signature = αυτά του target segment V|x0|y0|y1.
    const matchTarget = target.find((t) => gridStripSignature(t) === gridStripSignature(rehosted));
    expect(matchTarget).toBeDefined();
    expect(rehosted.guideBindings).toEqual(matchTarget!.guideBindings);
    // διατομή (width) διατηρείται· coords snapped στο target.
    expect((rehosted.params as { width: number }).width).toBe(800);
    expect((rehosted.params as { start: { x: number } }).start.x).toBe(0);
  });

  it('horizontal ορφανός ευθυγραμμισμένος → match', () => {
    const target = buildTarget([...X3, ...Y3]);
    const o = orphan({ x: 0, y: 0 }, { x: 4000, y: 0 });
    const res = rehostOrphanStrips([o], target, X3, Y3);
    expect(res).toHaveLength(1);
    const sig = gridStripSignature(res[0].rehosted);
    expect(target.some((t) => gridStripSignature(t) === sig)).toBe(true);
  });

  it('εκτός κανάβου (mid-bay) → skip (μένει ελεύθερος)', () => {
    const target = buildTarget([...X3, ...Y3]);
    // x=2000 απέχει 2000 από κάθε X-guide· tol = 4000·0.25 = 1000 → no match.
    const o = orphan({ x: 2000, y: 0 }, { x: 2000, y: 4000 });
    expect(rehostOrphanStrips([o], target, X3, Y3)).toHaveLength(0);
  });

  it('κλίμακα ΜΕΤΡΩΝ: tol scale-aware (ευθυγραμμισμένος match· mid-bay skip)', () => {
    const Xm = [guide('x0', 'X', 0), guide('x1', 'X', 4), guide('x2', 'X', 8)];
    const Ym = [guide('y0', 'Y', 0), guide('y1', 'Y', 4), guide('y2', 'Y', 8)];
    const target = buildTarget([...Xm, ...Ym], 'm');
    const aligned = orphan({ x: 0, y: 0 }, { x: 0, y: 4 }, { units: 'm' });
    const mid = orphan({ x: 2, y: 0 }, { x: 2, y: 4 }, { units: 'm' }); // 2 > tol(4·0.25=1)
    expect(rehostOrphanStrips([aligned], target, Xm, Ym)).toHaveLength(1);
    expect(rehostOrphanStrips([mid], target, Xm, Ym)).toHaveLength(0);
  });

  it('ορφανός που ΗΔΗ φέρει bindings → εξαιρείται', () => {
    const target = buildTarget([...X3, ...Y3]);
    const hosted = {
      ...orphan({ x: 0, y: 0 }, { x: 0, y: 4000 }),
      guideBindings: [{ guideId: 'x0', slot: 'start-x' }],
    } as unknown as FoundationEntity;
    expect(rehostOrphanStrips([hosted], target, X3, Y3)).toHaveLength(0);
  });

  it('multi-bay ορφανός (όλο το ύψος άξονα) → υιοθετεί ΤΟ ΠΡΩΤΟ φάτνωμα (V|x0|y0|y1)', () => {
    // Χειροκίνητη λωρίδα σε όλο το ύψος του x0 (y0→y2, 2 φατνώματα). Πρέπει να
    // ταιριάξει στο πρώτο grid segment (y0→y1)· τα υπόλοιπα τα φτιάχνει ο reconciler.
    const target = buildTarget([...X3, ...Y3]);
    const o = orphan({ x: 0, y: 0 }, { x: 0, y: 8000 });
    const res = rehostOrphanStrips([o], target, X3, Y3);
    expect(res).toHaveLength(1);
    // Το rehosted signature ταυτίζεται με ΑΚΡΙΒΩΣ ένα target strip = το πρώτο φάτνωμα.
    const sig = gridStripSignature(res[0].rehosted);
    expect(target.filter((t) => gridStripSignature(t) === sig)).toHaveLength(1);
    // Coords του πρώτου φατνώματος (y0→y1), όχι όλο το ύψος (y0→y2).
    expect((res[0].rehosted.params as { end: { y: number } }).end.y).toBe(4000);
    expect(res[0].rehosted.id).toBe(o.id);
  });

  it('multi-bay horizontal ορφανός → υιοθετεί το πρώτο φάτνωμα (H|y0|x0|x1)', () => {
    const target = buildTarget([...X3, ...Y3]);
    const o = orphan({ x: 0, y: 0 }, { x: 8000, y: 0 });
    const res = rehostOrphanStrips([o], target, X3, Y3);
    expect(res).toHaveLength(1);
    // Σπάει στο πρώτο φάτνωμα x0→x1 (ίδιο signature με ένα μόνο target strip).
    const sig = gridStripSignature(res[0].rehosted);
    expect(target.filter((t) => gridStripSignature(t) === sig)).toHaveLength(1);
  });

  it('2 ορφανοί ίδιο segment → πρώτος κερδίζει (deterministic, μηδέν διπλό re-host)', () => {
    const target = buildTarget([...X3, ...Y3]);
    const a = orphan({ x: 0, y: 0 }, { x: 0, y: 4000 });
    const b = orphan({ x: 0, y: 0 }, { x: 0, y: 4000 });
    const res = rehostOrphanStrips([a, b], target, X3, Y3);
    expect(res).toHaveLength(1);
    expect(res[0].original.id).toBe(a.id);
  });
});
