/**
 * ADR-769 Δ2 — **η άγκυρα των δύο κατευθύνσεων.**
 *
 * 🔴 Ο τύπος `Record<CoordinateColumnKey, …>` απαιτεί απάντηση για κάθε στήλη **σε χρόνο
 * μεταγλώττισης** — αλλά ο πράκτορας δεν τρέχει `tsc` (N.17) και το subapp είναι **εκτός** του
 * root `tsconfig`, οπότε μόνο το CI το βλέπει (CHECK 3.29). Άρα η εγγύηση χρειάζεται **δεύτερο
 * σκέλος που εκτελείται**: belt-and-suspenders (N.7.2 #4).
 *
 * 🔑 Και το κρίσιμο: ο εμπρός χάρτης επαληθεύεται **εκτελώντας** τον πραγματικό
 * `buildCoordinateTable`, όχι διαβάζοντάς τον. Ένα test που επαναλάμβανε τη χαρτογράφηση θα
 * ήταν σύμφωνο με τον εαυτό του και τυφλό στην απόκλιση.
 */

import {
  buildCoordinateTable,
  COORDINATE_COLUMNS,
  COORDINATE_WRITE_BACK,
} from '../survey-tables';
import { planTableWriteBack } from '../../../../bim/table/write-back/table-write-back-plan';
import type { TableCell } from '../../../../types/table';
import { moveSurveyPoint, surveyPointDeltaForField } from '../../topo-survey-point-resolve';
import type { TopoPoint } from '../../topo-types';

/** Τιμές **διακριτές μεταξύ τους** — ώστε μια εναλλαγή x↔y να μη μπορεί να περάσει. */
const POINT: TopoPoint = { x: 391_698_400, y: 4_204_500_000, z: 123_456, code: 'ΣΤ3' };

describe('ADR-769 Δ2 — ο εμπρός και ο αντίστροφος χάρτης δεν μπορούν να αποκλίνουν', () => {
  it('κάθε στήλη του πίνακα έχει απόφαση γραψιμότητας — καμία σιωπηλή παράλειψη', () => {
    for (const column of COORDINATE_COLUMNS) {
      expect(COORDINATE_WRITE_BACK[column.key]).toBeDefined();
    }
  });

  it('καμία απόφαση δεν δείχνει σε στήλη που δεν υπάρχει — κανένα ορφανό', () => {
    const columnKeys = new Set<string>(COORDINATE_COLUMNS.map((c) => c.key));
    for (const key of Object.keys(COORDINATE_WRITE_BACK)) {
      expect(columnKeys.has(key)).toBe(true);
    }
  });

  it('τα δύο σύνολα έχουν ΙΔΙΟ πλήθος — ούτε λείπει, ούτε περισσεύει', () => {
    expect(Object.keys(COORDINATE_WRITE_BACK)).toHaveLength(COORDINATE_COLUMNS.length);
  });
});

describe('ADR-769 Δ2 — κάθε γράψιμη στήλη δείχνει στο ΣΩΣΤΟ πεδίο του ιδιοκτήτη', () => {
  /** 🔑 Ο ΠΡΑΓΜΑΤΙΚΟΣ παραγωγός εκτελείται — δεν αντιγράφεται η λογική του. */
  const row = buildCoordinateTable([POINT]).rows[0]!.cells;

  it.each([
    ['x', 'x'],
    ['y', 'y'],
  ] as const)(
    'η στήλη «%s» γεμίζει από το TopoPoint.%s — άρα εκεί πρέπει να γράφει',
    (columnKey, field) => {
      const decision = COORDINATE_WRITE_BACK[columnKey];
      expect(decision.kind).toBe('writable');
      if (decision.kind !== 'writable') return;

      // Ο εμπρός χάρτης: το κελί ΕΙΝΑΙ η τιμή αυτού του πεδίου (εκτελεσμένο, όχι υποτιθέμενο).
      expect(row[columnKey]).toBe(POINT[field]);
      // Ο αντίστροφος: η απόφαση ονομάζει ΤΟ ΙΔΙΟ πεδίο.
      expect(decision.field).toBe(field);
    },
  );

  it('🔴 ο αύξων αριθμός ΔΕΝ αντιστοιχεί σε πεδίο του σημείου — γι΄ αυτό είναι ordinal', () => {
    expect(row.index).toBe(1);
    expect(Object.values(POINT)).not.toContain(row.index);
    expect(COORDINATE_WRITE_BACK.index).toEqual({ kind: 'unwritable', reason: 'ordinal' });
  });

  it('🔴 z και code ΕΙΝΑΙ πραγματικές παράμετροι — δηλώνονται no-owner, ΟΧΙ computed', () => {
    // Το ψέμα που αποφεύγουμε: αν ήταν «computed», ο επόμενος αναγνώστης δεν θα ήξερε ποτέ ότι
    // λείπει μόνο ο ιδιοκτήτης. Ο εμπρός χάρτης αποδεικνύει ότι είναι πεδία του σημείου.
    expect(row.z).toBe(POINT.z);
    expect(row.code).toBe(POINT.code);
    expect(COORDINATE_WRITE_BACK.z).toEqual({ kind: 'unwritable', reason: 'no-owner' });
    expect(COORDINATE_WRITE_BACK.code).toEqual({ kind: 'unwritable', reason: 'no-owner' });
  });
});

