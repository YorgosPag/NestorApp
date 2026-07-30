/**
 * `BOQAdminReadService` — ανάγνωση BOQ με **Admin SDK**, για τον πράκτορα
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ (ADR-734 §8.3, απόφαση Φάσης 3)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `boqService` χτίζεται πάνω στο **client** Firebase SDK (`firebase/firestore`
 * + `@/lib/firebase`). Ο agentic executor είναι `server-only` με **Admin** SDK.
 * Αν οι επτά δυνατότητες του ADR-734 §7 τροφοδοτούνταν με το client service μέσα
 * στον server, το client SDK θα έτρεχε **ανεξουσιοδότητο**: τα Firestore rules θα
 * έκοβαν, το client repository **καταπίνει** το σφάλμα και επιστρέφει `[]`, και ο
 * πράκτορας θα ανακοίνωνε «δεν βρέθηκαν επιμετρήσεις» — **σιωπηλά και ψευδώς**.
 * Ψευδές «κενό» είναι χειρότερο από σφάλμα: το σφάλμα φαίνεται.
 *
 * Αυτή η κλάση είναι η **προσθήκη** που το λύνει. Δεν αγγίζει `boqService`,
 * `cost-engine` ή `boq-repository` (ADR-734 §9): μοιράζεται μαζί τους τους
 * **καθαρούς** κανόνες (`boq-document-normalize`, `boq-read-shared`,
 * `boq-atoe-fallback`) και ξαναγράφει **μόνο** ό,τι επιβάλλει το άλλο SDK — τα
 * ερωτήματα.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΣΚΟΠΙΜΗ ΔΙΑΦΟΡΑ ΣΥΜΠΕΡΙΦΟΡΑΣ: ΕΔΩ ΤΑ ΣΦΑΛΜΑΤΑ **ΔΕΝ ΚΑΤΑΠΙΝΟΝΤΑΙ**
 * ─────────────────────────────────────────────────────────────────────────────
 * Το client repository επιστρέφει `[]` / `null` σε κάθε αστοχία υποδομής. Για
 * UI είναι ανεκτό — ο άνθρωπος βλέπει κενή οθόνη και ξαναφορτώνει. Για πράκτορα
 * που παρουσιάζει αριθμό **προς υπογραφή** είναι απαράδεκτο: «κενό αποτέλεσμα»
 * και «δεν μπόρεσα να διαβάσω» γίνονται δυσδιάκριτα, και το μοντέλο θα δηλώσει
 * το δεύτερο ως πρώτο με απόλυτη σιγουριά.
 *
 * Εδώ η αστοχία **ρίχνει**. Το registry (`invoke()`) την πιάνει και τη μετατρέπει
 * σε `INTERNAL` χωρίς να διαρρεύσει μήνυμα υποδομής — δηλαδή ο πράκτορας μαθαίνει
 * «απέτυχε», όχι «δεν υπάρχει». Είναι η ίδια διάκριση που το ADR-734 §6.5 #4
 * επιβάλλει μεταξύ `null` («κανείς δεν παρακολουθεί») και `0` («ελέγχθηκε,
 * καθαρό»), εφαρμοσμένη στο επίπεδο πρόσβασης δεδομένων.
 *
 * Η μοναδική εξαίρεση είναι δηλωμένη και αιτιολογημένη στο `getCategories()`.
 *
 * @module services/measurements/admin/boq-admin-read-service
 * @see ADR-734 §7 (τα εργαλεία), §8.3 (η απόφαση SDK), §9 (τι δεν αγγίζουμε)
 * @see ADR-175 (BOQ)
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import type { BOQCategory, BOQItem, BOQSummary } from '@/types/boq';
import type { BOQSearchFilters, BOQStats } from '../contracts';
import type { IBOQReadService } from '../boq-read-contract';
import { normalizeBOQCategory, normalizeBOQItemSafe } from '../boq-document-normalize';
import { applyBoqSearchText, buildCategoryNameMap, computeBoqStats } from '../boq-read-shared';
import { buildStaticAtoeCategories } from '../boq-atoe-fallback';
import { computeBuildingSummary } from '../cost-engine';

const logger = createModuleLogger('BOQAdminReadService');

/** Η ταξινόμηση των γραμμών — ίδια με το client μονοπάτι, ώστε ίδια σειρά παντού. */
const ITEM_ORDER_FIELD = 'categoryCode';

/**
 * Ισοδύναμα φίλτρων → περιορισμοί ερωτήματος.
 *
 * Δηλωτικός πίνακας αντί για αλυσίδα `if`: η προσθήκη φίλτρου είναι **μία
 * γραμμή δεδομένων**, όχι νέο κλαδί κώδικα που μπορεί να ξεχάσει το `companyId`.
 */
const EQUALITY_FILTERS: readonly {
  readonly field: string;
  readonly read: (filters: BOQSearchFilters) => string | undefined;
}[] = [
  { field: 'categoryCode', read: (f) => f.categoryCode },
  { field: 'status', read: (f) => (f.status && f.status !== 'all' ? f.status : undefined) },
  { field: 'source', read: (f) => f.source },
  { field: 'scope', read: (f) => f.scope },
  { field: 'linkedPhaseId', read: (f) => f.linkedPhaseId },
];

type AdminDocument = FirebaseFirestore.QueryDocumentSnapshot;

/** Έγγραφα → γραμμές, πετώντας όσα δεν κανονικοποιούνται (δεν ρίχνει τη λίστα). */
function toItems(documents: readonly AdminDocument[]): BOQItem[] {
  return documents
    .map((document) => normalizeBOQItemSafe(document.id, document.data() as Record<string, unknown>))
    .filter((item): item is BOQItem => item !== null);
}

