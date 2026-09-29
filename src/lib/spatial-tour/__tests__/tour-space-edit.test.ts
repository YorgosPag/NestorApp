/**
 * @fileoverview **ΤΑ ΣΧΗΜΑΤΑ ΤΩΝ ΧΩΡΩΝ** (ADR-884 Φ2στ-γ Γ3β · Γ3γ-2α · §4.14 · §12 Δ8) — καθαρές.
 *
 * - **Χ** — περίγραμμα χώρου: νέο/αντικατάσταση · κάθε άρνηση με όνομα · ιδεμποτία · χώρος χωρίς σημείο λήψης δεκτός (Γ3β-1).
 * - **Ι** — id του πελάτη (Γ3γ-2α, Figma/Linear): πρόθεμα + UUID v4 · `create` ≠ `replace` · ιδεμπότητη επανάληψη · `*-exists`.
 * - **Δ** — δηλωμένο εμβαδόν (Δ8.4 · Γ3β-2): πηγή υποχρεωτική · επιβιώνει αλλαγή σχήματος με την ΑΡΧΙΚΗ σφραγίδα.
 * - **Ε** — επικάλυψη: κοινός τοίχος/νοητή γραμμή ✓ · πάνω στον γείτονα ✗ (Revit «Room overlaps»).
 * - **Γ** — νοητές γραμμές (Δ8.2).
 * - **Κ** — κάτοψη: νέα κλίμακα ξανακλιμακώνει (ίδιο pixel) · νέα κάτοψη/σβήσιμο κλίμακας σβήνει.
 * - **Α** — αναίρεση: κάθε αντίστροφη **εκτελείται** και δίνει ξανά τον αρχικό γράφο **στα ίδια id** (και το X → `null` της κλίμακας).
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

/** Ids «επιπέδου Β» όπως θα τα έκοβε ο `enterpriseIdService` στον browser — πρόθεμα + UUID v4. */
const S1 = 'tspc_11111111-1111-4111-8111-111111111111';
const S2 = 'tspc_22222222-2222-4222-8222-222222222222';
const S3 = 'tspc_33333333-3333-4333-8333-333333333333';
const G1 = 'tsep_11111111-1111-4111-8111-111111111111';
const G2 = 'tsep_22222222-2222-4222-8222-222222222222';
const create = (space: TourSpaceDraft, spaceId: string = S1) => ({ levelKey: L0, spaceId, mode: 'create' as const, space });
const replace = (space: TourSpaceDraft, spaceId: string = S1) => ({ levelKey: L0, spaceId, mode: 'replace' as const, space });

const BASE: Graph = { levels: [{ key: L0, floorPlans: [PLAN] }], nodes: [node('a', { x: 3, y: -2, z: 0 })] };

function edited(result: TourGraphEditResult): Graph {
  if (result.kind !== 'edited') throw new Error(`αναμενόταν αλλαγή, ήρθε ${JSON.stringify(result)}`);
  expect(checkTourGraph(result.graph)).toEqual([]);
  return result.graph;
}
const levelOf = (graph: Graph): TourLevel => graph.levels[0];
const refusalOf = (result: TourGraphEditResult) => (result.kind === 'refused' ? result.reason : result.kind);

const KITCHEN = draft(rect(1, -1, 5, -4), { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } });

/** Ο γράφος με έναν εγκεκριμένο χώρο `S1` (κουζίνα, δηλωμένο 12,40 από μελέτη) και μία γραμμή `G1`. */
const WITH_SPACE: Graph = (() => {
  const one = edited(upsertSpace(BASE, create(KITCHEN), STAMP));
  return edited(upsertSeparation(one, { levelKey: L0, separationId: G1, mode: 'create', a: { x: 5, y: -1 }, b: { x: 5, y: -4 } }, STAMP));
})();

