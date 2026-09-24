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
 *   ταυτότητα         = το ίδιο το `subjectId`               (καμία νέα γεννήτρια)
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

import type { File } from '@google-cloud/storage';

import { getAdminBucket } from '@/lib/firebaseAdmin';
import { createModuleLogger } from '@/lib/telemetry';
import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import {
  isRasterShelfKind,
  shelfRecipe,
  type PublicShelfKind,
  type RasterShelfKind,
  type ShelfFraming,
} from '@/services/upload/utils/public-shelf-kinds';

import {
  asLogMessage,
  deleteExtra,
  scanShelfPrefix,
  shelfFailure,
  uploadMissing,
} from './public-shelf-bucket';
import {
  cachedFocalPoint,
  cachedVariants,
  distinctByKey,
  encodeFocalPointMeta,
  fullCacheHit,
  groupUploads,
  META_FOCAL_POINT,
  sourceReference,
  toObject,
  toShelfWrite,
  type PendingUpload,
  type PublicShelfObject,
} from './public-shelf-plan';
import { sanitiseShelfImage } from './public-shelf-sanitise';
import { detectFocalPointInBytes } from './public-shelf-focal-point';

/**
 * ⚠️ **Επανεξαγωγή, ΟΧΙ δεύτερη δήλωση** — ο τύπος μετακόμισε στο `public-shelf-plan`
 * *(N.7.1, ADR-845 Φ4.0)*, αλλά η **δημόσια επιφάνεια** του ραφιού είναι εδώ: το
 * {@link PublicShelfImage} τον αναφέρει, και κανείς καταναλωτής δεν χρειάζεται να μάθει
 * ότι το σχέδιο χώρισε από τον γραφέα.
 */
export type { PublicShelfObject } from './public-shelf-plan';

const logger = createModuleLogger('public-shelf');

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------


/**
 * **Μια εικόνα και όλα τα παράγωγά της** — η μονάδα που καταλαβαίνει η οθόνη.
 *
 * 🔑 Το ομαδοποιημένο σχήμα είναι **απαίτηση της Α2.2**: κάθε πλάτος έχει **δική του**
 * διεύθυνση περιεχομένου, οπότε αν η αναφορά ήταν επίπεδη λίστα, ο καλών θα έπρεπε να
 * μαντέψει ποια bytes ανήκουν στην ίδια φωτογραφία — δηλαδή θα γεννιόταν **δεύτερος**
 * κριτής ταυτότητας δίπλα στο content-addressing.
 */
export interface PublicShelfImage<M> {
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
   * του αρχείου δεν το κοιτά· η **μία** ερμηνεία ζει στον καταναλωτή του κάθε είδους
   * *(`withPublishedGallery` για τις αγγελίες)*.
   *
   * 🔑 **Και γι' αυτό έγινε παράμετρος τύπου στο Στάδιο 2**: ένα πεδίο που κουβαλιέται
   * **αδιαφανώς** δεν έχει λόγο να ξέρει αν είναι κάτοψη ή λογότυπο. Ο τύπος τηρεί
   * επιτέλους αυτό που το σχόλιο υποσχόταν ήδη.
   */
  readonly material: M;
  /**
   * 🎯 **Το ΑΥΤΟΜΑΤΟ σημείο εστίασης** — γεννήθηκε από τα bytes (ADR-880). `null` ⇒ δεν ζητήθηκε
   * από τη γραμμή ή δεν βρέθηκε σήμα.
   */
  readonly focalPoint: PhotoFocalPoint | null;
  /**
   * 🎯 **Το σημείο που ΔΗΛΩΣΕ ο άνθρωπος** — κουβαλιέται **αδιαφανώς** από την πηγή, όπως το
   * {@link material}, και για τον **ίδιο** λόγο: το `published[i]` δεν είναι το `sources[i]`. Το ράφι
   * δεν το ερμηνεύει· η απόφαση *«ποιο κερδίζει»* ζει στο `resolvePhotoFocalPoint`.
   */
  readonly declaredFocalPoint: PhotoFocalPoint | null;
}

/** Τι έκανε η συμφιλίωση — ρητά, ώστε ο καλών να **μετρήσει**. */
export interface PublicShelfReport<M> {
  readonly outcome: 'reconciled' | 'failed';
  /** Οι εικόνες που **είναι** στο ράφι μετά τη συμφιλίωση, στη σειρά της επιλογής. */
  readonly published: readonly PublicShelfImage<M>[];
  /** Πόσα αντικείμενα **έφυγαν** επειδή έπαψαν να ανήκουν στο επιθυμητό σύνολο. */
  readonly removed: number;
  /** Πόσες πηγές **δεν** μπόρεσαν να καθαριστούν (κατεστραμμένο ή μη-εικόνα). */
  readonly rejected: number;
}


