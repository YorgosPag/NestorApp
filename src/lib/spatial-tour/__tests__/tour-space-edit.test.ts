/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΧΩΡΩΝ** (ADR-884 Φ2στ-γ Γ3β · §4.14 · §12 Δ8) — καθαρές.
 *
 * - **Χ** — περίγραμμα χώρου: νέο/αντικατάσταση · κάθε άρνηση με όνομα · ιδεμποτία · χώρος χωρίς σημείο λήψης δεκτός (Γ3β-1).
 * - **Δ** — δηλωμένο εμβαδόν (Δ8.4 · Γ3β-2): πηγή υποχρεωτική · επιβιώνει αλλαγή σχήματος με την ΑΡΧΙΚΗ σφραγίδα.
 * - **Ε** — επικάλυψη: κοινός τοίχος/νοητή γραμμή ✓ · πάνω στον γείτονα ✗ (Revit «Room overlaps»).
 * - **Γ** — νοητές γραμμές (Δ8.2).
 * - **Κ** — κάτοψη: νέα κλίμακα ξανακλιμακώνει (ίδιο pixel) · νέα κάτοψη/σβήσιμο κλίμακας σβήνει.
 * - **Α** — αναίρεση: κάθε αντίστροφη **εκτελείται** και δίνει ξανά τον αρχικό γράφο (και το X → `null` της κλίμακας).
 * - Κάθε αποτέλεσμα περνά το `checkTourGraph`.
 */

import type { FloorPlanRecord, SpatialTour, TourLevel, TourNode } from '@/types/spatial-tour';

import { checkTourGraph } from '../spatial-tour-graph';
import type { TourGraphCommand, TourGraphEditResult, TourSpaceDraft } from '../tour-graph-edit';
import { inverseOf } from '../tour-graph-inverse';
import { calibrateLevel, positionNode, setLevelFloorPlan } from '../tour-plan-edit';
import { removeSeparation, removeSpace, upsertSeparation, upsertSpace } from '../tour-space-edit';

type Graph = Pick<SpatialTour, 'levels' | 'nodes'>;

const L0 = { kind: 'local', ordinal: 0 } as const;
const STAMP = { uid: 'manager', at: '2026-09-28T10:00:00.000Z' };
const LATER = { uid: 'editor', at: '2026-09-29T10:00:00.000Z' };
/** 1000 × 500 pixel, 2 cm/pixel ⇒ 20 × 10 m, y ∈ [−10, 0]. */
const PLAN: FloorPlanRecord = {
  source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'manager', approvedAt: STAMP.at,
  image: { width: 1000, height: 500, contentHash: 'h1' },
  scale: { metresPerPixel: 0.02, calibratedBy: 'manager', calibratedAt: STAMP.at },
};
const node = (id: string, position: TourNode['position']): TourNode => ({ id, levelKey: L0, position, links: [] });
const rect = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const draft = (points = rect(1, -1, 5, -4), extra: Partial<TourSpaceDraft> = {}): TourSpaceDraft =>
  ({ points, source: 'detected', room: null, declaredArea: null, ...extra });

const BASE: Graph = { levels: [{ key: L0, floorPlans: [PLAN] }], nodes: [node('a', { x: 3, y: -2, z: 0 })] };

function edited(result: TourGraphEditResult): Graph {
  if (result.kind !== 'edited') throw new Error(`αναμενόταν αλλαγή, ήρθε ${JSON.stringify(result)}`);
  expect(checkTourGraph(result.graph)).toEqual([]);
  return result.graph;
}
const levelOf = (graph: Graph): TourLevel => graph.levels[0];
const refusalOf = (result: TourGraphEditResult) => (result.kind === 'refused' ? result.reason : result.kind);

/** Ο γράφος με έναν εγκεκριμένο χώρο `s1` (κουζίνα, δηλωμένο 12,40 από μελέτη) και μία γραμμή `g1`. */
const WITH_SPACE: Graph = (() => {
  const room = { types: ['kitchen'], label: null };
  const one = edited(upsertSpace(BASE, { levelKey: L0, spaceId: null, space: draft(rect(1, -1, 5, -4), { room, declaredArea: { areaM2: 12.4, source: 'engineer-study' } }) }, 's1', STAMP));
  return edited(upsertSeparation(one, { levelKey: L0, separationId: null, a: { x: 5, y: -1 }, b: { x: 5, y: -4 } }, 'g1', STAMP));
})();

