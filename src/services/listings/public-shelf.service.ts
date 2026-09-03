/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΡΑΦΙΟΥ** — συμφιλίωση, όχι εφαρμογή διαφορών.
 * @related ADR-841 §7 Α12 (.4 · .5 · .6) · Α2 (.2 · .3) · publish-public-listing.ts
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η Φ3 ΠΡΟΣΘΕΣΕ **ΠΑΡΑΓΩΓΑ**, ΚΑΙ ΜΑΖΙ ΤΟΥΣ ΕΝΑ ΚΟΣΤΟΣ ΠΟΥ ΕΠΡΕΠΕ ΝΑ ΛΥΘΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Αυτή η συνάρτηση τρέχει σε **κάθε αποθήκευση** του κατόχου, μέσα στη διαδρομή του
 * αιτήματος. Με τρία παράγωγα ανά φωτογραφία *(Α2.2)*, μια αποθήκευση **τίτλου** θα
 * κατέβαζε και θα ξανακωδικοποιούσε **κάθε** δημοσιευμένη φωτογραφία.
 *
 * 🏆 **Η λύση είναι ΜΕΤΑΔΕΔΟΜΕΝΑ ΠΑΝΩ ΣΤΟ ΙΔΙΟ ΤΟ ΑΝΤΙΚΕΙΜΕΝΟ** *(Α2.3)*: κάθε
 * δημοσιευμένο παράγωγο κουβαλά **ποιο πρωτότυπο** το γέννησε *(αδιαφανές `sourceRef`)*
 * και **με ποια συνταγή** *(`recipe`)*. Η συμφιλίωση ρωτά **μόνο τη γενιά** του
 * ιδιωτικού αρχείου — **κανένα κατέβασμα, καμία αποκωδικοποίηση** — και αν όλα τα
 * παράγωγα υπάρχουν ήδη με ίδια πηγή και ίδια συνταγή, **δεν κάνει τίποτα**.
 *
 * ✅ **Η αυτο-ίαση ΔΕΝ χάνεται**: η απαρίθμηση του προθέματος και ο {@link deleteExtra}
 * τρέχουν **πάντα**. Αυτό που παραλείπεται είναι μόνο η αποκωδικοποίηση bytes που
 * **αποδεδειγμένα** υπάρχουν.
 *
 * 🔴 **ΤΟ `sourceRef` ΕΙΝΑΙ ΧΑΣΑΡΙΣΜΕΝΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΑΣΦΑΛΕΙΑ.** Ο ρόλος
 * `legacyObjectReader` δίνει `objects.get`, που επιστρέφει **και τα μεταδεδομένα**. Ωμό
 * μονοπάτι εκεί μέσα θα δημοσίευε το `owner_properties/{userId}/…` ⇒ **διαρροή του
 * `userId` σε ανώνυμο**. Είναι το ίδιο μάθημα με το `objects.list` της Α12.11, μία
 * βαθμίδα πιο κάτω.
 */