describe('ADR-769 Δ1 — ο κύκλος κλείνει: κελί → πλάνο → delta → ΤΟ ΣΗΜΕΙΟ ΜΕΤΑΚΙΝΕΙΤΑΙ', () => {
  /**
   * 🔑 Το κανονικό παράδειγμα του ADR-766 Α2, εκτελεσμένο άκρη σε άκρη με τις **πραγματικές**
   * συναρτήσεις: «ο χρήστης γράφει 391.698,5 στη γραμμή 1 → μετακινήθηκε η κορυφή 1».
   */
  function writeAndMove(field: 'x' | 'y', displayMetres: number): TopoPoint {
    const points: readonly TopoPoint[] = [POINT];
    const row = buildCoordinateTable(points).rows[0]!.cells;

    const plan = planTableWriteBack({
      column: COORDINATE_WRITE_BACK[field],
      sourceKey: field,
      valueType: 'dimension-mm-to-m',
      cell: { value: row[field], bound: { sourceValue: row[field] } } as TableCell,
      nextDisplayValue: displayMetres,
      rowBasis: [{ sourceKey: 'code', sourceValue: row.code }],
      liveRow: row,
    });
    expect(plan.status).toBe('accepted');
    if (plan.status !== 'accepted') throw new Error('unreachable');

    const delta = surveyPointDeltaForField(points, 0, plan.field, plan.storeValue);
    expect(delta).not.toBeNull();
    return moveSurveyPoint(points, 0, delta!)[0]!;
  }

  it('γραφή στο Χ προσγειώνει το σημείο ΑΚΡΙΒΩΣ στην τιμή που πληκτρολογήθηκε', () => {
    const moved = writeAndMove('x', 391_698.5);
    expect(moved.x).toBe(391_698_500);
  });

  it('🔴 ο άξονας που ΔΕΝ γράφτηκε μένει ανέγγιχτος — και το υψόμετρο επίσης', () => {
    const moved = writeAndMove('x', 391_698.5);
    expect(moved.y).toBe(POINT.y);
    expect(moved.z).toBe(POINT.z);
    expect(moved.code).toBe(POINT.code);
  });

  it('γραφή στο Υ κινεί ΜΟΝΟ το Υ — καμία εναλλαγή αξόνων', () => {
    const moved = writeAndMove('y', 4_204_500.25);
    expect(moved.y).toBe(4_204_500_250);
    expect(moved.x).toBe(POINT.x);
  });

  it('δείκτης εκτός ορίων ⇒ ρητό null, ποτέ σιωπηλό μηδενικό delta', () => {
    expect(surveyPointDeltaForField([POINT], 7, 'x', 1)).toBeNull();
  });
});

describe('ADR-769 — ο πίνακας συντεταγμένων δεν κατασκευάζει νούμερα (ADR-720)', () => {
  it('σημείο μετρημένο μόνο σε κάτοψη γράφει ΚΕΝΟ στο Ζ, ποτέ 0', () => {
    const planOnly: TopoPoint = { x: 1000, y: 2000 };
    expect(buildCoordinateTable([planOnly]).rows[0]!.cells.z).toBeNull();
  });
});