describe('Χ — περίγραμμα χώρου', () => {
  it('νέος χώρος: id από τον διακομιστή, έγκριση = σφραγίδα, createdId για την αναίρεση', () => {
    const result = upsertSpace(BASE, { levelKey: L0, spaceId: null, space: draft() }, 's1', STAMP);
    expect(result).toMatchObject({ kind: 'edited', createdId: 's1' });
    const [space] = levelOf(edited(result)).spaces ?? [];
    expect(space).toEqual({ id: 's1', points: rect(1, -1, 5, -4), source: 'detected', approvedBy: 'manager', approvedAt: STAMP.at });
  });

  it('χώρος ΧΩΡΙΣ σημείο λήψης, με δικό του όνομα, είναι δεκτός (Γ3β-1: η αποθήκη που δεν φωτογραφήθηκε)', () => {
    const storage = draft(rect(10, -6, 12, -8), { room: { types: ['storage'], label: 'Αποθήκη' }, source: 'manual' });
    const space = (levelOf(edited(upsertSpace(BASE, { levelKey: L0, spaceId: null, space: storage }, 's2', STAMP))).spaces ?? [])[0];
    expect(space.room).toEqual({ types: ['storage'], label: 'Αποθήκη', source: 'manual' });
  });

  it('ίδια δεδομένα ⇒ unchanged (η προηγούμενη έγκριση μένει)· άλλο σχήμα ⇒ νέα έγκριση, χωρίς createdId', () => {
    const same = draft(rect(1, -1, 5, -4), { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } });
    expect(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: same }, 'x', LATER)).toEqual({ kind: 'unchanged' });
    const moved = upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: { ...same, points: rect(1, -1, 5, -5) } }, 'x', LATER);
    expect(moved).not.toHaveProperty('createdId');
    expect(levelOf(edited(moved)).spaces?.[0]).toMatchObject({ id: 's1', approvedBy: 'editor', approvedAt: LATER.at });
  });

  it.each([
    ['δύο κορυφές', draft([{ x: 1, y: -1 }, { x: 5, y: -1 }]), 'space-invalid'],
    ['αυτοτεμνόμενο (παπιγιόν)', draft([{ x: 1, y: -1 }, { x: 5, y: -4 }, { x: 5, y: -1 }, { x: 1, y: -4 }]), 'space-invalid'],
    // Αυτοτομή με ΜΕΓΑΛΟ εμβαδόν — δεν την πιάνει το ελάχιστο εμβαδόν, μόνο ο έλεγχος αυτοτομής.
    ['αυτοτεμνόμενο με θηλιά (εμβαδόν > 20 m²)', draft([{ x: 1, y: -1 }, { x: 9, y: -1 }, { x: 9, y: -5 }, { x: 5, y: -5 }, { x: 5, y: -0.5 }]), 'space-invalid'],
    ['μουτζούρα 0,1 m²', draft(rect(1, -1, 1.2, -1.5)), 'space-invalid'],
    ['μη πεπερασμένο', draft([{ x: 1, y: -1 }, { x: Number.NaN, y: -1 }, { x: 5, y: -4 }]), 'space-invalid'],
    ['κορυφή έξω από την κάτοψη', draft(rect(18, -1, 22, -4)), 'space-outside-plan'],
    ['άγνωστος τύπος ονόματος', draft(rect(1, -1, 5, -4), { room: { types: ['dungeon'], label: null } }), 'room-invalid'],
  ] as const)('%s ⇒ %s', (_label, space, reason) => {
    expect(refusalOf(upsertSpace(BASE, { levelKey: L0, spaceId: null, space }, 's1', STAMP))).toBe(reason);
  });

  it('άγνωστη πηγή ⇒ space-invalid · ανύπαρκτο id ⇒ space-absent · όροφος χωρίς κλίμακα ⇒ plan-uncalibrated', () => {
    const badSource = { ...draft(), source: 'guess' } as unknown as TourSpaceDraft;
    expect(refusalOf(upsertSpace(BASE, { levelKey: L0, spaceId: null, space: badSource }, 's1', STAMP))).toBe('space-invalid');
    expect(refusalOf(upsertSpace(BASE, { levelKey: L0, spaceId: 'ghost', space: draft() }, 's1', STAMP))).toBe('space-absent');
    const { scale: _s, ...uncalibrated } = PLAN;
    const graph: Graph = { levels: [{ key: L0, floorPlans: [uncalibrated] }], nodes: [] };
    expect(refusalOf(upsertSpace(graph, { levelKey: L0, spaceId: null, space: draft() }, 's1', STAMP))).toBe('plan-uncalibrated');
    expect(refusalOf(upsertSpace(BASE, { levelKey: { kind: 'local', ordinal: 9 }, spaceId: null, space: draft() }, 's1', STAMP))).toBe('level-absent');
  });

  it('αφαίρεση: φεύγει μόνο αυτός · ανύπαρκτος ⇒ unchanged · ο τελευταίος ⇒ το πεδίο λείπει (όπως πριν τη Γ3β)', () => {
    expect(removeSpace(WITH_SPACE, L0, 'ghost')).toEqual({ kind: 'unchanged' });
    const level = levelOf(edited(removeSpace(WITH_SPACE, L0, 's1')));
    expect(level).not.toHaveProperty('spaces');
    expect(level.separations).toHaveLength(1);
  });
});

