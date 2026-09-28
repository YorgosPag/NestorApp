/**
 * @fileoverview **ΟΙ ΑΛΛΑΓΕΣ ΤΗΣ ΚΑΤΟΨΗΣ** (ADR-884 Φ2στ-β · §4.13) — καθαρές.
 *
 * - **Κ** — κάτοψη ορόφου: η προηγούμενη `superseded` (ιστορία), θέσεις του ορόφου σβήνουν, ίδια επιλογή ⇒ τίποτα.
 * - **Β** — κλίμακα: ξανακλιμάκωση θέσεων (ίδιο pixel) · χωρίς εικόνα ⇒ άρνηση · άκυρη ⇒ άρνηση · ίδια ⇒ τίποτα.
 * - **Θ** — θέση: μόνο σε βαθμονομημένη κάτοψη, μόνο πάνω της · `null` σβήνει · ίδια ⇒ τίποτα.
 * - **Π** — προσανατολισμός: τα βελάκια στρέφονται κατά Δ (ώστε να μένουν στο ίδιο σημείο της φωτογραφίας).
 * - **Α** — αναίρεση: κάθε νέα εντολή έχει πιστή αντίστροφη.
 * - Κάθε αποτέλεσμα περνά το `checkTourGraph`.
 */

import type { FloorPlanRecord, SpatialTour, TourNode } from '@/types/spatial-tour';

import { checkTourGraph } from '../spatial-tour-graph';
import type { TourGraphCommand, TourGraphEditResult } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import { calibrateLevel, orientNode, positionNode, setLevelFloorPlan } from '../tour-plan-edit';
import { planToImagePixel } from '../tour-plan-frame';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

const L0 = { kind: 'local', ordinal: 0 } as const;
const L1 = { kind: 'local', ordinal: 1 } as const;
const STAMP = { uid: 'manager', at: '2026-09-27T10:00:00.000Z' };
const IMAGE = { width: 1000, height: 500, contentHash: 'h1' };
const NONE: FloorPlanRecord = { source: 'none', state: 'active', fileId: null, approvedBy: null, approvedAt: null };
const PLAN: FloorPlanRecord = {
  source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'manager', approvedAt: STAMP.at, image: IMAGE,
  scale: { metresPerPixel: 0.02, calibratedBy: 'manager', calibratedAt: STAMP.at },
};
const node = (id: string, levelKey = L0, position: TourNode['position'] = null, links: TourNode['links'] = []): TourNode =>
  ({ id, levelKey, position, links });

const PLACED: Graph = {
  levels: [{ key: L0, floorPlans: [PLAN] }, { key: L1, floorPlans: [NONE] }],
  nodes: [
    node('a', L0, { x: 2, y: -1, z: 0 }, [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }, { toNodeId: 'c', via: 'manual', bearingRad: null }]),
    node('b', L0, { x: 6, y: -3, z: 0 }, [{ toNodeId: 'a', via: 'manual', bearingRad: 4 }]),
    node('c', L1, null, [{ toNodeId: 'a', via: 'manual', bearingRad: null }]),
  ],
};

function edited(result: TourGraphEditResult): Graph {
  if (result.kind !== 'edited') throw new Error(`αναμενόταν αλλαγή, ήρθε ${JSON.stringify(result)}`);
  expect(checkTourGraph(result.graph)).toEqual([]);
  return result.graph;
}
const positionOf = (graph: Graph, id: string) => graph.nodes.find((n) => n.id === id)?.position ?? null;

describe('Κ — κάτοψη ορόφου', () => {
  const choice = { fileId: 'f2', source: 'user-sketch' as const, image: { width: 800, height: 600, contentHash: 'h2' } };

  it('νέα κάτοψη: η προηγούμενη superseded, η νέα active με εικόνα και έγκριση, οι θέσεις του ορόφου σβήνουν', () => {
    const graph = edited(setLevelFloorPlan(PLACED, L0, choice, STAMP));
    const plans = graph.levels[0].floorPlans;
    expect(plans.map((p) => [p.fileId, p.state])).toEqual([['f1', 'superseded'], ['f2', 'active']]);
    expect(plans[1]).toMatchObject({ source: 'user-sketch', approvedBy: 'manager', approvedAt: STAMP.at, image: choice.image });
    expect(plans[1].scale).toBeUndefined();
    expect(positionOf(graph, 'a')).toBeNull();
    expect(positionOf(graph, 'b')).toBeNull();
  });

  it('ίδιο αρχείο και ίδια πηγή ⇒ τίποτα · «χωρίς κάτοψη» σε όροφο χωρίς ⇒ τίποτα', () => {
    expect(setLevelFloorPlan(PLACED, L0, { fileId: 'f1', source: 'engineer', image: IMAGE }, STAMP)).toEqual({ kind: 'unchanged' });
    expect(setLevelFloorPlan(PLACED, L1, null, STAMP)).toEqual({ kind: 'unchanged' });
  });

  it('όροφος που δεν υπάρχει ⇒ level-absent', () => {
    expect(setLevelFloorPlan(PLACED, { kind: 'local', ordinal: 9 }, choice, STAMP)).toEqual({ kind: 'refused', reason: 'level-absent' });
  });
});

