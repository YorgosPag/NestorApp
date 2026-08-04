/**
 * 🔴 ADR-754 **Β1** — τα **χρωματιστά διακεκομμένα περιγράμματα** γύρω από τα κελιά που
 * διαβάζει ο τύπος που γράφεται αυτή τη στιγμή.
 *
 * ## Καμία γνώση, μόνο μελάνι
 * Ίδιο συμβόλαιο με τον `stamp-table-indicator.ts`: το «ποια κελιά» το απαντά το καθαρό
 * `table-formula-reference-spans.ts`, το «πού είναι» η διάταξη, και εδώ μένει μόνο το «πώς
 * φαίνονται». Ο ζωγράφος **δεν** τοκενίζει, **δεν** διαβάζει store, **δεν** ξέρει τι είναι
 * τύπος.
 *
 * ## 🔴 Γιατί ΔΕΝ γεννιέται δεύτερη υλοποίηση `setLineDash`
 * Το `save / setLineDash / stroke / restore` **υπάρχει ήδη** ως {@link strokeRectMm}, και το
 * χρησιμοποιούν το φάντασμα μεταφοράς και το περίγραμμα λειτουργίας. Ένα τρίτο αντίγραφο θα
 * ήταν sibling clone που το **CHECK 3.28** (jscpd, N.18) πιάνει ανεξάρτητα ονόματος — και,
 * χειρότερα, τρίτο σημείο όπου μπορεί να ξεχαστεί το `restore()`.
 *
 * ## 🔴 ΠΟΤΕ μέσα στο bitmap cache — ADR-040 κανόνας #3
 * Ζωγραφίζεται **μόνο** στο overlay pass της επιλεγμένης οντότητας, όπως ο δρομέας κελιού.
 * Αν το πρόχειρο έμπαινε ποτέ στο κλειδί του `dxf-bitmap-cache-key.ts`, **κάθε χαρακτήρας**
 * που πληκτρολογεί ο χρήστης θα ζητούσε πλήρη ανακατασκευή raster όλων των οντοτήτων — το
 * μετρημένο «60Hz rebuild ⇒ FPS 1». Ο φύλακας είναι το `if (cursor)` του καλούντος, όπου το
 * `selected` είναι ήδη εγγυημένο.
 *
 * ## Η ΛΕΞΗ «marching ants» ΕΙΝΑΙ ΛΑΘΟΣ ΕΔΩ
 * Ορολογικά αφορά το **κινούμενο** διάστικτο marquee του `Ctrl+C` (περιοχή στο πρόχειρο).
 * Αυτά εδώ είναι **ακίνητα** και σημαίνουν άλλο πράγμα. Καταγράφεται ρητά ώστε να μη μπει
 * ποτέ σε όνομα ή σχόλιο (ADR-754 §8).
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-formula-references
 * @see bim/table/formula/table-formula-reference-spans.ts — η απάντηση που ζωγραφίζεται
 * @see rendering/entities/table/stamp-table-range-ghost.ts — ο αδελφός που καθρεφτίζει
 * @see docs/centralized-systems/reference/adrs/ADR-754-table-point-mode.md §8 (Β1)
 */

import { TABLE_FORMULA_REFERENCE } from '../../../config/color-config';
import { strokeRectMm, type StampTableContext } from './stamp-table-layout';
import { tableRangeRectMm } from '../../../bim/table/table-cell-range';
import type { TableFormulaReferenceSpan } from '../../../bim/table/formula/table-formula-reference-spans';
import type { TableLayout } from '../../../bim/table/table-layout-types';

/**
 * Ένα διακεκομμένο περίγραμμα ανά **διακριτή περιοχή** του τύπου.
 *
 * ⚠️ Ανά **περιοχή**, όχι ανά εμφάνιση: το `=A1+A1*2` δίνει δύο εγγραφές με τον ίδιο δείκτη
 * παλέτας, και η δεύτερη θα ζωγράφιζε ακριβώς τα ίδια pixel πάνω στα πρώτα. Σε διακεκομμένη
 * γραμμή αυτό **φαίνεται**: το δεύτερο πέρασμα βάφει και τα κενά του μοτίβου, δηλαδή το
 * περίγραμμα θα γινόταν συμπαγές — και το συμπαγές σημαίνει ήδη κάτι άλλο σε αυτόν τον
 * πίνακα («εδώ πάει το πλήκτρο»).
 *
 * Σιωπά χωρίς αναφορές, που είναι η **συνήθης** κατάσταση κάθε καρέ: ο χρήστης που γράφει
 * `Μπετόν C25` δεν γράφει τύπο.
 */
export function stampTableFormulaReferences(
  rc: StampTableContext,
  layout: TableLayout,
  spans: readonly TableFormulaReferenceSpan[],
): void {
  if (spans.length === 0) return;

  const painted = new Set<number>();
  for (const span of spans) {
    if (painted.has(span.colorIndex)) continue;
    painted.add(span.colorIndex);

    // `null` όταν τα όρια δεν τέμνουν τη διάταξη — μπαγιάτικη αναφορά σε γραμμή που μόλις
    // σβήστηκε. Παράλειψη, ποτέ μαντεψιά: ίδια συντηρητική στάση με το φάντασμα.
    const rectMm = tableRangeRectMm(layout, span.bounds);
    if (!rectMm) continue;

    strokeRectMm(
      rc,
      rectMm,
      referenceColorHex(span.colorIndex),
      TABLE_FORMULA_REFERENCE.lineWidthPx,
      TABLE_FORMULA_REFERENCE.dashPx,
    );
  }
}

/**
 * Δείκτης παλέτας → χρώμα, **κυκλικά**.
 *
 * Ο κύκλος ζει εδώ και όχι στον παραγωγό των δεικτών: εκείνος είναι καθαρή γραμματική και δεν
 * επιτρέπεται να ξέρει πόσα χρώματα υπάρχουν — αλλιώς μια αλλαγή παλέτας θα άλλαζε **ποια
 * αναφορά ταιριάζει με ποια**, δηλαδή θα ήταν αλλαγή σημασίας μεταμφιεσμένη σε αλλαγή στυλ.
 */
export function referenceColorHex(colorIndex: number): string {
  const palette = TABLE_FORMULA_REFERENCE.paletteHex;
  return palette[colorIndex % palette.length];
}
