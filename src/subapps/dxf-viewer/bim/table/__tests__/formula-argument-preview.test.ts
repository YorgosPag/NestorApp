/**
 * 🔴 ADR-763 Φ2.3 — **Η ΖΩΝΤΑΝΗ ΑΠΟΤΙΜΗΣΗ ΕΙΝΑΙ Η ΑΠΟΔΕΙΞΗ ΤΗΣ ΥΠΟΔΕΙΞΗΣ.**
 *
 * Η Φ2.4 κάνει το κλικ να γράψει `A1`. Μόνο του, το `A1` δεν λέει αν ο χρήστης έδειξε το κελί
 * που ήθελε — το `= 20` δίπλα του το λέει. Γι' αυτό οι δύο φάσεις δοκιμάζονται μαζί, και γι'
 * αυτό η **πρώτη** ομάδα εδώ είναι το κύκλωμα «κλικ ⇒ τιμή».
 *
 * @see bim/table/formula/catalog/formula-argument-preview.ts
 */

import { functionArgumentsPreview } from '../formula/catalog/formula-argument-preview';
import { createTableModel } from '../table-model-helpers';
import { drawingFormulaGrammar } from '../formula/table-formula-grammar';
import type { TableCellEntry, TableColumn, TableModel, TableRow } from '../../../types/table';
import { bookOf } from './formula-book-fixture';

const COLUMNS: TableColumn[] = ['c1', 'c2'].map((id) => ({
  id,
  sizing: { kind: 'fixed', widthMm: 20 },
  valueType: 'number',
  align: 'right',
}));

const ROWS: TableRow[] = ['r1', 'r2', 'r3'].map((id) => ({ id, rowClass: 'data', heightMm: 8 }));

/** `A1=20`, `A2=30`, `A3` κενό, `B1` κείμενο. */
const CELLS: readonly TableCellEntry[] = [
  ['r1', 'c1', { kind: 'text', value: '20' }],
  ['r2', 'c1', { kind: 'text', value: '30' }],
  ['r1', 'c2', { kind: 'text', value: 'Δοκός Δ1' }],
];

const MODEL: TableModel = createTableModel({ columns: COLUMNS, rows: ROWS, cells: CELLS });
const SEPARATOR = drawingFormulaGrammar().argumentSeparator;

function previewOf(
  functionName: string,
  values: readonly string[],
  frame = { prefix: `=${functionName}(`, suffix: ')' },
  model: TableModel | null = MODEL,
) {
  // 🔴 ADR-833 Φάση 7 — η προεπισκόπηση αποτιμά με **βιβλίο**, όπως και η δέσμευση.
  const book = model === null ? null : bookOf(model);
  return functionArgumentsPreview({ book, functionName, frame, values, separator: SEPARATOR });
}

describe('ΤΟ ΚΥΚΛΩΜΑ — δείχνω κελί, βλέπω τιμή', () => {
  it('🔴 όρισμα «A1» ⇒ «= 20» δίπλα του', () => {
    expect(previewOf('SUM', ['A1']).perArgument[0]).toBe('20');
  });

  it('η κλήση αποτιμάται ολόκληρη: SUM(A1;A2) ⇒ 50', () => {
    expect(previewOf('SUM', ['A1', 'A2']).call).toBe('50');
  });

  it('εύρος: SUM(A1:A2) ⇒ 50, και το ίδιο το όρισμα δεν είναι τιμή', () => {
    const preview = previewOf('SUM', ['A1:A2']);
    expect(preview.call).toBe('50');
    // Ένα εύρος **δεν είναι τιμή** (`=A1:A2` ⇒ `#VALUE!`) — μόνο μια συνάρτηση το δέχεται.
    // Καταγράφεται ως συμπεριφορά: ο χρήστης βλέπει τον κωδικό, όχι σιωπή.
    expect(preview.perArgument[0]).toBe('#VALUE!');
  });
});

describe('ΤΑ ΤΡΙΑ ΚΕΙΜΕΝΑ — και γιατί η κλήση ΔΕΝ είναι το αποτέλεσμα', () => {
  it('απλή περίπτωση: κλήση και αποτέλεσμα ταυτίζονται', () => {
    const preview = previewOf('SUM', ['A1', 'A2']);
    expect(preview.call).toBe('50');
    expect(preview.result).toBe('50');
  });

  it('🔴 ΕΜΦΥΤΕΥΣΗ: η κλήση λέει 50, το κελί θα γράψει 51', () => {
    // Το «πριν» και το «μετά» της κλήσης ζουν στο πλαίσιο — δες `FormulaCallFrame`.
    const preview = previewOf('SUM', ['A1', 'A2'], { prefix: '=SUM(', suffix: ')+1' });
    expect(preview.call).toBe('50');
    expect(preview.result).toBe('51');
  });
});

describe('Η ΓΡΑΦΗ ΤΩΝ ΤΙΜΩΝ — Excel parity', () => {
  it('κείμενο σε εισαγωγικά, όπως στον διάλογο του Excel', () => {
    expect(previewOf('CONCATENATE', ['B1']).perArgument[0]).toBe('"Δοκός Δ1"');
  });

  it('κενό κελί ⇒ 0 (ο κανόνας της ρίζας), όχι κενό αλφαριθμητικό', () => {
    expect(previewOf('SUM', ['A3']).perArgument[0]).toBe('0');
  });

  it('λογική τιμή κεφαλαία', () => {
    expect(previewOf('IF', ['A1>10', 'TRUE', 'FALSE']).call).toBe('TRUE');
  });

  it('κωδικός σφάλματος αυτούσιος, ΧΩΡΙΣ εισαγωγικά', () => {
    expect(previewOf('SUM', ['1/0']).perArgument[0]).toBe('#DIV/0!');
  });
});

