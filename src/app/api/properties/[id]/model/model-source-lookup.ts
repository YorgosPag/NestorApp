import 'server-only';

/**
 * @fileoverview **ΣΕ ΠΟΙΑ ΕΚΔΟΣΗ ΗΤΑΝ ΤΑ ΣΧΕΔΙΑ ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΔΗΜΟΣΙΕΥΣΗΣ;** (ADR-845 Ο-25)
 * @related lib/listings/model-source-revisions · api/cad-files (ο γραφέας του `revision`)
 * @module app/api/properties/[id]/model/model-source-lookup
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — **ΤΟ ΟΡΙΟ ΤΗΣ ΠΟΡΤΑΣ ΕΙΝΑΙ 300 ΓΡΑΜΜΕΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `route.ts` ήταν στις **280/300** *(N.7.1: `/api/*route.ts` → 300)*. Δύο αναγνώσεις
 * παραπάνω και η πύλη θα μπλόκαρε το commit. ⇒ **EXTRACT, ποτέ trim** — και η γραμμή της
 * τομής δεν είναι αυθαίρετη: η **πόρτα** κρίνει *κηδεμονία και σχήμα*· εδώ ζει η **ανάγνωση**
 * που τρέφει την καταγραφή.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΠΕΛΑΤΗΣ ΛΕΕΙ *ΠΟΙΑ*, ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΓΡΑΦΕΙ *ΣΕ ΠΟΙΟ REVISION*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ίδια ραφή με το `at` του δημόσιου σχήματος *(`timeCreated` του αντικειμένου, ποτέ ρολόι
 * πελάτη)*: ένα revision που θα ερχόταν από τον πελάτη θα ήταν **ισχυρισμός του καλούντος**,
 * και θα μπορούσε να είναι μπαγιάτικο **τη στιγμή που γράφεται** — ο πελάτης κρατά ένα
 * στιγμιότυπο της σκηνής, όχι το ζωντανό έγγραφο.
 *
 * ⛔ **Δεν κρίνει ΤΙΠΟΤΑ** — ούτε κύκλο ζωής, ούτε κηδεμονία, ούτε αν το αρχείο είναι
 * σκηνή. Είναι **ανάγνωση**, και η μόνη της απόφαση είναι *«τι κάνω όταν λείπει»*.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import {
  supersededByPublication,
  type AgencyMediaCandidate,
} from '@/services/listings/agency-media-selection';
import type { ModelSourceRevision } from '@/lib/listings/model-source-revisions';
import type { FileRecordBase } from '@/services/file-record';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('ModelSourceLookup');

/**
 * **Πόσα σχέδια δέχεται μία δημοσίευση** — φρουρός εισόδου, όχι προτίμηση.
 *
 * 🔑 Ένα μοντέλο `all-floors` έχει τόσα σχέδια όσοι οι όροφοι· ένα κτίριο με πάνω από **30**
 * ορόφους δεν υπάρχει σε αυτό το έργο. Το ταβάνι υπάρχει ώστε ένα κακόβουλο —ή απλώς
 * σπασμένο— σώμα αιτήματος να μη μετατρέψει **μία** δημοσίευση σε αυθαίρετο πλήθος
 * αναγνώσεων Firestore.
 */
export const MAX_MODEL_SOURCE_FILES = 30;

/**
 * **Ό,τι έστειλε ο πελάτης ως κατάλογο σχεδίων** — `[]` για κάθε άλλη απάντηση.
 *
 * ⚠️ **Δέχεται `unknown` επειδή αυτό ακριβώς είναι ένα πεδίο multipart.** Ένα σχήμα που δεν
 * αναγνωρίζεται σημαίνει *«δεν κατέγραψα προέλευση»* — δηλαδή `unknown` παλαιότητα, που είναι
 * **τίμιο**. ⛔ **Ποτέ άρνηση της δημοσίευσης**: η καταγραφή δεν επιτρέπεται να ακυρώσει την
 * πράξη, όπως δεν την ακυρώνει ούτε η ιστορία της διαδοχής *(Ο-27)*.
 */
export function readSceneFileIds(raw: unknown): readonly string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const ids: readonly unknown[] = parsed;
  return ids
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, MAX_MODEL_SOURCE_FILES);
}

/**
 * 🏆 **ΤΑ ΣΧΕΔΙΑ, ΣΤΗΝ ΕΚΔΟΣΗ ΠΟΥ ΕΧΟΥΝ ΤΩΡΑ** — μία ανάγνωση ανά αρχείο, όλες μαζί.
 *
 * 🔑 **`getAll`, όχι βρόχος από `get()`**: το Firestore το εξυπηρετεί σε **ένα** ταξίδι
 * δικτύου, και ο κατάλογος είναι **ήδη** ταυτοποιητικά — δεν χρειάζεται ερώτημα ούτε
 * ευρετήριο. Ένας βρόχος θα πλήρωνε N γύρους για δουλειά που γίνεται σε έναν.
 *
 * ⚠️ **Η ΚΗΔΕΜΟΝΙΑ ΕΛΕΓΧΕΤΑΙ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΕΛΕΤΟΥΡΓΙΚΟ.** Τα ταυτοποιητικά τα έδωσε ο
 * **πελάτης**: χωρίς αυτόν τον έλεγχο, ένα κατασκευασμένο σώμα θα μπορούσε να διαβάσει
 * `revision` αρχείου **ξένης εταιρείας** — μικρή διαρροή, αλλά **διαρροή**. Ίδιος κανόνας με
 * τον αναγνώστη της δημοσίευσης: *«η απουσία κηδεμονίας είναι λόγος σιωπής»*.
 *
 * ⚠️ **Αρχείο χωρίς αριθμητικό `revision` παραλείπεται** — δεν βαφτίζεται `0`. Ένα `?? 0` θα
 * έγραφε καταγραφή που **δεν θα ταίριαζε ποτέ** με το ζωντανό έγγραφο, δηλαδή θα δήλωνε το
 * μοντέλο **μόνιμα μπαγιάτικο** από τη στιγμή που γεννήθηκε.
 *
 * 🔑 **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον `readPublishedAgencyMedia`: η αποτυχία της
 * καταγραφής δεν ακυρώνει τη δημοσίευση. Αλλά **ονομάζεται** στο ημερολόγιο, ώστε η διαφορά
 * «δεν υπήρχαν σχέδια» ⇄ «γνωστά απέτυχε» να μένει ορατή.
 */
