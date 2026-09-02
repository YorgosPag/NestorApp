/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΩΝ ΔΗΜΟΣΙΩΝ ΦΩΤΟΓΡΑΦΙΩΝ ΤΟΥ ΓΡΑΦΕΙΟΥ** (ADR-841 §7 Α14.5).
 * @related services/listings/agency-media-publication · services/company/company-public-name.reader
 * @module services/listings/agency-media.reader
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ ΙΔΙΟ ΙΔΙΩΜΑ ΜΕ ΤΟΝ `AgencyIdentityResolver`, ΓΙΑ ΤΟΝ ΙΔΙΟ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας δέχεται **επιλυτή ως όρισμα** αντί να ρωτά μόνος του: ένα πέρασμα οφείλει
 * να μιλά για **μία** εικόνα του κόσμου, και ο βρόχος μπορεί να στήσει τη δική του
 * πολιτική κόστους χωρίς ο γραφέας να ξέρει ότι υπάρχει.
 *
 * ⚠️ **ΔΕΝ απομνημονεύεται**, σε αντίθεση με τον επιλυτή ταυτότητας — και είναι
 * **διαφορά ουσίας, όχι παράλειψη**: εκείνος ρωτά *ανά **εταιρεία*** *(N ακίνητα ⇒ 1
 * ανάγνωση)*, αυτός *ανά **ακίνητο*** *(N ακίνητα ⇒ N αναγνώσεις, καμία επανάληψη)*.
 * Μνήμη εδώ θα κρατούσε τα πάντα ζωντανά χωρίς να γλιτώνει **ούτε ένα** ερώτημα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΣΤΕΝΕΥΕΙ ΣΕ **ΚΗΔΕΜΟΝΙΑ**· Η **ΑΠΟΦΑΣΗ** ΖΕΙ ΣΤΟΝ ΚΑΘΑΡΟ ΚΑΝΟΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ερώτημα φιλτράρει σε *«ποιανού είναι»* *(μισθωτής + οντότητα + κατηγορία)*· το
 * *«δημοσιεύεται;»* το απαντά **αποκλειστικά** το {@link publishedAgencyMediaSources},
 * στη μνήμη. **Δεν** είναι βελτιστοποίηση — είναι το SSoT: κριτήριο μοιρασμένο ανάμεσα
 * σε ένα ευρετήριο Firestore και μια συνάρτηση θα ήταν **δύο** απαντήσεις, και η μισή
 * **δεν θα εκτελούνταν ποτέ σε δοκιμή**.
 *
 * 🔑 Και τα τέσσερα πεδία είναι **πρόθεμα** του υπάρχοντος σύνθετου ευρετηρίου
 * `[companyId, entityType, entityId, category, isDeleted]` ⇒ **κανένα νέο ευρετήριο**.
 * Το `companyId` είναι επίσης ο όρος που απαιτούν τα CHECK 3.10 / 3.35, και δεν είναι
 * τελετουργικό: είναι η **απόδειξη κηδεμονίας** — το ίδιο `companyId` που έγραψε το
 * `createEntity` από το auth context (ADR-238).
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FILE_CATEGORIES } from '@/config/domain-constants';
import { createModuleLogger } from '@/lib/telemetry';
import {
  publishedAgencyMediaSources,
  type AgencyMediaCandidate,
} from './agency-media-publication';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

const logger = createModuleLogger('agency-media-reader');

/** Η επιλογή δημοσίευσης **ενός ακινήτου** του γραφείου. */
export type AgencyMediaResolver = (
  propertyId: string,
  companyId: string | null | undefined,
) => Promise<readonly PublicShelfSource[]>;

/** Κανένα δημόσιο αρχείο — μοιράζεται, γιατί είναι αμετάβλητο και κενό. */
const NO_AGENCY_MEDIA: readonly PublicShelfSource[] = [];

/**
 * **Τι δημοσιεύει αυτό το ακίνητο του γραφείου.**
 *
 * ⚠️ **Χωρίς `companyId` επιστρέφει κενό ΧΩΡΙΣ να ρωτήσει.** Ερώτημα δίχως μισθωτή θα
 * ήταν σάρωση **όλης** της `files` — δηλαδή ένα ακίνητο χωρίς ιδιοκτήτη θα μπορούσε να
 * δημοσιεύσει αρχεία **ξένης** εταιρείας. Η απουσία κηδεμονίας είναι λόγος **σιωπής**,
 * ποτέ λόγος πλατύτερης ερώτησης.
 *
 * 🔑 **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον γραφέα: η αποτυχία ανάγνωσης των
 * φωτογραφιών δεν επιτρέπεται να ακυρώσει τη δημοσίευση της αγγελίας. Αλλά
 * **ονομάζεται** στο ημερολόγιο, ώστε η διαφορά «σιωπηλά κενό» ⇄ «γνωστά απέτυχε» να
 * μένει ορατή.
 */
export async function readPublishedAgencyMedia(
  adminDb: AdminFirestore,
  propertyId: string,
  companyId: string | null | undefined,
): Promise<readonly PublicShelfSource[]> {
  const owner = typeof companyId === 'string' && companyId.trim() !== '' ? companyId : null;
  if (owner === null || propertyId.trim() === '') return NO_AGENCY_MEDIA;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where('companyId', '==', owner)
      .where('entityType', '==', 'property')
      .where('entityId', '==', propertyId)
      .where('category', '==', FILE_CATEGORIES.PHOTOS)
      .get();

    return publishedAgencyMediaSources(
      snapshot.docs.map((doc) => ({ ...(doc.data() as AgencyMediaCandidate), id: doc.id })),
    );
  } catch (error) {
    logger.warn('Οι φωτογραφίες του γραφείου δεν διαβάστηκαν — η αγγελία δημοσιεύεται χωρίς αυτές', {
      propertyId,
      companyId: owner,
      error: error instanceof Error ? error.message : String(error),
    });
    return NO_AGENCY_MEDIA;
  }
}

/**
 * **Ο επιλυτής ενός περάσματος.** Δες το σχόλιο του module για το γιατί δεν έχει μνήμη.
 */
export function createAgencyMediaResolver(adminDb: AdminFirestore): AgencyMediaResolver {
  return (propertyId, companyId) => readPublishedAgencyMedia(adminDb, propertyId, companyId);
}
