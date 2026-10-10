/**
 * @fileoverview **Ο ΕΝΑΣ ΒΡΟΧΟΣ ΕΠΑΝΑΠΡΟΒΟΛΗΣ, ΜΕ ΕΜΒΕΛΕΙΑ** — έργο ή όροφος (ADR-907 §11.8).
 * @related ./publish-public-listing (ο ΕΝΑΣ γραφέας) · ./listing-media-refresh (οι πόρτες) · ./listing-media-reconciliation.service (ο κριτής)
 * @module services/listings/listing-scope-republish
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως το §11.7 υπήρχαν **δύο** βρόχοι πάνω στα ακίνητα που καλούσαν τον ίδιο γραφέα: του **έργου**
 * *(`republishListingsForProject`, μέσα στο αρχείο του γραφέα)* και του **ορόφου**
 * *(`refreshListingsOfFloor`, δίπλα στις πόρτες αρχείων)*. Ίδιο σώμα, άλλο ερώτημα — και ο πρώτος δεν
 * μοιραζόταν επιλυτή μέσων, άρα N αδελφές μονάδες διάβαζαν τα τεκμήρια του ορόφου τους N φορές.
 *
 * 🔑 **Η εμβέλεια απαντά ΔΥΟ ερωτήσεις, και μόνο αυτές**: *«ποια ακίνητα;»* και *«ποια από αυτά οφείλουν
 * επαναπροβολή;»*. Όλα τα άλλα —τι δημοσιεύεται, τι αποσύρεται, τι ψήνεται— μένουν στον
 * {@link republishListing}.
 *
 * | Εμβέλεια | Ποια ακίνητα | Ποια οφείλουν | Γιατί |
 * |---|---|---|---|
 * | `project` | όλα του έργου | **όλα** | άλλαξε ο **τόπος**, που δεν ζει σε κανένα αποτύπωμα |
 * | `floor` | όλα του ορόφου | όσα **δημοσιεύονται** και το αποτύπωμα μέσων τους **διαφωνεί** | άλλαξε —ίσως— η κάτοψη ορόφου· ό,τι συμφωνεί δεν ξαναψήνεται |
 *
 * ⛔ **ΧΩΡΙΣ ΑΝΑΔΡΟΜΗ, ΔΟΜΙΚΑ**: ο βρόχος καλεί τον **γραφέα**, ποτέ την πόρτα «άλλαξε μονάδα»
 * *(`republishListingOfChangedUnit`)*. Η επαναπροβολή μιας αδελφής δεν μπορεί να πυροδοτήσει νέα διάδοση —
 * αυτό το αρχείο **δεν εισάγει** το `listing-media-refresh` *(άγκυρα ΕΒ-4)*.
 *
 * 🔑 **Ιδεμποτής στην εμβέλεια ορόφου**: δεύτερο πέρασμα αμέσως μετά βρίσκει τα πάντα σε συμφωνία και δεν
 * γράφει τίποτα — γι' αυτό μπορεί να καλείται από **κάθε** πόρτα που αγγίζει μονάδα, χωρίς δεύτερο κριτήριο
 * «άλλαξε κάτι ορατό;». Το αποτύπωμα **είναι** το κριτήριο.
 */

import 'server-only';

import type { Firestore as AdminFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  createAgencyIdentityResolver,
  type AgencyIdentityResolver,
} from '@/services/company/company-public-name.reader';

import { judgeStoredListingMedia } from './listing-media-reconciliation.service';
import { createListingMediaResolver, type ListingMediaResolver } from './listing-media-sources';
import { isPubliclyListed } from './public-listing-projection';
import {
  republishListing,
  type ListingSourceProperty,
  type PublishOutcome,
} from './publish-public-listing';

const logger = createModuleLogger('listing-scope-republish');

/** Η εμβέλεια ενός περάσματος — κλειστή ένωση: τρίτη εμβέλεια χωρίς σκέλος **δεν μεταγλωττίζεται**. */
type ListingScope =
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'floor'; readonly floorId: string; readonly companyId: string };

/**
 * **Οι επιλυτές ΕΝΟΣ περάσματος** — μία εικόνα των εταιρειών και μία ανάγνωση τεκμηρίων ανά όροφο, όσα
 * ακίνητα κι αν περάσουν (ADR-841 §7 Α1 · ADR-907 §11.7).
 */
export interface ListingPass {
  readonly resolveAgency: AgencyIdentityResolver;
  readonly resolveMedia: ListingMediaResolver;
}

export function createListingPass(adminDb: AdminFirestore): ListingPass {
  return {
    resolveAgency: createAgencyIdentityResolver(adminDb),
    resolveMedia: createListingMediaResolver(adminDb),
  };
}

/** Τι έγινε στην αγγελία **ενός** ακινήτου που ξαναπροβλήθηκε. Ό,τι δεν όφειλε επαναπροβολή **λείπει**. */
interface ScopedListingReport {
  readonly propertyId: string;
  readonly outcome: PublishOutcome;
}