export async function readModelSourceRevisions(
  adminDb: AdminFirestore,
  companyId: string,
  sceneFileIds: readonly string[],
): Promise<readonly ModelSourceRevision[]> {
  if (sceneFileIds.length === 0) return [];

  try {
    const refs = sceneFileIds.map((id) => adminDb.collection(COLLECTIONS.FILES).doc(id));
    const snapshots = await adminDb.getAll(...refs);

    return snapshots.flatMap((snapshot) => {
      const data = snapshot.data();
      if (data === undefined || data.companyId !== companyId) return [];

      const revision = data.revision;
      return typeof revision === 'number' && Number.isFinite(revision)
        ? [{ fileId: snapshot.id, revision }]
        : [];
    });
  } catch (error) {
    logger.warn('Οι εκδόσεις των σχεδίων δεν διαβάστηκαν — το μοντέλο δημοσιεύεται ΧΩΡΙΣ προέλευση', {
      companyId,
      requested: sceneFileIds.length,
      error: getErrorMessage(error),
    });
    return [];
  }
}

/**
 * **Ποια ενεργά αρχεία δημοσιεύουν ΤΟ ΙΔΙΟ ΠΡΑΓΜΑ;** — η κρίση, ποτέ η πράξη (Ο-27).
 *
 * 🔑 **ΚΑΝΕΝΑ ΝΕΟ ΕΥΡΕΤΗΡΙΟ, ΚΑΙ ΤΟ ΦΙΛΤΡΟ ΤΑΥΤΟΤΗΤΑΣ ΜΕΝΕΙ ΣΤΗ ΜΝΗΜΗ.** Τα τέσσερα πεδία
 * του ερωτήματος είναι **πρόθεμα** του υπάρχοντος σύνθετου
 * `[companyId, entityType, entityId, category, isDeleted]` — του **ίδιου** που εξυπηρετεί τον
 * αναγνώστη της δημοσίευσης. Ένα πέμπτο σκέλος `publicationIdentity` θα απαιτούσε **νέο**
 * ευρετήριο για να διαλέξει ανάμεσα σε **λίγες** εγγραφές: ένα ακίνητο έχει μονοψήφιο αριθμό
 * μοντέλων *(και το `PUBLISHED_MEDIA_LIMIT` το κρατά έτσι)*.
 *
 * 🔴 **Η ΙΣΟΤΗΤΑ ΤΑΥΤΟΤΗΤΑΣ ΔΕΝ ΓΡΑΦΕΤΑΙ ΕΔΩ** — τη ρωτά το `supersededByPublication`, το
 * **ίδιο** σώμα που ζει δίπλα στην επιμέλεια της αγγελίας. Μια δεύτερη σύγκριση εδώ θα ήταν
 * δύο απαντήσεις στο *«είναι αυτά τα δύο το ίδιο πράγμα;»*, ελεύθερες να αποκλίνουν — και η
 * απόκλιση θα ήταν **αόρατη**: η αγγελία θα έδειχνε ένα, ο κάδος θα κρατούσε δύο ενεργά.
 *
 * ⚠️ **Δεν πετά ποτέ.** Η ιστορία δεν επιτρέπεται να ακυρώσει τη δημοσίευση: το κοινό είναι
 * **ήδη** σωστό από την επιμέλεια, ό,τι κι αν πει αυτό το ερώτημα. Η αποτυχία **ονομάζεται**
 * στο ημερολόγιο, ώστε η διαφορά «κανένας προκάτοχος» ⇄ «δεν κοιτάξαμε» να μένει ορατή.
 */
export async function findSupersededModels(
  adminDb: AdminFirestore,
  companyId: string,
  propertyId: string,
  newcomer: FileRecordBase,
): Promise<readonly string[]> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.FILES)
      .where('companyId', '==', companyId)
      .where('entityType', '==', ENTITY_TYPES.PROPERTY)
      .where('entityId', '==', propertyId)
      .where('category', '==', FILE_CATEGORIES.MODELS)
      .get();

    return supersededByPublication(
      snapshot.docs.map((doc) => ({ ...(doc.data() as AgencyMediaCandidate), id: doc.id })),
      newcomer as AgencyMediaCandidate,
    );
  } catch (error) {
    logger.warn('Οι προκάτοχοι του μοντέλου δεν διαβάστηκαν — η αγγελία μένει σωστή, η ιστορία όχι', {
      propertyId, companyId, error: getErrorMessage(error),
    });
    return [];
  }
}
