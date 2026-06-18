/**
 * ADR-486 — DERIVED-from-connectivity beam support condition (SSoT) tests.
 *
 * Επαληθεύει τον κανόνα precedence: count===1 → πρόβολος (η ΜΟΝΗ αλλαγή
 * συμπεριφοράς)· count!==1 → ο αποθηκευμένος τύπος (μηδέν regression).
 */

import { resolveBeamSupportCondition, buildBeamSupportTypeMap } from '../derive-beam-support';
import type {
  StructuralEdge,
  StructuralGraph,
  StructuralNode,
} from '../structural-organism-types';
import type { BeamSupportType } from '../../../types/beam-types';

const beamNode = (id: string, supportType: BeamSupportType = 'simple'): StructuralNode => ({
  id,
  memberKind: 'beam',
  entityType: 'beam',
  axis: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, halfWidth: 0.1 },
  supportType,
  baseZmm: 0,
  topZmm: 300,
});

const columnNode = (id: string): StructuralNode => ({
  id,
  memberKind: 'column',
  entityType: 'column',
  footprint: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  baseZmm: 0,
  topZmm: 3000,
});

const bearingEdge = (columnId: string, beamId: string): StructuralEdge => ({
  id: `${columnId}->${beamId}:column-bearing`,
  supportId: columnId,
  supportedId: beamId,
  kind: 'column-bearing',
});

const graphOf = (nodes: StructuralNode[], edges: StructuralEdge[]): StructuralGraph => ({ nodes, edges });

describe('resolveBeamSupportCondition (ADR-486)', () => {
  it('1 στήριξη → πρόβολος (override του stored simple)', () => {
    const g = graphOf([beamNode('b1'), columnNode('c1')], [bearingEdge('c1', 'b1')]);
    const r = resolveBeamSupportCondition(g, 'b1', 'simple');
    expect(r.supportType).toBe('cantilever');
    expect(r.supportCount).toBe(1);
    expect(r.stable).toBe(true);
  });

  it('2 στηρίξεις → διατηρεί τον stored (αμφιέρειστο)', () => {
    const g = graphOf(
      [beamNode('b1'), columnNode('c1'), columnNode('c2')],
      [bearingEdge('c1', 'b1'), bearingEdge('c2', 'b1')],
    );
    expect(resolveBeamSupportCondition(g, 'b1', 'simple').supportType).toBe('simple');
  });

  it('2 στηρίξεις → διατηρεί τη ρητή πρόθεση χρήστη (fixed)', () => {
    const g = graphOf(
      [beamNode('b1', 'fixed'), columnNode('c1'), columnNode('c2')],
      [bearingEdge('c1', 'b1'), bearingEdge('c2', 'b1')],
    );
    expect(resolveBeamSupportCondition(g, 'b1', 'fixed').supportType).toBe('fixed');
  });

  it('1 στήριξη από fixed → πρόβολος (έχασε στήριξη)', () => {
    const g = graphOf([beamNode('b1', 'fixed'), columnNode('c1')], [bearingEdge('c1', 'b1')]);
    expect(resolveBeamSupportCondition(g, 'b1', 'fixed').supportType).toBe('cantilever');
  });

  it('0 στηρίξεις → fallback stored + ασταθές (μηχανισμός)', () => {
    const g = graphOf([beamNode('b1')], []);
    const r = resolveBeamSupportCondition(g, 'b1', 'simple');
    expect(r.supportType).toBe('simple');
    expect(r.supportCount).toBe(0);
    expect(r.stable).toBe(false);
  });

  it('απών stored → default simple όταν δεν είναι πρόβολος', () => {
    const g = graphOf([beamNode('b1')], []);
    expect(resolveBeamSupportCondition(g, 'b1', undefined).supportType).toBe('simple');
  });
});

describe('buildBeamSupportTypeMap (ADR-486)', () => {
  it('χαρτογραφεί μόνο δοκάρια· πρόβολος vs αμφιέρειστο σωστά', () => {
    const g = graphOf(
      [beamNode('cantilever-beam'), beamNode('simple-beam'), columnNode('c1'), columnNode('c2'), columnNode('c3')],
      [
        bearingEdge('c1', 'cantilever-beam'), // 1 στήριξη
        bearingEdge('c2', 'simple-beam'),
        bearingEdge('c3', 'simple-beam'), // 2 στηρίξεις
      ],
    );
    const map = buildBeamSupportTypeMap(g);
    expect(map.get('cantilever-beam')).toBe('cantilever');
    expect(map.get('simple-beam')).toBe('simple');
    expect(map.has('c1')).toBe(false); // οι κολώνες δεν μπαίνουν
    expect(map.size).toBe(2);
  });
});
