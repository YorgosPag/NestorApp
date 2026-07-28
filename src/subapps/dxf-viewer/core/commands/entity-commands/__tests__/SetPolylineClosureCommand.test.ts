/**
 * ADR-718 §Β — `SetPolylineClosureCommand`: AutoCAD `PEDIT → Close / Open`, undoable.
 *
 * ── Τι κρατά ΑΥΤΟ το αρχείο ─────────────────────────────────────────────────────────────────
 * Τη **σημασιολογία** της εντολής: ποια τμήματα υπάρχουν μετά την πράξη, πού κάθονται τα
 * **per-segment** μητρώα (`bulges` / widths), τι αρνείται, και ότι η αναίρεση επαναφέρει τα
 * πάντα. Το «τι κάνει ο cascade στο τοπογραφικό όριο» ζει στο αδελφό
 * `systems/topography/__tests__/topo-boundary-link.test.ts` — εδώ ελέγχεται μόνο ότι ο cascade
 * **καλείται** (καλωδίωση), ίδια διαίρεση με το `SnapshotTransformCommand.topo-cascade.test.ts`.
 *
 * ── Γιατί τα `bulges` είναι το κύριο αγκίστρι ───────────────────────────────────────────────
 * Γιατί εκεί το σφάλμα είναι **αόρατο**. Ένα σκέτο `{ closed: false }` περνά κάθε οπτικό
 * έλεγχο σε πολυγραμμή **χωρίς τόξα** — δηλαδή στη συντριπτική πλειοψηφία των δοκιμών — και
 * σπάει μόνο στο σχέδιο του πελάτη που έχει καμπύλο όριο. Ίδιο σχήμα με το κενό του §Α: «όλα
 * τα tests έτρεχαν στην περίπτωση όπου η παράλειψη δεν φαίνεται».
 *
 * @see ../SetPolylineClosureCommand
 * @see ../SetBulgeCommand — η σύμβαση πλήθους τμημάτων (`closed ? N : N − 1`)
 */

import type { SceneEntity } from '../../interfaces';
import { createMockSceneManager, type MockSceneManager } from '../../__tests__/mock-scene-manager';

jest.mock('../../../../bim/cascade/associative-geometry-reconcile', () => ({
  reconcileAssociativeGeometry: jest.fn(),
}));

import { SetPolylineClosureCommand } from '../SetPolylineClosureCommand';
import { reconcileAssociativeGeometry } from '../../../../bim/cascade/associative-geometry-reconcile';

const mockReconcile = reconcileAssociativeGeometry as jest.Mock;

const ID = 'ent-poly';

/** Τετράγωνο: τέσσερις κορυφές, άρα 4 τμήματα κλειστό / 3 ανοιχτό. */
const SQUARE = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

interface PolyOverrides {
  readonly closed?: boolean;
  readonly bulges?: number[];
  readonly startWidths?: number[];
  readonly type?: string;
  readonly vertices?: { x: number; y: number }[];
}

function poly(overrides: PolyOverrides = {}): SceneEntity {
  return {
    id: ID,
    type: overrides.type ?? 'polyline',
    layerId: 'lyr_test',
    vertices: (overrides.vertices ?? SQUARE).map((v) => ({ ...v })),
    closed: overrides.closed ?? true,
    ...(overrides.bulges ? { bulges: overrides.bulges } : {}),
    ...(overrides.startWidths ? { startWidths: overrides.startWidths } : {}),
  } as unknown as SceneEntity;
}

type ReadPoly = {
  closed?: boolean;
  vertices: { x: number; y: number }[];
  bulges?: number[];
  startWidths?: number[];
};

function read(sm: MockSceneManager): ReadPoly {
  return sm.store.get(ID) as unknown as ReadPoly;
}

function run(entity: SceneEntity, op: ConstructorParameters<typeof SetPolylineClosureCommand>[0]['op']) {
  const sm = createMockSceneManager([entity]);
  const cmd = new SetPolylineClosureCommand({ entityId: ID, op }, sm);
  cmd.execute();
  return { sm, cmd };
}

beforeEach(() => {
  mockReconcile.mockReset();
});

// ─── Η σημαία ──────────────────────────────────────────────────────────────────

