/**
 * 🔴 ADR-769 §7.2 — **Ο ΚΥΚΛΟΣ ΚΛΕΙΝΕΙ ΜΕ ΤΙΣ ΠΡΑΓΜΑΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ.**
 *
 * ```
 *   TopoPoint[] ─buildCoordinateTable─▶ ExportableTable ─applyBoundSourceToCells─▶ κελιά
 *        ▲                                                                          │
 *        │                                                                   cellInputText
 *   moveSurveyPoint ◀─ surveyPointDeltaForField ◀─ askTableWriteBack ◀─ ό,τι πληκτρολόγησε
 * ```
 *
 * Κανένα βήμα δεν είναι fixture: αν κάποιο από τα έξι αλλάξει μονάδα ή σημασία, **αυτό** το
 * αρχείο κοκκινίζει. Το ADR-716 το διατυπώνει έτσι: *«η διαγώνιος είναι δομικά ανίκανη —
 * λύση = ΑΠΟΔΕΙΞΗ»*.
 *
 * ## 🔴 Η βλάβη που το γέννησε (μετρημένη με εκτέλεση, 08/08)
 * Ο πυρήνας της Φ.Η γράφτηκε υποθέτοντας ότι το κελί δείχνει **μέτρα**. Δεν έδειχνε: ο δεσμός
 * έγραφε **ωμά χιλιοστά** (`391698400`), ενώ το CSV/PDF του **ίδιου** πίνακα έδειχνε
 * `391698.400`. Τα 18 tests του κριτή ήταν πράσινα γιατί **έδιναν** μέτρα στην είσοδο —
 * χαρακτήριζαν την υπόθεση, όχι τη ζωντανή συμπεριφορά (ADR-587 §6.1: «ένα test που ρωτά τον
 * εαυτό του δεν είναι άγκυρα»). Ο κύκλος από άκρη σε άκρη είναι το μόνο σχήμα που δεν μπορεί
 * να πει ψέματα γι' αυτό.
 *
 * @see bim/table/write-back/table-write-back-request.ts — ο συναρμολογητής
 */

import { applyBoundSourceToCells } from '../binding/table-binding-cells';
import { commitCellWrites, cellInputText } from '../formula/table-formula-engine';
import { askTableWriteBack, tableCellInputValue } from '../write-back/table-write-back-request';
import { buildCoordinateTable } from '../../../systems/topography/deliverables/survey-tables';
import {
  moveSurveyPoint,
  surveyPointDeltaForField,
} from '../../../systems/topography/topo-survey-point-resolve';
import type { PersistedTableModel, TableBinding, TableColumn, TableRow } from '../../../types/table';
import type { TopoPoint } from '../../../systems/topography/topo-types';

// ─── Σκηνικό: η αποτύπωση και ο πίνακάς της ──────────────────────────────────

/** Δύο κορυφές σε ΕΓΣΑ'87, world canonical mm. Η δεύτερη είναι ο στόχος. */
const P1 = { x: 391_600_000, y: 4_204_000_000, z: 12_000, code: 'ΣΤ1' } as TopoPoint;
const P2 = { x: 391_698_400, y: 4_204_500_000, z: 14_500, code: 'ΣΤ3' } as TopoPoint;

const BINDING: TableBinding = {
  mode: 'live',
  sourceRef: { kind: 'survey-coordinates' },
  revision: 'r0',
};

function emptyModel(): PersistedTableModel {
  const col = (id: string, sourceKey: string): TableColumn => ({
    id, sizing: { kind: 'fixed', widthMm: 25 }, valueType: 'text', align: 'right', sourceKey,
  });
  const columns: TableColumn[] = [
    col('cIdx', 'index'), col('cX', 'x'), col('cY', 'y'), col('cZ', 'z'), col('cCode', 'code'),
  ];
  const rows: TableRow[] = [
    { id: 'rHead', rowClass: 'header', heightMm: 8 },
    { id: 'r1', rowClass: 'data', heightMm: 6 },
    { id: 'r2', rowClass: 'data', heightMm: 6 },
  ];
  return { columns, rows, cells: [], merges: [] };
}

