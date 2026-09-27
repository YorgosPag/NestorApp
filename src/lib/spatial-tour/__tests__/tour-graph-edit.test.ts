/**
 * @fileoverview **ΟΙ ΑΛΛΑΓΕΣ ΤΟΥ ΓΡΑΦΟΥ** (ADR-884 Φ2β · §4.9) — καθαρές.
 *
 * - **Τ** — τοποθέτηση: νέο σημείο σε τοπικό όροφο που δεν υπάρχει ⇒ ο όροφος γεννιέται με κάτοψη `none`· όροφος BIM δεν
 *   επινοείται· «δίπλα στο…» ⇒ σύνδεσμος και στις δύο κατευθύνσεις· ήδη τοποθετημένη ⇒ άρνηση, ίδιος κόμβος ⇒ τίποτα.
 * - **Α** — αφαίρεση: η τελευταία λήψη παίρνει μαζί το σημείο **και** τους εισερχόμενους συνδέσμους.
 * - **Β** — βελάκι: upsert στο ένα άκρο, το άλλο κρατά το δικό του· ίδιο βελάκι ⇒ τίποτα.
 * - **Γ** — κάθε αποτέλεσμα περνά το `checkTourGraph`.
 * - **Ε** — τοποθετείται **μόνο** λήψη με πλακίδια (Φ2δ): άψητη σε ορατό σημείο θα το έκρυβε από τον θεατή.
 */

import { checkTourGraph } from '../spatial-tour-graph';
import { linkNodes, placeCapture, unlinkNodes, unplaceCapture } from '../tour-graph-edit';
import type { SpatialTour, TourNode } from '@/types/spatial-tour';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

const NONE = { source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null } as const;
const L0 = { kind: 'local', ordinal: 0 } as const;
const node = (id: string, links: TourNode['links'] = []): TourNode => ({ id, levelKey: L0, position: null, links });
const GRAPH: Graph = {
  levels: [{ key: L0, floorPlans: [NONE] }],
  nodes: [node('a', [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }]), node('b', [{ toNodeId: 'a', via: 'manual', bearingRad: 2 }])],
};
const EMPTY: Graph = { levels: [], nodes: [] };
/** Λήψη με πλακίδια — μόνο τέτοια τοποθετείται (Φ2δ · §4.10). */
const READY = { state: 'ready', contentHash: 'h1', faceSize: 512 } as const;
const UNPLACED = { nodeId: null, tileset: READY };
const placedAt = (nodeId: string) => ({ nodeId, tileset: READY });

function edited(result: ReturnType<typeof placeCapture>) {
  if (result.kind !== 'edited') throw new Error(`αναμενόταν αλλαγή, ήρθε ${JSON.stringify(result)}`);
  expect(checkTourGraph(result.graph)).toEqual([]);
  return result;
}

describe('Τ — τοποθέτηση', () => {
  it('πρώτο σημείο σε άδεια περιήγηση: ο τοπικός όροφος γεννιέται με κάτοψη none', () => {
    const result = edited(placeCapture(EMPTY, UNPLACED, { kind: 'new-node', levelKey: L0, linkFrom: null }, 'n1'));
    expect(result.graph.levels).toEqual([{ key: L0, floorPlans: [NONE] }]);
    expect(result.graph.nodes).toEqual([node('n1')]);
    expect(result.captureNodeId).toBe('n1');
  });

  it('όροφος BIM που η περιήγηση δεν ξέρει ⇒ άρνηση, ποτέ επινόηση', () => {
    expect(placeCapture(EMPTY, UNPLACED, { kind: 'new-node', levelKey: { kind: 'floor', floorId: 'f1' }, linkFrom: null }, 'n1'))
      .toEqual({ kind: 'refused', reason: 'level-absent' });
  });

  it('«δίπλα στο a» ⇒ σύνδεσμος και στις δύο κατευθύνσεις, το a κρατά τους άλλους του', () => {
    const result = edited(placeCapture(GRAPH, UNPLACED, { kind: 'new-node', levelKey: L0, linkFrom: 'a' }, 'n1'));
    const a = result.graph.nodes.find((n) => n.id === 'a');
    expect(a?.links.map((l) => l.toNodeId).sort()).toEqual(['b', 'n1']);
    expect(result.graph.nodes.find((n) => n.id === 'n1')?.links).toEqual([{ toNodeId: 'a', via: 'manual', bearingRad: null }]);
  });

  it('στο ίδιο σημείο με άλλη λήψη ⇒ κανένας νέος κόμβος', () => {
    const result = edited(placeCapture(GRAPH, UNPLACED, { kind: 'node', nodeId: 'b' }, 'n1'));
    expect(result.graph).toBe(GRAPH);
    expect(result.captureNodeId).toBe('b');
  });

  it('ήδη τοποθετημένη ⇒ άρνηση (και το «νέο σημείο» δεν γεννά δεύτερο κόμβο)· ίδιο σημείο ⇒ τίποτα', () => {
    expect(placeCapture(GRAPH, placedAt('a'), { kind: 'new-node', levelKey: L0, linkFrom: null }, 'n1')).toEqual({ kind: 'refused', reason: 'capture-placed' });
    expect(placeCapture(GRAPH, placedAt('a'), { kind: 'node', nodeId: 'b' }, 'n1')).toEqual({ kind: 'refused', reason: 'capture-placed' });
    expect(placeCapture(GRAPH, placedAt('a'), { kind: 'node', nodeId: 'a' }, 'n1')).toEqual({ kind: 'unchanged' });
  });

  it('άγνωστο σημείο ⇒ άρνηση', () => {
    expect(placeCapture(GRAPH, UNPLACED, { kind: 'node', nodeId: 'zz' }, 'n1')).toEqual({ kind: 'refused', reason: 'node-absent' });
    expect(placeCapture(GRAPH, UNPLACED, { kind: 'new-node', levelKey: L0, linkFrom: 'zz' }, 'n1')).toEqual({ kind: 'refused', reason: 'node-absent' });
  });
});