/** Ό,τι έμαθε η συμφιλίωση για **μία** πηγή. */
interface AddressedImage<M> {
  readonly variants: readonly PublicShelfObject[];
  readonly uploads: readonly PendingUpload[];
  /** Δες {@link PublicShelfImage.material} — κουβαλιέται, δεν ερμηνεύεται. */
  readonly material: M;
  /** Δες {@link PublicShelfImage.focalPoint}. */
  readonly focalPoint: PhotoFocalPoint | null;
  /** Δες {@link PublicShelfImage.declaredFocalPoint}. */
  readonly declaredFocalPoint: PhotoFocalPoint | null;
}

// ---------------------------------------------------------------------------
// Παραγωγή του επιθυμητού συνόλου
// ---------------------------------------------------------------------------

/** Η δημόσια όψη μιας διευθυνσιοδοτημένης εικόνας — το **μεγαλύτερο** πλάτος είναι το κανονικό. */
function toPublishedImage<M>(image: AddressedImage<M>): PublicShelfImage<M> {
  return {
    canonical: image.variants[image.variants.length - 1],
    variants: image.variants,
    material: image.material,
    focalPoint: image.focalPoint,
    declaredFocalPoint: image.declaredFocalPoint,
  };
}

/**
 * **Η γρήγορη διαδρομή** — όλα τα πλάτη είναι ήδη στο ράφι· καμία αποκωδικοποίηση. Το σημείο εστίασης
 * έρχεται από τη **μνήμη** του ραφιού (ή από την αυτοθεραπεία του `rememberedFocalPoint`). `null` ⇒ λείπει
 * έστω ένα πλάτος, άρα φρέσκια κωδικοποίηση.
 */
