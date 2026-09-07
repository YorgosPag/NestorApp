/**
 * ADR-833 / ADR-587 Φ10 — **Η ΤΡΙΤΗ ΠΡΟΒΟΛΗ ΤΟΥ ΠΙΝΑΚΑ**: `DxfTable → EntityModel` (spatial index).
 *
 * ## 🔴 Το περιστατικό που γέννησε αυτό το αρχείο (μετρημένο σε πραγματικό σχέδιο, 2026-09-07)
 * Το `hit-test-model-dxf.ts` κρατούσε **χειρόγραφη** λίστα πεδίων πίνακα, και η λίστα έμεινε
 * στην **προ-ADR-833** μορφή: ζητούσε `model`/`binding` (πεδία που η Φάση 2 **έβγαλε** από την
 * οντότητα) και **δεν** ζητούσε `worksheets`/`activeWorksheetId`. Άρα σε κάθε καρέ:
 *
 * ```
 *   DxfTable (με φύλλα) → seam → EntityModel ΧΩΡΙΣ κανένα σχήμα
 *                              → resolveWorksheets → κενό εφεδρικό φύλλο + logger.error
 *                              → διάταξη 0×0 → κουτί = ΕΚΦΥΛΙΣΜΕΝΟ ΣΗΜΕΙΟ στην άγκυρα
 * ```
 *
 * ## 🔴 ΓΙΑΤΙ ΤΟ ΥΠΑΡΧΟΝ PIN ΗΤΑΝ ΠΡΑΣΙΝΟ ΟΣΟ ΕΤΡΕΧΕ ΤΟ ΣΦΑΛΜΑ
 * Ο cross-seam φρουρός (`hit-test-entity-model-coverage.test.ts`) ρωτούσε **«non-null;»** — και
 * το `calculateTableBounds` επιστρέφει, **επίτηδες**, εκφυλισμένο κουτί αντί για `null` όταν ο
 * πίνακας δεν έχει γραμμές (μια οντότητα χωρίς κελιά πρέπει να παραμένει επιλέξιμη). Δηλαδή η
 * νόμιμη ανοχή του ενός στρώματος έκρυβε την απώλεια του άλλου: **το `null` δεν ήταν ποτέ το
 * σύμπτωμα εδώ.**
 *
 * Άρα η ερώτηση αυτού του αρχείου δεν είναι «υπάρχει κουτί;» αλλά **«είναι ΤΟ ΙΔΙΟ κουτί με
 * αυτό που ζωγραφίζεται;»** — η μόνη διατύπωση που δεν μπορεί να ικανοποιηθεί από εκφυλισμό.
 *
 * @see services/hit-test-model-dxf.ts — η προβολή που ελέγχεται
 * @see bim/table/__tests__/table-render-fields.test.ts — οι άλλες δύο προβολές (ίδιο SSoT)
 */

// Firebase auth mock — τα type barrels αγγίζουν auth στο import path.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  getAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInAnonymously: jest.fn(),
}));

import { convertDxfEntityToEntityModel } from '../hit-test-entity-model';
import { TABLE_RENDER_FIELDS } from '../../bim/table/table-render-fields';
import { BoundsCalculator } from '../../rendering/hitTesting/Bounds';
import { calculateTableBounds } from '../../bim/table/table-entity-hit';
import { TO_DXF_HANDLERS } from '../../hooks/canvas/dxf-scene-entity-handlers';
import { buildTableModel } from '../../bim/table/build-table-entity';
import {
  makeTableEntity,
  makePreWorksheetsTableEntity,
} from '../../bim/table/__tests__/make-table-entity';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { TableEntity } from '../../types/table-entity';

/** Η πραγματική αλυσίδα παραγωγής: οντότητα σκηνής → `DxfTable` → hit-test `EntityModel`. */
function throughSeam(entity: TableEntity): ReturnType<typeof convertDxfEntityToEntityModel> {
  const base = { id: entity.id, layerId: entity.layerId, visible: true };
  const dxf = TO_DXF_HANDLERS.table!(entity, base as never) as unknown as DxfEntityUnion;
  return convertDxfEntityToEntityModel(dxf);
}

