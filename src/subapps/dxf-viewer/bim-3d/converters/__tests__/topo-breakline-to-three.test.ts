/**
 * ADR-920 Β4.8 Β2.3 — δεσμευμένες ασυνέχειες → 3Δ τμήματα, ομαδοποιημένα ανά μοτίβο.
 *
 * Το αναμενόμενο υπολογίζεται με το ΙΔΙΟ primitive προβολής που χτίζει το έδαφος
 * (`projectTopoPolylineVertices`): η άγκυρα εδώ είναι η ΛΟΓΙΚΗ (ομάδες, crop, πραγματικό z, NaN), όχι
 * μια δεύτερη υλοποίηση της σύμβασης αξόνων — που θα ήταν ακριβώς ο δίδυμος που απαγορεύει το N.18.
 */

import { topoBreaklinesToGeometries } from '../topo-breakline-to-three';
import { projectTopoPolylineVertices } from '../topo-polyline-to-three';
import type { Breakline, TopoPoint3D } from '../../../systems/topography/topo-types';
import type { WorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';
import { breaklineDashPattern } from '../../../systems/topography/topo-breakline-style';

const SHIFT: WorldToDisplayProjector = {
  isIdentity: false,
  project: (x, y) => ({ x: x - 400_000, y: y - 4_000_000 }),
  unproject: (x, y) => ({ x: x + 400_000, y: y + 4_000_000 }),
};

const line = (id: string, vertices: TopoPoint3D[], extra: Partial<Breakline> = {}): Breakline =>
  ({ id, vertices, closed: false, ...extra });

/** Expected three-world XYZ of 3D ends, via the SAME primitive the terrain uses. */
function expected(ends: TopoPoint3D[], datumMm = 0, projector: WorldToDisplayProjector | null = null): number[] {
  return Array.from(projectTopoPolylineVertices(ends, (i) => ends[i]!.z - datumMm, projector));
}

describe('topoBreaklinesToGeometries — ομάδες ανά μοτίβο', () => {
  it('ίδιο μοτίβο ⇒ μία ομάδα· elevation και άγνωστη (απούσα) είναι η ΙΔΙΑ συνεχής', () => {
    const a = line('a', [{ x: 0, y: 0, z: 1_000 }, { x: 1_000, y: 0, z: 2_000 }], { elevationSource: 'elevation' });
    const b = line('b', [{ x: 0, y: 500, z: 1_000 }, { x: 1_000, y: 500, z: 2_000 }]);
    const c = line('c', [{ x: 0, y: 900, z: 0 }, { x: 1_000, y: 900, z: 0 }], { elevationSource: 'surface' });
    const { groups } = topoBreaklinesToGeometries([a, b, c]);
    expect(groups.map((g) => g.pattern)).toEqual([null, breaklineDashPattern('surface')]);
    expect(groups[0]!.positions.length).toBe(12); // δύο τμήματα στη συνεχή
    expect(groups[1]!.positions.length).toBe(6);
  });

  it('πραγματικό z ανά κορυφή, μείον datum, μέσα από τον projector (§M10f)', () => {
    const ends = [{ x: 400_100, y: 4_000_200, z: 101_000 }, { x: 400_300, y: 4_000_200, z: 103_500 }];
    const { groups, vertices } = topoBreaklinesToGeometries([line('a', ends)], { projector: SHIFT, datumMm: 100_000 });
    expect(Array.from(groups[0]!.positions)).toEqual(expected(ends, 100_000, SHIFT));
    expect(Array.from(vertices!)).toEqual(expected(ends, 100_000, SHIFT));
  });

  it('κλειστή ⇒ και το τμήμα τελευταία → πρώτη', () => {
    const tri = [{ x: 0, y: 0, z: 0 }, { x: 1_000, y: 0, z: 0 }, { x: 0, y: 1_000, z: 0 }];
    expect(topoBreaklinesToGeometries([line('t', tri, { closed: true })]).groups[0]!.positions.length).toBe(18);
    expect(topoBreaklinesToGeometries([line('t', tri)]).groups[0]!.positions.length).toBe(12);
  });

  it('μη πεπερασμένη κορυφή ⇒ πέφτουν τα τμήματά της, όχι όλη η σκηνή (ADR-537)', () => {
    const bad = line('x', [{ x: 0, y: 0, z: 0 }, { x: 1_000, y: 0, z: Number.NaN }, { x: 2_000, y: 0, z: 0 }]);
    const { groups, vertices } = topoBreaklinesToGeometries([bad]);
    expect(groups).toEqual([]);
    expect(vertices!.length).toBe(6);
  });

  it('καμία ασυνέχεια ⇒ καμία ομάδα, καμία κουκκίδα', () => {
    expect(topoBreaklinesToGeometries([])).toEqual({ groups: [], vertices: null });
  });
});

describe('topoBreaklinesToGeometries — crop (ίδιο δαχτυλίδι με το TIN)', () => {
  const RING = [{ x: 0, y: 0 }, { x: 10_000, y: 0 }, { x: 10_000, y: 10_000 }, { x: 0, y: 10_000 }];

  it('κρατά μόνο το κομμάτι ΜΕΣΑ, με γραμμικό z στα σημεία τομής', () => {
    const through = line('a', [{ x: -5_000, y: 5_000, z: 0 }, { x: 15_000, y: 5_000, z: 20_000 }]);
    const { groups, vertices } = topoBreaklinesToGeometries([through], { cropRing: RING });
    const inside = [{ x: 0, y: 5_000, z: 5_000 }, { x: 10_000, y: 5_000, z: 15_000 }];
    expect(Array.from(groups[0]!.positions)).toEqual(expected(inside));
    expect(vertices).toBeNull(); // και οι δύο κορυφές είναι ΕΞΩ
  });

  it('ολόκληρη έξω ⇒ τίποτα· χωρίς δαχτυλίδι ⇒ ολόκληρη', () => {
    const outside = line('o', [{ x: 20_000, y: 0, z: 0 }, { x: 30_000, y: 0, z: 0 }]);
    expect(topoBreaklinesToGeometries([outside], { cropRing: RING }).groups).toEqual([]);
    expect(topoBreaklinesToGeometries([outside], { cropRing: null }).groups[0]!.positions.length).toBe(6);
  });
});
