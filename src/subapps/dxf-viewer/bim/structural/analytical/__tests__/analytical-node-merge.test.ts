/**
 * ADR-480 (T2) — analytical node merge (pure).
 *
 * Καλύπτει: priority-aware union-find (ο root με τη μέγιστη προτεραιότητα),
 * spatial merge εντός ανοχής (3D), και level clustering υψομέτρων.
 */

import {
  NodeUnionFind,
  mergeByProximity,
  clusterElevations,
  NODE_MERGE_TOLERANCE_M,
  type RawNode,
} from '../analytical-node-merge';

describe('NodeUnionFind', () => {
  it('root = το στοιχείο μέγιστης προτεραιότητας (κορυφή κολόνας νικά άκρο δοκαριού)', () => {
    const uf = new NodeUnionFind();
    uf.add('beamEnd', 1);
    uf.add('colTop', 2);
    uf.union('beamEnd', 'colTop');
    expect(uf.find('beamEnd')).toBe('colTop');
    expect(uf.find('colTop')).toBe('colTop');
  });

  it('ισοπαλία προτεραιότητας → ντετερμινιστικά το μικρότερο id', () => {
    const uf = new NodeUnionFind();
    uf.add('z', 1);
    uf.add('a', 1);
    uf.union('z', 'a');
    expect(uf.find('z')).toBe('a');
  });

  it('μεταβατικότητα — τρία στοιχεία ένα set, κοινός root', () => {
    const uf = new NodeUnionFind();
    uf.add('a', 1); uf.add('b', 1); uf.add('c', 1);
    uf.union('a', 'b');
    uf.union('b', 'c');
    expect(uf.find('a')).toBe(uf.find('c'));
  });
});

describe('mergeByProximity', () => {
  const raw = (id: string, x: number, y: number, z: number, p = 1): RawNode => ({
    id, priority: p, position: { xM: x, yM: y, zM: z },
  });

  it('ενώνει κόμβους εντός ανοχής, αφήνει χωριστούς τους μακρινούς', () => {
    const uf = new NodeUnionFind();
    const nodes = [raw('a', 0, 0, 0), raw('b', 0.02, 0, 0), raw('c', 5, 0, 0)];
    nodes.forEach((n) => uf.add(n.id, n.priority));
    mergeByProximity(nodes, uf);
    expect(uf.find('a')).toBe(uf.find('b')); // 20mm < 50mm ανοχή
    expect(uf.find('a')).not.toBe(uf.find('c'));
  });

  it('διαφορά μόνο στο z πάνω από ανοχή → δεν ενώνονται', () => {
    const uf = new NodeUnionFind();
    const nodes = [raw('base', 0, 0, 0), raw('top', 0, 0, 3)];
    nodes.forEach((n) => uf.add(n.id, n.priority));
    mergeByProximity(nodes, uf);
    expect(uf.find('base')).not.toBe(uf.find('top'));
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
