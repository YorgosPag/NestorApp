/**
 * ADR-736 §6 — «ποια εικόνα τοποθετώ» + «πού προσγειώνεται», για την εντολή **ΕΙΣΑΓΩΓΗΣ**
 * εικόνας (AutoCAD `IMAGEATTACH` / Revit *Insert ▸ Image* / ArchiCAD *Place Picture*).
 *
 * 🔑 **Δεν υλοποιεί τοποθέτηση.** Είναι δύο instances των ΗΔΗ υπαρχόντων factories του
 * entourage (ADR-654 M6): ο selection store και ο placer. Ο λόγος που δουλεύει αυτούσιο είναι
 * ότι η ερώτηση είναι η ίδια — «βάλε αυτό το raster με το κέντρο του στο κλικ» — και τη
 * λύνει ήδη μία μηχανή: `createEntourageTool` (FSM + ghost) → `createEntouragePlacer`
 * (κέντρο → γωνία, mm → μονάδες σκηνής) → `addEntourageToScene` (undoable append + broadcast).
 * Δεύτερο FSM ή δεύτερος ghost renderer θα ήταν ακριβώς το structural clone του N.18.
 *
 * ## Η ΜΟΝΗ διαφορά από τις 4 catalog οικογένειες: ποιος ξέρει το μέγεθος
 *
 * Ένας καναπές είναι 2.100 mm — το ξέρει ο catalog, ίδιο σε κάθε σχέδιο. Μια φωτογραφία
 * αυτοψίας **δεν έχει** φυσικό μέγεθος· το ορίζει η προβολή τη στιγμή της εισαγωγής
 * (`IMAGE_PLACEMENT_VIEWPORT_FRACTION`, βλ. `image-source-attach.ts`). Άρα το μέγεθος
 * ταξιδεύει **μαζί με την επιλογή** αντί να ζητείται από catalog, και ο `getSizeMm` του
 * placer το διαβάζει από τον store — event-time, ίδιο ιδίωμα με το «ποιο item» (ADR-040).
 *
 * ⚠️ Ταυτότητα (`id`) = το **download URL**, που είναι content-addressed (SHA-256 του αρχείου,
 * βλ. `io/user-image-asset.ts`). Δεν είναι αυθαίρετη επιλογή: ο `getSizeMm` πρέπει να μπορεί να
 * απαντήσει «αυτό το μέγεθος αφορά ΑΥΤΟ το item;» και το περιεχόμενο είναι η μόνη ταυτότητα που
 * υπάρχει — δεν υπάρχει catalog id να δανειστούμε, και μια αυτοσχέδια τυχαία θα παραβίαζε το N.6.
 *
 * @see ../entourage/place-entourage.ts — το factory του placer
 * @see ../entourage/entourage-selection-store.ts — το factory του store
 * @see ./image-source-attach.ts — `imagePlacementSizeMm` (η μία μετάφραση οθόνη → mm)
 */

import type { EntourageSizeMm } from '../../data/entourage-catalog-core';
import {
  createEntourageSelectionStore,
  type EntourageSelection,
} from '../entourage/entourage-selection-store';
import { createEntouragePlacer, type EntouragePlacer } from '../entourage/place-entourage';

/** Το layer όπου προσγειώνονται ΟΛΕΣ οι εικόνες που εισήγαγε ρητά ο χρήστης. */
export const ATTACHED_IMAGE_LAYER_ID = 'IMAGES-2D';

/**
 * Η ενεργή επιλογή: ό,τι το entourage (`id` + `url`) **συν** τα δύο που ο catalog θα έδινε
 * αλλιώς — το μέγεθος και η ετικέτα της πηγής.
 */
export interface AttachedImageSelection extends EntourageSelection {
  /** Κλειδωμένο τη στιγμή της επιλογής αρχείου — ώστε το ghost να μην αλλάζει με το zoom. */
  readonly sizeMm: EntourageSizeMm;
  /** Το όνομα του αρχείου που διάλεξε ο χρήστης → γίνεται η ετικέτα «Πηγή» της εικόνας. */
  readonly sourceName: string;
}

/** «Ποια ανεβασμένη εικόνα τοποθετείται» SSoT. */
export const attachedImageSelection = createEntourageSelectionStore<AttachedImageSelection>();

/**
 * Placer εισαγόμενων εικόνων: το μέγεθος έρχεται από την ίδια την επιλογή, layer IMAGES-2D.
 *
 * Ο έλεγχος `current.id === id` δεν είναι διακοσμητικός: το tool χτίζει params με το id που
 * βρήκε στον store τη στιγμή του κλικ, οπότε μια αναντιστοιχία σημαίνει ότι η επιλογή άλλαξε
 * ενδιάμεσα — και τότε `null` ⇒ ο placer επιστρέφει `null` ⇒ το tool δείχνει
 * `errorUnknownItem` αντί να καρφώσει εικόνα με λάθος διαστάσεις.
 */
export const attachedImagePlacer: EntouragePlacer = createEntouragePlacer({
  getSizeMm: (id) => {
    const current = attachedImageSelection.get();
    return current?.id === id ? current.sizeMm : null;
  },
  layerId: ATTACHED_IMAGE_LAYER_ID,
});