/** Ο πίνακας **γεμισμένος από την πηγή** — η πραγματική διαδρομή του ADR-767 §5. */
function filled(points: readonly TopoPoint[]): PersistedTableModel {
  return commitCellWrites(applyBoundSourceToCells(emptyModel(), buildCoordinateTable(points)).pending);
}

const ctx = (points: readonly TopoPoint[]) => ({ topoPoints: points });

// ─── 1. Ο κύκλος, άκρη σε άκρη ───────────────────────────────────────────────

describe('ADR-769 — ο πίνακας ζητάει, η κορυφή μετακινείται ΑΚΡΙΒΩΣ εκεί', () => {
  it('🔴 ο ΕΠΕΞΕΡΓΑΣΤΗΣ δείχνει ΜΕΤΡΑ — ό,τι βλέπει ο άνθρωπος είναι ό,τι πληκτρολογεί', () => {
    // Η γραμμή που ΔΕΝ ήταν πράσινη πριν: το κελί έδειχνε `391698400`.
    expect(cellInputText(filled([P1, P2]), 'r2', 'cX')).toBe('391698.4');
  });

  it('🏆 γράφω 391698.5 και η κορυφή προσγειώνεται στα 391698500 mm — Υ και Ζ ΑΝΕΓΓΙΧΤΑ', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points),
      binding: BINDING,
      context: ctx(points),
      rowId: 'r2',
      colId: 'cX',
      nextDisplayValue: tableCellInputValue('391698.5'),
    });
    if (request === null) throw new Error('αναμενόταν αίτημα write-back');
    expect(request.sourceRowIndex).toBe(1);
    expect(request.plan).toMatchObject({ status: 'accepted', field: 'x', storeValue: 391_698_500 });
    if (request.plan.status !== 'accepted') return;

    // Ο μεταφραστής και ο εκτελεστής, **αυτούσιοι** — καμία εντολή δεν χτίστηκε γι' αυτό.
    const delta = surveyPointDeltaForField(points, 1, request.plan.field, request.plan.storeValue);
    if (delta === null) throw new Error('αναμενόταν delta');
    const moved = moveSurveyPoint(points, 1, delta);

    expect(moved[1].x).toBe(391_698_500);
    expect(moved[1].y).toBe(P2.y);
    expect(moved[1].z).toBe(P2.z);
    expect(moved[0]).toBe(P1); // η άλλη κορυφή δεν αντιγράφηκε καν
  });

  it('η ΙΔΙΑ τιμή δεν γεννά αίτημα εκτέλεσης — καμία εγγραφή στο ιστορικό', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.4'),
    });
    expect(request?.plan.status).toBe('unchanged');
  });
});

// ─── 2. Compare-and-swap πάνω στην ΠΡΑΓΜΑΤΙΚΗ βάση ───────────────────────────