describe('Χ — περίγραμμα χώρου', () => {
  it('νέος χώρος: το id του ΠΕΛΑΤΗ γράφεται αυτούσιο, έγκριση = σφραγίδα', () => {
    const [space] = levelOf(edited(upsertSpace(BASE, create(draft()), STAMP))).spaces ?? [];
    expect(space).toEqual({ id: S1, points: rect(1, -1, 5, -4), source: 'detected', approvedBy: 'manager', approvedAt: STAMP.at });
  });

  it('χώρος ΧΩΡΙΣ σημείο λήψης, με δικό του όνομα, είναι δεκτός (Γ3β-1: η αποθήκη που δεν φωτογραφήθηκε)', () => {
    const storage = draft(rect(10, -6, 12, -8), { room: { types: ['storage'], label: 'Αποθήκη' }, source: 'manual' });
    const space = (levelOf(edited(upsertSpace(BASE, create(storage, S2), STAMP))).spaces ?? [])[0];
    expect(space.room).toEqual({ types: ['storage'], label: 'Αποθήκη', source: 'manual' });
  });

  it('ίδια δεδομένα ⇒ unchanged (η προηγούμενη έγκριση μένει)· άλλο σχήμα ⇒ νέα έγκριση', () => {
    expect(upsertSpace(WITH_SPACE, replace(KITCHEN), LATER)).toEqual({ kind: 'unchanged' });
    const moved = upsertSpace(WITH_SPACE, replace({ ...KITCHEN, points: rect(1, -1, 5, -5) }), LATER);
    expect(levelOf(edited(moved)).spaces?.[0]).toMatchObject({ id: S1, approvedBy: 'editor', approvedAt: LATER.at });
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
    expect(refusalOf(upsertSpace(BASE, create(space), STAMP))).toBe(reason);
  });

  it('άγνωστη πηγή ⇒ space-invalid · replace ανύπαρκτου ⇒ space-absent · όροφος χωρίς κλίμακα ⇒ plan-uncalibrated', () => {
    const badSource = { ...draft(), source: 'guess' } as unknown as TourSpaceDraft;
    expect(refusalOf(upsertSpace(BASE, create(badSource), STAMP))).toBe('space-invalid');
    expect(refusalOf(upsertSpace(BASE, replace(draft()), STAMP))).toBe('space-absent');
    const { scale: _s, ...uncalibrated } = PLAN;
    const graph: Graph = { levels: [{ key: L0, floorPlans: [uncalibrated] }], nodes: [] };
    expect(refusalOf(upsertSpace(graph, create(draft()), STAMP))).toBe('plan-uncalibrated');
    expect(refusalOf(upsertSpace(BASE, { ...create(draft()), levelKey: { kind: 'local', ordinal: 9 } }, STAMP))).toBe('level-absent');
  });

  it('αφαίρεση: φεύγει μόνο αυτός · ανύπαρκτος ⇒ unchanged · ο τελευταίος ⇒ το πεδίο λείπει (όπως πριν τη Γ3β)', () => {
    expect(removeSpace(WITH_SPACE, L0, S3)).toEqual({ kind: 'unchanged' });
    const level = levelOf(edited(removeSpace(WITH_SPACE, L0, S1)));
    expect(level).not.toHaveProperty('spaces');
    expect(level.separations).toHaveLength(1);
  });
});

describe('Ι — id του πελάτη (Γ3γ-2α)', () => {
  it.each([
    ['χωρίς πρόθεμα', '11111111-1111-4111-8111-111111111111'],
    ['πρόθεμα άλλου είδους (γραμμή)', G2],
    ['πρόθεμα κόμβου', 'tnod_11111111-1111-4111-8111-111111111111'],
    ['όχι UUID v4', 'tspc_11111111-1111-1111-1111-111111111111'],
    ['αυθαίρετο', 's1'],
  ])('create με %s ⇒ space-invalid (ο κριτής δεν εμπιστεύεται ποτέ id πελάτη)', (_label, spaceId) => {
    expect(refusalOf(upsertSpace(BASE, create(draft(), spaceId), STAMP))).toBe('space-invalid');
  });

  it('επανάληψη ΙΔΙΟΥ create (το δίκτυο το ξανάστειλε) ⇒ unchanged, ποτέ δεύτερος χώρος', () => {
    expect(upsertSpace(WITH_SPACE, create(KITCHEN), LATER)).toEqual({ kind: 'unchanged' });
  });

  it('create σε id που υπάρχει με ΑΛΛΟ περιεχόμενο ⇒ space-exists (όχι σιωπηλή αντικατάσταση)', () => {
    expect(refusalOf(upsertSpace(WITH_SPACE, create({ ...KITCHEN, points: rect(1, -1, 5, -5) }), LATER))).toBe('space-exists');
  });

  it('replace σε χώρο που έσβησε άλλος ⇒ space-absent (ποτέ ανάσταση)', () => {
    const gone = edited(removeSpace(WITH_SPACE, L0, S1));
    expect(refusalOf(upsertSpace(gone, replace(KITCHEN), LATER))).toBe('space-absent');
  });
});

