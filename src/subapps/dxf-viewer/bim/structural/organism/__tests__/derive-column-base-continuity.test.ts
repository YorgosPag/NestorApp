/**
 * ADR-489 §6.1 — DERIVED column→footing base continuity (SSoT) tests.
 *
 * Επαληθεύει ότι η effective βάση κάθε κολώνας προκύπτει από τις `footing-bearing`
 * ακμές του graph = άνω παρειά στηρίζοντος πεδίλου, ΜΟΝΟ προς τα κάτω, με το βαθύτερο
 * πέδιλο να νικά (pad −1000 αντί tie-beam −500).
 */

import { buildColumnBaseContinuityMap } from '../derive-column-base-continuity';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from '../structural-organism-types';

/** `atX` μετατοπίζει το footprint στο plan → δύο κολώνες σε ΔΙΑΦΟΡΕΤΙΚΕΣ κατακόρυφες στοίβες. */
const columnNode = (id: string, baseZmm: number, atX = 0): StructuralNode => ({
  id,
  memberKind: 'column',
  entityType: 'column',
  footprint: [{ x: atX, y: 0 }, { x: atX + 1, y: 0 }, { x: atX + 1, y: 1 }],
  baseZmm,
  topZmm: baseZmm + 3000,
});

const footingNode = (id: string, topZmm: number, thicknessMm = 500): StructuralNode => ({
  id,
  memberKind: 'footing',
  entityType: 'foundation',
  footprint: [{ x: -1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 2 }, { x: -1, y: 2 }],
  baseZmm: topZmm - thicknessMm,
  topZmm,
});

const footingEdge = (footingId: string, columnId: string): StructuralEdge => ({
  id: `${footingId}->${columnId}:footing-bearing`,
  supportId: footingId,
  supportedId: columnId,
  kind: 'footing-bearing',
});

const graphOf = (nodes: StructuralNode[], edges: StructuralEdge[]): StructuralGraph => ({ nodes, edges });

describe('buildColumnBaseContinuityMap (ADR-489 §6.1)', () => {
  it('cross-level: κολώνα ισογείου (z=0) εδράζεται στο πέδιλο Θεμελίωσης (top −1000)', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('f1', -1000)],
      [footingEdge('f1', 'c1')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('c1')).toBe(-1000);
  });

  it('χωρίς πέδιλο → κανένα entry (κολώνα κρατά τη nominal βάση)', () => {
    const g = graphOf([columnNode('c1', 0)], []);
    expect(buildColumnBaseContinuityMap(g).size).toBe(0);
  });

  it('πέδιλο στο ίδιο επίπεδο με τη βάση → ΟΧΙ κατέβασμα (no-op εντός EPS)', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('f1', 0)],
      [footingEdge('f1', 'c1')],
    );
    expect(buildColumnBaseContinuityMap(g).has('c1')).toBe(false);
  });

  it('πέδιλο ΠΑΝΩ από τη βάση → ποτέ δεν ανεβάζει κολώνα', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('f1', 500)],
      [footingEdge('f1', 'c1')],
    );
    expect(buildColumnBaseContinuityMap(g).has('c1')).toBe(false);
  });

  it('πολλαπλά πέδιλα → το ΒΑΘΥΤΕΡΟ νικά (pad −1000 αντί tie-beam −500)', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('tie', -500), footingNode('pad', -1000)],
      [footingEdge('tie', 'c1'), footingEdge('pad', 'c1')],
    );
    expect(buildColumnBaseContinuityMap(g).get('c1')).toBe(-1000);
  });

  it('πολλές κολώνες → ανεξάρτητο effective base ανά κολώνα', () => {
    const g = graphOf(
      [columnNode('c1', 0), columnNode('c2', 0), footingNode('f1', -1000), footingNode('f2', -800)],
      [footingEdge('f1', 'c1'), footingEdge('f2', 'c2')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('c1')).toBe(-1000);
    expect(map.get('c2')).toBe(-800);
  });

  // ── ADR-489 §7 — «μόνο η χαμηλότερη κολώνα κάθε πεδίλου» ────────────────────
  // Το `footingSupportsColumnBase` δεν έχει μέγιστη κατακόρυφη απόσταση, οπότε σε
  // per-stack graph (όλοι οι όροφοι μαζί) ΚΑΘΕ κολώνα πάνω από το πέδιλο παίρνει
  // ακμή. Μόνο αυτή που πατά πάνω του επιτρέπεται να κατέβει.

  it('κολώνα ΥΠΕΡΚΕΙΜΕΝΟΥ ορόφου πάνω από το ίδιο πέδιλο ΔΕΝ κατεβαίνει', () => {
    const g = graphOf(
      [columnNode('ground', 0), columnNode('upper', 3000), footingNode('f1', -1000)],
      [footingEdge('f1', 'ground'), footingEdge('f1', 'upper')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('ground')).toBe(-1000);
    expect(map.has('upper')).toBe(false);
  });

  it('τριώροφο stack → μόνο η κολώνα του κατώτατου ορόφου εδράζεται', () => {
    const g = graphOf(
      [columnNode('c0', 0), columnNode('c1', 3000), columnNode('c2', 6000), footingNode('f1', -1000)],
      [footingEdge('f1', 'c0'), footingEdge('f1', 'c1'), footingEdge('f1', 'c2')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect([...map.keys()]).toEqual(['c0']);
  });

  it('δίδυμο πέδιλο: δύο ΙΣΟΫΨΕΙΣ κολώνες κατεβαίνουν και οι δύο', () => {
    const g = graphOf(
      [columnNode('a', 0), columnNode('b', 0), footingNode('f1', -1000)],
      [footingEdge('f1', 'a'), footingEdge('f1', 'b')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('a')).toBe(-1000);
    expect(map.get('b')).toBe(-1000);
  });

  it('πεδιλοδοκός: κολώνες σε ΑΛΛΗ στοίβα εδράζονται ΟΛΕΣ, ακόμη κι αν είναι ψηλότερα', () => {
    // Το κριτήριο είναι η κατακόρυφη στοίβα, ΟΧΙ το «χαμηλότερη κολώνα του πεδίλου»:
    // μια συνδετήρια/εδαφόπλακα στηρίζει πολλές κολώνες σε διαφορετικές θέσεις plan.
    const g = graphOf(
      [columnNode('left', 0, 0), columnNode('right', 400, 10), footingNode('strip', -1000)],
      [footingEdge('strip', 'left'), footingEdge('strip', 'right')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('left')).toBe(-1000);
    expect(map.get('right')).toBe(-1000);
  });

  it('υπερκείμενη κολώνα με ΔΙΚΟ της πέδιλο (υπόγειο) εδράζεται κανονικά', () => {
    // Δύο ανεξάρτητα πέδιλα → κάθε ένα κρίνεται χωριστά· κανένα δεν «σκιάζει» το άλλο.
    const g = graphOf(
      [columnNode('deep', -2000), columnNode('shallow', 0), footingNode('fDeep', -3000), footingNode('fShallow', -1000)],
      [footingEdge('fDeep', 'deep'), footingEdge('fShallow', 'shallow')],
    );
    const map = buildColumnBaseContinuityMap(g);
    expect(map.get('deep')).toBe(-3000);
    expect(map.get('shallow')).toBe(-1000);
  });

  it('αγνοεί μη-footing ακμές (column-bearing/top-attachment)', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('f1', -1000)],
      [{ id: 'x', supportId: 'c1', supportedId: 'b1', kind: 'column-bearing' }],
    );
    expect(buildColumnBaseContinuityMap(g).size).toBe(0);
  });
});