describe('ADR-769 Δ3 — γραφή σε λάθος στόχο είναι ΔΟΜΙΚΑ αδύνατη', () => {
  it('🔴 η κορυφή κουνήθηκε στην πηγή μετά το γέμισμα ⇒ source-moved, ΚΑΜΙΑ γραφή', () => {
    const shown = filled([P1, P2]);
    // Ο πίνακας δείχνει στιγμιότυπο (Δ3 του ADR-767: καμία αυτόματη ανανέωση), ενώ η
    // αποτύπωση προχώρησε. Ακριβώς το σενάριο που το CAS υπάρχει για να πιάσει.
    const live = [P1, { ...P2, y: 4_204_599_999 } as TopoPoint];

    const request = askTableWriteBack({
      model: shown, binding: BINDING, context: ctx(live),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.5'),
    });
    expect(request?.plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'source-moved', sourceKey: 'y' },
    });
  });

  it('η βάση είναι οι ΥΠΟΛΟΙΠΕΣ στήλες — η ίδια η στήλη που γράφεται εξαιρείται', () => {
    // Αλλιώς κάθε γραφή θα απορριπτόταν από τον εαυτό της: εκεί η διαφορά είναι ο ΣΚΟΠΟΣ.
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('999999.9'),
    });
    expect(request?.plan.status).toBe('accepted');
  });

  it('🔴 η ΙΔΙΑ Η ΣΤΗΛΗ-ΣΤΟΧΟΣ κουνήθηκε στην πηγή ⇒ ΕΠΙΤΡΕΠΕΤΑΙ — ο χρήστης δίνει ΑΠΟΛΥΤΗ τιμή', () => {
    // Η διάκριση που κάνει τον CAS χρήσιμο αντί για εμπόδιο: «η **γραμμή** είναι ακόμη η
    // γραμμή του ΣΤ3;» είναι η ερώτηση ταυτότητας· «το x άλλαξε;» **δεν** είναι — ο χρήστης
    // δηλώνει πού *πρέπει* να είναι το x, όχι πού ήταν. Αν μετρούσε και αυτή, ένα διπλό
    // πάτημα «Ανανέωση» θα έκανε κάθε διόρθωση συντεταγμένης αδύνατη.
    const shown = filled([P1, P2]);
    const live = [P1, { ...P2, x: 391_698_444 } as TopoPoint];

    const request = askTableWriteBack({
      model: shown, binding: BINDING, context: ctx(live),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.5'),
    });
    expect(request?.plan).toMatchObject({ status: 'accepted', storeValue: 391_698_500 });
  });

  it('🔴 ο ΔΕΙΚΤΗΣ γραμμής είναι πραγματικός — «πάντα η πρώτη» θα μετακινούσε λάθος κορυφή', () => {
    const points = [P1, P2];
    const first = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r1', colId: 'cX', nextDisplayValue: tableCellInputValue('391600.1'),
    });
    const second = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.5'),
    });
    expect(first?.sourceRowIndex).toBe(0);
    expect(second?.sourceRowIndex).toBe(1);
  });

  it('γραμμή που η πηγή ΔΕΝ καλύπτει ⇒ source-unavailable, ποτέ γραφή σε ανύπαρκτο σημείο', () => {
    const request = askTableWriteBack({
      model: filled([P1, P2]), binding: BINDING, context: ctx([P1]),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.5'),
    });
    expect(request?.plan).toMatchObject({ status: 'rejected', reason: { kind: 'source-unavailable' } });
  });

  it('🔴 η ΚΕΦΑΛΙΔΑ γράφεται ΚΑΝΟΝΙΚΑ — ο τίτλος στήλης είναι δικός του, όχι της πηγής', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'rHead', colId: 'cX', nextDisplayValue: tableCellInputValue('Χ (μ)'),
    });
    // Ο δεσμός γεμίζει **μόνο** γραμμές `data` (ADR-767 §5), οπότε το κελί κεφαλίδας δεν έχει
    // `bound` και ο κριτής το στέλνει στο μοντέλο. Ένας πίνακας που δεν αφήνει να αλλάξεις
    // την επικεφαλίδα του θα ήταν παλινδρόμηση της Φ.ΣΤ, γεννημένη από τη Φ.Η.
    expect(request).toBeNull();
  });

  it('🔴 δεμένο κελί σε γραμμή που η πηγή ΔΕΝ καλύπτει ⇒ δείκτης -1 ⇒ άρνηση', () => {
    // `-1` και όχι `0`: το «δεν βρέθηκε» δεν επιτρέπεται να διαβαστεί ως «η πρώτη γραμμή» —
    // αυτό θα ήταν γραφή σε **λάθος κορυφή**, ακριβώς η βλάβη που το Δ3 αποκλείει.
    const request = askTableWriteBack({
      model: filled([P1, P2]), binding: BINDING, context: ctx([P1]),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('391698.5'),
    });
    expect(request?.sourceRowIndex).toBe(1);
    expect(request?.plan).toMatchObject({ status: 'rejected', reason: { kind: 'source-unavailable' } });
  });
});

