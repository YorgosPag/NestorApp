/**
 * @fileoverview **Η ΒΡΑΔΙΝΗ ΣΥΜΦΙΛΙΩΣΗ ΤΩΝ ΜΕΣΩΝ** — το δίχτυ κάτω από την κλάση Ο-35.
 * @related ADR-845 §7.17 Α5 · lib/listings/listing-media-fingerprint · services/listings/publish-public-listing
 * @module services/listings/listing-media-reconciliation.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΚΑΝΕΙ — **ΣΥΓΚΡΙΝΕΙ**, ΔΕΝ ΞΑΝΑΨΗΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Για κάθε **δημοσιευμένο** ακίνητο γραφείου: *τι θα έφευγε τώρα;* ⇄ *τι γράφτηκε;* Όπου
 * συμφωνούν, **καμία γραφή**. Όπου διαφέρουν, η αγγελία ξαναπροβάλλεται από τον **ΕΝΑ**
 * {@link republishListing} — και η απόκλιση **καταγράφεται ως σφάλμα**: με τα στρώματα 1+2
 * σωστά, ο αριθμός είναι **μηδέν**. Κάθε μη μηδενικό είναι **πόρτα που ξέφυγε**, με το ακίνητό της.
 *
 * ⛔ **Δεν είναι δεύτερη επανασύνθεση.** Η `rebuildAllPublicListings` ξαναγράφει **κάθε** αγγελία
 * και σβήνει ορφανές· εδώ δεν γράφεται τίποτα που δεν **αποδείχθηκε** παλιό, και οι ορφανές δεν
 * αγγίζονται. Κοινό έχουν μόνο τον γραφέα.
 *
 * ⚠️ **Μόνο η οικογένεια του γραφείου** *(`properties`)*: ο ιδιώτης δημοσιεύει από τη **δήλωση**
 * της αγγελίας του, όχι από διαβάθμιση αρχείων — άλλη κλάση, άλλος γραφέας.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  MEDIA_FINGERPRINT_FIELD,
  mediaAgreement,
  type ListingMediaVerdict,
  type MediaAgreement,
} from '@/lib/listings/listing-media-fingerprint';
import { createModuleLogger } from '@/lib/telemetry';
import { createAgencyIdentityResolver } from '@/services/company/company-public-name.reader';

import { mediaFingerprintOf } from './listing-media-fingerprint-stamp';
import { createListingMediaResolver, type ListingMediaResolver } from './listing-media-sources';
import { isPubliclyListed } from './public-listing-projection';
import {
  republishListing,
  type ListingSourceProperty,
  type PublishOutcome,
} from './publish-public-listing';

const logger = createModuleLogger('listings/media-reconciliation');

/**
 * Η λογιστική μιας συμφιλίωσης.
 *
 * - `agreed` — το αποτύπωμα συμφωνεί· **καμία γραφή**
 * - `drifted` — 🔴 διαφέρει: **πόρτα που ξέφυγε** *(στόχος: μηδέν)*
 * - `unstamped` — η αγγελία δεν έχει αποτύπωμα *(γράφτηκε πριν από την Α5, ή το ράφι της απέτυχε)*
 * - `missing` — ακίνητο δημοσιεύσιμο **χωρίς** αγγελία *(ξέφυγε πόρτα της **πρώτης** πηγής)*
 * - `republished` · `failed` — τι έγινε σε όσα ξαναπροβλήθηκαν
 */
export interface MediaReconciliationReport {
  readonly scanned: number;
  readonly listed: number;
  readonly agreed: number;
  readonly drifted: number;
  readonly unstamped: number;
  readonly missing: number;
  readonly republished: number;
  readonly failed: number;
}

type Finding = MediaAgreement | 'missing';

/** Η δημόσια αγγελία ενός ακινήτου, όσο χρειάζεται ο κριτής: **υπάρχει;** και **τι αποτύπωμα γράφτηκε;** */
interface StoredListing {
  readonly exists: boolean;
  readonly fingerprint: unknown;
}

/** Το αποθηκευμένο αποτύπωμα κάθε δημοσιευμένης αγγελίας — **μία** ανάγνωση για όλη τη σάρωση. */
async function readStoredFingerprints(adminDb: AdminFirestore): Promise<ReadonlyMap<string, unknown>> {
  const listings = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).get();
  return new Map(listings.docs.map((doc) => [doc.id, doc.get(MEDIA_FINGERPRINT_FIELD)]));
}

/**
 * **Ένα ακίνητο**: τι θα έφευγε τώρα ⇄ τι γράφτηκε.
 *
 * 🔑 **Ο ΕΝΑΣ κριτής, δύο καλούντες**: η βραδινή σάρωση *(με τον χάρτη της μίας ανάγνωσης)* και η
 * οθόνη του γραφείου *(με την αγγελία ενός ακινήτου — {@link judgeListingMedia})*.
 */
async function judgeProperty(
  propertyId: string,
  property: ListingSourceProperty,
  stored: StoredListing,
  resolveMedia: ListingMediaResolver,
): Promise<Finding> {
  if (!stored.exists) return 'missing';

  // 🔑 Ο **ίδιος** επιλυτής με τον γραφέα (ADR-907 §11.7): αρχεία του ακινήτου **και** κάτοψη ορόφου — αλλιώς το
  //    αποτύπωμα εδώ θα διέφερε **πάντα** από το γραμμένο, και η αγγελία θα ξαναψηνόταν κάθε βράδυ.
  const sources = await resolveMedia(propertyId, property);
  return mediaAgreement(stored.fingerprint, mediaFingerprintOf(sources));
}