export class BOQAdminReadService implements IBOQReadService {
  private readonly db: Firestore;

  /**
   * @param db Ένεση **μόνο** για τα tests. Στην παραγωγή αφήνεται κενό ώστε η
   *   σύνδεση να λύνεται τεμπέλικα: αν λυνόταν στον κατασκευαστή, μια εισαγωγή
   *   του module σε περιβάλλον χωρίς διαπιστευτήρια θα έριχνε κατά τη φόρτωση.
   */
  constructor(db?: Firestore) {
    this.db = db ?? getAdminFirestore();
  }

  // --- ΓΡΑΜΜΕΣ ---

  async getByBuilding(companyId: string, buildingId: string): Promise<BOQItem[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where('companyId', '==', companyId)
      .where('buildingId', '==', buildingId)
      .orderBy(ITEM_ORDER_FIELD, 'asc')
      .get();

    return toItems(snapshot.docs);
  }

  /**
   * ⚠️ **Χωρίς `companyId` — κατά το συμβόλαιο του `IBOQService`.** Ο έλεγχος
   * ιδιοκτησίας γίνεται **μετά** το fetch, στο `fetchOwnedBoqItem()`
   * (ADR-734 §7.1). Καμία δυνατότητα δεν καλεί αυτή τη μέθοδο απευθείας· ο
   * φύλακας `boq-capability-tenant-guard` του `.ssot-registry.json` το επιβάλλει.
   */
  async getById(id: string): Promise<BOQItem | null> {
    const snapshot = await this.db.collection(COLLECTIONS.BOQ_ITEMS).doc(id).get();
    if (!snapshot.exists) return null;

    return normalizeBOQItemSafe(snapshot.id, snapshot.data() as Record<string, unknown>);
  }

  async search(
    companyId: string,
    buildingId: string,
    filters?: BOQSearchFilters,
  ): Promise<BOQItem[]> {
    let boqQuery: FirebaseFirestore.Query = this.db
      .collection(COLLECTIONS.BOQ_ITEMS)
      .where('companyId', '==', companyId)
      .where('buildingId', '==', buildingId);

    if (filters) {
      for (const { field, read } of EQUALITY_FILTERS) {
        const value = read(filters);
        if (value !== undefined) {
          boqQuery = boqQuery.where(field, '==', value);
        }
      }
    }

    const snapshot = await boqQuery.orderBy(ITEM_ORDER_FIELD, 'asc').get();

    // Το ταίριασμα κειμένου γίνεται στη μνήμη — η Firestore δεν έχει αναζήτηση
    // υποσυμβολοσειράς. Ίδιος κανόνας με το client μονοπάτι (SSoT).
    return applyBoqSearchText(toItems(snapshot.docs as AdminDocument[]), filters?.searchText);
  }

  // --- ΣΥΝΑΘΡΟΙΣΕΙΣ ---

  async getStatistics(companyId: string, buildingId: string): Promise<BOQStats> {
    const items = await this.getByBuilding(companyId, buildingId);
    return computeBoqStats(items);
  }

  /**
   * Κατηγορίες ΑΤΟΕ του tenant.
   *
   * ⚠️ **Η μία δηλωμένη εξαίρεση στον κανόνα «τα σφάλματα ρίχνουν».** Κενή
   * συλλογή είναι **φυσιολογική** κατάσταση (ο πελάτης δεν έχει παραμετροποιήσει
   * δικές του κατηγορίες) και απαντάται με τον master κατάλογο ΑΤΟΕ. Αστοχία
   * ανάγνωσης όμως **ρίχνει** — σε αντίθεση με το client μονοπάτι, που γυρίζει
   * τον ίδιο static κατάλογο και στις δύο περιπτώσεις και έτσι τις κάνει
   * δυσδιάκριτες.
   */
  async getCategories(companyId: string): Promise<BOQCategory[]> {
    const snapshot = await this.db
      .collection(COLLECTIONS.BOQ_CATEGORIES)
      .where('companyId', '==', companyId)
      .orderBy('sortOrder', 'asc')
      .get();

    if (snapshot.empty) {
      return buildStaticAtoeCategories(companyId);
    }

    return snapshot.docs.map((document) =>
      normalizeBOQCategory(document.id, document.data() as Record<string, unknown>),
    );
  }

  /**
   * Σύνοψη κτιρίου.
   *
   * ⚠️ Επιστρέφει `null` **μόνο** για κτίριο χωρίς γραμμές. Το client μονοπάτι
   * επιστρέφει `null` **και** σε εσωτερική αστοχία (πιάνει το σφάλμα), οπότε ο
   * καλών δεν μπορεί να ξεχωρίσει «άδειο κτίριο» από «δεν διάβασα». Εδώ η
   * δεύτερη περίπτωση ρίχνει και καταλήγει σε `INTERNAL` (ADR-734 §7.2 #2).
   */
  async getBuildingSummary(companyId: string, buildingId: string): Promise<BOQSummary | null> {
    const items = await this.getByBuilding(companyId, buildingId);
    if (items.length === 0) return null;

    const firstItem = items[0];
    const categories = firstItem ? await this.getCategories(firstItem.companyId) : [];

    return computeBuildingSummary(buildingId, items, buildCategoryNameMap(items, categories));
  }
}

// ============================================================================
// SINGLETON — τεμπέλικο, ώστε η εισαγωγή να μη ζητά διαπιστευτήρια
// ============================================================================

let instance: BOQAdminReadService | null = null;

/** Το admin service ανάγνωσης του τρέχοντος διεργασιακού περιβάλλοντος. */
export function getBoqAdminReadService(): BOQAdminReadService {
  if (instance === null) {
    logger.info('Initializing admin BOQ read service');
    instance = new BOQAdminReadService();
  }
  return instance;
}
