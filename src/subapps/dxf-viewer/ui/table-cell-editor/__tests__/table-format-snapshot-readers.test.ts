/**
 * 🔴 ADR-739 §55 — **οι τρεις αναγνώσεις που έλειπαν**: τυπογραφία, στοίχιση, αριθμητική μορφή.
 *
 * Τα τρία τμήματα υπήρχαν στο mini toolbar ως **προαιρετικά** props και κανείς δεν τα
 * τροφοδοτούσε — δηλαδή δεν αποδίδονταν καθόλου. Το ερώτημα εδώ δεν είναι «ζωγραφίζονται;»
 * (το απαντά το `table-format-toolbar.test.tsx`) αλλά **τι λένε**, και ειδικότερα τα δύο που
 * κανένα άλλο test δεν μπορεί να ρωτήσει:
 *
 *  1. **Η μορφή αριθμού ΔΕΝ είναι πεδίο στυλ.** Κληρονομείται με δική της αλυσίδα
 *     (κελί→γραμμή→στήλη→`valueType`), οπότε πρέπει να διαβαστεί με βρόχο πάνω στα κελιά. Ένα
 *     `resolveTableFormatState(…, 'numberFormat')` δεν μεταγλωττίζεται καν — αλλά ένα «σχεδόν»
 *     σωστό διάβασμα (μόνο οι ρητές παρακάμψεις) θα άφηνε **γκρίζο το «%»** σε στήλη ποσοστών.
 *  2. **Δύο ίσες μορφές γραμμένες σε δύο κελιά είναι δύο ΔΙΑΦΟΡΕΤΙΚΑ αντικείμενα.** Με
 *     σύγκριση ταυτότητας, ολόκληρη στήλη ρητά ποσοστιαία διαβάζεται **ανάμεικτη**.
 *
 * @see ui/table-cell-editor/table-format-snapshot.ts
 */

import {
  EMPTY_TABLE_FONT_STATE,
  EMPTY_TABLE_NUMBER_FORMAT_STATE,
  resolveTableAlignState,
  resolveTableFontState,
  resolveTableNumberFormatState,
  type FormatTarget,
} from '../table-format-snapshot';
import {
  hierarchicalTableStyle,
  FIXTURE_DATA_TEXT_MM,
  FIXTURE_HEADER_TEXT_MM,
} from '../../../bim/table/__tests__/hierarchical-table-style-fixture';
import type { TableFormatScope } from '../../../bim/table/table-format-scope';
import type { TableCellEntry, PersistedTableModel } from '../../../types/table';
import type { TableCellFormat } from '../../../types/table-cell-format';

const STYLE = hierarchicalTableStyle();

/**
 * Δύο στήλες με **διαφορετική σημασιολογική βάση** (`text` / `count`): είναι η μόνη διάταξη
 * που ξεχωρίζει «διάβασε τη σημασιολογία της στήλης» από «διάβασε μόνο τις παρακάμψεις».
 */
function model(cells: readonly TableCellEntry[] = []): PersistedTableModel {
  return {
    columns: [
      { id: 'c0', sizing: { kind: 'hug' }, valueType: 'text', align: 'left' },
      { id: 'c1', sizing: { kind: 'hug' }, valueType: 'count', align: 'left' },
    ],
    rows: [
      { id: 'r0', rowClass: 'header' },
      { id: 'r1', rowClass: 'data' },
      { id: 'r2', rowClass: 'data' },
    ],
    cells: [...cells],
    merges: [],
  };
}

const range = (
  firstRow: number, lastRow: number, firstCol: number, lastCol: number,
): TableFormatScope => ({ kind: 'range', bounds: { firstRow, lastRow, firstCol, lastCol } });

function target(m: PersistedTableModel, scope: TableFormatScope): FormatTarget {
  return { entityId: 'entity-1', model: m, style: STYLE, scope, layerColors: [] };
}

const numberCell = (
  rowId: string, colId: string, numberFormat: TableCellFormat,
): TableCellEntry => [rowId, colId, { kind: 'text', value: '1', styleOverride: { numberFormat } }];

