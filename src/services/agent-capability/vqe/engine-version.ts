/**
 * Engine Version — δηλωμένη έκδοση + **αυτόματο** αποτύπωμα συμπεριφοράς
 *
 * Το `IntegrityRecord.engineVersion` απαντά: «αν ξανατρέξω τον ίδιο υπολογισμό,
 * θα πάρω τον ίδιο αριθμό;». Μια χειροκίνητη σταθερά έκδοσης απαντά σε αυτό
 * **μόνο όσο κάποιος θυμάται να την αυξήσει** — και η ιστορία αυτού του repo
 * δείχνει ότι οι χειροκίνητες σταθερές σαπίζουν σιωπηλά.
 *
 * Γι' αυτό η έκδοση είναι σύνθετη: `<semver>+<fingerprint>`
 *
 *   • `semver`      — για ανθρώπους· αυξάνεται σε συμβατικά breaking changes.
 *   • `fingerprint` — sha256 των **πραγματικών εξόδων** του cost-engine πάνω σε
 *                     σταθερό δείγμα. Αλλάζει ένας τύπος ⇒ αλλάζει το
 *                     αποτύπωμα **αυτόματα**, χωρίς να το θυμηθεί κανείς.
 *
 * Είναι το μοτίβο content-addressed build (Bazel action key / Nix derivation):
 * το αποτύπωμα του εργαλείου μπαίνει στο κλειδί του αποτελέσματος.
 *
 * ⚠️ **Ειλικρίνεια ορίων**: το αποτύπωμα καλύπτει ό,τι αγγίζει το δείγμα. Είναι
 * **ανιχνευτής μεταβολής**, όχι απόδειξη ισοδυναμίας. Αλλαγή σε μονοπάτι που το
 * δείγμα δεν εκτελεί δεν φαίνεται.
 *
 * ⚠️ Το δείγμα ΔΕΝ επιτρέπεται να περιέχει ρολόι ή locale:
 *   • το `computeBuildingSummary` γράφει `lastUpdated: nowISO()` ⇒ **εξαιρείται**
 *     ρητά (αλλιώς η «έκδοση» θα άλλαζε κάθε κλήση)·
 *   • το ίδιο ταξινομεί κατηγορίες με `compareByLocale` ⇒ ξανα-ταξινομούμε κατά
 *     code unit πριν το hash (αλλιώς η έκδοση θα εξαρτιόταν από την έκδοση ICU
 *     του μηχανήματος).
 *
 * @module services/agent-capability/vqe/engine-version
 * @see ADR-734 §6.2 (IntegrityRecord)
 */

import type { BOQItem } from '@/types/boq';
// Βαθύ import σκόπιμα: το barrel `@/services/measurements` δημιουργεί το
// singleton `boqService` (Firestore) στο module load. Ο φάκελος είναι pure —
// δεν επιτρέπεται να σέρνει I/O στο γράφο εισαγωγών.
import {
  computeGrossQuantity,
  computeItemCost,
  computeVariance,
  computeBaselineDrift,
  computeBuildingSummary,
} from '@/services/measurements/cost-engine';
import { canonicalize } from './canonical-encoding';
import { sha256HexSync } from './hashing';
import { compareCodeUnits } from './ordering';

// ============================================================================
// ΔΗΛΩΜΕΝΗ ΕΚΔΟΣΗ
// ============================================================================

/**
 * Συμβατική έκδοση του υπολογιστικού στρώματος (ανθρώπινη σημασία).
 * Αύξησέ την όταν αλλάζει το **νόημα** ενός αριθμού, ακόμη κι αν το αποτύπωμα
 * θα το έπιανε ούτως ή άλλως.
 */
export const VQE_ENGINE_SEMVER = '1.0.0';

/** Μήκος του αποτυπώματος σε hex χαρακτήρες (48 bits — αρκετά για ανίχνευση μεταβολής). */
const FINGERPRINT_LENGTH = 12;

// ============================================================================
// ΔΕΙΓΜΑ ΣΥΜΠΕΡΙΦΟΡΑΣ
// ============================================================================

