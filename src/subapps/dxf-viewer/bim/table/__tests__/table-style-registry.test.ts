/**
 * ADR-739 Φάση Α — unit tests του μητρώου `TableStyle`.
 *
 * Το ίδιο συμβόλαιο με τα δύο υπάρχοντα μητρώα στυλ (ADR-570 line styles, ADR-362
 * DIMSTYLE): built-in read-only, σταθερό στιγμιότυπο για `useSyncExternalStore`,
 * καθαρή υποχώρηση όταν σβήνεται το ενεργό στυλ.
 */

import {
  TableStyleRegistry,
  __setTableStyleRegistryForTests,
  getTableStyleRegistry,
  getTableStyleSnapshot,
} from '../table-style-registry';
import {
  BUILTIN_TABLE_STYLES,
  BUILTIN_TABLE_STYLE_IDS,
  DEFAULT_ACTIVE_TABLE_STYLE_ID,
  DETAIL_SHEET_ROW_HEIGHT_MM,
  DETAIL_SHEET_RULE_HEX,
  DETAIL_SHEET_RULE_WIDTH_MM,
  DETAIL_SHEET_TEXT_HEIGHT_MM,
  DETAIL_SHEET_TEXT_HEX,
} from '../table-style-presets';
import { AUTOMATIC_TABLE_INK, isAutomaticTableInk } from '../table-ink';
import { parseHex } from '../../../config/color-math';

describe('TableStyleRegistry — σπορά built-in', () => {
  let registry: TableStyleRegistry;
  beforeEach(() => {
    registry = new TableStyleRegistry();
  });

  it('σπέρνει και τα δύο built-in στυλ', () => {
    expect(registry.getAllStyles()).toHaveLength(BUILTIN_TABLE_STYLES.length);
    expect(BUILTIN_TABLE_STYLES).toHaveLength(2);
  });

  it('επιλύει κάθε built-in από το σταθερό του slug', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(registry.getStyle(style.id)).toEqual(style);
    }
  });

  it('ξεκινά με ενεργό το προεπιλεγμένο', () => {
    expect(registry.getActiveStyleId()).toBe(DEFAULT_ACTIVE_TABLE_STYLE_ID);
    expect(registry.getActiveStyle().id).toBe(DEFAULT_ACTIVE_TABLE_STYLE_ID);
  });

  it('τα ονόματα των built-in είναι i18n ΚΛΕΙΔΙΑ, ποτέ ωμό κείμενο (N.11)', () => {
    for (const style of BUILTIN_TABLE_STYLES) {
      expect(style.name).toMatch(/^ribbon\.commands\.tableStyleNames\./);
      expect(style.isBuiltIn).toBe(true);
    }
  });
});

describe('TableStyleRegistry — custom στυλ', () => {
  let registry: TableStyleRegistry;
  beforeEach(() => {
    registry = new TableStyleRegistry();
  });

  it('τα custom παίρνουν enterprise id με το πρόθεμα tblstyle (N.6)', () => {
    const source = registry.getStyle(BUILTIN_TABLE_STYLE_IDS.STANDARD)!;
    const created = registry.createCustomStyle({ ...source, name: 'Δικός μου' });
    expect(created.id).toMatch(/^tblstyle_/);
    expect(created.id).not.toBe(source.id);
    expect(created.isBuiltIn).toBe(false);
  });

  it('τα built-in είναι read-only: ούτε ενημέρωση ούτε διαγραφή', () => {
    const id = BUILTIN_TABLE_STYLE_IDS.STANDARD;
    expect(() => registry.updateCustomStyle(id, { defaultRowHeightMm: 99 })).toThrow(/BUILTIN_READONLY/);
    expect(() => registry.deleteCustomStyle(id)).toThrow(/BUILTIN_READONLY/);
  });

  it('η κλωνοποίηση παράγει ανεξάρτητο custom με νέο όνομα', () => {
    const clone = registry.duplicateStyle(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET, '  Αντίγραφο  ');
    expect(clone.name).toBe('Αντίγραφο');
    expect(clone.isBuiltIn).toBe(false);
    expect(clone.rowClasses).toEqual(registry.getStyle(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET)!.rowClasses);
  });

  it('η κλωνοποίηση με κενό όνομα απορρίπτεται', () => {
    expect(() => registry.duplicateStyle(BUILTIN_TABLE_STYLE_IDS.STANDARD, '   ')).toThrow(/NAME_REQUIRED/);
  });

  it('σβήνοντας το ενεργό custom, το ενεργό επιστρέφει στο προεπιλεγμένο', () => {
    const source = registry.getStyle(BUILTIN_TABLE_STYLE_IDS.STANDARD)!;
    const created = registry.createCustomStyle({ ...source, name: 'Προσωρινό' });
    registry.setActiveStyleId(created.id);
    registry.deleteCustomStyle(created.id);
    expect(registry.getActiveStyleId()).toBe(DEFAULT_ACTIVE_TABLE_STYLE_ID);
  });

  it('άγνωστο id δεν γίνεται ενεργό', () => {
    expect(() => registry.setActiveStyleId('tblstyle_ανύπαρκτο')).toThrow(/NOT_FOUND/);
  });
});

