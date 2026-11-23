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
 * 🔑 **ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ, ΕΝΑΣ ΚΡΙΤΗΣ** (ADR-920 §14.11 Ζ3c): το γραφείο *(`properties`, `republishListing`)* **και** ο
 * ιδιοκτήτης *(`owner_properties`, `republishOwnerProperty`)*. Από το Ζ3b ο κάδος του φακέλου ακινήτου είναι πράξη
 * διακομιστή που ξαναπροβάλλει την αγγελία ιδιοκτήτη — άρα και εκεί υπάρχουν πόρτες που μπορούν να ξεφύγουν. Ο
 * γραφέας του ιδιοκτήτη γράφει το **ίδιο** αποτύπωμα (περνά από το `writeWithShelf`)· τα τρέχοντα μέσα τα δίνει ο
 * **ίδιος** δρόμος με τον γραφέα (`currentOwnerListingProjection`), ποτέ δεύτερος υπολογισμός.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import {
  MEDIA_FINGERPRINT_FIELD,
  mediaAgreement,
  recipeAgreement,
  type ListingMediaVerdict,
  type MediaAgreement,
  type RecipeAgreement,
} from '@/lib/listings/listing-media-fingerprint';
import {
  LISTING_RECIPE_BACKFILL_PER_RUN,
  recipeBackfillRunIndex,
  recipeBackfillWindow,
} from '@/lib/listings/listing-recipe-backfill';
import { createModuleLogger } from '@/lib/telemetry';
import { createAgencyIdentityResolver } from '@/services/company/company-public-name.reader';
import {
  currentOwnerListingProjection,
  republishOwnerProperty,
} from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';

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
 * - `recipeOutdated` — σωστή στο υλικό, ψημένη με **παλιά συνταγή** *(αναμενόμενο μετά από αλλαγή συνταγής, όχι σφάλμα·
 *   ADR-920 §14.9 Γ)* — μετρά **μέσα** στο `agreed`
 * - `recipeDeferred` — από αυτές, όσες έμειναν για επόμενο πέρασμα ({@link LISTING_RECIPE_BACKFILL_PER_RUN})
 * - `republished` · `failed` — τι έγινε σε όσα ξαναπροβλήθηκαν (απόκλιση υλικού **και** συνταγής)
 */
export interface MediaReconciliationReport {
  readonly scanned: number;
  readonly listed: number;
  readonly agreed: number;
  readonly drifted: number;
  readonly unstamped: number;
  readonly missing: number;
  readonly recipeOutdated: number;
  readonly recipeDeferred: number;
  readonly republished: number;
  readonly failed: number;
}

/** Η ετυμηγορία του κριτή για **ένα** δημοσιεύσιμο ακίνητο. */
type Finding = MediaAgreement | 'missing';

/** Η πλήρης κρίση του βραδινού περάσματος: το υλικό **και** η συνταγή (ADR-920 §14.9 Γ). */
interface Judgement {
  readonly finding: Finding;
  readonly recipe: RecipeAgreement;
}

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
  return (await judgeWithRecipe(propertyId, property, stored, resolveMedia)).finding;
}

/**
 * Ο κριτής, **και** η συνταγή — ένα αποτύπωμα, δύο ερωτήσεις. Η οθόνη και ο βρόχος ορόφου ρωτούν μόνο το υλικό
 * ({@link judgeProperty})· μόνο το βραδινό πέρασμα ρωτά και αν ψήθηκε με τις τρέχουσες συνταγές.
 */
async function judgeWithRecipe(
  propertyId: string,
  property: ListingSourceProperty,
  stored: StoredListing,
  resolveMedia: ListingMediaResolver,
): Promise<Judgement> {
  if (!stored.exists) return judgementOf(stored, null);

  // 🔑 Ο **ίδιος** επιλυτής με τον γραφέα (ADR-907 §11.7): αρχεία του ακινήτου **και** κάτοψη ορόφου — αλλιώς το
  //    αποτύπωμα εδώ θα διέφερε **πάντα** από το γραμμένο, και η αγγελία θα ξαναψηνόταν κάθε βράδυ.
  return judgementOf(stored, mediaFingerprintOf(await resolveMedia(propertyId, property)));
}

/**
 * **Ο ΕΝΑΣ κριτής: γραμμένο ⇄ τρέχον αποτύπωμα** — για κάθε οικογένεια (ADR-920 §14.11 Ζ3c). `current === null` =
 * τα τρέχοντα μέσα δεν διαβάστηκαν ⇒ `unknown` (ξαναπροβάλλεται), ποτέ `current`.
 */
function judgementOf(stored: StoredListing, current: string | null): Judgement {
  if (!stored.exists) return { finding: 'missing', recipe: 'current' };
  if (current === null) return { finding: 'unknown', recipe: 'current' };
  return { finding: mediaAgreement(stored.fingerprint, current), recipe: recipeAgreement(stored.fingerprint, current) };
}