describe('Δ — δηλωμένο εμβαδόν (Δ8.4)', () => {
  it.each([[0], [-3], [10_001], [Number.POSITIVE_INFINITY]])('εμβαδόν %p ⇒ area-invalid', (areaM2) => {
    const space = draft(rect(1, -1, 5, -4), { declaredArea: { areaM2, source: 'owner-declared' } });
    expect(refusalOf(upsertSpace(BASE, create(space), STAMP))).toBe('area-invalid');
  });

  it('χωρίς γνωστή πηγή ⇒ area-invalid (Γ3β-2: η πηγή είναι υποχρεωτική)', () => {
    const space = { ...draft(), declaredArea: { areaM2: 12, source: 'hearsay' } } as unknown as TourSpaceDraft;
    expect(refusalOf(upsertSpace(BASE, create(space), STAMP))).toBe('area-invalid');
  });

  it('αλλαγή ΣΧΗΜΑΤΟΣ: η δήλωση μένει με την ΑΡΧΙΚΗ σφραγίδα· αλλαγή ΤΙΜΗΣ: νέα σφραγίδα', () => {
    const kept = { ...KITCHEN, points: rect(1, -1, 5, -5) };
    const reshaped = levelOf(edited(upsertSpace(WITH_SPACE, replace(kept), LATER))).spaces?.[0];
    expect(reshaped?.declaredArea).toEqual({ areaM2: 12.4, source: 'engineer-study', declaredBy: 'manager', declaredAt: STAMP.at });
    const retyped = { ...kept, declaredArea: { areaM2: 13, source: 'site-measurement' as const } };
    const changed = levelOf(edited(upsertSpace(WITH_SPACE, replace(retyped), LATER))).spaces?.[0];
    expect(changed?.declaredArea).toEqual({ areaM2: 13, source: 'site-measurement', declaredBy: 'editor', declaredAt: LATER.at });
  });

  it('ίδιο σχήμα, ΜΟΝΟ νέα δήλωση ⇒ αλλαγή (όχι «unchanged») · σβήσιμο της δήλωσης ⇒ αλλαγή', () => {
    const onlyArea = { ...KITCHEN, declaredArea: { areaM2: 12.5, source: 'engineer-study' as const } };
    expect(levelOf(edited(upsertSpace(WITH_SPACE, replace(onlyArea), LATER))).spaces?.[0].declaredArea).toMatchObject({ areaM2: 12.5 });
    const cleared = { ...KITCHEN, declaredArea: null };
    expect(levelOf(edited(upsertSpace(WITH_SPACE, replace(cleared), LATER))).spaces?.[0]).not.toHaveProperty('declaredArea');
  });
});

