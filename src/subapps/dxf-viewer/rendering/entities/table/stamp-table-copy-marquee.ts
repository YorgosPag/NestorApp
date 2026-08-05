/**
 * 🔴 ADR-739 §48 — **ΤΑ «ΜΥΡΜΗΓΚΙΑ» ΤΗΣ ΑΝΤΙΓΡΑΜΜΕΝΗΣ ΠΕΡΙΟΧΗΣ** (Excel parity).
 *
 * Ένα κινούμενο διακεκομμένο ορθογώνιο γύρω από ό,τι μπήκε στο πρόχειρο με `Ctrl+C`/`Ctrl+X`.
 * Είναι η **μόνη** απάντηση στο «τι θα επικολληθεί αν πατήσω τώρα `Ctrl+V`», σε μια εφαρμογή
 * όπου η επιλογή έχει ήδη προλάβει να μετακινηθεί αλλού.
 *
 * ## 🔴 Ο ΖΩΓΡΑΦΟΣ ΕΙΝΑΙ Ο ΔΕΥΤΕΡΟΣ ΦΡΟΥΡΟΣ — και είναι σκόπιμο (belt-and-suspenders)
 * Ο πρώτος φρουρός είναι ο **παλμός**: ρωτά «είμαι ακόμα μέσα σε αυτόν τον πίνακα;» και
 * σβήνει το marquee σε `Escape` / έξοδο / μετάβαση σε άλλον πίνακα. Δεν μπορεί όμως να ρωτήσει
 * «άλλαξε το μοντέλο;» — αυτό απαιτεί ανάγνωση σκηνής, που είναι ακριβή σε ρολόι και **δωρεάν
 * εδώ**: ο `TableRenderer` κρατά ήδη τη ζωντανή οντότητα κάθε καρέ.
 *
 * Άρα η ερώτηση μπαίνει εκεί όπου η απάντηση δεν κοστίζει. Το κριτήριο είναι **σύγκριση
 * αναφοράς** (`entity.model !== marquee.modelRef`), και στηρίζεται σε τεκμηριωμένο δόγμα του
 * έργου: *η ταυτότητα του μοντέλου ΕΙΝΑΙ η έκδοσή του* — το `buildTableModelCommand`
 * επιστρέφει `null` όταν τίποτα δεν άλλαξε, δηλαδή νέα αναφορά ⇒ πραγματική αλλαγή. Έτσι
 * «γράψιμο σε κελί σβήνει τα μυρμήγκια» (Excel parity) βγαίνει **χωρίς καμία γραμμή σε καμία
 * διαδρομή εγγραφής**, ούτε στις σημερινές ούτε στις μελλοντικές.
 *
 * ⚠️ **Σιωπή, όχι σβήσιμο**: αυτός ο ζωγράφος δεν γράφει ποτέ store. Μια παρενέργεια μέσα σε
 * βρόχο ζωγραφικής θα ήταν κατάσταση που αλλάζει ανάλογα με το αν κάτι είναι ορατό — ακριβώς
 * το είδος σύζευξης που ο ADR-040 κυνηγά. Το ρητό σβήσιμο ανήκει στους δύο δεσμευτές
 * (`commitText`, `useTableModelCommit`)· εδώ γίνεται μόνο το **δίχτυ**.
 *
 * ## Γιατί ΜΟΝΟ περίγραμμα, χωρίς γέμισμα
 * Η ερώτηση είναι «τι είναι στο πρόχειρο», όχι «τι μάρκαρα». Το γέμισμα ανήκει ήδη στην
 * **επιλογή** ({@link stampTableSelection}), και οι δύο συνυπάρχουν συνεχώς: αμέσως μετά το
 * `Ctrl+C` η ίδια περιοχή είναι **και** επιλεγμένη **και** αντιγραμμένη. Δεύτερο ημιδιαφανές
 * στρώμα πάνω στο πρώτο θα διπλασίαζε τη σκίαση και θα έκρυβε το κείμενο — δηλαδή θα έκανε την
 * επιλογή αδύνατη να επαληθευτεί με το μάτι (το ίδιο σφάλμα που τεκμηριώνει το §19.8).
 *
 * @module subapps/dxf-viewer/rendering/entities/table/stamp-table-copy-marquee
 * @see bim/table/table-marching-ants.ts — η φάση, και γιατί το offset είναι αρνητικό
 * @see state/table-copy-marquee-store.ts — από πού έρχεται η απάντηση (getter, ADR-040)
 */

