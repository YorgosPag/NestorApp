/**
 * ADR-782 §23 — η **συνεδρία** χειροκίνητης τοποθέτησης: τι κάνει ο χρήστης **τώρα**.
 *
 * ## Γιατί χωριστά από το `basemap-placement-store`
 * Εκείνο κρατά το **αποτέλεσμα** (πού κάθεται ο χάρτης) και επιβιώνει της συνεδρίας — αλλιώς
 * κλείνοντας το εργαλείο θα χανόταν η δουλειά. Αυτό κρατά την **πρόθεση σε εξέλιξη** (ποιο
 * εργαλείο, ποια μισοτελειωμένη αντιστοιχία, ποια χειρονομία τρέχει) και **πρέπει** να σβήνει.
 * Ένα store για τα δύο θα σήμαινε ότι μια μισοτελειωμένη αντιστοιχία επιβιώνει του κλεισίματος
 * και «ξυπνά» στο επόμενο άνοιγμα, ζητώντας το ταίρι ενός σημείου που κανείς δεν θυμάται.
 *
 * ## Δύο εργαλεία, μία συνεδρία (απόφαση Giorgio 2026-08-10: «και τα δύο»)
 * | Εργαλείο | Χειρονομία | Ακρίβεια |
 * |---|---|---|
 * | `drag` | πιάσε τον χάρτη · λαβή στροφής | γρήγορη προσέγγιση |
 * | `match` | δείξε σημείο σχεδίου → δείξε το ίδιο στον χάρτη | φινίρισμα |
 *
 * ⚠️ Είναι **ρητή** επιλογή και όχι αυτόματη διάκριση «κλικ ή σύρσιμο»: η ίδια κίνηση του
 * ποντικιού θα σήμαινε δύο πράγματα ανάλογα με το αν κουνήθηκε τρία εικονοστοιχεία, και ο
 * χρήστης δεν έχει τρόπο να μάθει ποιο διάλεξε το πρόγραμμα γι' αυτόν. Η κατάσταση εργαλείου
 * είναι το πρότυπο κάθε CAD (AutoCAD command, Revit modify-tool).
 *
 * Μηδέν React (ADR-040). Χαμηλή συχνότητα: η συνεδρία αλλάζει σε πατήματα, όχι σε κινήσεις —
 * η **θέση** κατά το σύρσιμο γράφεται στο `basemap-placement-store`.
 *
 * @see ./basemap-placement.ts — τα μαθηματικά
 * @see ../../hooks/canvas/use-basemap-placement-interaction.ts — ο χειριστής δείκτη
 */

import { createExternalStore } from '@/lib/state/createExternalStore';
import type { Point2D } from '../../rendering/types/Types';
import type { GeoReference } from '../geo-referencing/geo-transform';
import type { PlacementCorrespondence } from './basemap-placement';
import { setBasemapPlacement } from './basemap-placement-store';

/** Ποιον δρόμο χρησιμοποιεί ο χρήστης αυτή τη στιγμή. */
export type BasemapPlacementTool = 'drag' | 'match';

/** Ποια χειρονομία τρέχει· `'none'` όταν ο δείκτης δεν κρατά τίποτα. */
export type BasemapPlacementGesture = 'none' | 'drag' | 'rotate';

export interface BasemapPlacementSession {
  readonly active: boolean;
  readonly tool: BasemapPlacementTool;
  readonly gesture: BasemapPlacementGesture;
  /**
   * Το πλαίσιο **πριν** ξεκινήσει η τρέχουσα χειρονομία — το στιγμιότυπο αναίρεσης.
   *
   * ⚠️ Δεν είναι δεύτερη αλήθεια για το «πού κάθεται ο χάρτης»: είναι φωτογραφία μιας στιγμής,
   * που ζει **όσο** η χειρονομία και χρησιμεύει σε ένα ακριβώς πράγμα — το `Esc` στη μέση ενός
   * συρσίματος να επαναφέρει, όπως κάνει κάθε λαβή αυτού του viewer (ADR-364 `GRIP_DRAG`).
   */
  readonly gestureOrigin: GeoReference | null;
  /** Σημείο του **σχεδίου** που δείχτηκε και περιμένει το ταίρι του στον χάρτη. */
  readonly pendingDrawing: Point2D | null;
  /** Οι ολοκληρωμένες αντιστοιχίες — **δύο** το πολύ λύνονται (δες `placeBasemapByCorrespondences`). */
  readonly correspondences: readonly PlacementCorrespondence[];
}

const IDLE: BasemapPlacementSession = {
  active: false,
  tool: 'drag',
  gesture: 'none',
  gestureOrigin: null,
  pendingDrawing: null,
  correspondences: [],
};

const store = createExternalStore<BasemapPlacementSession>(IDLE);

export function getBasemapPlacementSession(): BasemapPlacementSession {
  return store.get();
}

export function subscribeBasemapPlacementSession(listener: () => void): () => void {
  return store.subscribe(listener);
}

/** `true` όταν το εργαλείο τοποθέτησης κρατά τον καμβά — η πύλη κάθε εγγραφής `Esc`. */
export function isBasemapPlacementActive(): boolean {
  return store.get().active;
}

