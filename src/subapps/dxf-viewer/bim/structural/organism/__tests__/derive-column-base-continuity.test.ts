/**
 * ADR-488 §6.1 — DERIVED column→footing base continuity (SSoT) tests.
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

const columnNode = (id: string, baseZmm: number): StructuralNode => ({
  id,
  memberKind: 'column',
  entityType: 'column',
  footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
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

describe('buildColumnBaseContinuityMap (ADR-488 §6.1)', () => {
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

  it('αγνοεί μη-footing ακμές (column-bearing/top-attachment)', () => {
    const g = graphOf(
      [columnNode('c1', 0), footingNode('f1', -1000)],
      [{ id: 'x', supportId: 'c1', supportedId: 'b1', kind: 'column-bearing' }],
    );
    expect(buildColumnBaseContinuityMap(g).size).toBe(0);
  });
});
