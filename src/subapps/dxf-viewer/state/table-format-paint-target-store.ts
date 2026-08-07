'use client';

/**
 * 🔴 ADR-768 Βήμα 5 (Δ3) — **ΠΟΙΟ ΚΕΛΙ ΘΑ ΒΑΨΕΙ ΤΟ ΟΠΛΙΣΜΕΝΟ ΠΙΝΕΛΟ**, αν πατηθεί τώρα.
 *
 * Το **πέμπτο** κανάλι της **ίδιας** σάρωσης `mousemove` (μετά τον hover των λωρίδων, τον ρόλο
 * δείκτη, το ⊕ και το ⊖). Γεννιέται από τον **ΕΝΑ** γραφέα (`use-table-indicator-hover`) και
 * γράφεται **μόνο** όταν το πινέλο είναι οπλισμένο **και** ο ρόλος δείκτη είναι `format-paint`.
 *
 * ## 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ — η εναλλακτική ήταν δεύτερος hit-test, και είναι απαγορευμένη
 * Ο ακροατής του κλικ **δεν** επιτρέπεται να ξαναρωτήσει τη γεωμετρία «πού έπεσε αυτό;»: είναι
 * ο ρητός κανόνας του `use-table-armed-control-click` — *«ό,τι πατιέται είναι ό,τι φαίνεται»*.
 * Ανάμεσα στην τελευταία κίνηση και το πάτημα μπορεί να έχει αλλάξει το zoom (τροχός), το
 * επίπεδο, ή το μοντέλο (undo από συντόμευση)· τότε η δεύτερη σάρωση θα απαντούσε για **άλλο**
 * κελί από εκείνο που ο δείκτης υποσχέθηκε, και το σφάλμα **δεν αφήνει ίχνος** επειδή το
 * αποτέλεσμα είναι απολύτως έγκυρο.
 *
 * 🔑 Με αυτό το store, το πινέλο χρησιμοποιεί τον κοινό ακροατή **αυτούσιο**: παίρνει δωρεάν τη
 * σειρά «κατανάλωση πριν το αποτέλεσμα» (§40.8) και τη **διεκδίκηση του `mouseup`** (§40.9),
 * χωρίς **καμία** αλλαγή στο κοινό συμβόλαιο.
 *
 * ## 🔴 ΚΡΑΤΑ ΤΑΥΤΟΤΗΤΕΣ ΚΕΛΙΟΥ, ΟΧΙ ΔΕΙΚΤΕΣ ΟΡΙΩΝ — και είναι η διαφορά από τα δύο αδέλφια
 * Το ⊖ κουβαλά `firstIndex`/`lastIndex` επειδή ο **ζωγράφος** τα χρειάζεται για να βάψει κόκκινο
 * μέσα στο ίδιο καρέ. Εδώ δεν ζωγραφίζει κανείς τίποτα: η τιμή διαβάζεται **τη στιγμή του
 * πατήματος**, δηλαδή αργότερα — και οι δείκτες μπορεί να έχουν μετακινηθεί στο μεταξύ (μια
 * εισαγωγή γραμμής από συντόμευση, ένα undo). Οι **ταυτότητες** (`rowId`/`colId`) δεν
 * μετακινούνται ποτέ: ή υπάρχουν, ή το κελί σβήστηκε και η μετατροπή σε όρια απαντά `null`.
 *
 * ## Γιατί ΚΑΝΕΝΑ `markSystemsDirty` — σε αντίθεση με **και τα τέσσερα** αδέλφια
 * Εκείνα ζητούν καρέ επειδή ο **καμβάς τα ζωγραφίζει** (φωτισμένο γράμμα, ⊕, κόκκινο πλύσιμο).
 * Ο στόχος βαψίματος δεν έχει ζωγράφο: η ύπαρξή του φαίνεται **μόνο** στον δείκτη υλικού, που
 * ζει στο `style.cursor` και ενημερώνεται από δική του διαδρομή (ADR-549 Φ8). Ένα καρέ εδώ θα
 * ήταν επανασχεδίαση ολόκληρης της σκηνής, ~60 φορές το δευτερόλεπτο, για μηδέν pixel.
 *
 * ## Ο δεύτερος αναγνώστης, και γιατί δεν είναι πολυτέλεια
 * Εκτός από το πάτημα, το store το διαβάζει το **κλείδωμα καμβά** (§29): όσο υπάρχει έγκυρος
 * στόχος, το `mousedown` **οφείλει** να περάσει ώστε να το πιάσει ο ακροατής του πινέλου — και
 * **μόνο** αυτό (το `mouseup` μένει κομμένο, αλλιώς ο καμβάς αποεπιλέγει τον πίνακα). Χωρίς
 * κοινό store, το κλείδωμα θα έκανε **δική του** σάρωση σκηνής ανά πάτημα, δηλαδή θα υπήρχε
 * pixel όπου το κλείδωμα αφήνει το συμβάν να περάσει και το πινέλο δεν βάφει — ή το ανάποδο.
 *
 * @module subapps/dxf-viewer/state/table-format-paint-target-store
 * @see ui/table-cell-editor/use-table-indicator-hover.ts — ο ΕΝΑΣ γραφέας (πέμπτο κανάλι)
 * @see ui/table-cell-editor/use-table-format-painter-click.ts — ο ΕΝΑΣ εκτελεστής
 * @see ui/table-cell-editor/use-table-canvas-lockdown.ts — ο δεύτερος αναγνώστης (§29)
 * @see docs/centralized-systems/reference/adrs/ADR-768-table-format-painter.md
 */