describe('Δ — δηλωμένο εμβαδόν (Δ8.4)', () => {
  it.each([[0], [-3], [10_001], [Number.POSITIVE_INFINITY]])('εμβαδόν %p ⇒ area-invalid', (areaM2) => {
    const space = draft(rect(1, -1, 5, -4), { declaredArea: { areaM2, source: 'owner-declared' } });
    expect(refusalOf(upsertSpace(BASE, { levelKey: L0, spaceId: null, space }, 's1', STAMP))).toBe('area-invalid');
  });

  it('χωρίς γνωστή πηγή ⇒ area-invalid (Γ3β-2: η πηγή είναι υποχρεωτική)', () => {
    const space = { ...draft(), declaredArea: { areaM2: 12, source: 'hearsay' } } as unknown as TourSpaceDraft;
    expect(refusalOf(upsertSpace(BASE, { levelKey: L0, spaceId: null, space }, 's1', STAMP))).toBe('area-invalid');
  });

  it('αλλαγή ΣΧΗΜΑΤΟΣ: η δήλωση μένει με την ΑΡΧΙΚΗ σφραγίδα· αλλαγή ΤΙΜΗΣ: νέα σφραγίδα', () => {
    const kept = draft(rect(1, -1, 5, -5), { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } });
    const reshaped = levelOf(edited(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: kept }, 'x', LATER))).spaces?.[0];
    expect(reshaped?.declaredArea).toEqual({ areaM2: 12.4, source: 'engineer-study', declaredBy: 'manager', declaredAt: STAMP.at });
    const retyped = { ...kept, declaredArea: { areaM2: 13, source: 'site-measurement' as const } };
    const changed = levelOf(edited(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: retyped }, 'x', LATER))).spaces?.[0];
    expect(changed?.declaredArea).toEqual({ areaM2: 13, source: 'site-measurement', declaredBy: 'editor', declaredAt: LATER.at });
  });

  it('ίδιο σχήμα, ΜΟΝΟ νέα δήλωση ⇒ αλλαγή (όχι «unchanged») · σβήσιμο της δήλωσης ⇒ αλλαγή', () => {
    const base = { points: rect(1, -1, 5, -4), room: { types: ['kitchen'], label: null } };
    const onlyArea = draft(base.points, { room: base.room, declaredArea: { areaM2: 12.5, source: 'engineer-study' } });
    expect(levelOf(edited(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: onlyArea }, 'x', LATER))).spaces?.[0].declaredArea)
      .toMatchObject({ areaM2: 12.5 });
    const cleared = draft(base.points, { room: base.room, declaredArea: null });
    expect(levelOf(edited(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: 's1', space: cleared }, 'x', LATER))).spaces?.[0])
      .not.toHaveProperty('declaredArea');
  });
});

