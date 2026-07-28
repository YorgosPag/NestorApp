/**
 * ADR-718 §Δ — **ΟΛΗ** η in-place οικογένεια μετασχηματισμού συμμετέχει στον universal
 * associative cascade (ADR-540), όχι μόνο η μετακίνηση.
 *
 * ── Τι ερώτημα κλείνει ──────────────────────────────────────────────────────────────────────
 * Η ζωντανή επαλήθευση του Μ3 επιβεβαίωσε ότι το όριο ακολουθεί το **σύρσιμο λαβής** και τη
 * **μετακίνηση**, αλλά δεν κατάφερε να απομονώσει την οντότητα για **περιστροφή/κλιμάκωση** —
 * δηλαδή τα δύο έμειναν «δεν το είδα», όχι «δουλεύει». Ο κώδικας λέει ότι δουλεύουν
 * (`SnapshotTransformCommand` → `reconcileAssociativeGeometry` → `cascadeTopoSourceGeometry`),
 * αλλά **καμία δοκιμή δεν το κρατούσε**: αν κάποιος έβγαζε αύριο την κλήση από τη βάση, το
 * όριο θα σταματούσε σιωπηλά να ακολουθεί σε τρεις εντολές ταυτόχρονα.
 *
 * ── Γιατί παραμετρικό πάνω στην ΟΙΚΟΓΕΝΕΙΑ και όχι μία δοκιμή ανά εντολή ─────────────────────
 * Η καλωδίωση ζει **μία φορά**, στη βάση. Ένα test ανά υποκλάση θα ήταν τρία αντίγραφα του
 * ίδιου ισχυρισμού (N.18) — και, χειρότερα, δεν θα κάλυπτε την **τέταρτη** υποκλάση που θα
 * γραφτεί κάποια στιγμή. Ο πίνακας από κάτω είναι η δήλωση «κάθε in-place μετασχηματισμός
 * κληρονομεί τον cascade»· ένα νέο μέλος που δεν μπαίνει εδώ είναι ορατή παράλειψη, όχι κρυφή.
 *
 * Ελέγχεται **η καλωδίωση, όχι η αριθμητική** — ίδια διαίρεση με το αδελφό
 * `StretchEntityCommand.associative.test.ts`. Τι ξανα-derive-άρεται ζει στο
 * `systems/topography/__tests__/topo-source-cascade.test.ts`.
 *
 * @see ./StretchEntityCommand.associative.test.ts — το αδελφό αρχείο (η άλλη οικογένεια)
 * @see ../SnapshotTransformCommand — η βάση που κατέχει την κλήση
 */

import type { ICommand, ISceneManager, SceneEntity } from '../../interfaces';
import { createMockSceneManager } from '../../__tests__/mock-scene-manager';

jest.mock('../../../../bim/cascade/associative-geometry-reconcile', () => ({
  reconcileAssociativeGeometry: jest.fn(),
}));

import { RotateEntityCommand } from '../RotateEntityCommand';
import { ScaleEntityCommand } from '../ScaleEntityCommand';
import { MirrorEntityCommand } from '../MirrorEntityCommand';
import { reconcileAssociativeGeometry } from '../../../../bim/cascade/associative-geometry-reconcile';

const mockReconcile = reconcileAssociativeGeometry as jest.Mock;

const POLY_ID = 'ent-boundary-poly';

/** Το «οικόπεδο»: κλειστή πολυγραμμή, ακριβώς ό,τι δέχεται το `buildBoundaryFromEntity`. */
const polyline = (): SceneEntity =>
  ({
    id: POLY_ID,
    type: 'polyline',
    layerId: 'lyr_test',
    closed: true,
    vertices: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ],
  } as unknown as SceneEntity);

function sceneManager(): ISceneManager {
  return createMockSceneManager([polyline()], { getEntityIndex: () => -1 });
}

/**
 * Η in-place οικογένεια, ονομαστικά. **Πρόσθεσε εδώ κάθε νέα υποκλάση του
 * `SnapshotTransformCommand`** — αυτός είναι ο μόνος λόγος που ο πίνακας είναι ρητός.
 */
const IN_PLACE_TRANSFORMS: ReadonlyArray<[string, (sm: ISceneManager) => ICommand]> = [
  ['RotateEntityCommand', (sm) => new RotateEntityCommand([POLY_ID], { x: 0, y: 0 }, 37, sm)],
  ['ScaleEntityCommand', (sm) => new ScaleEntityCommand([POLY_ID], { x: 0, y: 0 }, { sx: 2, sy: 2 }, sm)],
  ['MirrorEntityCommand', (sm) => new MirrorEntityCommand([POLY_ID], { p1: { x: 0, y: 0 }, p2: { x: 0, y: 100 } }, sm)],
];

beforeEach(() => {
  mockReconcile.mockReset();
});

describe.each(IN_PLACE_TRANSFORMS)(
  '%s — universal associative cascade (ADR-540 · ADR-718 §Δ)',
  (_name, build) => {
    it('execute ⇒ ο cascade τρέχει με την οντότητα που μετασχηματίστηκε', () => {
      const sm = sceneManager();

      build(sm).execute();

      expect(mockReconcile).toHaveBeenCalledTimes(1);
      expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], sm, expect.anything());
    });

    it('undo ⇒ ο ΙΔΙΟΣ cascade — αλλιώς η αναίρεση αφήνει το όριο στο μετασχηματισμένο σχήμα', () => {
      const cmd = build(sceneManager());
      cmd.execute();
      mockReconcile.mockReset();

      cmd.undo();

      expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], expect.anything());
    });

    it('redo ⇒ ξανά, ταυτόσημα με το execute', () => {
      const cmd = build(sceneManager());
      cmd.execute();
      cmd.undo();
      mockReconcile.mockReset();

      cmd.redo();

      expect(mockReconcile).toHaveBeenCalledWith([POLY_ID], expect.anything(), expect.anything());
    });
  },
);