describe('Β — κλίμακα', () => {
  it('νέα κλίμακα: οι τελείες μένουν στο ίδιο pixel, η κλίμακα γράφει ποιος/πότε', () => {
    const graph = edited(calibrateLevel(PLACED, L0, 0.025, STAMP));
    expect(graph.levels[0].floorPlans[0].scale).toEqual({ metresPerPixel: 0.025, calibratedBy: 'manager', calibratedAt: STAMP.at });
    const a = positionOf(graph, 'a');
    if (a === null) throw new Error('με θέση');
    expect(planToImagePixel(a, 0.025).x).toBeCloseTo(100);
    expect(planToImagePixel(a, 0.025).y).toBeCloseTo(50);
  });

  it('σβήσιμο κλίμακας ⇒ θέσεις σβήνουν (θέση χωρίς κλίμακα δεν υπάρχει)', () => {
    const graph = edited(calibrateLevel(PLACED, L0, null, STAMP));
    expect(graph.levels[0].floorPlans[0].scale).toBeUndefined();
    expect(positionOf(graph, 'a')).toBeNull();
  });

  it('χωρίς εικόνα ⇒ plan-absent · άκυρη ⇒ scale-invalid · ίδια ⇒ τίποτα', () => {
    expect(calibrateLevel(PLACED, L1, 0.02, STAMP)).toEqual({ kind: 'refused', reason: 'plan-absent' });
    expect(calibrateLevel(PLACED, L0, 0, STAMP)).toEqual({ kind: 'refused', reason: 'scale-invalid' });
    expect(calibrateLevel(PLACED, L0, Number.NaN, STAMP)).toEqual({ kind: 'refused', reason: 'scale-invalid' });
    expect(calibrateLevel(PLACED, L0, 0.02, STAMP)).toEqual({ kind: 'unchanged' });
  });
});

describe('Θ — θέση', () => {
  it('πάνω στη βαθμονομημένη κάτοψη ⇒ γράφεται (z = 0)', () => {
    expect(positionOf(edited(positionNode(PLACED, 'a', { x: 10, y: -5 })), 'a')).toEqual({ x: 10, y: -5, z: 0 });
  });

  it('έξω από την εικόνα ⇒ position-outside-plan · αβαθμονόμητη ⇒ plan-uncalibrated', () => {
    expect(positionNode(PLACED, 'a', { x: 25, y: -5 })).toEqual({ kind: 'refused', reason: 'position-outside-plan' });
    expect(positionNode(PLACED, 'a', { x: 5, y: 2 })).toEqual({ kind: 'refused', reason: 'position-outside-plan' });
    expect(positionNode(PLACED, 'c', { x: 1, y: -1 })).toEqual({ kind: 'refused', reason: 'plan-uncalibrated' });
    const unscaled: Graph = { ...PLACED, levels: [{ key: L0, floorPlans: [{ ...PLAN, scale: null }] }, PLACED.levels[1]] };
    expect(positionNode(unscaled, 'a', { x: 1, y: -1 })).toEqual({ kind: 'refused', reason: 'plan-uncalibrated' });
  });

  it('null σβήνει · ίδια θέση ⇒ τίποτα · άγνωστο σημείο ⇒ node-absent', () => {
    expect(positionOf(edited(positionNode(PLACED, 'a', null)), 'a')).toBeNull();
    expect(positionNode(PLACED, 'c', null)).toEqual({ kind: 'unchanged' });
    expect(positionNode(PLACED, 'a', { x: 2, y: -1 })).toEqual({ kind: 'unchanged' });
    expect(positionNode(PLACED, 'x', null)).toEqual({ kind: 'refused', reason: 'node-absent' });
  });
});