import { createExternalStore } from '../stores/createExternalStore';
import type { TableColumnId, TableRowId } from '../types/table';

/**
 * Ο στόχος του επόμενου βαψίματος.
 *
 * ⚠️ Το `entityId` **δεν** είναι ο πίνακας του δρομέα: είναι ο πίνακας **κάτω από το χέρι**, που
 * μπορεί να είναι άλλος (cross-table βάψιμο, ADR-768 §2.2). Το πεδίο λέγεται έτσι επειδή ικανοποιεί
 * το `ArmedControlState` του κοινού ακροατή, ο οποίος το χρησιμοποιεί για να λύσει τη **ζωντανή**
 * οντότητα τη στιγμή του συμβάντος.
 */
export interface TableFormatPaintTargetState {
  readonly entityId: string;
  readonly rowId: TableRowId;
  readonly colId: TableColumnId;
}

const store = createExternalStore<TableFormatPaintTargetState | null>(null);

function sameState(
  a: TableFormatPaintTargetState | null,
  b: TableFormatPaintTargetState | null,
): boolean {
  if (a === null || b === null) return a === b;
  return a.entityId === b.entityId && a.rowId === b.rowId && a.colId === b.colId;
}

/** Ο στόχος **τη στιγμή της κλήσης**· `null` όταν το πάτημα δεν θα έβαφε τίποτα. */
export function getTableFormatPaintTarget(): TableFormatPaintTargetState | null {
  return store.get();
}

/**
 * Γράφει τον στόχο. Ο φύλακας ισότητας ζει **εδώ** και όχι στον καλούντα — ίδια αρχή με τα
 * τέσσερα αδέλφια: ένας δεύτερος γραφέας αύριο δεν μπορεί να τον παρακάμψει.
 *
 * ⚠️ Χωρίς αίτημα καρέ. Δες την κεφαλίδα για το γιατί εδώ η σιωπή είναι το σωστό.
 */
export function setTableFormatPaintTarget(next: TableFormatPaintTargetState | null): void {
  if (sameState(store.get(), next)) return;
  store.set(next);
}

/** Κανένας στόχος. Ιδεμποτής, ώστε να δίνεται απευθείας στον κοινό καθαρισμό του γραφέα. */
export function clearTableFormatPaintTarget(): void {
  setTableFormatPaintTarget(null);
}

/** Test helper — μηδενισμός μεταξύ tests, ίδιο μοτίβο με τα αδελφά stores. */
export function __resetTableFormatPaintTargetForTests(): void {
  store.reset(null);
}
