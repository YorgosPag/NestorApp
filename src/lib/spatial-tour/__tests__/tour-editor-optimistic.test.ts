/**
 * @jest-environment node
 *
 * @fileoverview **Ο ΕΠΕΞΕΡΓΑΣΤΗΣ ΒΛΕΠΕΙ ΤΟΥΣ ΧΩΡΟΥΣ** (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14) — μανιφέστο ⇒ γράφος οθόνης ⇒ αισιόδοξη
 * εικόνα ⇒ αναίρεση που **ΕΚΤΕΛΕΙΤΑΙ**.
 *
 * 🔴 Το κενό που κλείνει (handoff Γ3β): ο γράφος της οθόνης **δεν** κουβαλούσε χώρους ⇒ `inverseOf` δεν έβρισκε «πριν» ⇒ καμία
 * «Αναίρεση» για αλλαγή/αφαίρεση χώρου. Εδώ η αντίστροφη υπολογίζεται **πάνω στον γράφο της οθόνης**, όπως ακριβώς στο
 * `useTourEditorActions`, και εκτελείται πάνω στην αλήθεια του διακομιστή.
 */

import type { FloorPlanRecord, SpatialTour, TourNode } from '@/types/spatial-tour';

import type { TourGraphCommand, TourGraphEditResult, TourSpaceDraft } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import { optimisticGraph } from '../tour-editor-optimistic';
import { removeSeparation, removeSpace, upsertSeparation, upsertSpace } from '../tour-space-edit';
import { graphLevelsOfViewer, viewerLevelsOf } from '../viewer/tour-viewer-graph';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

const L0 = { kind: 'local', ordinal: 0 } as const;
const STAMP = { uid: 'manager', at: '2026-09-28T10:00:00.000Z' };
const PLAN: FloorPlanRecord = {
  source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'manager', approvedAt: STAMP.at,
  image: { width: 1000, height: 500, contentHash: 'h1' },
  scale: { metresPerPixel: 0.02, calibratedBy: 'manager', calibratedAt: STAMP.at },
};
const NODE: TourNode = { id: 'a', levelKey: L0, position: { x: 3, y: -2, z: 0 }, links: [] };
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const draft = (points = rect(1, -1, 5, -4), extra: Partial<TourSpaceDraft> = {}): TourSpaceDraft =>
  ({ points, source: 'detected', room: null, declaredArea: null, ...extra });

const S1 = 'tspc_11111111-1111-4111-8111-111111111111';
const S2 = 'tspc_22222222-2222-4222-8222-222222222222';
const S3 = 'tspc_33333333-3333-4333-8333-333333333333';
const G1 = 'tsep_11111111-1111-4111-8111-111111111111';
const G2 = 'tsep_22222222-2222-4222-8222-222222222222';

function edited(result: TourGraphEditResult): Graph {
  if (result.kind !== 'edited') throw new Error(`αναμενόταν αλλαγή, ήρθε ${JSON.stringify(result)}`);
  return result.graph;
}

/** Η αλήθεια του διακομιστή: κουζίνα `S1` (δηλωμένο 12,40), αποθήκη `S2`, γραμμή `G1`. */
const SERVER: Graph = (() => {
  const base: Graph = { levels: [{ key: L0, floorPlans: [PLAN] }], nodes: [NODE] };
  const kitchen = draft(rect(1, -1, 5, -4), { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } });
  const one = edited(upsertSpace(base, { levelKey: L0, spaceId: S1, mode: 'create', space: kitchen }, STAMP));
  const two = edited(upsertSpace(one, { levelKey: L0, spaceId: S2, mode: 'create', space: draft(rect(10, -6, 12, -8), { source: 'manual' }) }, STAMP));
  return edited(upsertSeparation(two, { levelKey: L0, separationId: G1, mode: 'create', a: { x: 5, y: -1 }, b: { x: 5, y: -4 } }, STAMP));
})();

/** Ο γράφος της οθόνης — ό,τι φτάνει στον επεξεργαστή (μανιφέστο διαχειριστή) και ό,τι χτίζει το `useEditorGraph`. */
const SCREEN: Graph = { nodes: SERVER.nodes, levels: graphLevelsOfViewer(viewerLevelsOf(SERVER.levels, { areas: 'shown' })) };
const NO_CAPTURES = () => undefined;