const MODEL = buildTableModel({ columnCount: 3, dataRowCount: 2, columnWidthMm: 40 });

describe('🔴 πίνακας → spatial index: ΤΟ ΙΔΙΟ κουτί με αυτό που ζωγραφίζεται', () => {
  it.each([
    ['νέα μορφή (φύλλα)', () => makeTableEntity({ id: 'tbl_new', model: MODEL })],
    ['ΠΑΛΙΑ μορφή (πριν τα φύλλα)', () => makePreWorksheetsTableEntity(MODEL, undefined, { id: 'tbl_old' })],
  ])('%s', (_label, make) => {
    const entity = make();
    const expected = calculateTableBounds(entity, 0);
    const actual = BoundsCalculator.calculateEntityBounds(throughSeam(entity), 0);

    expect(actual).not.toBeNull();
    // Ταυτότητα τιμών, όχι «υπάρχει»: το εκφυλισμένο κουτί του σφάλματος περνούσε κάθε
    // ασθενέστερη διατύπωση.
    expect(actual!.minX).toBeCloseTo(expected.minX, 9);
    expect(actual!.minY).toBeCloseTo(expected.minY, 9);
    expect(actual!.maxX).toBeCloseTo(expected.maxX, 9);
    expect(actual!.maxY).toBeCloseTo(expected.maxY, 9);
    // Και έκταση: ένα σημείο στην άγκυρα ΔΕΝ είναι πίνακας 3 στηλών × 4 γραμμών.
    expect(actual!.width).toBeGreaterThan(0);
    expect(actual!.height).toBeGreaterThan(0);
  });

  it('τα φύλλα ΦΤΑΝΟΥΝ αυτούσια — κανένα εφεδρικό κενό φύλλο, καμία καταγραφή σφάλματος', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const model = throughSeam(makeTableEntity({ id: 'tbl_log', model: MODEL })) as unknown as {
      worksheets?: readonly { model?: { columns?: readonly unknown[] } }[];
    };
    // Το σχήμα, όχι μόνο η ύπαρξη: το εφεδρικό φύλλο έχει κι αυτό `worksheets.length === 1`.
    expect(model.worksheets?.[0]?.model?.columns).toHaveLength(3);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('🚫 τα νεκρά ονόματα της παλιάς μορφής δεν ζητούνται πια σε αυτό το σύνορο', () => {
  it('το `EntityModel` του πίνακα ΔΕΝ κουβαλά `model`/`binding`', () => {
    // Δύο κληρονόμοι του «πού είναι τα κελιά» θα ήταν ακριβώς ο καθρέφτης που το ADR-833 §5.2
    // απαγορεύει — και ο τρόπος με τον οποίο αυτή η προβολή έμεινε πίσω για μία ολόκληρη φάση.
    const model = throughSeam(makeTableEntity({ id: 'tbl_dead', model: MODEL })) as unknown as
      Record<string, unknown>;
    expect('model' in model).toBe(false);
    expect('binding' in model).toBe(false);
  });

  it('η προβολή μεταφέρει ΟΛΟ το συμβόλαιο — ίδιος φρουρός με τις άλλες δύο', () => {
    // Ο πίνακας είναι ο τύπος του οποίου τα πεδία **αλλάζουν με το σχήμα του** (ADR-833), γι'
    // αυτό αυτή η προβολή δεν επιτρέπεται να κρατά τοπική λίστα: ρωτά το ΙΔΙΟ SSoT με τις
    // άλλες δύο. Πρόσθεσε πεδίο στο `TABLE_RENDER_FIELDS` και ξέχνα το εδώ ⇒ κόκκινο.
    const model = throughSeam(
      makeTableEntity({ id: 'tbl_contract', model: MODEL }),
    ) as unknown as Record<string, unknown>;
    // Το `breaking` λείπει νόμιμα από το δείγμα (optional), οπότε ο έλεγχος αφορά τα υπόλοιπα —
    // αλλιώς θα δοκιμαζόταν η πληρότητα του δείγματος αντί για τη μεταφορά.
    const required = TABLE_RENDER_FIELDS.filter((f) => f !== 'breaking');
    expect(required.filter((f) => model[f] === undefined)).toEqual([]);
  });
});