async function fromCache<M>(
  kind: RasterShelfKind<M>,
  existing: readonly File[],
  plan: Pick<ShelfPlanInputs, 'sourceRef' | 'recipe' | 'detects'>,
): Promise<Omit<AddressedImage<M>, 'material' | 'declaredFocalPoint'> | null> {
  const hit = fullCacheHit(kind, cachedVariants(existing, plan.sourceRef, plan.recipe));
  if (hit === null) return null;
  const variants = distinctByKey(hit);
  const focalPoint = plan.detects
    ? await rememberedFocalPoint(existing, plan.sourceRef, plan.recipe, variants)
    : null;
  return { variants, uploads: [], focalPoint };
}

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
async function addressOne<M>(
  kind: RasterShelfKind<M>,
  subjectId: string,
  source: PublicShelfSource<M>,
  existing: readonly File[],
): Promise<AddressedImage<M> | null> {
  try {
    const original = getAdminBucket().file(source.privateStoragePath);
    const [meta] = await original.getMetadata();
    const sourceRef = sourceReference(source.privateStoragePath, String(meta.generation ?? ''));

    // 🔑 **ΕΔΩ ΓΕΝΝΙΕΤΑΙ Η ΣΥΝΤΑΓΗ, ΜΙΑ ΦΟΡΑ ΑΝΑ ΠΗΓΗ** *(Α21.10)*: είναι το **μόνο**
    //    σημείο του γραφέα που κρατά ταυτόχρονα το **είδος** *(άρα την κωδικοποίηση)*
    //    και το **υλικό** *(άρα το πλαισίωμα)*. Ό,τι είναι πιο κάτω τη δέχεται έτοιμη —
    //    ούτε η μνήμη ούτε ο γραφέας επιτρέπεται να τη ξαναϋπολογίσουν.
    // ⚠️ Η μηχανή **ρωτά τη γραμμή**· δεν ερμηνεύει το υλικό. Δες `PublicShelfKind.framingOf`.
    // ⚠️ **Ρωτιέται ΜΙΑ φορά** και ταΐζει και τα δύο: μια δεύτερη κλήση θα ήταν δύο τιμές
    //    που πρέπει να συμφωνούν — δηλαδή συνταγή που περιγράφει **άλλα** bytes από όσα
    //    παρήχθησαν, αν κάποτε το `framingOf` πάψει να είναι καθαρή συνάρτηση.
    const framing = kind.framingOf(source.material);
    const recipe = shelfRecipe(kind.encoding, framing);
    const detects = kind.detectsFocalPoint(source.material);
    const carried = { material: source.material, declaredFocalPoint: source.focalPoint ?? null };

    const cached = await fromCache(kind, existing, { sourceRef, recipe, detects });
    if (cached !== null) return { ...cached, ...carried };

    const [raw] = await original.download();
    return { ...(await freshlyAddressed(kind, subjectId, raw, { sourceRef, recipe, framing, detects })), ...carried };
  } catch (error) {
    logger.warn('Πηγή δεν δημοσιεύεται — δεν διαβάστηκε ή δεν καθαρίστηκε', {
      subjectId,
      privateStoragePath: source.privateStoragePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Ό,τι χρειάζεται η φρέσκια κωδικοποίηση — γεννιέται **μία** φορά στο {@link addressOne}. */
interface ShelfPlanInputs {
  readonly sourceRef: string;
  readonly recipe: string;
  readonly framing: ShelfFraming;
  readonly detects: boolean;
}

/**
 * **Η αργή διαδρομή**: καθαρισμός, διευθυνσιοδότηση, σημείο εστίασης — από **μία** αποκωδικοποίηση.
 * ⚠️ «Δεν ρωτήθηκε» (`detects === false`) ⇒ `undefined` προς τον κάδο, ώστε να μη γραφτεί ψευδές «none».
 */
async function freshlyAddressed<M>(
  kind: RasterShelfKind<M>,
  subjectId: string,
  raw: Buffer,
  plan: ShelfPlanInputs,
): Promise<Pick<AddressedImage<M>, 'variants' | 'uploads' | 'focalPoint'>> {
  const sanitised = await sanitiseShelfImage(raw, kind.encoding, plan.framing, plan.detects);
  const remembered = plan.detects ? sanitised.focalPoint : undefined;
  const uploads = groupUploads(kind, subjectId, plan.sourceRef, plan.recipe, sanitised.variants, remembered);
  return { variants: distinctByKey(uploads.map(toObject)), uploads, focalPoint: sanitised.focalPoint };
}

/**
 * 🎯 **Το σημείο εστίασης μιας πηγής που ΔΕΝ αποκωδικοποιήθηκε** (γρήγορη διαδρομή, ADR-880).
 *
 * Το ράφι το θυμάται στα μεταδεδομένα των παραγώγων. 🩹 **Αυτοθεραπεία**: αντικείμενα γραμμένα πριν
 * το ADR-880 δεν το έχουν ⇒ ανάλυση του **μικρότερου** δημόσιου παραγώγου (λίγα KB, ίδια εικόνα σε
 * άλλο μέγεθος) και εγγραφή του μεταδεδομένου σε **όλα** τα παράγωγα — χωρίς επανακωδικοποίηση, χωρίς
 * νέο κλειδί. Ιδιοδύναμο: δύο ταυτόχρονες συμφιλιώσεις γράφουν την **ίδια** τιμή.
 *
 * ⚠️ **Δεν πετά ποτέ**: αποτυχία ⇒ `null` (κέντρο) και η επόμενη συμφιλίωση ξαναδοκιμάζει.
 */
async function rememberedFocalPoint(
  existing: readonly File[],
  sourceRef: string,
  recipe: string,
  variants: readonly PublicShelfObject[],
): Promise<PhotoFocalPoint | null> {
  const remembered = cachedFocalPoint(existing, sourceRef, recipe);
  if (remembered !== undefined) return remembered;

  try {
    const smallest = existing.find((file) => file.name === variants[0]?.key);
    if (smallest === undefined) return null;
    const [bytes] = await smallest.download();
    const focalPoint = await detectFocalPointInBytes(bytes);
    const keys = new Set(variants.map((variant) => variant.key));
    await Promise.all(
      existing
        .filter((file) => keys.has(file.name))
        .map((file) => file.setMetadata({ metadata: { [META_FOCAL_POINT]: encodeFocalPointMeta(focalPoint) } })),
    );
    return focalPoint;
  } catch (error) {
    logger.warn('Το σημείο εστίασης δεν αποκαταστάθηκε — η φωτογραφία μένει στο κέντρο', {
      sourceRef,
      error: asLogMessage(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Η μία δημόσια είσοδος
// ---------------------------------------------------------------------------

/**
 * **Κάνε το ράφι αυτού του υποκειμένου ΑΚΡΙΒΩΣ ίσο με το επιθυμητό σύνολο.**
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΕΙΔΟΣ ΕΙΝΑΙ **ΠΡΩΤΟ ΟΡΙΣΜΑ**, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΤΑΔΙΟ 2
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως την Α21 η συνάρτηση **υπέθετε** το είδος: ρίζα `listings/`, φρουρός που απαγορεύει
 * `comp_`, πλάτη γκαλερί. Τώρα το **ρωτά** — και ό,τι ακολουθεί *(πρόθεμα, φρουρός,
 * κωδικοποίηση, συνταγή, σάρωση, διαγραφή)* βγαίνει **από τον ίδιο** περιγραφέα.
 *
 * 🔴 **Ένα λάθος είδος δεν μπορεί να γράψει σε ξένη ρίζα**: το `publicShelfPrefix`
 * **πετά** αν η ταυτότητα δεν περνά τον φρουρό **αυτού** του είδους, και οι δύο φρουροί
 * είναι **αντίθετοι**. Δεν είναι σύμβαση — είναι αδύνατο.
 */
export async function reconcilePublicShelf<M>(
  kind: PublicShelfKind<M>,
  subjectId: string,
  sources: readonly PublicShelfSource<M>[],
): Promise<PublicShelfReport<M>> {
  // 🔴 **Η ΜΙΑ ΣΤΕΝΩΣΗ, ΣΤΟ ΣΥΝΟΡΟ** *(ADR-845 §3, Φ4.0 · άγκυρα Α-1δ)*. Ό,τι είναι από
  //    εδώ και κάτω είναι **σχήματος raster από άκρη σε άκρη**: η μνήμη του ραφιού έχει
  //    κλειδί το **πλάτος**, τα μεταδεδομένα κουβαλούν `requestedWidths`, και η γρήγορη
  //    διαδρομή ρωτά *«υπάρχουν ΟΛΑ τα πλάτη;»*. Δεν είναι τρεις αναφορές σε πεδίο —
  //    είναι η **πληθυντικότητα** της εικόνας, που ένα μοντέλο **δεν έχει**.
  // ⚠️ **Ονομαστική αποτυχία, ποτέ `throw`** — ίδιο συμβόλαιο με κάθε άλλη αποτυχία εδώ:
  //    το ράφι μένει μπαγιάτικο, η αποθήκευση του κατόχου **δεν** ακυρώνεται.
  // 🔑 Στη Φ4.2 αυτή η γραμμή είναι που θα **κοκκινίσει πρώτη** όταν εμφανιστεί είδος
  //    μοντέλου — και είναι το ζητούμενο: ο ψήστης μπαίνει **μαζί** με τη γραμμή του.
  if (!isRasterShelfKind(kind)) {
    return shelfFailure(
      logger,
      'Το δημόσιο ράφι ΔΕΝ δημοσιεύει μη-εικόνες με ΑΥΤΟ το κεφάλι',
      { root: kind.root, subjectId, encoding: kind.encoding.kind },
      sources.length,
    );
  }

  try {
    const scan = await scanShelfPrefix(kind, subjectId);
    const addressed = await Promise.all(
      sources.map((source) => addressOne(kind, subjectId, source, scan.files)),
    );
    const desired = addressed.filter((image): image is AddressedImage<M> => image !== null);

    const desiredKeys = new Set(desired.flatMap((image) => image.variants.map((v) => v.key)));

    // 🔑 **Η μετάφραση γίνεται ΕΔΩ, στο σύνορο** *(Φ4.2β)*: ο κάδος δέχεται
    //    {@link ShelfWrite} — «κλειδί, bytes, τύπος, μεταδεδομένα» — και **δεν ξέρει** τι
    //    είναι «πλάτος». Τα πέντε `META_*` γεννιούνται στο `toShelfWrite`, δίπλα στον
    //    **μοναδικό αναγνώστη** τους *(`cachedVariants`)*.
    await uploadMissing(
      scan.bucket,
      desired.flatMap((image) => image.uploads).map(toShelfWrite),
      scan.keys,
    );
    const removed = await deleteExtra(kind, scan.files, desiredKeys);

    return {
      outcome: 'reconciled',
      published: desired.map(toPublishedImage),
      removed,
      rejected: addressed.length - desired.length,
    };
  } catch (error) {
    return shelfFailure(
      logger,
      'Το ράφι ΕΙΚΟΝΩΝ ΔΕΝ συμφιλιώθηκε — μένει ΜΠΑΓΙΑΤΙΚΟ ως την επανασύνθεση',
      { root: kind.root, subjectId, error: asLogMessage(error) },
      0,
    );
  }
}