const sorted = <T,>(items: readonly T[]): T[] => [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

/**
 * Τα σχήματα χωρίς σφραγίδες (του διακομιστή) — **με** id: από τη Γ3γ-2α η αναίρεση ξαναγεννά στο ΙΔΙΟ id.
 */
function shapesOf(graph: Graph) {
  const level = graph.levels[0];
  return {
    spaces: sorted((level.spaces ?? []).map(({ approvedBy: _b, approvedAt: _a, declaredArea, ...rest }) =>
      ({ ...rest, ...(declaredArea == null ? {} : { declaredArea: { areaM2: declaredArea.areaM2, source: declaredArea.source } }) }))),
    separations: sorted((level.separations ?? []).map(({ id, a, b }) => ({ id, a, b }))),
  };
}

/** Εκτελεί τις εντολές πάνω στον γράφο με τις ΙΔΙΕΣ καθαρές συναρτήσεις του γραφέα. */
function run(graph: Graph, commands: readonly TourGraphCommand[]): Graph {
  return commands.reduce((g, command) => {
    switch (command.op) {
      case 'space': return edited(upsertSpace(g, command, STAMP));
      case 'unspace': return edited(removeSpace(g, command.levelKey, command.spaceId));
      case 'separate': return edited(upsertSeparation(g, command, STAMP));
      case 'unseparate': return edited(removeSeparation(g, command.levelKey, command.separationId));
      default: throw new Error(`δεν αναμενόταν ${command.op}`);
    }
  }, graph);
}

describe('ο γράφος της οθόνης', () => {
  it('κουβαλά χώρους + γραμμές ίδια με τον διακομιστή (εκτός σφραγίδων)', () => {
    expect(shapesOf(SCREEN)).toEqual(shapesOf(SERVER));
  });

  it('στρογγυλή διαδρομή οθόνη ⇒ γράφος ⇒ οθόνη = ταυτότητα (η αισιόδοξη εικόνα δεν χάνει τίποτα)', () => {
    const levels = viewerLevelsOf(SERVER.levels, { areas: 'shown' });
    expect(viewerLevelsOf(graphLevelsOfViewer(levels), { areas: 'shown' })).toEqual(levels);
  });
});

describe('🔴 αναίρεση από την οθόνη — ΕΚΤΕΛΕΙΤΑΙ και ξαναδίνει το αρχικό', () => {
  const cases: ReadonlyArray<readonly [string, TourGraphCommand]> = [
    ['αλλαγή σχήματος (με τη δήλωση)', { op: 'space', levelKey: L0, spaceId: S1, mode: 'replace', space: draft(rect(1, -1, 6, -4), { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } }) }],
    ['αφαίρεση χώρου με δήλωση', { op: 'unspace', levelKey: L0, spaceId: S1 }],
    ['μετακίνηση γραμμής', { op: 'separate', levelKey: L0, separationId: G1, mode: 'replace', a: { x: 5.5, y: -1 }, b: { x: 5.5, y: -4 } }],
    ['αφαίρεση γραμμής', { op: 'unseparate', levelKey: L0, separationId: G1 }],
    ['ΝΕΟΣ χώρος (Γ3γ-2α)', { op: 'space', levelKey: L0, spaceId: S3, mode: 'create', space: draft(rect(14, -1, 16, -3)) }],
    ['ΝΕΑ γραμμή (Γ3γ-2α)', { op: 'separate', levelKey: L0, separationId: G2, mode: 'create', a: { x: 1, y: -1 }, b: { x: 1, y: -3 } }],
  ];

  it.each(cases)('%s', (_name, command) => {
    const undo = inverseOf(command, SCREEN, {});
    expect(undo).not.toBeNull();
    const after = run(SERVER, [command]);
    expect(shapesOf(run(after, undo ?? []))).toEqual(shapesOf(SERVER));
  });
});

describe('αισιόδοξη εικόνα', () => {
  it('αλλαγή/αφαίρεση υπάρχοντος ⇒ ο νέος γράφος, ίδιος με του διακομιστή', () => {
    const command: TourGraphCommand = { op: 'unspace', levelKey: L0, spaceId: S2 };
    const screen = optimisticGraph(command, SCREEN, NO_CAPTURES);
    expect(screen === null ? null : shapesOf(screen)).toEqual(shapesOf(run(SERVER, [command])));
  });

  it('🔑 ΝΕΟΣ χώρος / ΝΕΑ γραμμή ⇒ αισιόδοξα ΜΕ το οριστικό id του πελάτη, ίδια με του διακομιστή (Γ3γ-2α, Figma/Linear)', () => {
    const commands: readonly TourGraphCommand[] = [
      { op: 'space', levelKey: L0, spaceId: S3, mode: 'create', space: draft(rect(14, -1, 16, -3)) },
      { op: 'separate', levelKey: L0, separationId: G2, mode: 'create', a: { x: 1, y: -1 }, b: { x: 1, y: -3 } },
    ];
    for (const command of commands) {
      const screen = optimisticGraph(command, SCREEN, NO_CAPTURES);
      expect(screen === null ? null : shapesOf(screen)).toEqual(shapesOf(run(SERVER, [command])));
    }
  });

  it('ο ΙΔΙΟΣ κριτής: σχήμα πάνω στον γείτονα ⇒ καμία αισιόδοξη εικόνα (θα το αρνιόταν και ο διακομιστής)', () => {
    const overlap: TourGraphCommand = { op: 'space', levelKey: L0, spaceId: S2, mode: 'replace', space: draft(rect(2, -2, 11, -7)) };
    expect(optimisticGraph(overlap, SCREEN, NO_CAPTURES)).toBeNull();
  });

  it('θέση σημείου ⇒ αισιόδοξα, όπως πριν (οι κόμβοι δεν χάθηκαν στη γενίκευση)', () => {
    const moved = optimisticGraph({ op: 'position', nodeId: 'a', point: { x: 4, y: -3 } }, SCREEN, NO_CAPTURES);
    expect(moved?.nodes[0].position).toMatchObject({ x: 4, y: -3 });
  });

  it('κλειδωμένες εντολές (κάτοψη/κλίμακα) ⇒ καμία αισιόδοξη εικόνα', () => {
    expect(optimisticGraph({ op: 'calibrate', levelKey: L0, metresPerPixel: 0.03 }, SCREEN, NO_CAPTURES)).toBeNull();
  });
});