import type { Bucket, File } from '@google-cloud/storage';
import { createHash } from 'node:crypto';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import { getAdminBucket, getAdminStorage } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import {
  PUBLIC_SHELF_CACHE_CONTROL,
  buildPublicShelfKey,
  parsePublicShelfKey,
  publicShelfPrefix,
  publicShelfUrl,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';

import {
  PUBLIC_SHELF_RECIPE,
  PUBLIC_SHELF_VARIANT_WIDTHS,
  sanitiseImageVariants,
} from './public-shelf-sanitise';

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

/**
 * **Μια εικόνα και όλα τα παράγωγά της** — η μονάδα που καταλαβαίνει η οθόνη.
 *
 * 🔑 Το ομαδοποιημένο σχήμα είναι **απαίτηση της Α2.2**: κάθε πλάτος έχει **δική του**
 * διεύθυνση περιεχομένου, οπότε αν η αναφορά ήταν επίπεδη λίστα, ο καλών θα έπρεπε να
 * μαντέψει ποια bytes ανήκουν στην ίδια φωτογραφία — δηλαδή θα γεννιόταν **δεύτερος**
 * κριτής ταυτότητας δίπλα στο content-addressing.
 */
export interface PublicShelfImage {
  /** Το **μεγαλύτερο** διαθέσιμο παράγωγο — ο στόχος του `src`. */
  readonly canonical: PublicShelfObject;
  /** Όλα τα διακριτά παράγωγα, **αύξον πλάτος**. Περιέχει το {@link canonical}. */
  readonly variants: readonly PublicShelfObject[];
  /**
   * **Τι ήταν αυτά τα bytes**, όπως το δήλωσε η πηγή — ταξιδεύει **αυτούσιο** (Α17.4).
   *
   * 🔴 **ΓΙΑΤΙ ΤΑΞΙΔΕΥΕΙ ΚΑΙ ΔΕΝ ΑΝΤΙΣΤΟΙΧΙΖΕΤΑΙ ΜΕ ΔΕΙΚΤΗ ΣΤΗΝ ΕΞΟΔΟ:** το
   * {@link reconcilePublicShelf} **πετά** τις πηγές που δεν καθαρίστηκαν, άρα το
   * `published[i]` **δεν** είναι το `sources[i]`. Ένας καλών που θα ζευγάρωνε με τη θέση
   * θα γινόταν σιωπηλά λάθος την **πρώτη** φορά που μια εικόνα απορρίπτεται — και το
   * λάθος θα ήταν «η κάτοψη ανακοινώθηκε ως φωτογραφία», δηλαδή **ακριβώς** το Ο-20.
   *
   * ⛔ **Το ράφι ΔΕΝ το διαβάζει ΠΟΤΕ για να αποφασίσει κάτι.** Καμία διακλάδωση αυτού
   * του αρχείου δεν το κοιτά· η **μία** ερμηνεία ζει στο `withPublishedGallery`.
   */
  readonly material: ListingMaterial;
}

/** Τι έκανε η συμφιλίωση — ρητά, ώστε ο καλών να **μετρήσει**. */
export interface PublicShelfReport {
  readonly outcome: 'reconciled' | 'failed';
  /** Οι εικόνες που **είναι** στο ράφι μετά τη συμφιλίωση, στη σειρά της επιλογής. */
  readonly published: readonly PublicShelfImage[];
  /** Πόσα αντικείμενα **έφυγαν** επειδή έπαψαν να ανήκουν στο επιθυμητό σύνολο. */
  readonly removed: number;
  /** Πόσες πηγές **δεν** μπόρεσαν να καθαριστούν (κατεστραμμένο ή μη-εικόνα). */
  readonly rejected: number;
}

/** Ένα παράγωγο έτοιμο να **ανέβει** — υπάρχει μόνο όταν δεν βρέθηκε ήδη στο ράφι. */
interface PendingUpload {
  readonly key: string;
  readonly bytes: Buffer;
  readonly contentType: string;
  readonly sourceRef: string;
  readonly width: number;
  readonly height: number;
  /** Τα **ζητούμενα** πλάτη που εξυπηρετεί αυτό το ένα αντικείμενο (δες `groupUploads`). */
  readonly requestedWidths: readonly number[];
}

/** Ό,τι έμαθε η συμφιλίωση για **μία** πηγή. */
interface AddressedImage {
  readonly variants: readonly PublicShelfObject[];
  readonly uploads: readonly PendingUpload[];
  /** Δες {@link PublicShelfImage.material} — κουβαλιέται, δεν ερμηνεύεται. */
  readonly material: ListingMaterial;
}

// ---------------------------------------------------------------------------
// Μεταδεδομένα του ραφιού — τα ονόματα γράφονται **μία** φορά
// ---------------------------------------------------------------------------

const META_SOURCE_REF = 'shelfSourceRef';
const META_RECIPE = 'shelfRecipe';
const META_REQUESTED_WIDTHS = 'shelfRequestedWidths';
const META_PIXEL_WIDTH = 'shelfPixelWidth';
const META_PIXEL_HEIGHT = 'shelfPixelHeight';

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

/**
 * **Ποιο πρωτότυπο, σε ποια έκδοση** — χασαρισμένο, γιατί το αποτέλεσμα γίνεται
 * **δημόσιο μεταδεδομένο** (δες το σκεπτικό του module).
 *
 * 🔑 Η **γενιά** του GCS αλλάζει σε κάθε επανεγγραφή του ιδιωτικού αρχείου, άρα ένα
 * αντικατεστημένο πρωτότυπο παίρνει **νέα** αναφορά και τα παλιά παράγωγα παύουν να
 * ταιριάζουν — αυτο-ακύρωση, χωρίς κανέναν να τη θυμηθεί.
 */
function sourceReference(privateStoragePath: string, generation: string): string {
  return createHash('sha256').update(`${privateStoragePath}#${generation}`).digest('hex');
}

// ---------------------------------------------------------------------------
// Η μνήμη του ραφιού — τι υπάρχει ήδη, και από ποιο πρωτότυπο
// ---------------------------------------------------------------------------

/**
 * **Τα παράγωγα αυτής της πηγής που ΥΠΑΡΧΟΥΝ ΗΔΗ**, ανά ζητούμενο πλάτος.
 *
 * ⚠️ Απαιτεί ταύτιση **και** στη συνταγή: αλλαγή ποιότητας ή γκάμας πλατών **οφείλει**
 * να ακυρώσει τα παλιά παράγωγα, και η {@link PUBLIC_SHELF_RECIPE} είναι παραγόμενη
 * ακριβώς για να μην μπορεί να ξεχαστεί.
 */
function cachedVariants(
  existing: readonly File[],
  sourceRef: string,
): ReadonlyMap<number, PublicShelfObject> {
  const byWidth = new Map<number, PublicShelfObject>();

  for (const file of existing) {
    const custom = file.metadata.metadata;
    if (custom?.[META_SOURCE_REF] !== sourceRef) continue;
    if (custom[META_RECIPE] !== PUBLIC_SHELF_RECIPE) continue;

    const object: PublicShelfObject = {
      key: file.name,
      url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, file.name),
      width: Number(custom[META_PIXEL_WIDTH]),
      height: Number(custom[META_PIXEL_HEIGHT]),
    };
    if (!Number.isFinite(object.width) || !Number.isFinite(object.height)) continue;

    for (const requested of String(custom[META_REQUESTED_WIDTHS] ?? '').split(',')) {
      const width = Number(requested);
      if (Number.isFinite(width)) byWidth.set(width, object);
    }
  }

  return byWidth;
}