/** Σταθερό BOQ item δείγματος. Καμία τιμή δεν προέρχεται από ρολόι ή τυχαιότητα. */
const PROBE_ITEM_BASE: BOQItem = {
  id: 'probe-item-a',
  companyId: 'probe-company',
  projectId: 'probe-project',
  buildingId: 'probe-building',
  scope: 'building',
  linkedFloorId: null,
  linkedUnitId: null,
  linkedUnitIds: null,
  costAllocationMethod: 'by_area',
  customAllocations: null,
  categoryCode: 'OIK-2',
  subCategoryCode: 'OIK-2.1',
  title: 'probe',
  description: null,
  unit: 'm3',
  estimatedQuantity: 12.5,
  actualQuantity: 13.25,
  wasteFactor: 0.08,
  wastePolicy: 'inherited',
  materialUnitCost: 92.4,
  laborUnitCost: 31.75,
  equipmentUnitCost: 7.125,
  priceAuthority: 'master',
  linkedPhaseId: null,
  linkedTaskId: null,
  linkedInvoiceId: null,
  linkedContractorId: null,
  source: 'manual',
  measurementMethod: 'manual',
  status: 'approved',
  qaStatus: 'pending',
  notes: null,
  createdBy: null,
  approvedBy: null,
  createdAt: '2020-01-01T00:00:00.000Z',
  updatedAt: '2020-01-01T00:00:00.000Z',
  liveQuantity: 14,
  liveQuantitySyncedAt: '2020-01-02T00:00:00.000Z',
};

/** Δεύτερο item με άλλη κατηγορία — ενεργοποιεί την ομαδοποίηση του rollup. */
const PROBE_ITEM_SECOND: BOQItem = {
  ...PROBE_ITEM_BASE,
  id: 'probe-item-b',
  categoryCode: 'OIK-1',
  unit: 'm2',
  estimatedQuantity: 40,
  actualQuantity: null,
  wasteFactor: 0,
  liveQuantity: null,
  liveQuantitySyncedAt: null,
};

/** Ονόματα κατηγοριών ως `Map` — ελέγχει και ότι ο κωδικοποιητής δεν τα ισοπεδώνει. */
const PROBE_CATEGORY_NAMES = new Map<string, string>([
  ['OIK-1', 'probe-category-one'],
  ['OIK-2', 'probe-category-two'],
]);

/**
 * Παρατηρήσιμη συμπεριφορά της μηχανής πάνω στο δείγμα, καθαρισμένη από ρολόι
 * και locale.
 */
function probeEngineBehaviour(): unknown {
  const summary = computeBuildingSummary(
    'probe-building',
    [PROBE_ITEM_BASE, PROBE_ITEM_SECOND],
    PROBE_CATEGORY_NAMES,
  );
  return {
    gross: [
      computeGrossQuantity(7, 0.08),
      computeGrossQuantity(3, 2), // clamp άνω ορίου
      computeGrossQuantity(5, -1), // clamp κάτω ορίου
    ],
    itemCost: computeItemCost(PROBE_ITEM_BASE),
    variance: computeVariance(PROBE_ITEM_BASE),
    drift: computeBaselineDrift(PROBE_ITEM_BASE),
    summary: {
      buildingId: summary.buildingId,
      totalItems: summary.totalItems,
      totalEstimatedCost: summary.totalEstimatedCost,
      totalActualCost: summary.totalActualCost,
      // ΟΧΙ `summary.lastUpdated` — ρολόι.
      // Επανα-ταξινόμηση κατά code unit — ΟΧΙ locale.
      categories: [...summary.categories].sort((a, b) =>
        compareCodeUnits(a.categoryCode, b.categoryCode),
      ),
    },
  };
}

// ============================================================================
// ΑΠΟΤΥΠΩΜΑ
// ============================================================================

let cachedFingerprint: string | null = null;

/**
 * Αποτύπωμα συμπεριφοράς της υπολογιστικής μηχανής. Μνημονεύεται: ο υπολογισμός
 * είναι καθαρός και ντετερμινιστικός, άρα η μία εκτέλεση ανά διεργασία αρκεί.
 */
export function computeEngineFingerprint(): string {
  if (cachedFingerprint === null) {
    cachedFingerprint = sha256HexSync(canonicalize(probeEngineBehaviour())).slice(
      0,
      FINGERPRINT_LENGTH,
    );
  }
  return cachedFingerprint;
}

/** Η πλήρης έκδοση μηχανής όπως γράφεται στο `IntegrityRecord.engineVersion`. */
export function resolveEngineVersion(): string {
  return `${VQE_ENGINE_SEMVER}+${computeEngineFingerprint()}`;
}