describe('Α — αφαίρεση', () => {
  it('τελευταία λήψη ⇒ φεύγει το σημείο και κάθε σύνδεσμος προς αυτό', () => {
    const result = edited(unplaceCapture(GRAPH, { nodeId: 'a' }, 0));
    expect(result.graph.nodes).toEqual([node('b')]);
    expect(result.captureNodeId).toBeNull();
  });

  it('υπάρχει κι άλλη λήψη στο σημείο ⇒ το σημείο μένει', () => {
    expect(edited(unplaceCapture(GRAPH, { nodeId: 'a' }, 1)).graph.nodes).toBe(GRAPH.nodes);
  });

  it('ατοποθέτητη ⇒ άρνηση', () => {
    expect(unplaceCapture(GRAPH, { nodeId: null }, 0)).toEqual({ kind: 'refused', reason: 'capture-unplaced' });
  });
});

describe('Β — βελάκι', () => {
  it('αλλαγή βελακιού στο a: το b κρατά το δικό του', () => {
    const result = edited(linkNodes(GRAPH, 'a', 'b', 0.5));
    expect(result.graph.nodes.find((n) => n.id === 'a')?.links).toEqual([{ toNodeId: 'b', via: 'manual', bearingRad: 0.5 }]);
    expect(result.graph.nodes.find((n) => n.id === 'b')?.links).toEqual([{ toNodeId: 'a', via: 'manual', bearingRad: 2 }]);
  });

  it('βελάκι σε ΑΣΥΝΔΕΤΟ σημείο: η επιστροφή γεννιέται ΧΩΡΙΣ βελάκι — ποτέ «+π» (χωρίς πυξίδα θα έδειχνε λάθος τοίχο, §4.10)', () => {
    const withC: Graph = { levels: GRAPH.levels, nodes: [...GRAPH.nodes, node('c')] };
    const result = edited(linkNodes(withC, 'a', 'c', 1));
    expect(result.graph.nodes.find((n) => n.id === 'a')?.links).toContainEqual({ toNodeId: 'c', via: 'manual', bearingRad: 1 });
    expect(result.graph.nodes.find((n) => n.id === 'c')?.links).toEqual([{ toNodeId: 'a', via: 'manual', bearingRad: null }]);
  });

  it('ίδιο βελάκι ⇒ τίποτα· αυτοσύνδεσμος/άγνωστος ⇒ άρνηση', () => {
    expect(linkNodes(GRAPH, 'a', 'b', 1)).toEqual({ kind: 'unchanged' });
    expect(linkNodes(GRAPH, 'a', 'a', 1)).toEqual({ kind: 'refused', reason: 'node-absent' });
    expect(linkNodes(GRAPH, 'a', 'zz', 1)).toEqual({ kind: 'refused', reason: 'node-absent' });
  });

  it('αποσύνδεση: και οι δύο κατευθύνσεις· ανύπαρκτος σύνδεσμος ⇒ τίποτα', () => {
    const result = edited(unlinkNodes(GRAPH, 'b', 'a'));
    expect(result.graph.nodes.every((n) => n.links.length === 0)).toBe(true);
    expect(unlinkNodes(result.graph, 'a', 'b')).toEqual({ kind: 'unchanged' });
  });
});

describe('Ε — μόνο λήψη με πλακίδια τοποθετείται (Φ2δ · §4.10)', () => {
  const pending = { nodeId: null, tileset: { state: 'pending', contentHash: null, faceSize: null } } as const;
  const failed = { nodeId: null, tileset: { state: 'failed', contentHash: 'h1', faceSize: null } } as const;
  const readyNoSize = { nodeId: null, tileset: { state: 'ready', contentHash: 'h1', faceSize: null } } as const;

  it.each([
    ['ψήνεται', pending],
    ['απέτυχε', failed],
    ['ready χωρίς μέγεθος όψης (ο θεατής δεν θα ήξερε τα επίπεδα)', readyNoSize],
  ])('%s ⇒ capture-not-ready, και σε νέο και σε υπάρχον σημείο', (_label, capture) => {
    expect(placeCapture(GRAPH, capture, { kind: 'node', nodeId: 'a' }, 'n1')).toEqual({ kind: 'refused', reason: 'capture-not-ready' });
    expect(placeCapture(GRAPH, capture, { kind: 'new-node', levelKey: L0, linkFrom: null }, 'n1')).toEqual({ kind: 'refused', reason: 'capture-not-ready' });
  });

  it('ήδη τοποθετημένη στο ίδιο σημείο μένει «τίποτα» (επανάληψη) πριν ρωτηθεί η ετοιμότητα', () => {
    expect(placeCapture(GRAPH, { nodeId: 'a', tileset: { state: 'pending', contentHash: null, faceSize: null } }, { kind: 'node', nodeId: 'a' }, 'n1'))
      .toEqual({ kind: 'unchanged' });
  });
});