describe('Ε — επικάλυψη με άλλον χώρο του ορόφου', () => {
  it('ο γείτονας στον κοινό τοίχο/στη νοητή γραμμή ✓ · 30 cm πάνω του ✗ · ο ίδιος χώρος δεν συγκρίνεται με τον εαυτό του', () => {
    expect(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: null, space: draft(rect(5, -1, 9, -4)) }, 's2', STAMP).kind).toBe('edited');
    expect(refusalOf(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: null, space: draft(rect(4.7, -1, 9, -4)) }, 's2', STAMP))).toBe('space-overlap');
    const pair = edited(upsertSpace(WITH_SPACE, { levelKey: L0, spaceId: null, space: draft(rect(5, -1, 9, -4)) }, 's2', STAMP));
    // Τρεμούλιασμα 2 cm πάνω στον γείτονα (ορθογώνια έλξη / σύρσιμο) ⇒ δεκτό· ο s1 δεν συγκρίνεται με τον εαυτό του.
    expect(upsertSpace(pair, { levelKey: L0, spaceId: 's1', space: draft(rect(1, -1, 5.02, -4)) }, 'x', LATER).kind).toBe('edited');
    expect(refusalOf(upsertSpace(pair, { levelKey: L0, spaceId: 's1', space: draft(rect(1, -1, 5.3, -4)) }, 'x', LATER))).toBe('space-overlap');
  });
});

describe('Γ — νοητές γραμμές (Δ8.2)', () => {
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, separationId: string | null = null) =>
    ({ levelKey: L0, separationId, a, b });

  it('νέα γραμμή: createdId · ίδια θέση ⇒ unchanged · μετακίνηση ⇒ νέα έγκριση', () => {
    expect(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5, y: -4 }), 'g1', STAMP)).toMatchObject({ kind: 'edited', createdId: 'g1' });
    expect(upsertSeparation(WITH_SPACE, line({ x: 5, y: -1 }, { x: 5, y: -4 }, 'g1'), 'x', LATER)).toEqual({ kind: 'unchanged' });
    const moved = levelOf(edited(upsertSeparation(WITH_SPACE, line({ x: 6, y: -1 }, { x: 6, y: -4 }, 'g1'), 'x', LATER)));
    expect(moved.separations?.[0]).toEqual({ id: 'g1', a: { x: 6, y: -1 }, b: { x: 6, y: -4 }, approvedBy: 'editor', approvedAt: LATER.at });
  });

  it('έξω από την κάτοψη · κοντύτερη από 10 cm ⇒ separation-invalid · ανύπαρκτη ⇒ separation-absent / unchanged', () => {
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 25, y: -1 }), 'g', STAMP))).toBe('separation-invalid');
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5.05, y: -1 }), 'g', STAMP))).toBe('separation-invalid');
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5, y: -4 }, 'ghost'), 'g', STAMP))).toBe('separation-absent');
    expect(removeSeparation(WITH_SPACE, L0, 'ghost')).toEqual({ kind: 'unchanged' });
    expect(levelOf(edited(removeSeparation(WITH_SPACE, L0, 'g1')))).not.toHaveProperty('separations');
  });
});

describe('Κ — τα σχήματα ανήκουν στην ΕΙΚΟΝΑ', () => {
  it('νέα κλίμακα: κορυφές και άκρα ξανακλιμακώνονται (ίδιο pixel) — ×2,5 για 0,02 → 0,05', () => {
    const level = levelOf(edited(calibrateLevel(WITH_SPACE, L0, 0.05, STAMP)));
    expect(level.spaces?.[0].points[2]).toEqual({ x: 12.5, y: -10 });
    expect(level.separations?.[0].b).toEqual({ x: 12.5, y: -10 });
  });

  it('σβήσιμο κλίμακας · νέα κάτοψη ⇒ σχήματα σβήνουν', () => {
    expect(levelOf(edited(calibrateLevel(WITH_SPACE, L0, null, STAMP)))).not.toHaveProperty('spaces');
    const choice = { fileId: 'f2', source: 'user-sketch' as const, image: { width: 800, height: 600, contentHash: 'h2' } };
    const level = levelOf(edited(setLevelFloorPlan(WITH_SPACE, L0, choice, STAMP)));
    expect(level).not.toHaveProperty('spaces');
    expect(level).not.toHaveProperty('separations');
  });
});