/**
 * **Συμφωνεί η δημόσια αγγελία ΑΥΤΟΥ του ακινήτου με το τρέχον υλικό του;** — για την καρτέλα του
 * ακινήτου *(ADR-845 §7.17 Α5β)*.
 *
 * ⚠️ **Το έγγραφο διαβάζεται ΤΩΡΑ, από τη βάση** — ίδιος λόγος με το `refreshListingAfterMediaChange`.
 * 🔐 Ακίνητο που λείπει ή ανήκει σε **άλλον** μισθωτή απαντά `unlisted`: δεν υπάρχει τίποτα δικό του
 * να συγκριθεί, και η απάντηση δεν μαρτυρά αν το ακίνητο υπάρχει.
 *
 * 🔑 **Δεν πετά ποτέ**: βλάβη ανάγνωσης ⇒ `unknown` *(«δεν ξέρω»)*, ποτέ `current`. Μια ένδειξη που
 * δεν φορτώθηκε δεν επιτρέπεται να ρίξει την οθόνη στην οποία κάθεται.
 */
export async function judgeListingMedia(
  adminDb: AdminFirestore,
  propertyId: string,
  companyId: string,
): Promise<ListingMediaVerdict> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    const data = snapshot.data() as ListingSourceProperty | undefined;
    if (data === undefined || data.companyId !== companyId) return 'unlisted';

    const property = { ...data, id: propertyId };
    if (!isPubliclyListed(property)) return 'unlisted';

    const listing = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(propertyId).get();
    const stored = { exists: listing.exists, fingerprint: listing.get(MEDIA_FINGERPRINT_FIELD) };
    return await judgeProperty(propertyId, property, stored, createListingMediaResolver(adminDb));
  } catch (error) {
    logger.warn('Η συμφωνία μέσων δεν κρίθηκε — η οθόνη λέει «δεν ξέρω»', {
      propertyId, error: error instanceof Error ? error.message : String(error),
    });
    return 'unknown';
  }
}

/** Η απόκλιση **με όνομα και ακίνητο** — αυτό είναι το προϊόν της συμφιλίωσης, όχι η διόρθωση. */
function reportFinding(propertyId: string, finding: Finding): void {
  if (finding === 'stale') {
    logger.error('ΠΟΡΤΑ ΠΟΥ ΞΕΦΥΓΕ — τα μέσα της δημόσιας αγγελίας διαφέρουν από το τρέχον υλικό', { propertyId });
  } else if (finding === 'missing') {
    logger.error('ΠΟΡΤΑ ΠΟΥ ΞΕΦΥΓΕ — δημοσιεύσιμο ακίνητο χωρίς δημόσια αγγελία', { propertyId });
  }
}

/** Πόσα ακίνητα είχαν κάθε εύρημα — τα ονόματα της λογιστικής, ένα προς ένα. */
const FINDING_TALLY = {
  current: 'agreed',
  stale: 'drifted',
  unknown: 'unstamped',
  missing: 'missing',
} as const satisfies Record<Finding, keyof MediaReconciliationReport>;

/** Η έκβαση της επαναπροβολής στη λογιστική — η **απόσυρση** είναι κι αυτή διόρθωση που έγινε. */
const OUTCOME_TALLY = {
  published: 'republished',
  withdrawn: 'republished',
  failed: 'failed',
} as const satisfies Record<PublishOutcome, keyof MediaReconciliationReport>;

/**
 * **Σύγκρινε κάθε δημοσιευμένη αγγελία γραφείου με το τρέχον υλικό της· ξαναπρόβαλε ό,τι διαφέρει.**
 *
 * 🔑 **Ιδεμποτής**: δεύτερο πέρασμα αμέσως μετά βρίσκει τα πάντα `agreed` και δεν γράφει τίποτα.
 *
 * ⚠️ **Σειριακά** — ίδια πολιτική κόστους με την επανασύνθεση: μία ανάγνωση αρχείων ανά
 * δημοσιευμένο ακίνητο, και επαναπροβολή **μόνο** όπου αποδείχθηκε απόκλιση.
 */
export async function reconcileListingMedia(adminDb: AdminFirestore): Promise<MediaReconciliationReport> {
  const tally = { scanned: 0, listed: 0, agreed: 0, drifted: 0, unstamped: 0, missing: 0, republished: 0, failed: 0 };
  const stored = await readStoredFingerprints(adminDb);
  const resolveMedia = createListingMediaResolver(adminDb);
  const resolveAgency = createAgencyIdentityResolver(adminDb);
  const properties = await adminDb.collection(COLLECTIONS.PROPERTIES).get();

  for (const doc of properties.docs) {
    tally.scanned += 1;
    const property = doc.data() as ListingSourceProperty;
    if (!isPubliclyListed({ ...property, id: doc.id })) continue;
    tally.listed += 1;

    const listing = { exists: stored.has(doc.id), fingerprint: stored.get(doc.id) };
    const finding = await judgeProperty(doc.id, property, listing, resolveMedia);
    tally[FINDING_TALLY[finding]] += 1;
    if (finding === 'current') continue;

    reportFinding(doc.id, finding);
    tally[OUTCOME_TALLY[await republishListing(adminDb, doc.id, property, resolveAgency, resolveMedia)]] += 1;
  }

  logger.info('Συμφιλίωση μέσων αγγελιών', tally);
  return tally;
}
