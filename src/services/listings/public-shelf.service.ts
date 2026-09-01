/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΡΑΦΙΟΥ** — συμφιλίωση, όχι εφαρμογή διαφορών.
 * @related ADR-841 §7 Α12 (.4 · .5 · .6) · publish-public-listing.ts · public-shelf-sanitise.ts
 * @module services/listings/public-shelf.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΥΜΒΟΛΑΙΟ, ΣΕ ΤΡΕΙΣ ΓΡΑΜΜΕΣ — **ταυτόσημο** με τον γραφέα της προβολής
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   επιθυμητό σύνολο  ⇒ το πρόθεμα γίνεται **ακριβώς** αυτό  (ίδια είσοδος ⇒ ίδιο ράφι)
 *   κενό σύνολο       ⇒ το πρόθεμα **αδειάζει**              (η απόσυρση ΣΥΜΒΑΙΝΕΙ)
 *   ταυτότητα         = το ίδιο το `listingId`               (καμία νέα γεννήτρια)
 *
 * 🔑 **ΣΥΜΦΙΛΙΩΣΗ ΚΑΙ ΠΟΤΕ «ΕΦΑΡΜΟΓΗ ΣΥΜΒΑΝΤΟΣ».** Το `writeListingProjection` κάνει
 * ολικό `set()` επειδή μια μερική ενημέρωση θα άφηνε το δημόσιο έγγραφο **μείγμα δύο
 * καταστάσεων**. Εδώ ισχύει το ίδιο σε bytes, και με **μεγαλύτερο** διακύβευμα: ένας
 * σβήστης «κατά συμβάν» θα έχανε το συμβάν *(διαρροή που μεγαλώνει)* — ενώ η
 * συμφιλίωση **αυτοϊάται** σε κάθε επόμενη γραφή, και η επανασύνθεση
 * (`rebuildAllPublicListings`) την ξανατρέχει για όλες *(N.7.2 #4)*.
 *
 * 🔴 **ΚΑΙ ΓΙ' ΑΥΤΟ Η ΑΠΟΣΥΡΣΗ ΕΙΝΑΙ ΑΣΦΑΛΗΣ ΠΑΡΟΛΟ ΠΟΥ ΕΙΝΑΙ ΑΝΑΣΤΡΕΨΙΜΗ.** Το
 * `api/owner-properties/[id]/route.ts` δεν έχει `DELETE`: η απόσυρση είναι
 * `lifecycle: 'withdrawn'` και ο κάτοχος **επαναφέρει**. Ένα ράφι που άδειασε με
 * συμφιλίωση ξαναγεμίζει με συμφιλίωση — καμία κατάσταση δεν χάνεται, γιατί το ράφι
 * **δεν κατέχει** κατάσταση: είναι **παράγωγο**.
 *
 * ⚠️ **ΔΕΝ ΔΗΜΙΟΥΡΓΕΙ ΤΟΝ ΚΑΔΟ.** Η δημιουργία δημόσιου κάδου είναι **πράξη**, όχι
 * παρενέργεια αιτήματος — ζει στο {@link module:services/listings/public-shelf-provision}.
 * Αν ο κάδος λείπει, η δημοσίευση αποτυγχάνει **θορυβωδώς** και η επανασύνθεση τη
 * διορθώνει· δεν γεννιέται δημόσιος κάδος επειδή κάποιος πάτησε «αποθήκευση».
 */

import type { Bucket } from '@google-cloud/storage';
import { createHash } from 'node:crypto';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import { getAdminBucket, getAdminStorage } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import {
  PUBLIC_SHELF_CACHE_CONTROL,
  buildPublicShelfKey,
  parsePublicShelfKey,
  publicShelfPrefix,
  publicShelfUrl,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';

import { sanitiseImageForShelf } from './public-shelf-sanitise';

const logger = createModuleLogger('public-shelf');

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/** Ένα δημοσιευμένο αντικείμενο, όπως το βλέπει ο κόσμος. */
export interface PublicShelfObject {
  readonly key: string;
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/** Τι έκανε η συμφιλίωση — ρητά, ώστε ο καλών να **μετρήσει**. */
export interface PublicShelfReport {
  readonly outcome: 'reconciled' | 'failed';
  /** Τα αντικείμενα που **είναι** στο ράφι μετά τη συμφιλίωση. */
  readonly published: readonly PublicShelfObject[];
  /** Πόσα αντικείμενα **έφυγαν** επειδή έπαψαν να ανήκουν στο επιθυμητό σύνολο. */
  readonly removed: number;
  /** Πόσες πηγές **δεν** μπόρεσαν να καθαριστούν (κατεστραμμένο ή μη-εικόνα). */
  readonly rejected: number;
}

// ---------------------------------------------------------------------------
// Πρόσβαση στον κάδο
// ---------------------------------------------------------------------------

/** Ο **ΜΟΝΟΣ** δείκτης προς τον δημόσιο κάδο σε όλο το δέντρο. */
function shelfBucket(): Bucket {
  return getAdminStorage().bucket(GCS_PUBLIC_MEDIA_BUCKET);
}

/** sha256 των bytes, πεζό δεκαεξαδικό — **το κλειδί γεννιέται εδώ**. */
function contentAddress(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// ---------------------------------------------------------------------------
// Παραγωγή του επιθυμητού συνόλου
// ---------------------------------------------------------------------------

/** Ένα καθαρισμένο αρχείο μαζί με τη διεύθυνση που **του έδωσαν τα ίδια του τα bytes**. */
interface AddressedAsset {
  readonly key: string;
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly width: number;
  readonly height: number;
}

/**
 * Διαβάζει ένα πρωτότυπο από τον **ιδιωτικό** κάδο, το καθαρίζει, και το διευθυνσιοδοτεί.
 *
 * Επιστρέφει `null` όταν το αρχείο λείπει ή δεν είναι αποκωδικοποιήσιμη εικόνα: **μία
 * χαλασμένη φωτογραφία δεν εμποδίζει τη δημοσίευση των υπόλοιπων**, αλλά μετριέται
 * (`rejected`) ώστε να μη χαθεί σιωπηλά.
 */
async function addressOne(
  listingId: string,
  source: PublicShelfSource,
): Promise<AddressedAsset | null> {
  try {
    const [raw] = await getAdminBucket().file(source.privateStoragePath).download();
    const clean = await sanitiseImageForShelf(raw);
    const key = buildPublicShelfKey({
      listingId,
      contentHash: contentAddress(clean.bytes),
      ext: clean.ext,
    });
    return {
      key,
      bytes: clean.bytes,
      contentType: clean.contentType,
      width: clean.width,
      height: clean.height,
    };
  } catch (error) {
    logger.warn('Πηγή δεν δημοσιεύεται — δεν διαβάστηκε ή δεν καθαρίστηκε', {
      listingId,
      privateStoragePath: source.privateStoragePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Οι δύο πλευρές της συμφιλίωσης
// ---------------------------------------------------------------------------

/**
 * Ανεβάζει ό,τι **λείπει**. Ό,τι υπάρχει ήδη **δεν ξαναγράφεται**.
 *
 * 🔑 Το «υπάρχει ήδη» είναι απάντηση **ανά byte**, όχι ανά χρόνο: ίδια bytes ⇒ ίδιο
 * κλειδί ⇒ **μηδέν** εγγραφή, μηδέν κόστος, μηδέν ακύρωση cache *(N.7.2 #3)*.
 */
async function uploadMissing(
  bucket: Bucket,
  desired: readonly AddressedAsset[],
  existing: ReadonlySet<string>,
): Promise<void> {
  const missing = desired.filter((asset) => !existing.has(asset.key));

  await Promise.all(
    missing.map((asset) =>
      bucket.file(asset.key).save(asset.bytes, {
        contentType: asset.contentType,
        metadata: { cacheControl: PUBLIC_SHELF_CACHE_CONTROL },
      }),
    ),
  );
}

/**
 * Σβήνει ό,τι **περισσεύει** μέσα στο πρόθεμα **αυτής** της αγγελίας.
 *
 * ⚠️ **Αγγίζει ΜΟΝΟ κλειδιά που αναγνωρίζει** ({@link parsePublicShelfKey}): ό,τι
 * βρεθεί εκεί και δεν είναι δικής μας μορφής **μένει**. Ο αυστηρός γραφέας απέναντι
 * στον ανεκτικό αναγνώστη — ένας σαρωτής που σβήνει ό,τι δεν καταλαβαίνει είναι ο
 * σαρωτής της 27/08 *(«θα έσβηνε την αγορά»)*.
 */
async function deleteExtra(
  bucket: Bucket,
  prefix: string,
  desired: ReadonlySet<string>,
): Promise<number> {
  const [files] = await bucket.getFiles({ prefix });

  const doomed = files.filter(
    (file) => parsePublicShelfKey(file.name) !== null && !desired.has(file.name),
  );

  await Promise.all(doomed.map((file) => file.delete({ ignoreNotFound: true })));
  return doomed.length;
}

// ---------------------------------------------------------------------------
// Η μία δημόσια είσοδος
// ---------------------------------------------------------------------------

/**
 * **Κάνε το ράφι αυτής της αγγελίας ΑΚΡΙΒΩΣ ίσο με το επιθυμητό σύνολο.**
 *
 * Κενό σύνολο ⇒ το πρόθεμα αδειάζει. Ίδιο σύνολο δύο φορές ⇒ ταυτόσημο αποτέλεσμα,
 * χωρίς δεύτερη εγγραφή.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με το `writeListingProjection`: η αποτυχία
 * του δημόσιου ραφιού **δεν** ακυρώνει την αποθήκευση του κατόχου. Η αποτυχία
 * επιστρέφεται ονομαστικά ώστε η επανασύνθεση να τη διορθώσει.
 */
export async function reconcilePublicShelf(
  listingId: string,
  sources: readonly PublicShelfSource[],
): Promise<PublicShelfReport> {
  try {
    const prefix = publicShelfPrefix(listingId);
    const bucket = shelfBucket();

    const addressed = await Promise.all(sources.map((source) => addressOne(listingId, source)));
    const desired = addressed.filter((asset): asset is AddressedAsset => asset !== null);
    const desiredKeys = new Set(desired.map((asset) => asset.key));

    const [existingFiles] = await bucket.getFiles({ prefix });
    const existingKeys = new Set(existingFiles.map((file) => file.name));

    await uploadMissing(bucket, desired, existingKeys);
    const removed = await deleteExtra(bucket, prefix, desiredKeys);

    return {
      outcome: 'reconciled',
      published: desired.map((asset) => ({
        key: asset.key,
        url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, asset.key),
        width: asset.width,
        height: asset.height,
      })),
      removed,
      rejected: addressed.length - desired.length,
    };
  } catch (error) {
    logger.error('Το δημόσιο ράφι ΔΕΝ συμφιλιώθηκε — μένει ΜΠΑΓΙΑΤΙΚΟ ως την επανασύνθεση', {
      listingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'failed', published: [], removed: 0, rejected: 0 };
  }
}
