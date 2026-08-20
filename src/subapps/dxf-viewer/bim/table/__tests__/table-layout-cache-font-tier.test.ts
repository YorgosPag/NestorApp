/**
 * 🔴 ADR-786 §9 — **ΔΥΟ ΜΝΗΜΕΣ, ΜΙΑ ΜΟΝΟ ΑΚΥΡΩΝΟΤΑΝ** (το εύρημα του Giorgio, 2026-08-20).
 *
 * Η γραμματοσειρά CAD φορτώνεται **ασύγχρονα**. Ο μετρητής της διάταξης έχει βαθμίδες: με face
 * μετρά σε **em**, χωρίς face σε **ύψος κεφαλαίου** — τιμές που διαφέρουν κατά ~41%. Άρα ο
 * πρώτος υπολογισμός διάταξης συχνά γίνεται στη **λάθος** βαθμίδα.
 *
 * Μέχρι το ADR-786 αυτό ήταν ακίνδυνο, γιατί ο ζωγράφος ζωγράφιζε **πάντα** σε ύψος κεφαλαίου
 * και δεν ακολουθούσε καμία βαθμίδα. Από τη στιγμή που **ακολουθεί**, μια μπαγιάτικη διάταξη
 * βάζει τα βαμμένα τμήματα **29% πιο αριστερά**: το δεύτερο πέφτει **πάνω** στο πρώτο.
 *
 * ⚠️ **Είναι race — και γι' αυτό η ζωντανή επαλήθευση ΔΕΝ αρκούσε.** Με ζεστή HTTP cache η
 * γραμματοσειρά προλαβαίνει και η μνήμη γεννιέται σωστή· το ίδιο κλικ σε κρύα φόρτωση δείχνει
 * το ελάττωμα. Ένα «δεν το αναπαράγω στον browser» δεν είναι απόδειξη απουσίας — αυτή η
 * σουίτα ελέγχει και τις **δύο** καταστάσεις ρητά, ντετερμινιστικά.
 *
 * @see bim/table/table-entity-geometry.ts — `resolveTableLayout`, το κλειδί της μνήμης
 */

import { resolveTableLayout } from '../table-entity-geometry';
import { createTableModel } from '../table-model-helpers';
import { BUILTIN_TABLE_STYLES, BUILTIN_TABLE_STYLE_IDS } from '../table-style-presets';
import { bumpFontReady } from '../../../text-engine/fonts';
import { installStubFont } from '../../../text-engine/fonts/__tests__/_stub-font';
import type { TableStyle } from '../table-style';
import type { TableColumn, TableRow } from '../../../types/table';

const STYLE: TableStyle = BUILTIN_TABLE_STYLES.find(
  (s) => s.id === BUILTIN_TABLE_STYLE_IDS.STANDARD,
)!;
const SURFACE = '#1d283a';

const COLUMNS: TableColumn[] = [
  { id: 'c1', sizing: { kind: 'fixed', widthMm: 60 }, valueType: 'text', align: 'left' },
];
const ROWS: TableRow[] = [{ id: 'r1', rowClass: 'data' }];

/**
 * Νέο μοντέλο ανά κλήση (η μνήμη είναι `WeakMap` **ανά μοντέλο**), με τα δύο τελευταία
 * γράμματα βαμμένα — **ακριβώς** το «ΤΕ**ΣΤ**» του στιγμιότυπου.
 */
const modelOf = () =>
  createTableModel({
    columns: COLUMNS,
    rows: ROWS,
    cells: [['r1', 'c1', {
      kind: 'text', value: 'ΤΕΣΤ',
      runs: [{ start: 2, end: 4, style: { textColorHex: '#ff0000' } }],
    }]],
  });

/**
 * 🔴 Η μετατόπιση του **δεύτερου** τμήματος — ο ακριβής αριθμός που έβαζε το κόκκινο «Σ»
 * πάνω στο λευκό «Ε». Δεν διαλέγεται για ευκολία: είναι η τιμή που **αστόχησε**.
 */
const secondPieceOffsetOf = (layout: ReturnType<typeof resolveTableLayout>): number => {
  const run = layout.cells[0]?.texts[0];
  const spans = run?.spans;
  if (!spans || spans.length < 2) throw new Error('η διάταξη δεν παρήγαγε δύο τμήματα');
  return spans[1].offsetMm;
};

describe('🔴 ADR-786 §9 — η ΒΑΘΜΙΔΑ του μετρητή είναι είσοδος της διάταξης', () => {
  it('Μ1 — η μνήμη ΔΟΥΛΕΥΕΙ: ίδιες είσοδοι ⇒ η ίδια ακριβώς αναφορά', () => {
    // Ο παρονομαστής της επόμενης άγκυρας: αν η μνήμη δεν κρατούσε τίποτα, το «άλλαξε η
    // αναφορά» θα ήταν πράσινο χωρίς να αποδεικνύει απολύτως τίποτα.
    const model = modelOf();
    expect(resolveTableLayout(model, STYLE, SURFACE))
      .toBe(resolveTableLayout(model, STYLE, SURFACE));
  });

  it('🔴 Μ2 — γραμματοσειρά που προσγειώνεται ΜΕΤΑ τον πρώτο υπολογισμό ΞΑΝΑΜΕΤΡΑ', () => {
    const model = modelOf();

    // 1. Πρώτος υπολογισμός **χωρίς** face — η βαθμίδα CSS, δηλαδή ύψος κεφαλαίου.
    const before = resolveTableLayout(model, STYLE, SURFACE);
    const offsetBefore = secondPieceOffsetOf(before);

    // 2. Η γραμματοσειρά προσγειώνεται και σημαίνει ετοιμότητα — ό,τι ακριβώς κάνει το
    //    `preloadCadSubstituteFonts` στον ζωντανό καμβά.
    const restore = installStubFont(0.6, 'arial');
    try {
      bumpFontReady();

      // 3. Η διάταξη ΔΕΝ επιτρέπεται να έρθει από τη μνήμη: ο ζωγράφος θα ζωγραφίσει πλέον σε
      //    em, και μπαγιάτικες μετατοπίσεις σημαίνουν τμήματα το ένα πάνω στο άλλο.
      const after = resolveTableLayout(model, STYLE, SURFACE);
      expect(after).not.toBe(before);
      // Το «ΤΕ» μετριέται πλέον σε em ⇒ είναι ΠΛΑΤΥΤΕΡΟ ⇒ το «ΣΤ» οφείλει να πάει δεξιότερα.
      expect(secondPieceOffsetOf(after)).toBeGreaterThan(offsetBefore);

      // 4. Και από εκεί και πέρα ξανακρατιέται κανονικά — η διόρθωση δεν σκότωσε τη μνήμη.
      expect(resolveTableLayout(model, STYLE, SURFACE)).toBe(after);
    } finally {
      restore();
      bumpFontReady();
    }
  });
});