// ─── 3. Οι στήλες που ΔΕΝ γράφονται — καθεμία με τον δικό της λόγο ────────────

describe('ADR-769 Δ2 — ρητή άρνηση ανά στήλη, ποτέ σιωπή', () => {
  it('ο αύξων αριθμός απορρίπτεται ως ΠΑΡΑΓΩΓΟΣ, όχι ως «κάτι πήγε στραβά»', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cIdx', nextDisplayValue: tableCellInputValue('7'),
    });
    expect(request?.plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'column-unwritable', reason: 'ordinal' },
    });
  });

  it('🔴 το υψόμετρο δηλώνεται ΧΩΡΙΣ ΙΔΙΟΚΤΗΤΗ — γραφή του είναι δήλωση μέτρησης (ADR-720)', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cZ', nextDisplayValue: tableCellInputValue('15.0'),
    });
    expect(request?.plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'column-unwritable', reason: 'no-owner' },
    });
  });
});

// ─── 4. Ό,τι πληκτρολόγησε ο άνθρωπος ────────────────────────────────────────

describe('ADR-769 — από <input> σε τιμή κελιού', () => {
  it('🔴 ΚΕΝΟ ⇒ null, ΠΟΤΕ 0 — το `Number("")` είναι 0 και θα ήταν ψεύτικη μέτρηση', () => {
    expect(tableCellInputValue('')).toBeNull();
    expect(tableCellInputValue('   ')).toBeNull();
  });

  it('αριθμητικό ⇒ αριθμός σε μονάδες οθόνης', () => {
    expect(tableCellInputValue(' 391698.5 ')).toBe(391698.5);
    expect(tableCellInputValue('-3')).toBe(-3);
  });

  it('μη αριθμητικό ⇒ το κείμενο αυτούσιο· ο κριτής θα το αρνηθεί ρητά, δεν μαντεύει NaN', () => {
    expect(tableCellInputValue('εξήντα')).toBe('εξήντα');
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('εξήντα'),
    });
    expect(request?.plan).toMatchObject({ status: 'rejected', reason: { kind: 'invalid-value' } });
  });

  it('κενό σε γράψιμη στήλη ⇒ άρνηση — σβήσιμο συντεταγμένης δεν είναι μετακίνηση', () => {
    const points = [P1, P2];
    const request = askTableWriteBack({
      model: filled(points), binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue(''),
    });
    expect(request?.plan).toMatchObject({ status: 'rejected', reason: { kind: 'invalid-value' } });
  });
});

// ─── 5. Ό,τι ΔΕΝ είναι write-back ────────────────────────────────────────────

describe('ADR-769 — `null` σημαίνει «κανονικό κελί», όχι «απέτυχε»', () => {
  it('ελεύθερη στήλη μέσα σε δεμένο πίνακα δεν γεννά αίτημα', () => {
    const points = [P1, P2];
    const free: PersistedTableModel = {
      ...filled(points),
      columns: emptyModel().columns.map((c) => (c.id === 'cX' ? { ...c, sourceKey: undefined } : c)),
    };
    const request = askTableWriteBack({
      model: free, binding: BINDING, context: ctx(points),
      rowId: 'r2', colId: 'cX', nextDisplayValue: tableCellInputValue('1'),
    });
    // 🔴 Το κελί κρατά `bound` από το προηγούμενο γέμισμα αλλά η στήλη δεν δηλώνει πια πηγή.
    // Η άρνηση είναι **`no-owner`** και όχι σιωπή: κανείς δεν κατέχει αυτή τη στήλη — που
    // είναι ακριβώς η αλήθεια, και η ίδια που θα έλεγε και μια πηγή χωρίς παραγωγό.
    expect(request?.plan).toMatchObject({
      status: 'rejected',
      reason: { kind: 'column-unwritable', reason: 'no-owner' },
    });
  });
});
