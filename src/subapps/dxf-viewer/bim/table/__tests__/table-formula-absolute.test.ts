/**
 * 🔴 ADR-754 **Γ2** — **το `$`**, ως πίνακας περιπτώσεων.
 *
 * Δύο πράγματα κλειδώνουν εδώ, και το δεύτερο είναι το επικίνδυνο:
 *
 * 1. **Τέσσερις** μορφές, όχι δύο. Οι **μεικτές** (`A$1`, `$A1`) είναι ολόκληρος ο λόγος που
 *    υπάρχει το `F4`, και μια υλοποίηση με μία σημαία θα τις έκανε αδύνατο να **εκφραστούν**.
 * 2. 🔴 **Ο ένας ιδιοκτήτης του `$` και ο ένας μεταφραστής διεύθυνσης δεν επιτρέπεται να
 *    αποκλίνουν.** Ο αποκολλητής έχει **δικό του** regex για το πού κάθεται ένα δολάριο, και
 *    εκείνο ξαναλέει το σχήμα «γράμματα + ψηφία» που ξέρει και ο μεταφραστής. Είναι συνειδητό
 *    (δες την κεφαλίδα του module) — και γι' αυτό ακριβώς **καρφώνεται**: αν κάποτε ο ένας
 *    δεχτεί κάτι που ο άλλος απορρίπτει, ο χρήστης θα γράφει διεύθυνση που «δεν υπάρχει».
 *
 * ⚠️ **Πλέγμα 5×5, όπως κάθε test αυτού του ADR** (§1.2).
 */

import { createTableModel } from '../table-model-helpers';
import type { TableColumn, TableModel, TableRow } from '../../../types/table';
import { parseTableCellReference } from '../table-cell-reference';
import {
  absoluteFlags,
  cycleAbsoluteReference,
  formatAbsoluteReference,
  resolveWrittenCellRef,
  rewriteAbsoluteReference,
  splitAbsoluteReference,
} from '../formula/table-formula-absolute';

const COLUMNS: TableColumn[] = ['c1', 'c2', 'c3', 'c4', 'c5'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
  id,
  rowClass: 'data',
  heightMm: 8,
}));

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: [] });

/** Συμπαγής μορφή: `'A1'` → `'A1 —'`, `'$A$1'` → `'A1 ΣΓ'` (Σ=στήλη, Γ=γραμμή κλειδωμένη). */
function shape(text: string): string | null {
  const split = splitAbsoluteReference(text);
  if (split === null) return null;
  const locks = `${split.absoluteCol ? 'Σ' : ''}${split.absoluteRow ? 'Γ' : ''}`;
  return `${split.plain} ${locks === '' ? '—' : locks}`;
}

describe('αποκόλληση — οι ΤΕΣΣΕΡΙΣ μορφές', () => {
  it.each([
    ['A1', 'A1 —', 'σχετική'],
    ['$A$1', 'A1 ΣΓ', 'και οι δύο άξονες κλειδωμένοι'],
    ['A$1', 'A1 Γ', '🔑 μεικτή: μόνο η ΓΡΑΜΜΗ — αυτό γράφει ένα τρέχον άθροισμα'],
    ['$A1', 'A1 Σ', '🔑 μεικτή: μόνο η ΣΤΗΛΗ — αυτό γράφει ένα ποσοστό σε μία στήλη'],
  ])('«%s» ⇒ %s (%s)', (text, expected) => {
    expect(shape(text)).toBe(expected);
  });

  it('πολυγράμματη στήλη και πολυψήφια γραμμή — «$AB$12»', () => {
    expect(splitAbsoluteReference('$AB$12')).toEqual({
      plain: 'AB12',
      letters: 'AB',
      digits: '12',
      absoluteCol: true,
      absoluteRow: true,
    });
  });

  /**
   * 🔑 Τα ψηφία επιστρέφονται ως **κείμενο**, όχι ως αριθμός. Με `parseInt` το `F4` πάνω σε
   * `$A$007` θα ξαναέγραφε `A7` — δηλαδή θα άλλαζε **σιωπηλά** ό,τι πληκτρολόγησε ο χρήστης,
   * σε μια πράξη που υποτίθεται ότι αγγίζει **μόνο** τα δολάρια.
   */
  it('🔴 τα αρχικά μηδενικά ΕΠΙΒΙΩΝΟΥΝ — το `F4` δεν ξαναγράφει τη διεύθυνση', () => {
    expect(rewriteAbsoluteReference('A007', absoluteFlags(true, true))).toBe('$A$007');
  });
});