describe('Α — αναίρεση: κάθε αντίστροφη ΕΚΤΕΛΕΙΤΑΙ και ξαναδίνει τον αρχικό γράφο', () => {
  let minted = 0;
  const run = (graph: Graph, command: TourGraphCommand): Graph => {
    minted += 1;
    switch (command.op) {
      case 'space': return edited(upsertSpace(graph, command, command.spaceId ?? `new${minted}`, STAMP));
      case 'unspace': return edited(removeSpace(graph, command.levelKey, command.spaceId));
      case 'separate': return edited(upsertSeparation(graph, command, command.separationId ?? `new${minted}`, STAMP));
      case 'unseparate': return edited(removeSeparation(graph, command.levelKey, command.separationId));
      case 'calibrate': return edited(calibrateLevel(graph, command.levelKey, command.metresPerPixel, STAMP));
      case 'position': return edited(positionNode(graph, command.nodeId, command.point));
      default: throw new Error(command.op);
    }
  };
  /** Χωρίς τα id (η επαναγέννηση κόβει νέο — τίποτα δεν δείχνει στο παλιό) και χωρίς σφραγίδες. */
  const r = (p: { x: number; y: number } | null) => (p === null ? null : [Number(p.x.toFixed(9)), Number(p.y.toFixed(9))]);
  const shapesOf = (graph: Graph) => ({
    spaces: (levelOf(graph).spaces ?? []).map(({ points, room, declaredArea, source }) => ({ points, room, area: declaredArea?.areaM2, source })),
    lines: (levelOf(graph).separations ?? []).map(({ a, b }) => [r(a), r(b)]),
    positions: graph.nodes.map((n) => r(n.position)),
  });
  const roundTrip = (before: Graph, command: TourGraphCommand) => {
    const after = run(before, command);
    const createdId = (levelOf(after).spaces ?? []).concat().pop()?.id;
    const inverse = inverseOf(command, before, { createdId: command.op === 'separate' ? levelOf(after).separations?.at(-1)?.id : createdId });
    if (inverse === null) throw new Error('αναμενόταν αντιστρέψιμη');
    return inverse.reduce(run, after);
  };

  it.each<[string, TourGraphCommand]>([
    ['νέος χώρος', { op: 'space', levelKey: L0, spaceId: null, space: draft(rect(10, -6, 12, -8)) }],
    ['αλλαγή σχήματος', { op: 'space', levelKey: L0, spaceId: 's1', space: draft(rect(1, -1, 6, -6)) }],
    ['αφαίρεση χώρου (με όνομα + δήλωση)', { op: 'unspace', levelKey: L0, spaceId: 's1' }],
    ['νέα γραμμή', { op: 'separate', levelKey: L0, separationId: null, a: { x: 8, y: -1 }, b: { x: 8, y: -4 } }],
    ['μετακίνηση γραμμής', { op: 'separate', levelKey: L0, separationId: 'g1', a: { x: 6, y: -1 }, b: { x: 6, y: -4 } }],
    ['αφαίρεση γραμμής', { op: 'unseparate', levelKey: L0, separationId: 'g1' }],
    ['νέα κλίμακα', { op: 'calibrate', levelKey: L0, metresPerPixel: 0.05 }],
    ['🔴 σβήσιμο κλίμακας (X → null): θέσεις ΚΑΙ σχήματα επανέρχονται', { op: 'calibrate', levelKey: L0, metresPerPixel: null }],
  ])('%s', (_label, command) => {
    const back = roundTrip(WITH_SPACE, command);
    const expected = shapesOf(WITH_SPACE);
    const actual = shapesOf(back);
    expect(actual.lines).toEqual(expected.lines);
    expect(actual.positions).toEqual(expected.positions);
    expect(actual.spaces.map((s) => s.points.map(r))).toEqual(expected.spaces.map((s) => s.points.map(r)));
    expect(actual.spaces.map(({ room, area, source }) => ({ room, area, source })))
      .toEqual(expected.spaces.map(({ room, area, source }) => ({ room, area, source })));
  });

  it('αλλαγή κάτοψης: η αντίστροφη ξαναγεννά ΚΑΙ χώρους (με όνομα + δήλωση) ΚΑΙ γραμμές, μετά την κλίμακα', () => {
    const inverse = inverseOf({ op: 'floorplan', levelKey: L0, plan: { fileId: 'f2', source: 'user-sketch' } }, WITH_SPACE) ?? [];
    expect(inverse.map((c) => c.op)).toEqual(['floorplan', 'calibrate', 'position', 'separate', 'space']);
    expect(inverse.at(-1)).toMatchObject({
      op: 'space', spaceId: null,
      space: { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } },
    });
  });

  it('νέος χώρος χωρίς createdId ⇒ καμία αναίρεση (ποτέ μαντεψιά για το ποιο id)', () => {
    expect(inverseOf({ op: 'space', levelKey: L0, spaceId: null, space: draft() }, BASE)).toBeNull();
  });
});