describe('ΤΑ ΚΕΝΑ — «δεν ρωτήθηκε», ποτέ ψεύτικη απάντηση', () => {
  it('κενό όρισμα ⇒ κενό κείμενο (τα δεξιά δείχνουν το ΕΙΔΟΣ)', () => {
    expect(previewOf('SUM', ['']).perArgument[0]).toBe('');
  });

  it('μισογραμμένος τύπος ⇒ κενό, όχι σφάλμα', () => {
    expect(previewOf('SUM', ['A1+']).perArgument[0]).toBe('');
  });

  it('🔑 ίδιο μήκος με τις τιμές — ΠΑΝΤΑ, και για τα κενά που κόβονται', () => {
    // Το τελευταίο κενό **δεν** γράφεται στο κελί (δες `buildFormulaCallDraft`), αλλά η σειρά
    // του υπάρχει στην οθόνη. Κοντύτερος πίνακας θα έβαζε την τιμή δίπλα σε ΑΛΛΟ όνομα.
    expect(previewOf('SUM', ['A1', '', 'A2', '']).perArgument).toHaveLength(4);
  });

  it('χωρίς μοντέλο (undo έσβησε τον πίνακα) ⇒ όλα κενά, καμία κατάρρευση', () => {
    const preview = previewOf('SUM', ['A1', 'A2'], { prefix: '=SUM(', suffix: ')' }, null);
    expect(preview.perArgument).toEqual(['', '']);
    expect(preview.call).toBe('');
    expect(preview.result).toBe('');
  });
});

describe('Ο ΔΙΑΧΩΡΙΣΤΗΣ — της γραμματικής, ποτέ σταθερός', () => {
  it('η κλήση χτίζεται με τον ΙΔΙΟ διαχωριστή που γράφεται στο κελί', () => {
    // Αν εδώ γραφόταν σταθερό `;` ή `,`, η αποτίμηση θα σιωπούσε σε μισό κόσμο locale.
    expect(previewOf('SUM', ['A1', 'A2'], { prefix: '=SUM(', suffix: ')' }).call).toBe('50');
    expect(SEPARATOR === ';' || SEPARATOR === ',').toBe(true);
  });

  /**
   * ✅ **ΕΚΛΕΙΣΕ ΜΕ ΤΟ ADR-765.** Το εύρημα της 06/08 έλεγε: το `formula-call-text.ts` γράφει
   * ρητά ότι «το ενδιάμεσο κενό είναι **επιλογή**: το `=IF(A1;;B2)` σημαίνει *τίποτα αν
   * αληθές*», η **σύνθεση** το τηρούσε ακέραιο, και ο **αναλυτής** το απέρριπτε — άρα το
   * κείμενο που ο διάλογος έγραφε σωστά κατέληγε **κείμενο στο κελί**, όχι τύπος.
   *
   * 🔑 Το `''` ήταν **διφορούμενος** μάρτυρας: σήμαινε και «ο αναλυτής αρνήθηκε» και «δεν έχω
   * τι να σου πω ακόμη». Τώρα η απάντηση είναι **`0`** και αποδεικνύει τρία πράγματα μαζί: το
   * κενό αναλύθηκε, προσγειώθηκε στη **δεύτερη** θέση, και αποτιμήθηκε ως η κενή τιμή του
   * Excel (`=IF(αληθές;;99)` ⇒ `0`). Το `A1>10` είναι **αληθές** σε αυτό το μοντέλο — δες την
   * επόμενη γραμμή, όπου το ίδιο σχήμα με `'1'` δίνει `1`.
   */
  it('✅ κενό ΕΝΔΙΑΜΕΣΟ όρισμα ⇒ αναλύεται, και δίνει την κενή τιμή `0` (ADR-765)', () => {
    expect(previewOf('IF', ['A1>10', '', '99']).call).toBe('0');
  });

  it('🔑 το κενό ΔΕΝ στοιβάζεται αριστερά — η σύνθεση κρατά τη θέση του', () => {
    // Αν στοιβαζόταν, το `99` θα γινόταν *τιμή αν αληθές* και ο τύπος θα άλλαζε **σιωπηλά**
    // σημασία. Μετριέται στην τιμή που **παράγεται**: με στοίβαγμα το αποτέλεσμα θα ήταν `99`.
    // 🔴 Ο μάρτυρας έγινε **αυστηρότερος** με το ADR-765: πριν, το αναμενόμενο ήταν `''` —
    // τιμή που θα έβγαινε και αν ο αναλυτής είχε απορρίψει ολόκληρη την κλήση, δηλαδή ο
    // έλεγχος «δεν στοιβάχτηκε» περνούσε και χωρίς να έχει αναλυθεί τίποτα.
    expect(previewOf('IF', ['A1>10', '', '99']).result).toBe('0');
    expect(previewOf('IF', ['A1>10', '1', '99']).call).toBe('1');
  });
});