import { TABLE_COPY_MARQUEE } from '../../../config/color-config';
import { strokeRectMm, type StampTableContext } from './stamp-table-layout';
import { tableRangeRectMm } from '../../../bim/table/table-cell-range';
import {
  MARCHING_ANTS_DASH_PX,
  MARCHING_ANTS_LINE_WIDTH_PX,
  marchingAntsDashOffsetPx,
} from '../../../bim/table/table-marching-ants';
import type { TableLayout, TableRectMm } from '../../../bim/table/table-layout-types';
import type { TableCopyMarqueeState } from '../../../state/table-copy-marquee-store';
import type { TableEntity } from '../../../types/table-entity';

/**
 * Το ορθογώνιο των μυρμηγκιών **αυτού** του πίνακα, ή `null` όταν δεν πρέπει να φανεί τίποτα.
 *
 * Καθαρή συνάρτηση, εξαγόμενη χωριστά από τον ζωγράφο: εδώ ζει ολόκληρη η **προδιαγραφή**
 * («πότε φαίνονται τα μυρμήγκια»), και δοκιμάζεται χωρίς καμβά.
 *
 * Οι τρεις λόγοι σιωπής, με τη σειρά που στοιχίζουν σε αύξουσα ακρίβεια:
 *  1. **άλλος πίνακας** — δύο πίνακες στη σκηνή δεν μοιράζονται πρόχειρο·
 *  2. **μπαγιάτικη έκδοση** — δες την κεφαλίδα· είναι το «γράψιμο σβήνει τα μυρμήγκια»·
 *  3. **μη σχεδιάσιμα όρια** — η περιοχή δεν τέμνει πια τη διάταξη (σβήστηκαν οι γραμμές
 *     της). Ίδιο δίχτυ με το `stampTableRangeGhost`: ένα ορθογώνιο καρφωμένο στην άκρη θα
 *     υποσχόταν περιεχόμενο που δεν υπάρχει.
 */
export function resolveTableCopyMarqueeRect(
  entity: TableEntity,
  layout: TableLayout,
  marquee: TableCopyMarqueeState | null,
): TableRectMm | null {
  if (!marquee || marquee.entityId !== entity.id) return null;
  if (marquee.modelRef !== entity.model) return null;
  return tableRangeRectMm(layout, marquee.bounds);
}

/**
 * Χαράζει τα μυρμήγκια. No-op όταν ο {@link resolveTableCopyMarqueeRect} σιωπά.
 *
 * Ο χρόνος έρχεται **παράμετρος** και δεν διαβάζεται εδώ: ο ίδιος κώδικας ζωγραφίζει
 * ντετερμινιστικά σε test και ζωντανά στην οθόνη, χωρίς ψεύτικο ρολόι και χωρίς δεύτερη
 * διαδρομή. Ο καλών έχει ήδη τον αριθμό — ο `TableRenderer` βρίσκεται μέσα σε βρόχο καρέ.
 */
export function stampTableCopyMarquee(
  rc: StampTableContext,
  entity: TableEntity,
  layout: TableLayout,
  marquee: TableCopyMarqueeState | null,
  nowMs: number,
): void {
  const rectMm = resolveTableCopyMarqueeRect(entity, layout, marquee);
  if (!rectMm || !marquee) return;

  strokeRectMm(
    rc,
    rectMm,
    TABLE_COPY_MARQUEE.colorHex,
    // 🔴 §48.11 — το πάχος έρχεται από το **μοτίβο**, όχι από το χρώμα: είναι σκέλος της
    // αναλογίας 7:2:1 του Excel και κλιμακώνεται μαζί της. Δες `table-marching-ants.ts`.
    MARCHING_ANTS_LINE_WIDTH_PX,
    MARCHING_ANTS_DASH_PX,
    marchingAntsDashOffsetPx(nowMs - marquee.startedAtMs),
  );
}