/** Άνοιγμα της συνεδρίας. Ξεκινά πάντα καθαρή, ακόμη κι αν η προηγούμενη έκλεισε απότομα. */
export function beginBasemapPlacement(): void {
  store.set({ ...IDLE, active: true });
}

/**
 * Κλείσιμο. **Η τοποθέτηση παραμένει** — μόνο η πρόθεση σε εξέλιξη σβήνει.
 *
 * ⚠️ Το κλείσιμο δεν είναι «ακύρωση»: ο χάρτης ενημερώνεται **ζωντανά** σε κάθε κίνηση, άρα ο
 * χρήστης έχει ήδη δει και δεχτεί το αποτέλεσμα. Μια έξοδος που το ανέτρεπε θα έσβηνε δουλειά
 * που φαινόταν τελειωμένη — η ίδια αναίρεση την οποία υπάρχει ξεχωριστό κουμπί για να ζητήσει.
 */
export function endBasemapPlacement(): void {
  store.reset(IDLE);
}

/** Εναλλαγή εργαλείου· η μισοτελειωμένη αντιστοιχία πέφτει (δεν ανήκει στο νέο εργαλείο). */
export function setBasemapPlacementTool(tool: BasemapPlacementTool): void {
  store.set({ ...store.get(), tool, pendingDrawing: null });
}

/** Έναρξη χειρονομίας, με το πλαίσιο της στιγμής ως στιγμιότυπο αναίρεσης. */
export function beginPlacementGesture(
  gesture: Exclude<BasemapPlacementGesture, 'none'>,
  origin: GeoReference,
): void {
  store.set({ ...store.get(), gesture, gestureOrigin: origin });
}

/** Ομαλό τέλος χειρονομίας — ό,τι ζωγραφίστηκε μένει. */
export function endPlacementGesture(): void {
  const current = store.get();
  if (current.gesture === 'none') return;
  store.set({ ...current, gesture: 'none', gestureOrigin: null });
}

/** Το σημείο του σχεδίου που μόλις δείχτηκε· περιμένει το ταίρι του πάνω στον χάρτη. */
export function setPlacementPendingDrawing(point: Point2D): void {
  store.set({ ...store.get(), pendingDrawing: point });
}

/**
 * Ολοκλήρωση αντιστοιχίας. Κρατούνται οι **δύο τελευταίες**: μια τρίτη δεν λύνεται (άκαμπτος
 * μετασχηματισμός) και, αν συσσωρευόταν, η λίστα θα μεγάλωνε δηλώνοντας ακρίβεια που δεν υπάρχει.
 */
export function addPlacementCorrespondence(pair: PlacementCorrespondence): void {
  const current = store.get();
  const kept = [...current.correspondences, pair].slice(-2);
  store.set({ ...current, correspondences: kept, pendingDrawing: null });
}

/** Καθαρισμός των αντιστοιχιών — το «ξαναπιάσ' το από την αρχή» του εργαλείου `match`. */
export function clearPlacementCorrespondences(): void {
  store.set({ ...store.get(), correspondences: [], pendingDrawing: null });
}

/**
 * Το `Esc`, σε **σκαλιά** — η σύμβαση κάθε CAD: πίσω ένα βήμα τη φορά, όχι όλα μαζί.
 *
 * | Κατάσταση | Τι κάνει | Ανάλογο |
 * |---|---|---|
 * | χειρονομία σε εξέλιξη | επαναφέρει το πλαίσιο της στιγμής **πριν** το πιάσιμο | `GRIP_DRAG` (ADR-364) |
 * | μισοτελειωμένη αντιστοιχία | ξεχνά **μόνο** το σημείο του σχεδίου | `WALL_ALIGNMENT_BACK` |
 * | τίποτα από τα δύο | κλείνει τη συνεδρία | `MODIFY_TOOL` |
 *
 * ⚠️ **Μία** εγγραφή στον bus και όχι τρεις: οι τρεις καταστάσεις έχουν τον **ίδιο ιδιοκτήτη** και
 * την ίδια πύλη (`isBasemapPlacementActive`). Τρία σκαλιά θα έλυναν τη σειρά τους με **σειρά
 * εγγραφής** — ακριβώς η ισοπαλία που προειδοποιεί το `escape-priority.ts` (`BLOCKING_CONFIRM`).
 *
 * @returns `true` όταν το `Esc` καταναλώθηκε εδώ.
 */
export function escapeBasemapPlacement(): boolean {
  const current = store.get();
  if (!current.active) return false;

  if (current.gesture !== 'none') {
    if (current.gestureOrigin) setBasemapPlacement(current.gestureOrigin);
    store.set({ ...current, gesture: 'none', gestureOrigin: null });
    return true;
  }
  if (current.pendingDrawing) {
    store.set({ ...current, pendingDrawing: null });
    return true;
  }
  endBasemapPlacement();
  return true;
}

/** Επαναφορά για απομόνωση δοκιμών (δεν ειδοποιεί — δες `ExternalStore.reset`). */
export function resetBasemapPlacementSession(): void {
  store.reset(IDLE);
}