describe('Π — προσανατολισμός', () => {
  it('τα βελάκια του σημείου στρέφονται κατά Δ· βελάκι χωρίς κατεύθυνση μένει· των άλλων σημείων όχι', () => {
    const graph = edited(orientNode(PLACED, 'a', 0.5));
    const a = graph.nodes.find((n) => n.id === 'a');
    expect(a?.links[0].bearingRad).toBeCloseTo(1.5);
    expect(a?.links[1].bearingRad).toBeNull();
    expect(graph.nodes.find((n) => n.id === 'b')?.links[0].bearingRad).toBe(4);
  });

  it('η περιτύλιξη μένει στο [0, 2π) · Δ ≈ 0 (ή 2π) ⇒ τίποτα', () => {
    const graph = edited(orientNode(PLACED, 'b', 3));
    expect(graph.nodes.find((n) => n.id === 'b')?.links[0].bearingRad).toBeCloseTo(7 - 2 * Math.PI);
    expect(orientNode(PLACED, 'a', 0)).toEqual({ kind: 'unchanged' });
    expect(orientNode(PLACED, 'a', 2 * Math.PI)).toEqual({ kind: 'unchanged' });
  });
});

describe('Α — αναίρεση', () => {
  const run = (graph: Graph, command: TourGraphCommand): Graph => {
    switch (command.op) {
      case 'position': return edited(positionNode(graph, command.nodeId, command.point));
      case 'calibrate': return edited(calibrateLevel(graph, command.levelKey, command.metresPerPixel, STAMP));
      default: throw new Error(command.op);
    }
  };

  it('θέση: η αντίστροφη ξαναβάζει την προηγούμενη (ή τη σβήνει)', () => {
    expect(inverseOf({ op: 'position', nodeId: 'a', point: { x: 9, y: -9 } }, PLACED)).toEqual([{ op: 'position', nodeId: 'a', point: { x: 2, y: -1 } }]);
    expect(inverseOf({ op: 'position', nodeId: 'c', point: null }, PLACED)).toEqual([{ op: 'position', nodeId: 'c', point: null }]);
  });

  it('κλίμακα: πηγαινέλα επιστρέφει τις θέσεις στα ίδια μέτρα', () => {
    const command: TourGraphCommand = { op: 'calibrate', levelKey: L0, metresPerPixel: 0.05 };
    const inverse = inverseOf(command, PLACED);
    if (inverse === null) throw new Error('αντιστρέψιμη');
    const back = inverse.reduce(run, run(PLACED, command));
    expect(positionOf(back, 'a')?.x).toBeCloseTo(2);
    expect(positionOf(back, 'b')?.y).toBeCloseTo(-3);
  });

  it('κάτοψη: επαναφορά αρχείου + κλίμακας + θέσεων · από «χωρίς» ⇒ «χωρίς»', () => {
    const inverse = inverseOf({ op: 'floorplan', levelKey: L0, plan: { fileId: 'f2', source: 'user-sketch' } }, PLACED);
    expect(inverse).toEqual([
      { op: 'floorplan', levelKey: L0, plan: { fileId: 'f1', source: 'engineer' } },
      { op: 'calibrate', levelKey: L0, metresPerPixel: 0.02 },
      { op: 'position', nodeId: 'a', point: { x: 2, y: -1 } },
      { op: 'position', nodeId: 'b', point: { x: 6, y: -3 } },
    ]);
    expect(inverseOf({ op: 'floorplan', levelKey: L1, plan: { fileId: 'f2', source: 'engineer' } }, PLACED))
      .toEqual([{ op: 'floorplan', levelKey: L1, plan: null }]);
  });

  it('προσανατολισμός: με τη γνωστή προηγούμενη κατεύθυνση ⇒ επαναφορά· χωρίς ⇒ καμία αναίρεση', () => {
    const command: TourGraphCommand = { op: 'orient', captureId: 'cap', headingRad: 1 };
    expect(inverseOf(command, PLACED, { headingOf: () => 0.25 })).toEqual([{ op: 'orient', captureId: 'cap', headingRad: 0.25 }]);
    expect(inverseOf(command, PLACED)).toBeNull();
  });
});