/**
 * **Παράγωγα → αντικείμενα προς ανέβασμα**, με τα ταυτόσημα **συγχωνευμένα**.
 *
 * 🔑 Μια φωτογραφία 800px δίνει για τα 1280 **και** τα 2560 τα **ίδια bytes** ⇒ ίδιο
 * sha256 ⇒ **ένα** αντικείμενο. Η συγχώνευση δεν είναι βελτιστοποίηση: χωρίς αυτήν, δύο
 * παράλληλες εγγραφές θα διεκδικούσαν το **ίδιο** κλειδί, και το `requestedWidths` του
 * νικητή θα έλεγε ψέματα στην επόμενη συμφιλίωση.
 */
function groupUploads(
  listingId: string,
  sourceRef: string,
  assets: readonly { bytes: Buffer; contentType: string; width: number; height: number }[],
): readonly PendingUpload[] {
  const byKey = new Map<string, PendingUpload>();

  assets.forEach((asset, index) => {
    const key = buildPublicShelfKey({
      listingId,
      contentHash: contentAddress(asset.bytes),
      ext: 'webp',
    });
    const requested = PUBLIC_SHELF_VARIANT_WIDTHS[index];
    const already = byKey.get(key);

    byKey.set(key, {
      key,
      bytes: asset.bytes,
      contentType: asset.contentType,
      sourceRef,
      width: asset.width,
      height: asset.height,
      requestedWidths: [...(already?.requestedWidths ?? []), requested],
    });
  });

  return [...byKey.values()];
}