describe('TableStyleRegistry — στιγμιότυπο για useSyncExternalStore', () => {
  let registry: TableStyleRegistry;
  beforeEach(() => {
    registry = new TableStyleRegistry();
  });

  it('ίδια αναφορά ανάμεσα σε μεταβολές, νέα μετά από μεταβολή', () => {
    const first = registry.getSnapshot();
    expect(registry.getSnapshot()).toBe(first);
    registry.setActiveStyleId(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
    expect(registry.getSnapshot()).not.toBe(first);
  });

  it('ειδοποιεί τους συνδρομητές και σταματά μετά την αποχώρηση', () => {
    const listener = jest.fn();
    const unsubscribe = registry.subscribe(listener);
    registry.setActiveStyleId(BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    registry.setActiveStyleId(BUILTIN_TABLE_STYLE_IDS.STANDARD);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ο module-level accessor δείχνει στο singleton της συνεδρίας', () => {
    __setTableStyleRegistryForTests(null);
    expect(getTableStyleSnapshot()).toBe(getTableStyleRegistry().getSnapshot());
    __setTableStyleRegistryForTests(null);
  });
});

/**
 * 🔴 ADR-739 §38 — **ο αδελφός που έλειπε.**
 *
 * Μέχρι την 2026-08-04 **κανένα** test δεν κάρφωνε την τιμή του `standard`: το
 * `describe('preset «detailSheet» … αναλλοίωτες')` από κάτω δεν είχε ταίρι, και το
 * `STANDARD_TEXT_HEX` εμφανιζόταν σε **δύο** σημεία, αμφότερα μέσα στο ίδιο αρχείο πηγής.
 * Δηλαδή η προεπιλογή που βλέπει **κάθε** χρήστης σε **κάθε** νέο πίνακα ήταν η μόνη τιμή του
 * υποσυστήματος χωρίς δίχτυ — και μια σιωπηλή αλλαγή της δεν θα κοκκίνιζε τίποτα.
 */
describe('preset «standard» — το αυτόματο μελάνι, αναλλοίωτο', () => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD)!;

  it('και οι τρεις κλάσεις γράφουν με ΑΥΤΟΜΑΤΟ μελάνι — όχι με σταθερό hex', () => {
    for (const rowClass of ['title', 'header', 'data'] as const) {
      expect(style.rowClasses[rowClass].textColorHex).toBe(AUTOMATIC_TABLE_INK);
    }
  });

  it('🔴 το σεντινέλι ΔΕΝ είναι έγκυρο hex — αυτό το κάνει ασφαλές', () => {
    // Αν γινόταν ποτέ `#rrggbb`, θα έτρωγε μια πραγματική τιμή από το πεδίο **και** θα
    // περνούσε αθόρυβα από κάθε καταναλωτή που σήμερα το απορρίπτει ρητά.
    expect(parseHex(AUTOMATIC_TABLE_INK)).toBeNull();
    expect(isAutomaticTableInk(AUTOMATIC_TABLE_INK)).toBe(true);
  });

  it('🔴 ο πίνακας οπλισμών ΔΕΝ παρασύρθηκε — κρατά το ρητό του χρώμα', () => {
    // Ρητή εντολή Giorgio (04/08): το `detailSheet` δεν αγγίζεται. Το `DETAIL_SHEET_TEXT_HEX`
    // καταναλώνεται και **εκτός** του συστήματος στυλ (`detail-sheet-schedule-table.ts`), όπου
    // δεν υπάρχει διάταξη να επιλύσει σεντινέλι.
    const detail = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET)!;
    for (const rowClass of ['title', 'header', 'data'] as const) {
      expect(isAutomaticTableInk(detail.rowClasses[rowClass].textColorHex)).toBe(false);
    }
  });
});

describe('preset «detailSheet» — οι τιμές του ADR-622, αναλλοίωτες', () => {
  const style = BUILTIN_TABLE_STYLES.find((s) => s.id === BUILTIN_TABLE_STYLE_IDS.DETAIL_SHEET)!;

  it('κρατά ακριβώς τις σταθερές του detail-sheet-schedule-table.ts', () => {
    expect(style.defaultRowHeightMm).toBe(DETAIL_SHEET_ROW_HEIGHT_MM);
    expect(DETAIL_SHEET_ROW_HEIGHT_MM).toBe(7.5);
    expect(DETAIL_SHEET_TEXT_HEIGHT_MM).toBe(2.6);
    expect(DETAIL_SHEET_TEXT_HEX).toBe('#222222');
    expect(DETAIL_SHEET_RULE_HEX).toBe('#999999');
    expect(DETAIL_SHEET_RULE_WIDTH_MM).toBe(0.15);
  });

  it('και οι τρεις κλάσεις γράφουν με το ίδιο ύψος και χρώμα', () => {
    for (const rowClass of ['title', 'header', 'data'] as const) {
      expect(style.rowClasses[rowClass].textHeightMm).toBe(DETAIL_SHEET_TEXT_HEIGHT_MM);
      expect(style.rowClasses[rowClass].textColorHex).toBe(DETAIL_SHEET_TEXT_HEX);
    }
  });

  it('η ΜΟΝΗ ορατή ακμή είναι η γραμμή κάτω από την κεφαλίδα', () => {
    const visible: string[] = [];
    for (const rowClass of ['title', 'header', 'data'] as const) {
      const borders = style.rowClasses[rowClass].borders;
      for (const [edge, spec] of Object.entries(borders)) {
        if (spec.visible) visible.push(`${rowClass}.${edge}`);
      }
    }
    expect(visible).toEqual(['header.bottom']);
  });
});