// ──────────────────────────────────────────────────────────────────────────────
// Τυπογραφία — γραμματοσειρά + μέγεθος
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveTableFontState — «ποια τιμή», όχι «πατημένο ή όχι»', () => {
  it('χωρίς στόχο ⇒ σβηστά ΚΑΙ ΟΧΙ ανάμεικτα — ο στόχος που δεν υπάρχει δεν διαφωνεί', () => {
    expect(resolveTableFontState(null)).toEqual(EMPTY_TABLE_FONT_STATE);
    expect(resolveTableFontState(null).family.mixed).toBe(false);
  });

  it('ομοιόμορφα κελιά δεδομένων ⇒ το μέγεθος της κλάσης, χωρίς «ανάμεικτο»', () => {
    const state = resolveTableFontState(target(model(), range(1, 2, 0, 0)));
    expect(state.size).toEqual({ current: FIXTURE_DATA_TEXT_MM, mixed: false });
    // Καμία ρητή γραμματοσειρά πουθενά ⇒ «Αυτόματη», όχι ανάμεικτο.
    expect(state.family).toEqual({ current: undefined, mixed: false });
  });

  it('🔴 κεφαλίδα + δεδομένα ⇒ ΑΝΑΜΕΙΚΤΟ μέγεθος με `current: undefined`', () => {
    // Το combobox δείχνει **κενό** (Excel), ποτέ την τιμή του πρώτου κελιού — που θα ήταν
    // σιωπηλή δήλωση ότι ισχύει παντού.
    const state = resolveTableFontState(target(model(), range(0, 2, 0, 0)));
    expect(state.size).toEqual({ current: undefined, mixed: true });
    expect(FIXTURE_HEADER_TEXT_MM).not.toBe(FIXTURE_DATA_TEXT_MM);
  });

  it('ρητή γραμματοσειρά σε στήλη ⇒ το όνομα, από την ίδια επίλυση με τον ζωγράφο', () => {
    const m = model();
    const withFont: PersistedTableModel = {
      ...m,
      columns: [{ ...m.columns[0], styleOverride: { fontFamily: 'Arial' } }, m.columns[1]],
    };
    expect(resolveTableFontState(target(withFont, range(1, 2, 0, 0))).family)
      .toEqual({ current: 'Arial', mixed: false });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Στοίχιση
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveTableAlignState — `null` σημαίνει «καμία ΜΙΑ απάντηση»', () => {
  it('ομοιόμορφα κελιά δεδομένων ⇒ η στοίχιση της κλάσης', () => {
    expect(resolveTableAlignState(target(model(), range(1, 2, 0, 0)))).toBe('ML');
  });

  it('🔴 κεφαλίδα (MC) + δεδομένα (ML) ⇒ `null`, ώστε καμία επιλογή να μην τσεκαριστεί', () => {
    expect(resolveTableAlignState(target(model(), range(0, 2, 0, 0)))).toBeNull();
  });

  it('χωρίς στόχο ⇒ `null` — ίδια συμπεριφορά επιφάνειας με το ανάμεικτο, δηλωμένη ρητά', () => {
    expect(resolveTableAlignState(null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Αριθμητική μορφή — η ΜΟΝΗ που δεν περνά από το `resolveTableFormatState`
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveTableNumberFormatState — η αλυσίδα του ADR-760, όχι το στυλ', () => {
  it('χωρίς στόχο ⇒ κανένα κουμπί πατημένο, τίποτα ρητό', () => {
    expect(resolveTableNumberFormatState(null)).toEqual(EMPTY_TABLE_NUMBER_FORMAT_STATE);
  });

  it('🔴 ΚΑΜΙΑ παράκαμψη ⇒ η ΣΗΜΑΣΙΟΛΟΓΙΚΗ βάση της στήλης, με `explicit: false`', () => {
    // Στήλη `count` ⇒ `whole`. Ένα διάβασμα που κοιτούσε μόνο τις παρακάμψεις θα επέστρεφε
    // `general` — δηλαδή το κουμπί των χιλιάδων θα ήταν σβηστό ενώ ο χρήστης βλέπει ακέραιους
    // με διαχωριστικό.
    const state = resolveTableNumberFormatState(target(model(), range(1, 2, 1, 1)));
    expect(state.current).toEqual({ kind: 'whole' });
    expect(state.explicit).toBe(false);
  });

  it('ρητή μορφή σε ΟΛΑ τα κελιά ⇒ `explicit: true`', () => {
    const percent: TableCellFormat = { kind: 'percent', decimals: 0 };
    const m = model([numberCell('r1', 'c0', percent), numberCell('r2', 'c0', percent)]);
    expect(resolveTableNumberFormatState(target(m, range(1, 2, 0, 0))))
      .toEqual({ current: percent, explicit: true });
  });

  it('🔴 ΙΣΕΣ μορφές σε ΔΥΟ ΑΝΤΙΚΕΙΜΕΝΑ ⇒ ΔΕΝ είναι ανάμεικτο (η παγίδα του `===`)', () => {
    // Κάθε κελί κρατά **δικό του** αντικείμενο μορφής. Με σύγκριση ταυτότητας αναφοράς, μια
    // ολόκληρη στήλη ρητά ποσοστιαία θα διαβαζόταν ανάμεικτη και το «%» θα έσβηνε.
    const m = model([
      numberCell('r1', 'c0', { kind: 'percent', decimals: 0 }),
      numberCell('r2', 'c0', { kind: 'percent', decimals: 0 }),
    ]);
    const state = resolveTableNumberFormatState(target(m, range(1, 2, 0, 0)));
    expect(state.current).toEqual({ kind: 'percent', decimals: 0 });
    expect(state.explicit).toBe(true);
  });

  it('πραγματικά διαφορετικές μορφές ⇒ `current: null`, `explicit: false`', () => {
    const m = model([
      numberCell('r1', 'c0', { kind: 'percent', decimals: 0 }),
      numberCell('r2', 'c0', { kind: 'currency', decimals: 2 }),
    ]);
    expect(resolveTableNumberFormatState(target(m, range(1, 2, 0, 0))))
      .toEqual({ current: null, explicit: false });
  });

  it('ένα κελί ρητό, το άλλο κληρονομεί ΤΗΝ ΙΔΙΑ μορφή ⇒ κοινή τιμή αλλά ΟΧΙ ρητό', () => {
    // Η κουκκίδα «ρητό» απαντά «ποιος το είπε», όχι «τι φαίνεται»: ένα κελί που κληρονομεί
    // αρκεί για να σβήσει, ακριβώς όπως στο `overridden` της περιοχής.
    const m = model([numberCell('r1', 'c1', { kind: 'whole' })]);
    const state = resolveTableNumberFormatState(target(m, range(1, 2, 1, 1)));
    expect(state.current).toEqual({ kind: 'whole' });
    expect(state.explicit).toBe(false);
  });

  it('🔴 στόχος ΑΞΟΝΑΣ ⇒ μεταφράζεται σε ορθογώνιο και διαβάζει ΤΑ ΚΕΛΙΑ της στήλης', () => {
    // Χωρίς τη μετάφραση, το μενού των ζωνών δείκτη θα έδειχνε πάντα «καμία μορφή».
    const m = model();
    const axis: TableFormatScope = { kind: 'axis', axis: 'column', ids: ['c1'] };
    expect(resolveTableNumberFormatState(target(m, axis)).current).toEqual({ kind: 'whole' });
  });

  it('μπαγιάτικος άξονας (undo έσβησε τη στήλη) ⇒ EMPTY, ποτέ μαντεψιά', () => {
    const axis: TableFormatScope = { kind: 'axis', axis: 'column', ids: [] };
    expect(resolveTableNumberFormatState(target(model(), axis)))
      .toEqual(EMPTY_TABLE_NUMBER_FORMAT_STATE);
  });
});
