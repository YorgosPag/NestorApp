/**
 * 🔴 ADR-828 **Φ4α** — **ΤΟ ΚΟΥΜΠΙ «ΕΠΙΛΟΓΕΣ ΑΥΤΟΜΑΤΗΣ ΣΥΜΠΛΗΡΩΣΗΣ»**, ζωγραφισμένο.
 *
 * Μια μικρή λευκή πλάκα με βελάκι, κάτω από τη γεμισμένη περιοχή. Απαντά σε **μία** ερώτηση
 * που καμία άλλη επιφάνεια δεν απαντά: «*αυτό που μόλις έγινε — μπορώ να το αλλάξω;*».
 *
 * ## 🔴 ΓΙΑΤΙ ΖΩΓΡΑΦΙΣΜΕΝΟ ΚΑΙ ΟΧΙ DOM (η απόφαση, ώστε να μην ξαναγίνει)
 * Το DOM θα έδινε πραγματικό `<button>` με ARIA και focus ring. Απορρίφθηκε, και ο λόγος **δεν**
 * είναι η ευκολία:
 *  - **Συνέπεια**: *κάθε* affordance πίνακα είναι ζωγραφισμένη — λαβή, ⊕, ⊖, γωνία «όλα»,
 *    μυρμήγκια, ζώνες, grips. Αυτό θα ήταν το μόνο που δεν είναι, και το μόνο που θα έπρεπε να
 *    ξαναβρίσκει μόνο του τη θέση του σε κάθε pan/zoom (ο ζωγράφος τρέχει ήδη ανά καρέ).
 *  - **Η προσβασιμότητά του θα ήταν εν μέρει ψευδαίσθηση**: ένα tabbable κουμπί μέσα σε φύλλο
 *    όπου το `Tab` **ανήκει στον δρομέα** (σύμβαση πλέγματος) θα πάλευε με το ίδιο το
 *    πληκτρολογιακό μοντέλο του πίνακα.
 *
 * 🔑 Το πραγματικό κέρδος προσβασιμότητας δεν ήταν «κάν' το DOM» — ήταν «**δώσε του πλήκτρο**»
 * (`Alt+↓`), και αυτό γίνεται εξίσου καλά με ζωγραφισμένο κουμπί επειδή το **μενού** που
 * ανοίγει είναι ούτως ή άλλως Radix, δηλαδή ήδη πλήρως πλοηγήσιμο. Εκεί ξεπερνάμε και το
 * Excel, που **δεν έχει καμία** πληκτρολογιακή διαδρομή προς αυτό το κουμπί.
 *
 * ## 🔴 ΠΟΤΕ μέσα στο bitmap cache — ADR-040 κανόνας #3
 * Ζωγραφίζεται **μόνο** στο overlay pass της επιλεγμένης οντότητας, όπως ο δρομέας κελιού και
 * η λαβή. Ο φύλακας είναι το `if (cursor)` του καλούντος.
 *
 * ## ⚠️ Σιωπή, όχι σβήσιμο
 * Αυτός ο ζωγράφος **δεν γράφει ποτέ store** — ούτε καν όταν κρίνει το κουμπί μπαγιάτικο. Μια
 * παρενέργεια μέσα σε βρόχο ζωγραφικής θα ήταν κατάσταση που αλλάζει ανάλογα με το αν κάτι
 * είναι ορατό, ακριβώς το είδος σύζευξης που ο ADR-040 κυνηγά. Ίδιο συμβόλαιο με τα μυρμήγκια.
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-fill-badge
 * @see bim/table/table-fill-badge.ts — πού κάθεται, και πότε είναι ακόμη αληθινό
 * @see state/table-fill-badge-store.ts — από πού έρχεται η απάντηση (getter, ADR-040)
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §8
 */

import { TABLE_FILL_BADGE } from '../../../config/color-config';
import { traceRectMm, type StampTableContext } from './stamp-table-layout';
import { tableFillBadgeRectMm } from '../../../bim/table/table-fill-badge';
import type { TableCellRangeBounds } from '../../../bim/table/table-cell-range';
import type { TableLayout, TableRectMm } from '../../../bim/table/table-layout-types';