// ---------------------------------------------------------------------------
// Παραγωγή του επιθυμητού συνόλου
// ---------------------------------------------------------------------------

/**
 * Διαβάζει ένα πρωτότυπο από τον **ιδιωτικό** κάδο, το καθαρίζει σε **όλα** τα πλάτη,
 * και τα διευθυνσιοδοτεί.
 *
 * Επιστρέφει `null` όταν το αρχείο λείπει ή δεν είναι αποκωδικοποιήσιμη εικόνα: **μία
 * χαλασμένη φωτογραφία δεν εμποδίζει τη δημοσίευση των υπόλοιπων**, αλλά μετριέται
 * (`rejected`) ώστε να μη χαθεί σιωπηλά.
 *
 * 🔑 **Η γρήγορη διαδρομή είναι ΟΛΟΚΛΗΡΗ ή ΚΑΜΙΑ**: αν έστω ένα πλάτος λείπει, το
 * πρωτότυπο κατεβαίνει και αποκωδικοποιείται ούτως ή άλλως — μερική
 * επαναχρησιμοποίηση θα ήταν δεύτερη διαδρομή με δικά της σφάλματα για να γλιτώσει
 * **μία** κωδικοποίηση από τρεις.
 */
async function addressOne(
  listingId: string,
  source: PublicShelfSource,
  existing: readonly File[],
): Promise<AddressedImage | null> {
  try {
    const original = getAdminBucket().file(source.privateStoragePath);
    const [meta] = await original.getMetadata();
    const sourceRef = sourceReference(source.privateStoragePath, String(meta.generation ?? ''));

    const hit = fullCacheHit(cachedVariants(existing, sourceRef));
    if (hit !== null) return { variants: distinctByKey(hit), uploads: [], material: source.material };

    const [raw] = await original.download();
    const uploads = groupUploads(listingId, sourceRef, [...(await sanitiseImageVariants(raw))]);
    return { variants: distinctByKey(uploads.map(toObject)), uploads, material: source.material };
  } catch (error) {
    logger.warn('Πηγή δεν δημοσιεύεται — δεν διαβάστηκε ή δεν καθαρίστηκε', {
      listingId,
      privateStoragePath: source.privateStoragePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * **Καλύπτονται ΟΛΑ τα ζητούμενα πλάτη;** — `null` αν λείπει έστω ένα.
 *
 * ⚠️ **Όλα ή τίποτα, επίτηδες**: μερική επαναχρησιμοποίηση θα ήταν δεύτερη διαδρομή με
 * δικά της σφάλματα, για να γλιτώσει **μία** κωδικοποίηση από τρεις — ενώ το ακριβό
 * βήμα (κατέβασμα + αποκωδικοποίηση) θα πληρωνόταν ούτως ή άλλως.
 */
function fullCacheHit(
  cached: ReadonlyMap<number, PublicShelfObject>,
): readonly PublicShelfObject[] | null {
  const found: PublicShelfObject[] = [];

  for (const width of PUBLIC_SHELF_VARIANT_WIDTHS) {
    const object = cached.get(width);
    if (object === undefined) return null;
    found.push(object);
  }

  return found;
}

/** Ένα αντικείμενο προς ανέβασμα, όπως θα το δει ο κόσμος. */
function toObject(upload: PendingUpload): PublicShelfObject {
  return {
    key: upload.key,
    url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, upload.key),
    width: upload.width,
    height: upload.height,
  };
}

/**
 * **Τα διακριτά παράγωγα, αύξον πλάτος.**
 *
 * ⚠️ Η ταυτότητα είναι το **κλειδί**, ποτέ το πλάτος: δύο ζητούμενα πλάτη που έδωσαν τα
 * ίδια bytes είναι **ένα** αντικείμενο, και μια δεύτερη γραμμή `srcset` για το ίδιο URL
 * θα ζητούσε από τον περιηγητή να διαλέξει ανάμεσα σε δύο ταυτόσημα.
 */
function distinctByKey(objects: readonly PublicShelfObject[]): readonly PublicShelfObject[] {
  return [...new Map(objects.map((object) => [object.key, object])).values()].sort(
    (a, b) => a.width - b.width,
  );
}

// ---------------------------------------------------------------------------
// Οι δύο πλευρές της συμφιλίωσης
// ---------------------------------------------------------------------------

/**
 * Ανεβάζει ό,τι **λείπει**. Ό,τι υπάρχει ήδη **δεν ξαναγράφεται**.
 *
 * 🔑 Το «υπάρχει ήδη» είναι απάντηση **ανά byte**, όχι ανά χρόνο: ίδια bytes ⇒ ίδιο
 * κλειδί ⇒ **μηδέν** εγγραφή, μηδέν κόστος, μηδέν ακύρωση cache *(N.7.2 #3)*.
 *
 * ⚠️ Τα μεταδεδομένα **γράφονται μαζί με τα bytes**, ποτέ σε δεύτερη κλήση: ένα
 * αντικείμενο χωρίς `sourceRef` είναι αόρατο στη γρήγορη διαδρομή, και μια αποτυχία
 * ανάμεσα στις δύο κλήσεις θα άφηνε **μόνιμη** αποτυχία επαναχρησιμοποίησης.
 */
async function uploadMissing(
  bucket: Bucket,
  uploads: readonly PendingUpload[],
  existing: ReadonlySet<string>,
): Promise<void> {
  const missing = uploads.filter((upload) => !existing.has(upload.key));

  await Promise.all(
    missing.map((upload) =>
      bucket.file(upload.key).save(upload.bytes, {
        contentType: upload.contentType,
        metadata: {
          cacheControl: PUBLIC_SHELF_CACHE_CONTROL,
          metadata: {
            [META_SOURCE_REF]: upload.sourceRef,
            [META_RECIPE]: PUBLIC_SHELF_RECIPE,
            [META_REQUESTED_WIDTHS]: upload.requestedWidths.join(','),
            [META_PIXEL_WIDTH]: String(upload.width),
            [META_PIXEL_HEIGHT]: String(upload.height),
          },
        },
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
  existingFiles: readonly File[],
  desired: ReadonlySet<string>,
): Promise<number> {
  const doomed = existingFiles.filter(
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
 * χωρίς δεύτερη εγγραφή — και, από τη Φ3, **χωρίς δεύτερη αποκωδικοποίηση** *(Α2.3)*.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με το `writeListingProjection`: η αποτυχία
 * του δημόσιου ραφιού **δεν** ακυρώνει την αποθήκευση του κατόχου. Η αποτυχία
 * επιστρέφεται ονομαστικά ώστε η επανασύνθεση να τη διορθώσει.
 *
 * 🔑 **Η σειρά του `published` είναι η σειρά των `sources`** — δηλαδή η σειρά που
 * **δήλωσε** ο κάτοχος *(Α2.1)*. Καμία ταξινόμηση εδώ: θα ήταν σιωπηλή απόφαση για το
 * ποια φωτογραφία είναι «πρώτη», που είναι ακριβώς η πράξη που ανήκει στον άνθρωπο.
 */
export async function reconcilePublicShelf(
  listingId: string,
  sources: readonly PublicShelfSource[],
): Promise<PublicShelfReport> {
  try {
    const prefix = publicShelfPrefix(listingId);
    const bucket = shelfBucket();

    const [existingFiles] = await bucket.getFiles({ prefix });
    const addressed = await Promise.all(
      sources.map((source) => addressOne(listingId, source, existingFiles)),
    );
    const desired = addressed.filter((image): image is AddressedImage => image !== null);

    const desiredKeys = new Set(desired.flatMap((image) => image.variants.map((v) => v.key)));
    const existingKeys = new Set(existingFiles.map((file) => file.name));

    await uploadMissing(bucket, desired.flatMap((image) => image.uploads), existingKeys);
    const removed = await deleteExtra(bucket, existingFiles, desiredKeys);

    return {
      outcome: 'reconciled',
      published: desired.map((image) => ({
        canonical: image.variants[image.variants.length - 1],
        variants: image.variants,
        material: image.material,
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