/** **«Ποια ακίνητα;»** — ένα ερώτημα ανά εμβέλεια, ολόκληρο εδώ ώστε να το βλέπουν οι πύλες 3.35 και 3.91. */
async function unitsIn(
  adminDb: AdminFirestore,
  scope: ListingScope,
): Promise<readonly QueryDocumentSnapshot[]> {
  if (scope.kind === 'project') {
    // tenant-scope-exempt: το `projectId` ΕΙΝΑΙ όριο μισθωτή — ένα έργο ανήκει σε
    // ακριβώς μία εταιρεία, οπότε το φίλτρο δεν είναι ευρύτερο από ένα `companyId`,
    // είναι στενότερο. Επιπλέον τρέχει με Admin SDK ως **επανασύνθεση παραγώγου**: ο
    // καλών έχει ήδη αποδείξει δικαίωμα στο έργο, και η έξοδος είναι η δημόσια προβολή,
    // που εξ ορισμού δεν κουβαλά ταυτότητα πελάτη (`types/public-listing.ts`).
    const ofProject = await adminDb
      .collection(COLLECTIONS.PROPERTIES)
      .where('projectId', '==', scope.projectId)
      .get();
    return ofProject.docs;
  }

  const ofFloor = await adminDb
    .collection(COLLECTIONS.PROPERTIES)
    .where('companyId', '==', scope.companyId)
    .where('floorId', '==', scope.floorId)
    .get();
  return ofFloor.docs;
}

/**
 * Διαφωνεί το γραμμένο αποτύπωμα με ό,τι θα έφευγε τώρα;
 *
 * 🔑 **Βλάβη ανάγνωσης ⇒ «οφείλει»**, ποτέ «συμφωνεί»: ο γραφέας δεν πετά και ονομάζει την αποτυχία του·
 * μια σιωπηλή παράλειψη εδώ θα άφηνε την αδελφή μπαγιάτικη ως τη βραδινή συμφιλίωση χωρίς γραμμή στο ημερολόγιο.
 */
async function mediaDisagree(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ListingSourceProperty,
  resolveMedia: ListingMediaResolver,
): Promise<boolean> {
  try {
    return (await judgeStoredListingMedia(adminDb, propertyId, property, resolveMedia)) !== 'current';
  } catch (error) {
    logger.warn('Η συμφωνία μέσων δεν κρίθηκε — η αγγελία ξαναπροβάλλεται', {
      propertyId, error: error instanceof Error ? error.message : String(error),
    });
    return true;
  }
}

/** **«Οφείλει επαναπροβολή;»** — η δεύτερη ερώτηση της εμβέλειας. */
async function isDue(
  adminDb: AdminFirestore,
  scope: ListingScope,
  propertyId: string,
  property: ListingSourceProperty,
  pass: ListingPass,
): Promise<boolean> {
  switch (scope.kind) {
    case 'project':
      return true;
    case 'floor':
      // Ακίνητο που δεν δημοσιεύεται δεν έχει αγγελία να αλλάξει — ίδια πολιτική κόστους με τη συμφιλίωση.
      return isPubliclyListed(property) && mediaDisagree(adminDb, propertyId, property, pass.resolveMedia);
    default: {
      const exhaustive: never = scope;
      throw new Error(`Unknown republish scope: ${String(exhaustive)}`);
    }
  }
}

/**
 * **Ξαναπρόβαλε όσες αγγελίες της εμβέλειας το οφείλουν** — με τον ΕΝΑ {@link republishListing}.
 *
 * ⚠️ **Σειριακά**: N ακίνητα γράφουν στο ίδιο ράφι και στην ίδια απόδειξη παρουσίας του γραφείου.
 * ⚠️ **Πετά μόνο αν πέσει το ερώτημα της εμβέλειας** — ο καλών αποφασίζει τι σημαίνει αυτό για τη δική του πράξη
 * *(και οι δύο σημερινοί το μεταφράζουν σε «εκκρεμές, το κλείνει το δίχτυ»)*. Ο γραφέας δεν πετά ποτέ.
 */
export async function republishListingsInScope(
  adminDb: AdminFirestore,
  scope: ListingScope,
  pass: ListingPass = createListingPass(adminDb),
): Promise<readonly ScopedListingReport[]> {
  const reports: ScopedListingReport[] = [];

  for (const doc of await unitsIn(adminDb, scope)) {
    // Το `id` δεν ζει μέσα στο έγγραφο — η προβολή το θέλει ως ταυτότητα της αγγελίας.
    const property: ListingSourceProperty = { ...(doc.data() as ListingSourceProperty), id: doc.id };
    if (!(await isDue(adminDb, scope, doc.id, property, pass))) continue;

    const outcome = await republishListing(adminDb, doc.id, property, pass.resolveAgency, pass.resolveMedia);
    reports.push({ propertyId: doc.id, outcome });
  }

  return reports;
}

/**
 * Ξαναγράφει τις προβολές **όλων** των ακινήτων ενός έργου.
 *
 * Η θέση ζει στο **έργο** (ADR-777 Α1): μια διόρθωση διεύθυνσης εκεί αλλάζει το σχήμα στον χάρτη για
 * **κάθε** αγγελία του — και χωρίς αυτό, καμία δεν θα το μάθαινε.
 */
export async function republishListingsForProject(
  adminDb: AdminFirestore,
  projectId: string,
): Promise<Record<PublishOutcome, number>> {
  const tally: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };

  for (const { outcome } of await republishListingsInScope(adminDb, { kind: 'project', projectId })) {
    tally[outcome] += 1;
  }

  logger.info('Επανασύνθεση προβολών έργου', { projectId, ...tally });
  return tally;
}
