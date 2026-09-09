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
 * Το ερώτημα φιλτράρει σε *«ποιανού είναι»* *(μισθωτής + οντότητα + **οι δύο κάδοι**)*· το
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
  type AgencyMediaCandidate,
  type AgencyMediaDeclaration,
} from './agency-media-publication';
import { publishedAgencyMediaSources } from './agency-media-selection';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

const logger = createModuleLogger('agency-media-reader');

/**
 * **ΟΙ ΚΑΔΟΙ ΠΟΥ ΜΠΟΡΟΥΝ ΝΑ ΔΩΣΟΥΝ ΔΗΜΟΣΙΟ ΥΛΙΚΟ** (ADR-841 §7 Α17.7 · ADR-845 Βήμα Γ).
 *
 * ⚠️ **ΕΞΑΓΕΤΑΙ ΓΙΑ ΝΑ ΕΙΝΑΙ Ο ΚΑΝΟΝΑΣ ΕΚΤΕΛΕΣΙΜΟΣ, ΟΧΙ ΓΙΑ ΝΑ ΤΟΝ ΔΙΑΒΑΣΕΙ ΑΛΛΟΣ.** Ο
 * κανόνας *«κάθε τιμή εδώ έχει σκέλος στο `agencyMediaMaterial`, και αντίστροφα»* ήταν
 * **πρόζα** — και η αντίστροφη κατεύθυνσή του **έσπασε**: το Βήμα Γ βρήκε ότι ένα τρίτο
 * είδος υλικού χρειάζεται **τρεις** αλλαγές, και η τρίτη *(αυτή η λίστα)* ήταν η **πρώτη
 * στη σειρά εκτέλεσης**. Πλέον το φυλά άγκυρα — δες `agency-model-publication.test`.
 * ⛔ Κανείς άλλος **δεν** την καταναλώνει σε κώδικα παραγωγής.
 *
 * 🔴 **ΕΔΩ ΗΤΑΝ Η ΠΡΑΓΜΑΤΙΚΗ ΑΙΤΙΑ ΤΟΥ Ο-21 — ΟΧΙ ΣΤΟΝ ΚΑΝΟΝΑ.** Μέχρι τις 2026-09-06 το
 * ερώτημα έγραφε `.where('category', '==', PHOTOS)`, δηλαδή **καμία κάτοψη δεν έφτανε
 * ποτέ** στον φρουρό που το Ο-21 κατηγορούσε. Το Ο-21 έδειχνε τη λευκή λίστα του
 * `agency-media-publication`· εκείνη έκοβε **δεύτερη**. ⚠️ Πέμπτο σκέλος της ψευδούς
 * προκείμενης *(Α17.7.1)*: **ένας φρουρός που δεν εκτελείται ποτέ δεν είναι η αιτία.**
 *
 * 🔑 **`in` και όχι αφαίρεση του φίλτρου**: χωρίς κατηγορία, το ερώτημα θα κατέβαζε
 * **κάθε** αρχείο του ακινήτου *(συμβόλαια, τιμολόγια, άδειες)* για να τα πετάξει στη
 * μνήμη — περισσότερα reads και **περιττή έκθεση** δεδομένων που δεν αφορούν κανέναν εδώ.
 *
 * 🔑 **Κανένα νέο ευρετήριο**: το `in` πάνω σε πεδίο **ισότητας** εξυπηρετείται από το ίδιο
 * σύνθετο ευρετήριο `[companyId, entityType, entityId, category, isDeleted]`.
 *
 * ⛔ **ΜΗΝ προσθέσεις τρίτο κάδο εδώ «για ευελιξία».** Το *«τι φεύγει;»* το απαντά
 * **αποκλειστικά** το `agencyMediaMaterial`· αυτή η λίστα είναι **στένωση κόστους**, όχι
 * δεύτερο κριτήριο. Κάθε τιμή που μπαίνει εδώ και **δεν** έχει σκέλος εκεί είναι έγγραφα
 * που κατεβαίνουν για να πεταχτούν.
 */
export const PUBLISHABLE_CATEGORIES: readonly string[] = [
  FILE_CATEGORIES.PHOTOS,
  FILE_CATEGORIES.FLOORPLANS,
  // 🔴 **ΤΟ ΤΡΙΤΟ ΣΚΕΛΟΣ ΤΟΥ ΦΡΑΓΜΑΤΟΣ Ο-9** *(ADR-845 Φ4.2β/Βήμα Γ)* — και **ήταν το πρώτο
  //    στη σειρά εκτέλεσης**: χωρίς αυτή τη γραμμή το αρχείο **δεν κατεβαίνει καν**, οπότε οι
  //    δύο φρουροί του `agency-media-publication` δεν εκτελούνται ποτέ. Ακριβώς το σχήμα της
  //    Α17.7.1: *«ένας φρουρός που δεν εκτελείται ποτέ δεν είναι η αιτία»*.
  // ✅ Ο κανόνας από πάνω τηρείται: το `MODELS` **έχει** σκέλος στο `agencyMediaMaterial`.
  // 🔑 Τρεις τιμές ≪ όριο 10 του `in`, και **κανένα νέο ευρετήριο** — ίδιο σύνθετο.
  FILE_CATEGORIES.MODELS,
];

/**
 * Η επιλογή δημοσίευσης **ενός ακινήτου** του γραφείου.
 *
 * ⚠️ **Η δήλωση του ανθρώπου ΤΑΞΙΔΕΥΕΙ, δεν διαβάζεται εδώ** (ADR-841 §7 Α14.7.2). Ζει στο
 * **έγγραφο του ακινήτου**, το οποίο ο καλών έχει **ήδη στα χέρια του** — μια δεύτερη
 * ανάγνωση εδώ θα πλήρωνε ένα read ανά αγγελία για δεδομένο που ταξιδεύει δωρεάν, και θα
 * μπορούσε να διαβάσει **άλλη** έκδοση του ίδιου εγγράφου μέσα στο ίδιο πέρασμα.
 */
export type AgencyMediaResolver = (
  propertyId: string,
  companyId: string | null | undefined,
  declaration: AgencyMediaDeclaration,
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
  declaration: AgencyMediaDeclaration,
): Promise<readonly PublicShelfSource[]> {
  const owner = typeof companyId === 'string' && companyId.trim() !== '' ? companyId : null;
  if (owner === null || propertyId.trim() === '') return NO_AGENCY_MEDIA;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where('companyId', '==', owner)
      .where('entityType', '==', 'property')
      .where('entityId', '==', propertyId)
      .where('category', 'in', PUBLISHABLE_CATEGORIES)
      .get();

    return publishedAgencyMediaSources(
      snapshot.docs.map((doc) => ({ ...(doc.data() as AgencyMediaCandidate), id: doc.id })),
      declaration,
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
  return (propertyId, companyId, declaration) =>
    readPublishedAgencyMedia(adminDb, propertyId, companyId, declaration);
}
