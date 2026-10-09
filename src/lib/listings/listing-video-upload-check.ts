/**
 * @fileoverview **«ΘΑ ΜΠΟΡΕΙ ΑΥΤΟ ΤΟ ΒΙΝΤΕΟ ΝΑ ΔΗΜΟΣΙΕΥΤΕΙ;»** — η ερώτηση του browser, **πριν** φύγει ένα byte.
 * @related ADR-907 §10.9 · lib/media/mp4-boxes (`inspectMp4`) · listing-video-policy · storage.rules (`isListingVideoUpload`)
 * @module lib/listings/listing-video-upload-check
 *
 * 🔑 **Ο ΙΔΙΟΣ κριτής με τον ψήστη του δημόσιου ραφιού** (`inspectMp4` + `LISTING_VIDEO_LIMITS`): ό,τι λέει «δεκτό» εδώ
 * είναι ό,τι θα δεχτεί ο διακομιστής στη δημοσίευση. Διαβάζει μόνο τα κουτιά (λίγα KB) πάνω σε `Blob.slice` — ένα αρχείο
 * 100 MB κρίνεται χωρίς να φορτωθεί στη μνήμη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΤΥΜΗΓΟΡΙΕΣ, ΚΑΙ Η ΤΟΜΗ ΤΟΥΣ ΕΙΝΑΙ ΟΙ ΔΥΟ ΠΟΡΤΕΣ ΤΟΥ ΚΑΝΟΝΑ ΑΠΟΘΗΚΕΥΣΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάδος «βίντεο» μιας μονάδας δέχεται αρχεία από δύο πόρτες: τη **γενική** (κάθε αρχείο < 50 MB — υλικό του γραφείου:
 * πρόοδος εργασιών, εγγραφή από κάμερα σε WebM) και την πόρτα του **βίντεο αγγελίας** (MP4 ως 100 MB), που υπάρχει
 * **μόνο** για ό,τι θα δημοσιευτεί.
 *
 * - **`blocked`** — δεν δημοσιεύεται **και** δεν χωρά στη γενική πόρτα. Ο κανόνας θα το αρνιόταν ούτως ή άλλως, αλλά
 *   αφού ταξιδέψουν τα bytes και με `storage/unauthorized`. Εδώ το μαθαίνει αμέσως, με το όνομα του λόγου.
 * - **`unpublishable`** — δεν δημοσιεύεται, αλλά χωρά στη γενική πόρτα: **ανεβαίνει** ως υλικό του γραφείου, και ο
 *   άνθρωπος μαθαίνει τώρα (όχι τη μέρα της δημοσίευσης) γιατί η αγγελία δεν θα το δείξει και τι να αλλάξει.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — ούτε React, ούτε Firebase: η κρίση δοκιμάζεται με συνθετικά bytes.
 */

import { ENTITY_TYPES, FILE_CATEGORIES, type EntityType, type FileCategory } from '@/config/domain-constants';
import { UPLOAD_LIMITS } from '@/config/file-upload-config';
import { inspectMp4, type ByteSource, type Mp4Refusal } from '@/lib/media/mp4-boxes';

import { LISTING_VIDEO_CONTENT_TYPE, LISTING_VIDEO_LIMITS } from './listing-video-policy';

/** Η ετυμηγορία για ένα αρχείο που πάει στον κάδο βίντεο μιας μονάδας. */
export type ListingVideoUploadVerdict =
  | { readonly kind: 'publishable' }
  | { readonly kind: 'unpublishable'; readonly refusal: Mp4Refusal }
  | { readonly kind: 'blocked'; readonly refusal: Mp4Refusal };

/**
 * Τα όρια της πολιτικής στις μονάδες που διαβάζει ο άνθρωπος (MB · δευτερόλεπτα) — οι **παράμετροι** των μηνυμάτων
 * άρνησης. Ο αριθμός δεν γράφεται ποτέ μέσα σε κείμενο: αλλαγή στην πολιτική αλλάζει και το μήνυμα.
 */
export const LISTING_VIDEO_LIMIT_LABELS = {
  maxMb: LISTING_VIDEO_LIMITS.maxBytes / (1024 * 1024),
  maxSeconds: LISTING_VIDEO_LIMITS.maxDurationSec,
} as const;

/**
 * **Πάει αυτό το ανέβασμα στον κάδο από τον οποίο δημοσιεύεται το βίντεο αγγελίας;** — το κάτοπτρο του
 * `isListingVideoUpload()` των κανόνων και του κριτή `isDeliverableListingVideo` (μονάδα · `videos`).
 */
export function isListingVideoSlot(entityType: EntityType, category: FileCategory): boolean {
  return entityType === ENTITY_TYPES.PROPERTY && category === FILE_CATEGORIES.VIDEOS;
}

/** Ένα `Blob` ως πηγή bytes του αναγνώστη κουτιών — διαβάζει **μόνο** το κομμάτι που ζητήθηκε. */
export function blobByteSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start, length) => new Uint8Array(await blob.slice(start, start + length).arrayBuffer()),
  };
}

/**
 * Ο λόγος που το αρχείο **δεν** δημοσιεύεται, ή `null`.
 *
 * ⚠️ Το δηλωμένο MIME κρίνεται **μετά** τα bytes και μόνο αν τα bytes πέρασαν: ο κριτής της δημοσίευσης ζητά
 * `video/mp4` στην εγγραφή, άρα αληθινό MP4 που ο browser δήλωσε αλλιώς δεν θα έφευγε ποτέ — και θα το μάθαινε κανείς
 * μόνο από την απουσία του. Για αρχείο που **δεν** είναι MP4 το όνομα του αναγνώστη (`quicktime-container`…) λέει περισσότερα.
 */
async function publicationRefusal(file: Blob): Promise<Mp4Refusal | null> {
  const inspection = await inspectMp4(blobByteSource(file), LISTING_VIDEO_LIMITS);
  if (!inspection.ok) return inspection.refusal;
  return file.type === LISTING_VIDEO_CONTENT_TYPE ? null : 'not-mp4';
}

/** **Η ετυμηγορία** — δεν πετά ποτέ (ο αναγνώστης κουτιών επιστρέφει άρνηση ακόμη και για τυχαία bytes). */
export async function judgeListingVideoUpload(file: Blob): Promise<ListingVideoUploadVerdict> {
  const refusal = await publicationRefusal(file);
  if (refusal === null) return { kind: 'publishable' };

  // Ίδια σύγκριση με τον κανόνα (`size < 50 MB`): ό,τι δεν χωρά στη γενική πόρτα δεν έχει άλλη.
  return file.size < UPLOAD_LIMITS.MAX_FILE_SIZE ? { kind: 'unpublishable', refusal } : { kind: 'blocked', refusal };
}