describe('τι ΔΕΝ είναι διεύθυνση με δολάρια', () => {
  it.each([
    ['A1$', 'δολάριο στο τέλος — ΔΕΝ ισοδυναμεί με `$A1`'],
    ['$$A1', 'δύο δολάρια στη σειρά'],
    ['A$B1', 'δολάριο ανάμεσα σε γράμματα'],
    ['A1$2', 'δολάριο ανάμεσα σε ψηφία'],
    ['$', 'σκέτο δολάριο'],
    ['$A', 'χωρίς αριθμό γραμμής'],
    ['$1', 'χωρίς γράμμα στήλης'],
    ['SUM', 'όνομα συνάρτησης'],
  ])('«%s» ⇒ null (%s)', (text) => {
    expect(splitAbsoluteReference(text)).toBeNull();
  });
});

/**
 * 🔴 **ΤΟ ANCHOR ΤΗΣ ΑΠΟΚΛΙΣΗΣ.** Ο αποκολλητής και ο μεταφραστής είναι δύο αρχεία με δύο
 * regex. Εδώ επιβεβαιώνεται ότι **συμφωνούν στο σχήμα**: ό,τι ο πρώτος δέχεται ως διεύθυνση,
 * ο δεύτερος οφείλει να το αναγνωρίσει (ή να το απορρίψει **μόνο** για λόγο ορίων πλέγματος,
 * ποτέ μορφής).
 *
 * Αν αύριο ο μεταφραστής δεχτεί νέα μορφή (π.χ. `R1C1`) και αυτό το test μείνει πράσινο επειδή
 * κανείς δεν πρόσθεσε περίπτωση, το επόμενο test το πιάνει: ζητά ρητά ότι η **απόρριψη** του
 * αποκολλητή σε μορφή που ο μεταφραστής δέχεται είναι απαγορευμένη.
 */
describe('🔴 anchor — ο αποκολλητής και ο μεταφραστής ΔΕΝ αποκλίνουν', () => {
  /** Μορφές που ο **μεταφραστής** δέχεται ως διεύθυνση (ανεξάρτητα από όρια πλέγματος). */
  const SHAPES = ['A1', 'E5', 'b3', 'AB12', 'Z99', 'a10'] as const;
  /** Μορφές που ο μεταφραστής απορρίπτει — ο αποκολλητής οφείλει να συμφωνήσει. */
  const NON_SHAPES = ['SUM', 'A', '1', 'A1B', ''] as const;

  it.each(SHAPES)('«%s»: ό,τι δέχεται ο μεταφραστής, το δέχεται και ο αποκολλητής', (address) => {
    expect(splitAbsoluteReference(address)?.plain).toBe(address);
  });

  it.each(NON_SHAPES)('«%s»: ό,τι απορρίπτει ο μεταφραστής, το απορρίπτει και ο αποκολλητής', (text) => {
    expect(parseTableCellReference(MODEL, text)).toBeNull();
    expect(splitAbsoluteReference(text)).toBeNull();
  });

  /**
   * 🔑 Η **ουσία** του anchor: το δολάριο δεν επιτρέπεται να αλλάξει **ποιο** κελί ονομάζεται.
   * Και οι τέσσερις μορφές οφείλουν να δώσουν την ίδια ταυτότητα με τη σκέτη διεύθυνση.
   */
  it.each(['A1', 'E5', 'b3'])('«%s»: και οι 4 μορφές δίνουν την ταυτότητα της σκέτης', (address) => {
    const plain = parseTableCellReference(MODEL, address);
    for (const decorated of [address, `$${address}`, withRowMarker(address), `$${withRowMarker(address)}`]) {
      const ref = resolveWrittenCellRef(MODEL, decorated);
      expect({ rowId: ref?.rowId, colId: ref?.colId }).toEqual({
        rowId: plain?.rowId,
        colId: plain?.colId,
      });
    }
  });
});

