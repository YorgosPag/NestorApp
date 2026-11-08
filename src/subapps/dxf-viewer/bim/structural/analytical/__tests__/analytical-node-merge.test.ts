/**
 * ADR-480 (T2) — analytical node merge (pure).
 *
 * Καλύπτει: αντιπρόσωπο προτεραιότητας πάνω στον SSoT union-find (ADR-929 §6.9 #20 — ίδιες
 * αναμενόμενες τιμές με την παλιά `NodeUnionFind`), spatial merge εντός ανοχής (3D), και level
 * clustering υψομέτρων.
 */

import {
  createNodeSets,
  priorityRepresentatives,
  mergeByProximity,
  clusterElevations,
  NODE_MERGE_TOLERANCE_M,
  type RawNode,
} from '../analytical-node-merge';

const raw = (id: string, x: number, y: number, z: number, p = 1): RawNode => ({
  id, priority: p, position: { xM: x, yM: y, zM: z },
});

/** Αντιπρόσωπος ανά id, με τις προτεραιότητες των `nodes`. */
function representatives(nodes: readonly RawNode[], unions: ReadonlyArray<readonly [string, string]>) {
  const sets = createNodeSets(nodes);
  for (const [a, b] of unions) sets.union(a, b);
  const priority = new Map(nodes.map((n) => [n.id, n.priority]));
  return priorityRepresentatives(sets, (id) => priority.get(id) ?? 0);
}

describe('priorityRepresentatives', () => {
  it('αντιπρόσωπος = το στοιχείο μέγιστης προτεραιότητας (κορυφή κολόνας νικά άκρο δοκαριού)', () => {
    const rep = representatives([raw('beamEnd', 0, 0, 0, 1), raw('colTop', 0, 0, 0, 2)], [['beamEnd', 'colTop']]);
    expect(rep.get('beamEnd')).toBe('colTop');
    expect(rep.get('colTop')).toBe('colTop');
  });

  it('ισοπαλία προτεραιότητας → ντετερμινιστικά το μικρότερο id', () => {
    const rep = representatives([raw('z', 0, 0, 0, 1), raw('a', 0, 0, 0, 1)], [['z', 'a']]);
    expect(rep.get('z')).toBe('a');
  });

  it('μεταβατικότητα — τρία στοιχεία ένα set, κοινός αντιπρόσωπος', () => {
    const rep = representatives([raw('a', 0, 0, 0), raw('b', 0, 0, 0), raw('c', 0, 0, 0)], [['a', 'b'], ['b', 'c']]);
    expect(rep.get('a')).toBe(rep.get('c'));
  });

  it('ανεξάρτητος από σειρά/φορά ενώσεων: η μέγιστη προτεραιότητα κερδίζει ακόμη κι όταν μπαίνει τελευταία', () => {
    const nodes = [raw('b', 0, 0, 0, 1), raw('c', 0, 0, 0, 1), raw('top', 0, 0, 0, 3), raw('a', 0, 0, 0, 1)];
    const forward = representatives(nodes, [['b', 'c'], ['c', 'a'], ['a', 'top']]);
    const backward = representatives(nodes, [['top', 'a'], ['a', 'c'], ['c', 'b']]);
    for (const id of ['a', 'b', 'c', 'top']) {
      expect(forward.get(id)).toBe('top');
      expect(backward.get(id)).toBe('top');
    }
  });

  it('μονοσύνολο ⇒ αντιπρόσωπος ο εαυτός του', () => {
    const rep = representatives([raw('x', 0, 0, 0), raw('y', 0, 0, 0, 9)], []);
    expect(rep.get('x')).toBe('x');
    expect(rep.get('y')).toBe('y');
  });
});

describe('mergeByProximity', () => {
  it('ενώνει κόμβους εντός ανοχής, αφήνει χωριστούς τους μακρινούς', () => {
    const nodes = [raw('a', 0, 0, 0), raw('b', 0.02, 0, 0), raw('c', 5, 0, 0)];
    const sets = createNodeSets(nodes);
    mergeByProximity(nodes, sets);
    expect(sets.same('a', 'b')).toBe(true); // 20mm < 50mm ανοχή
    expect(sets.same('a', 'c')).toBe(false);
  });

  it('διαφορά μόνο στο z πάνω από ανοχή → δεν ενώνονται', () => {
    const nodes = [raw('base', 0, 0, 0), raw('top', 0, 0, 3)];
    const sets = createNodeSets(nodes);
    mergeByProximity(nodes, sets);
    expect(sets.same('base', 'top')).toBe(false);
  });
});

describe('clusterElevations', () => {
  it('ομαδοποιεί κοντινά υψόμετρα σε στάθμες', () => {
    const c = clusterElevations([0, 0.01, 3, 3.02, 6]);
    expect(c.clusters).toHaveLength(3);
    expect(c.indexOf(0)).toBe(0);
    expect(c.indexOf(3.01)).toBe(1);
    expect(c.indexOf(6)).toBe(2);
  });

  it('αντιπρόσωπος = μ.ό. του cluster· κενή είσοδος → καμία στάθμη', () => {
    const c = clusterElevations([3, 3.04]);
    expect(c.clusters[0].elevationM).toBeCloseTo(3.02, 4);
    expect(clusterElevations([]).clusters).toHaveLength(0);
  });

  it('η ανοχή είναι το NODE_MERGE_TOLERANCE_M', () => {
    const justOver = clusterElevations([0, NODE_MERGE_TOLERANCE_M + 0.001]);
    expect(justOver.clusters).toHaveLength(2);
  });
});