/**
 * **Η γραμμένη αγγελία ΕΝΟΣ ακινήτου ⇄ το τρέχον υλικό του** — η ανάγνωση της αγγελίας και ο ΕΝΑΣ κριτής, μαζί.
 *
 * 🔑 Τρίτος καλών του ίδιου κριτή *(ADR-907 §11.8)*: ο βρόχος ορόφου ρωτά **εδώ** ποια αδελφή αγγελία οφείλει
 * επαναπροβολή, αντί να αποκτήσει δικό του κριτήριο «άλλαξε κάτι ορατό;». ⚠️ **Πετά** σε βλάβη ανάγνωσης — το
 * τι σημαίνει αυτό το αποφασίζει ο καλών *(η οθόνη λέει «δεν ξέρω», ο βρόχος ξαναπροβάλλει)*.
 */
export async function judgeStoredListingMedia(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ListingSourceProperty,
  resolveMedia: ListingMediaResolver,
): Promise<MediaAgreement | 'missing'> {
  const listing = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(propertyId).get();
  const stored = { exists: listing.exists, fingerprint: listing.get(MEDIA_FINGERPRINT_FIELD) };
  return judgeProperty(propertyId, property, stored, resolveMedia);
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

    return await judgeStoredListingMedia(adminDb, propertyId, property, createListingMediaResolver(adminDb));
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

type Tally = { -readonly [K in keyof MediaReconciliationReport]: MediaReconciliationReport[K] };

/** Ένα ακίνητο που περιμένει επαναπροβολή — με τον γραφέα **της οικογένειάς του** (γραφείο ή ιδιοκτήτης). */
interface Republication {
  readonly propertyId: string;
  readonly run: () => Promise<PublishOutcome>;
}

/** Ένα πέρασμα: η λογιστική, τα γραμμένα αποτυπώματα (**μία** ανάγνωση) και ο ΕΝΑΣ τρόπος να ξαναπροβληθεί κάτι. */
interface ReconciliationPass {
  readonly adminDb: AdminFirestore;
  readonly stored: ReadonlyMap<string, unknown>;
  readonly tally: Tally;
  readonly republish: (pending: Republication) => Promise<void>;
}

function storedOf(pass: ReconciliationPass, listingId: string): StoredListing {
  return { exists: pass.stored.has(listingId), fingerprint: pass.stored.get(listingId) };
}

/**
 * **Η κρίση ενός δημοσιεύσιμου ακινήτου → λογιστική + ουρά** — κοινό των δύο οικογενειών: η απόκλιση υλικού
 * ξαναπροβάλλεται **αμέσως**, η απόκλιση μόνο συνταγής μπαίνει στην ουρά του ρυθμού (`outdated`).
 */
async function settle(
  pass: ReconciliationPass,
  pending: Republication,
  judgement: Judgement,
  outdated: Republication[],
): Promise<void> {
  pass.tally.listed += 1;
  pass.tally[FINDING_TALLY[judgement.finding]] += 1;
  if (judgement.finding === 'current') {
    if (judgement.recipe === 'outdated') {
      pass.tally.recipeOutdated += 1;
      outdated.push(pending);
    }
    return;
  }
  reportFinding(pending.propertyId, judgement.finding);
  await pass.republish(pending);
}

/**
 * **Σύγκρινε κάθε δημοσιευμένη αγγελία — γραφείου ΚΑΙ ιδιοκτήτη — με το τρέχον υλικό της· ξαναπρόβαλε ό,τι διαφέρει.**
 *
 * 🔑 **Ιδεμποτής**: δεύτερο πέρασμα αμέσως μετά βρίσκει τα πάντα `agreed` και δεν γράφει τίποτα.
 *
 * ⚠️ **Σειριακά** — ίδια πολιτική κόστους με την επανασύνθεση: μία ανάγνωση αρχείων ανά
 * δημοσιευμένο ακίνητο, και επαναπροβολή **μόνο** όπου αποδείχθηκε απόκλιση.
 *
 * 🔑 **Δύο ουρές, δύο πολιτικές** *(ADR-920 §14.9 Γ)*: η απόκλιση **υλικού** (πόρτα που ξέφυγε) διορθώνεται **πάντα,
 * όλη**, και καταγράφεται ως σφάλμα. Η απόκλιση **μόνο συνταγής** είναι αναμενόμενη μετά από αλλαγή συνταγής και
 * ξαναψήνεται **με ρυθμό** (`recipeBackfillWindow`), καταγεγραμμένη ως πληροφορία. `nowMs` = η στιγμή του περάσματος.
 * Ο ρυθμός είναι **ένας** για τις δύο οικογένειες: η ουρά τους είναι μία.
 */
export async function reconcileListingMedia(
  adminDb: AdminFirestore,
  nowMs: number = Date.now(),
): Promise<MediaReconciliationReport> {
  const tally: Tally = {
    scanned: 0, listed: 0, agreed: 0, drifted: 0, unstamped: 0, missing: 0,
    recipeOutdated: 0, recipeDeferred: 0, republished: 0, failed: 0,
  };
  const pass: ReconciliationPass = {
    adminDb,
    stored: await readStoredFingerprints(adminDb),
    tally,
    republish: async ({ run }) => {
      tally[OUTCOME_TALLY[await run()]] += 1;
    },
  };

  const outdated = [...(await judgeOfficeListings(pass)), ...(await judgeOwnerListings(pass, nowISO()))];
  const batch = recipeBackfillWindow(outdated, LISTING_RECIPE_BACKFILL_PER_RUN, recipeBackfillRunIndex(nowMs));
  tally.recipeDeferred = outdated.length - batch.length;
  for (const pending of batch) {
    logger.info('Επαναπροβολή μετά από αλλαγή συνταγής ραφιού', { propertyId: pending.propertyId });
    await pass.republish(pending);
  }

  logger.info('Συμφιλίωση μέσων αγγελιών', tally);
  return tally;
}

/**
 * **Οι αγγελίες του γραφείου** (`properties`): κρίνει **κάθε** δημοσιεύσιμο ακίνητο, ξαναπροβάλλει **αμέσως** κάθε
 * απόκλιση υλικού, και επιστρέφει όσες είναι σωστές στο υλικό αλλά ψημένες με παλιά συνταγή, με τη σειρά της σάρωσης.
 */
async function judgeOfficeListings(pass: ReconciliationPass): Promise<Republication[]> {
  const { adminDb } = pass;
  const resolveMedia = createListingMediaResolver(adminDb);
  const resolveAgency = createAgencyIdentityResolver(adminDb);
  const properties = await adminDb.collection(COLLECTIONS.PROPERTIES).get();
  const outdated: Republication[] = [];

  for (const doc of properties.docs) {
    pass.tally.scanned += 1;
    const property = doc.data() as ListingSourceProperty;
    if (!isPubliclyListed({ ...property, id: doc.id })) continue;

    const judgement = await judgeWithRecipe(doc.id, property, storedOf(pass, doc.id), resolveMedia);
    const run = () => republishListing(adminDb, doc.id, property, resolveAgency, resolveMedia);
    await settle(pass, { propertyId: doc.id, run }, judgement, outdated);
  }

  return outdated;
}

/**
 * **Το τρέχον αποτύπωμα μιας αγγελίας ιδιοκτήτη** — από τον **ίδιο** δρόμο με τον γραφέα της. Βλάβη ανάγνωσης του
 * φακέλου ⇒ `null` (καταγεγραμμένο): «δεν ξέρω», ποτέ «συμφωνεί».
 */
async function currentOwnerFingerprint(adminDb: AdminFirestore, property: OwnerProperty, at: string): Promise<string | null> {
  try {
    return mediaFingerprintOf((await currentOwnerListingProjection(adminDb, property, at)).publishedMedia ?? []);
  } catch (error) {
    logger.warn('Τα τρέχοντα μέσα αγγελίας ιδιοκτήτη δεν διαβάστηκαν — ξαναπροβάλλεται', {
      propertyId: property.id, error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * 🏠 **Οι αγγελίες ΙΔΙΟΚΤΗΤΗ** (`owner_properties`, ADR-920 §14.11 Ζ3c). Η πύλη «δημοσιεύεται;» κρίνεται **πρώτα**, από τα
 * γεγονότα διάθεσης μόνο (καθαρή προβολή, χωρίς φάκελο)· ο φάκελος διαβάζεται **μόνο** για όσες δημοσιεύονται.
 * Τρέχοντα μέσα που δεν διαβάζονται ⇒ `unknown` ⇒ επαναπροβολή: ο γραφέας κρίνει μόνος του, και η αποτυχία του αφήνει
 * την προβολή άθικτη (`failed`) — μια σπασμένη αγγελία δεν ρίχνει το πέρασμα των υπολοίπων.
 */
async function judgeOwnerListings(pass: ReconciliationPass, at: string): Promise<Republication[]> {
  const { adminDb } = pass;
  const owners = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).get();
  const outdated: Republication[] = [];

  for (const doc of owners.docs) {
    pass.tally.scanned += 1;
    const property = ownerPropertyFromDocument(doc.data(), doc.id);
    if (property === null || !isPubliclyListed(projectableFromOwnerProperty(property, at))) continue;

    const stored = storedOf(pass, doc.id);
    const judgement = judgementOf(stored, stored.exists ? await currentOwnerFingerprint(adminDb, property, at) : null);
    const run = async () => (await republishOwnerProperty(adminDb, property)).publish;
    await settle(pass, { propertyId: doc.id, run }, judgement, outdated);
  }

  return outdated;
}