/** `'A1'` → `'A$1'`: το δολάριο της γραμμής μπαίνει πριν από το πρώτο ψηφίο. */
function withRowMarker(address: string): string {
  const split = splitAbsoluteReference(address);
  return split === null ? address : `${split.letters}$${split.digits}`;
}

describe('δέσιμο — «ποιο κελί;» δεν το αλλάζει το δολάριο', () => {
  it.each(['A1', '$A1', 'A$1', '$A$1'])('η «%s» δείχνει στο ΙΔΙΟ κελί', (text) => {
    const ref = resolveWrittenCellRef(MODEL, text);
    expect(ref?.rowId).toBe('r1');
    expect(ref?.colId).toBe('c1');
  });

  it('οι σημαίες φτάνουν στον κόμβο — «$C4» κλειδώνει ΜΟΝΟ τη στήλη', () => {
    expect(resolveWrittenCellRef(MODEL, '$C4')).toEqual({
      rowId: 'r4',
      colId: 'c3',
      absoluteCol: true,
    });
  });

  /**
   * 🔑 Η σύμβαση «μόνο τα `true` γράφονται» δεν είναι στυλ: το `TableFormulaCellRef` ταξιδεύει
   * σε `JSON.stringify` (αποθήκευση σκηνής, `deepClone` για undo). Ένα `absoluteRow: false` σε
   * **κάθε** αναφορά **κάθε** τύπου θα ήταν καθαρό βάρος στο αρχείο, για πληροφορία που η
   * απουσία εκφράζει ήδη.
   */
  it('🔴 η σχετική αναφορά δεν αποκτά ΚΑΝΕΝΑ πεδίο σημαίας', () => {
    expect(Object.keys(resolveWrittenCellRef(MODEL, 'C4') ?? {}).sort()).toEqual(['colId', 'rowId']);
  });

  it('εκτός πλέγματος ⇒ null, ακόμη και κλειδωμένη — «$Z$99»', () => {
    expect(resolveWrittenCellRef(MODEL, '$Z$99')).toBeNull();
  });
});

/**
 * 🔑 **Η σειρά είναι του Excel, όχι δική μας.** Ένας μηχανικός που πατά `F4` δύο φορές
 * περιμένει `A$1` επειδή έτσι κάνει εδώ και τριάντα χρόνια· μια «πιο λογική» σειρά θα ήταν
 * απλώς **λάθος** για εκείνον.
 */
describe('ο κύκλος του F4 — A1 → $A$1 → A$1 → $A1 → A1', () => {
  it('τέσσερα πατήματα επιστρέφουν στην αρχή', () => {
    let flags = absoluteFlags(false, false);
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(formatAbsoluteReference('A', '1', flags));
      flags = cycleAbsoluteReference(flags);
    }
    expect(seen).toEqual(['A1', '$A$1', 'A$1', '$A1', 'A1']);
  });

  it('ο κύκλος είναι ΚΛΕΙΣΤΟΣ — καμία κατάσταση εκτός των τεσσάρων', () => {
    const forms = new Set<string>();
    let flags = absoluteFlags(false, false);
    for (let i = 0; i < 12; i++) {
      forms.add(formatAbsoluteReference('A', '1', flags));
      flags = cycleAbsoluteReference(flags);
    }
    expect(forms.size).toBe(4);
  });
});