describe('η σημαία `closed`', () => {
  it('close: ανοιχτή → κλειστή, χωρίς να πειράξει τις κορυφές', () => {
    const { sm } = run(poly({ closed: false }), { kind: 'close' });

    expect(read(sm).closed).toBe(true);
    expect(read(sm).vertices).toEqual(SQUARE);
  });

  it('open: κλειστή → ανοιχτή, χωρίς να πειράξει τις κορυφές', () => {
    const { sm } = run(poly({ closed: true }), { kind: 'open' });

    expect(read(sm).closed).toBe(false);
    expect(read(sm).vertices).toEqual(SQUARE);
  });
});

// ─── Η ακμή ────────────────────────────────────────────────────────────────────

describe('«Άνοιγμα εδώ» — η αναδιάταξη κορυφών', () => {
  it('η ακμή 0 φεύγει: η λίστα ξεκινά από τη ΔΕΥΤΕΡΗ κορυφή της', () => {
    const { sm } = run(poly(), { kind: 'open-at-edge', edgeIndex: 0 });

    // Ακμή 0 = v0→v1. Μετά το άνοιγμα η αλυσίδα είναι v1 … v0, δηλαδή αυτή η ακμή λείπει.
    expect(read(sm).vertices).toEqual([SQUARE[1], SQUARE[2], SQUARE[3], SQUARE[0]]);
    expect(read(sm).closed).toBe(false);
  });

  it('η ακμή 2 φεύγει', () => {
    const { sm } = run(poly(), { kind: 'open-at-edge', edgeIndex: 2 });

    expect(read(sm).vertices).toEqual([SQUARE[3], SQUARE[0], SQUARE[1], SQUARE[2]]);
  });

  it('η ΤΕΛΕΥΤΑΙΑ ακμή (το κλείσιμο) ταυτίζεται με το σκέτο άνοιγμα — μία συμπεριφορά', () => {
    const atEdge = run(poly(), { kind: 'open-at-edge', edgeIndex: SQUARE.length - 1 });
    const plain = run(poly(), { kind: 'open' });

    expect(read(atEdge.sm).vertices).toEqual(read(plain.sm).vertices);
    expect(read(atEdge.sm).closed).toBe(read(plain.sm).closed);
  });
});

// ─── Τα per-segment μητρώα (το αγκίστρι) ───────────────────────────────────────

describe('τα per-segment μητρώα ακολουθούν τα τμήματά τους', () => {
  it('close: το νέο τμήμα κλεισίματος γεννιέται ΕΥΘΥΓΡΑΜΜΟ, τα υπόλοιπα μένουν', () => {
    // Ανοιχτό τετράπλευρο ⇒ 3 τμήματα· μετά το κλείσιμο ⇒ 4.
    const { sm } = run(poly({ closed: false, bulges: [0.1, 0.2, 0.3] }), { kind: 'close' });

    expect(read(sm).bulges).toEqual([0.1, 0.2, 0.3, 0]);
  });

  it('open: φεύγει το τμήμα ΚΛΕΙΣΙΜΑΤΟΣ, όχι κάποιο άλλο', () => {
    const { sm } = run(poly({ bulges: [0.1, 0.2, 0.3, 0.4] }), { kind: 'open' });

    expect(read(sm).bulges).toEqual([0.1, 0.2, 0.3]);
  });

  it('open-at-edge 0: το τόξο κάθε τμήματος ταξιδεύει ΜΑΖΙ του, δεν μένει στη θέση του', () => {
    // Νέο τμήμα j = παλιό τμήμα (0 + 1 + j) mod 4 → [1, 2, 3]· το τμήμα 0 (0.1) φεύγει.
    const { sm } = run(poly({ bulges: [0.1, 0.2, 0.3, 0.4] }), { kind: 'open-at-edge', edgeIndex: 0 });

    expect(read(sm).bulges).toEqual([0.2, 0.3, 0.4]);
  });

  it('open-at-edge 2: ίδια περμουτάση, με αναδίπλωση', () => {
    // Νέο τμήμα j = παλιό (3 + j) mod 4 → [3, 0, 1]· το τμήμα 2 (0.3) φεύγει.
    const { sm } = run(poly({ bulges: [0.1, 0.2, 0.3, 0.4] }), { kind: 'open-at-edge', edgeIndex: 2 });

    expect(read(sm).bulges).toEqual([0.4, 0.1, 0.2]);
  });

  it('τα πλάτη ακολουθούν τον ΙΔΙΟ κανόνα με τα τόξα (ένας μηχανισμός, τρία μητρώα)', () => {
    const { sm } = run(
      poly({ startWidths: [1, 2, 3, 4] }),
      { kind: 'open-at-edge', edgeIndex: 0 },
    );

    expect(read(sm).startWidths).toEqual([2, 3, 4]);
  });

  it('πολυγραμμή ΧΩΡΙΣ τόξα δεν αποκτά πίνακα μηδενικών επειδή την άνοιξε κάποιος', () => {
    const { sm } = run(poly(), { kind: 'open' });

    expect(read(sm).bulges).toBeUndefined();
    expect(read(sm).startWidths).toBeUndefined();
  });
});