describe('Ε — επικάλυψη με άλλον χώρο του ορόφου', () => {
  it('ο γείτονας στον κοινό τοίχο/στη νοητή γραμμή ✓ · 30 cm πάνω του ✗ · ο ίδιος χώρος δεν συγκρίνεται με τον εαυτό του', () => {
    expect(upsertSpace(WITH_SPACE, create(draft(rect(5, -1, 9, -4)), S2), STAMP).kind).toBe('edited');
    expect(refusalOf(upsertSpace(WITH_SPACE, create(draft(rect(4.7, -1, 9, -4)), S2), STAMP))).toBe('space-overlap');
    const pair = edited(upsertSpace(WITH_SPACE, create(draft(rect(5, -1, 9, -4)), S2), STAMP));
    // Τρεμούλιασμα 2 cm πάνω στον γείτονα (ορθογώνια έλξη / σύρσιμο) ⇒ δεκτό· ο S1 δεν συγκρίνεται με τον εαυτό του.
    expect(upsertSpace(pair, replace(draft(rect(1, -1, 5.02, -4))), LATER).kind).toBe('edited');
    expect(refusalOf(upsertSpace(pair, replace(draft(rect(1, -1, 5.3, -4))), LATER))).toBe('space-overlap');
  });
});

describe('Γ — νοητές γραμμές (Δ8.2)', () => {
  type Mode = 'create' | 'replace';
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, mode: Mode = 'create', separationId: string = G1) =>
    ({ levelKey: L0, separationId, mode, a, b });

  it('νέα γραμμή με id πελάτη · ίδια θέση ⇒ unchanged · μετακίνηση ⇒ νέα έγκριση', () => {
    expect(levelOf(edited(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5, y: -4 }), STAMP))).separations?.[0].id).toBe(G1);
    expect(upsertSeparation(WITH_SPACE, line({ x: 5, y: -1 }, { x: 5, y: -4 }, 'replace'), LATER)).toEqual({ kind: 'unchanged' });
    const moved = levelOf(edited(upsertSeparation(WITH_SPACE, line({ x: 6, y: -1 }, { x: 6, y: -4 }, 'replace'), LATER)));
    expect(moved.separations?.[0]).toEqual({ id: G1, a: { x: 6, y: -1 }, b: { x: 6, y: -4 }, approvedBy: 'editor', approvedAt: LATER.at });
  });

  it('έξω από την κάτοψη · κοντύτερη από 10 cm ⇒ separation-invalid · ανύπαρκτη ⇒ separation-absent / unchanged', () => {
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 25, y: -1 }), STAMP))).toBe('separation-invalid');
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5.05, y: -1 }), STAMP))).toBe('separation-invalid');
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5, y: -4 }, 'replace', G2), STAMP))).toBe('separation-absent');
    expect(removeSeparation(WITH_SPACE, L0, G2)).toEqual({ kind: 'unchanged' });
    expect(levelOf(edited(removeSeparation(WITH_SPACE, L0, G1)))).not.toHaveProperty('separations');
  });

  it('create: ίδια γραμμή ξανά ⇒ unchanged · άλλη θέση στο ίδιο id ⇒ separation-exists · id χώρου ⇒ separation-invalid', () => {
    expect(upsertSeparation(WITH_SPACE, line({ x: 5, y: -1 }, { x: 5, y: -4 }), LATER)).toEqual({ kind: 'unchanged' });
    expect(refusalOf(upsertSeparation(WITH_SPACE, line({ x: 6, y: -1 }, { x: 6, y: -4 }), LATER))).toBe('separation-exists');
    expect(refusalOf(upsertSeparation(BASE, line({ x: 5, y: -1 }, { x: 5, y: -4 }, 'create', S1), STAMP))).toBe('separation-invalid');
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

describe('Α — αναίρεση: κάθε αντίστροφη ΕΚΤΕΛΕΙΤΑΙ και ξαναδίνει τον αρχικό γράφο, ΣΤΑ ΙΔΙΑ id', () => {
  const run = (graph: Graph, command: TourGraphCommand): Graph => {
    switch (command.op) {
      case 'space': return edited(upsertSpace(graph, command, STAMP));
      case 'unspace': return edited(removeSpace(graph, command.levelKey, command.spaceId));
      case 'separate': return edited(upsertSeparation(graph, command, STAMP));
      case 'unseparate': return edited(removeSeparation(graph, command.levelKey, command.separationId));
      case 'calibrate': return edited(calibrateLevel(graph, command.levelKey, command.metresPerPixel, STAMP));
      case 'position': return edited(positionNode(graph, command.nodeId, command.point));
      default: throw new Error(command.op);
    }
  };
  /** Με τα id (Γ3γ-2α: η επαναφορά γίνεται στο ΙΔΙΟ id) — χωρίς σφραγίδες. */
  const r = (p: { x: number; y: number } | null) => (p === null ? null : [Number(p.x.toFixed(9)), Number(p.y.toFixed(9))]);
  const shapesOf = (graph: Graph) => ({
    spaces: (levelOf(graph).spaces ?? []).map(({ id, points, room, declaredArea, source }) => (
      { id, points: points.map(r), room, area: declaredArea?.areaM2, source }
    )),
    lines: (levelOf(graph).separations ?? []).map(({ id, a, b }) => [id, r(a), r(b)]),
    positions: graph.nodes.map((n) => r(n.position)),
  });
  const roundTrip = (before: Graph, command: TourGraphCommand) => {
    const after = run(before, command);
    const inverse = inverseOf(command, before);
    if (inverse === null) throw new Error('αναμενόταν αντιστρέψιμη');
    return inverse.reduce(run, after);
  };

  it.each<[string, TourGraphCommand]>([
    ['νέος χώρος', { op: 'space', levelKey: L0, spaceId: S2, mode: 'create', space: draft(rect(10, -6, 12, -8)) }],
    ['αλλαγή σχήματος', { op: 'space', levelKey: L0, spaceId: S1, mode: 'replace', space: draft(rect(1, -1, 6, -6)) }],
    ['αφαίρεση χώρου (με όνομα + δήλωση)', { op: 'unspace', levelKey: L0, spaceId: S1 }],
    ['νέα γραμμή', { op: 'separate', levelKey: L0, separationId: G2, mode: 'create', a: { x: 8, y: -1 }, b: { x: 8, y: -4 } }],
    ['μετακίνηση γραμμής', { op: 'separate', levelKey: L0, separationId: G1, mode: 'replace', a: { x: 6, y: -1 }, b: { x: 6, y: -4 } }],
    ['αφαίρεση γραμμής', { op: 'unseparate', levelKey: L0, separationId: G1 }],
    ['νέα κλίμακα', { op: 'calibrate', levelKey: L0, metresPerPixel: 0.05 }],
    ['🔴 σβήσιμο κλίμακας (X → null): θέσεις ΚΑΙ σχήματα επανέρχονται', { op: 'calibrate', levelKey: L0, metresPerPixel: null }],
  ])('%s', (_label, command) => {
    expect(shapesOf(roundTrip(WITH_SPACE, command))).toEqual(shapesOf(WITH_SPACE));
  });

  it('η αναίρεση μιας δημιουργίας είναι γνωστή ΠΡΙΝ απαντήσει ο διακομιστής: αφαίρεση του ΙΔΙΟΥ id', () => {
    expect(inverseOf({ op: 'space', levelKey: L0, spaceId: S2, mode: 'create', space: draft() }, BASE))
      .toEqual([{ op: 'unspace', levelKey: L0, spaceId: S2 }]);
    expect(inverseOf({ op: 'unspace', levelKey: L0, spaceId: S3 }, WITH_SPACE)).toBeNull();
  });

  it('αλλαγή κάτοψης: η αντίστροφη ξαναγεννά ΚΑΙ χώρους (με όνομα + δήλωση) ΚΑΙ γραμμές, στα ίδια id, μετά την κλίμακα', () => {
    const inverse = inverseOf({ op: 'floorplan', levelKey: L0, plan: { fileId: 'f2', source: 'user-sketch' } }, WITH_SPACE) ?? [];
    expect(inverse.map((c) => c.op)).toEqual(['floorplan', 'calibrate', 'position', 'separate', 'space']);
    expect(inverse.at(-2)).toMatchObject({ op: 'separate', separationId: G1, mode: 'create' });
    expect(inverse.at(-1)).toMatchObject({
      op: 'space', spaceId: S1, mode: 'create',
      space: { room: { types: ['kitchen'], label: null }, declaredArea: { areaM2: 12.4, source: 'engineer-study' } },
    });
  });
});