/**
 * Πού κάθεται το βελάκι **μέσα** στην πλάκα, ως κλάσμα της πλευράς της.
 *
 * Είναι το **μόνο** σύμβολο, και όχι εικονίδιο πινέλου όπως στο Excel: στα 16 px ενός καμβά με
 * **περιστροφή** ένα εικονίδιο δύο στοιχείων γίνεται μουτζούρα, ενώ το βελάκι «άνοιξε μενού»
 * είναι το σχήμα που κάθε χρήστης έχει ήδη μάθει και παραμένει αναγνώσιμο σε κάθε γωνία. Η
 * **σημασία** («τι είδους γέμισμα») ζει στο μενού που ανοίγει, όπου υπάρχουν και τα εικονίδια
 * και οι ετικέτες — δηλαδή εκεί που υπάρχει χώρος να ειπωθεί αληθινά.
 */
const GLYPH = { left: 0.3, right: 0.7, top: 0.42, bottom: 0.62 } as const;

/**
 * Χαράζει το κουμπί. Ο καλών έχει ήδη κρίνει ότι υπάρχει — δες
 * `resolveTableFillBadgeBounds` για τους τρεις λόγους σιωπής.
 *
 * Σιωπά μόνο όταν η γεμισμένη περιοχή δεν τέμνει πια τη διάταξη (σβήστηκαν οι γραμμές της):
 * ίδιο δίχτυ με κάθε ζωγράφο περιοχής — ένα κουμπί καρφωμένο στην άκρη θα υποσχόταν πράξη
 * πάνω σε κελιά που δεν υπάρχουν.
 */
export function stampTableFillBadge(
  rc: StampTableContext,
  layout: TableLayout,
  filled: TableCellRangeBounds,
): void {
  const rect = tableFillBadgeRectMm(layout, filled, rc.pxPerMm);
  if (!rect) return;

  const { ctx } = rc;
  ctx.save();
  // Ρητά συμπαγές: ο `stampTableBorders` μπορεί να έχει αφήσει διακεκομμένο μοτίβο πάνω στο
  // ίδιο context — το `save/restore` προστατεύει τη ΔΙΚΗ μας κλήση, όχι την προηγούμενη.
  ctx.setLineDash([]);
  // Οι τέσσερις γωνίες περνούν χωριστά από το `toScreen` — ο πίνακας περιστρέφεται, και ένα
  // `rect()` σε άξονες οθόνης θα κρεμόταν λοξά πάνω από τα κελιά του. Η **μία** διατύπωση.
  traceRectMm(rc, rect);
  ctx.fillStyle = TABLE_FILL_BADGE.fillHex;
  ctx.fill();
  ctx.strokeStyle = TABLE_FILL_BADGE.outlineHex;
  ctx.lineWidth = TABLE_FILL_BADGE.outlineWidthPx;
  ctx.stroke();
  strokeGlyph(rc, rect);
  ctx.restore();
}

/**
 * Το βελάκι, με τα τρία του σημεία γεννημένα σε **mm του πλαισίου** και προβεβλημένα ένα προς
 * ένα — για τον ίδιο λόγο με τις γωνίες της πλάκας: η εύκολη εναλλακτική (προβάλλω το κέντρο
 * και προσθέτω ±px) θα έδινε πάντα **ίσιο** βελάκι, δηλαδή θα ακύρωνε σιωπηλά την περιστροφή
 * του πίνακα — ένα κουμπί με στραβό πλαίσιο και ίσιο σύμβολο μέσα του.
 */
function strokeGlyph(rc: StampTableContext, rect: TableRectMm): void {
  const { ctx } = rc;
  const { x, y, w, h } = rect;
  const a = rc.toScreen(x + w * GLYPH.left, y + h * GLYPH.top);
  const b = rc.toScreen(x + w * 0.5, y + h * GLYPH.bottom);
  const c = rc.toScreen(x + w * GLYPH.right, y + h * GLYPH.top);

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.strokeStyle = TABLE_FILL_BADGE.glyphHex;
  ctx.lineWidth = TABLE_FILL_BADGE.glyphWidthPx;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}