// ─── Τι ΑΡΝΕΙΤΑΙ ───────────────────────────────────────────────────────────────

describe('τι αρνείται — καμία σιωπηλή επινόηση', () => {
  it.each([
    ['λιγότερες από 3 κορυφές (δεν υπάρχει δακτύλιος)', poly({ closed: false, vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), { kind: 'close' as const }],
    ['ήδη κλειστή → close', poly({ closed: true }), { kind: 'close' as const }],
    ['ήδη ανοιχτή → open', poly({ closed: false }), { kind: 'open' as const }],
    ['ήδη ανοιχτή → open-at-edge', poly({ closed: false }), { kind: 'open-at-edge' as const, edgeIndex: 1 }],
    ['δείκτης ακμής εκτός ορίων', poly(), { kind: 'open-at-edge' as const, edgeIndex: 4 }],
    ['άλλος τύπος οντότητας', poly({ type: 'line' }), { kind: 'open' as const }],
  ])('%s ⇒ καμία εγγραφή, κανένας cascade', (_label, entity, op) => {
    const before = JSON.parse(JSON.stringify(entity));

    const { sm } = run(entity, op);

    expect(sm.store.get(ID)).toEqual(before);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('`validate()` απορρίπτει αρνητικό δείκτη ακμής πριν καν αγγίξει τη σκηνή', () => {
    const sm = createMockSceneManager([poly()]);
    const cmd = new SetPolylineClosureCommand({ entityId: ID, op: { kind: 'open-at-edge', edgeIndex: -1 } }, sm);

    expect(cmd.validate()).not.toBeNull();
  });
});

// ─── Αναίρεση / επανάληψη ──────────────────────────────────────────────────────

describe('αναίρεση και επανάληψη', () => {
  it('undo επαναφέρει κορυφές, σημαία ΚΑΙ τόξα — όχι μόνο τη σημαία', () => {
    const entity = poly({ bulges: [0.1, 0.2, 0.3, 0.4] });
    const before = JSON.parse(JSON.stringify(entity));
    const { sm, cmd } = run(entity, { kind: 'open-at-edge', edgeIndex: 1 });

    cmd.undo();

    expect(sm.store.get(ID)).toEqual(before);
  });

  it('redo ξαναφέρνει ΑΚΡΙΒΩΣ το ίδιο αποτέλεσμα με το execute', () => {
    const { sm, cmd } = run(poly({ bulges: [0.1, 0.2, 0.3, 0.4] }), { kind: 'open-at-edge', edgeIndex: 2 });
    const afterExecute = JSON.parse(JSON.stringify(sm.store.get(ID)));

    cmd.undo();
    cmd.redo();

    expect(sm.store.get(ID)).toEqual(afterExecute);
  });
});

// ─── Η καλωδίωση στον universal cascade ────────────────────────────────────────

describe('universal associative cascade (ADR-540)', () => {
  it.each([
    ['close', poly({ closed: false }), { kind: 'close' as const }],
    ['open', poly(), { kind: 'open' as const }],
    ['open-at-edge', poly(), { kind: 'open-at-edge' as const, edgeIndex: 1 }],
  ])('%s ⇒ ο cascade τρέχει με την πολυγραμμή που άλλαξε', (_label, entity, op) => {
    const { sm } = run(entity, op);

    expect(mockReconcile).toHaveBeenCalledTimes(1);
    expect(mockReconcile).toHaveBeenCalledWith([ID], sm);
  });

  it('undo ⇒ ο ΙΔΙΟΣ cascade — αλλιώς η αναίρεση αφήνει το όριο σπασμένο', () => {
    const { cmd } = run(poly(), { kind: 'open' });
    mockReconcile.mockReset();

    cmd.undo();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('redo ⇒ ξανά', () => {
    const { cmd } = run(poly(), { kind: 'open' });
    cmd.undo();
    mockReconcile.mockReset();

    cmd.redo();

    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });
});
