/**
 * @fileoverview **Ο ΚΑΘΑΡΙΣΤΗΣ** — τα bytes που φεύγουν στον κόσμο (ADR-841 §7 Α12.7).
 * @related ADR-841 §7 Α12.5 · Α12.7 · Α5 (`locationDisclosure`) · public-shelf.service
 * @module services/listings/public-shelf-sanitise
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ ΑΣΦΑΛΕΙΑ, ΟΧΙ ΜΟΡΦΟΠΟΙΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Φωτογραφία ακινήτου κουβαλά **συντεταγμένες**. Δημοσιευμένη ωμή, **ακυρώνει** το
 * `locationDisclosure: 'declined'` της **Α5**: η πλατφόρμα αποκαλύπτει ό,τι ο κάτοχος
 * **αρνήθηκε** να πει. Και δεν είναι θεωρητικό — υπάρχουν καταγεγραμμένες διαρρήξεις
 * σε ακίνητα εντοπισμένα από GPS σε φωτογραφίες αγγελιών.
 *
 * 🏆 **ΚΑΙ ΓΙ' ΑΥΤΟ Ο ΚΑΘΑΡΙΣΜΟΣ ΔΕΝ ΕΙΝΑΙ ΒΗΜΑ — ΕΙΝΑΙ Η ΓΕΝΝΗΣΗ ΤΗΣ ΔΙΕΥΘΥΝΣΗΣ.**
 * Οι μεγάλες πλατφόρμες αφαιρούν μεταδεδομένα ως **βήμα αγωγού**, και η βιβλιογραφία
 * το λέει αναξιόπιστο *(«their algorithms are not foolproof»)*. Εδώ το κλειδί του
 * ραφιού είναι το **sha256 της εξόδου αυτού του αρχείου** ⇒ *χωρίς καθαρισμό δεν
 * υπάρχει διεύθυνση, χωρίς διεύθυνση δεν υπάρχει δημοσίευση*. Ένας μελλοντικός
 * γραφέας που θα «ξεχνούσε» τον καθαρισμό δεν θα δημοσίευε ωμή φωτογραφία —
 * **δεν θα είχε κλειδί**.
 *
 * ⚠️ **SERVER-ONLY**: το `sharp` είναι εγγενές module. Καμία εισαγωγή από πελάτη.
 */

import sharp from 'sharp';

import { createModuleLogger } from '@/lib/telemetry';
import type { PublicShelfExtension } from '@/services/upload/utils/storage-path-public-shelf';

const logger = createModuleLogger('public-shelf-sanitise');

// ---------------------------------------------------------------------------
// Παράμετροι — γραμμένες μία φορά
// ---------------------------------------------------------------------------

/**
 * Το μέγιστο μήκος της **μεγάλης** πλευράς, σε pixel.
 *
 * Φράσσει το κόστος εξόδου *(egress)* και τον χρόνο αποκωδικοποίησης στη συσκευή του
 * επισκέπτη, χωρίς ορατή απώλεια σε οθόνη ακινήτου. Η Zillow σερβίρει παράγωγα
 * γύρω στα 1536px· κρατάμε περιθώριο για οθόνες υψηλής πυκνότητας.
 *
 * ⚠️ **Δεν είναι «η γκάμα παραγώγων»** — τα πολλαπλά μεγέθη ανά breakpoint είναι
 * απόφαση **παρουσίασης** και ανήκουν στη **Φ3**. Εδώ ορίζεται **ένα** κανονικό
 * δημοσιευμένο μέγεθος, ώστε το ράφι να μην περιμένει την οθόνη για να υπάρξει.
 */
export const PUBLIC_SHELF_MAX_EDGE_PX = 2560;

/** Ποιότητα WebP — ισορροπία που κρατά τα τεκμήρια ευανάγνωστα (κατόψεις, κείμενα). */
export const PUBLIC_SHELF_WEBP_QUALITY = 82;

/** Ο τύπος περιεχομένου που δηλώνει ο γραφέας στο αντικείμενο του ραφιού. */
export const PUBLIC_SHELF_IMAGE_CONTENT_TYPE = 'image/webp';

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/** Ό,τι παράγει ο καθαριστής — **αυτά** τα bytes δημοσιεύονται, κανένα άλλο. */
export interface SanitisedShelfAsset {
  /** Τα καθαρισμένα bytes. Το sha256 **τους** γίνεται το κλειδί. */
  readonly bytes: Buffer;
  readonly ext: PublicShelfExtension;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
}

/** Γιατί ένα αρχείο **δεν** μπόρεσε να γίνει δημοσιεύσιμο. */
export type ShelfSanitiseFailure = 'undecodable' | 'empty' | 'too-large-to-decode';

export class ShelfSanitiseError extends Error {
  constructor(readonly failure: ShelfSanitiseFailure, message: string) {
    super(message);
    this.name = 'ShelfSanitiseError';
  }
}

// ---------------------------------------------------------------------------
// Ο καθαριστής
// ---------------------------------------------------------------------------

/**
 * **Ωμή εικόνα → δημοσιεύσιμα bytes**, χωρίς κανένα μεταδεδομένο του ανθρώπου.
 *
 * Τι φεύγει: EXIF *(GPS, συσκευή, ώρα λήψης, σειριακός αριθμός φακού)*, IPTC, XMP,
 * ενσωματωμένα thumbnails *(που κρατούν **δικό τους** αντίγραφο των μεταδεδομένων)*
 * και το χρωματικό προφίλ.
 *
 * 🔑 **ΤΟ `.rotate()` ΕΙΝΑΙ ΑΠΑΡΑΙΤΗΤΟ ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΛΛΩΠΙΣΜΟΣ.** Ο προσανατολισμός
 * μιας φωτογραφίας κινητού ζει **μέσα στο EXIF**. Αν αφαιρέσεις το EXIF χωρίς να τον
 * εφαρμόσεις πρώτα, η δημοσιευμένη εικόνα βγαίνει **γυρισμένη στο πλάι** — δηλαδή ο
 * καθαρισμός θα κατέστρεφε ό,τι υποτίθεται ότι προστατεύει. Το `.rotate()` **χωρίς
 * όρισμα** εφαρμόζει τη στροφή του EXIF και μετά την πετά.
 *
 * ⚠️ **`withMetadata()` ΠΟΤΕ.** Το `sharp` δεν αντιγράφει μεταδεδομένα από μόνο του·
 * η **μόνη** διαδρομή που θα τα επανέφερε είναι εκείνη η κλήση. Άγκυρα την φυλάει.
 *
 * @throws {ShelfSanitiseError} όταν τα bytes δεν είναι αποκωδικοποιήσιμη εικόνα.
 */
export async function sanitiseImageForShelf(input: Buffer): Promise<SanitisedShelfAsset> {
  if (input.length === 0) {
    throw new ShelfSanitiseError('empty', 'Κενά bytes — δεν υπάρχει εικόνα να καθαριστεί');
  }

  try {
    const { data, info } = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({
        width: PUBLIC_SHELF_MAX_EDGE_PX,
        height: PUBLIC_SHELF_MAX_EDGE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: PUBLIC_SHELF_WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: data,
      ext: 'webp',
      contentType: PUBLIC_SHELF_IMAGE_CONTENT_TYPE,
      width: info.width,
      height: info.height,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Το αρχείο δεν είναι αποκωδικοποιήσιμη εικόνα — δεν δημοσιεύεται', {
      bytes: input.length,
      error: message,
    });
    throw new ShelfSanitiseError('undecodable', message);
  }
}
