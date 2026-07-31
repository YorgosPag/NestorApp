/**
 * Το **ένα** registry BOQ με Admin SDK — SSoT για κάθε server-side καταναλωτή
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΕΞΗΧΘΗ ΕΔΩ (N.0.2 — Boy Scout)
 * ─────────────────────────────────────────────────────────────────────────────
 * Στη Φάση 3α η σύνδεση «τεμπέλικο admin service → registry» ζούσε ιδιωτικά
 * μέσα στον `boq-capability-handler.ts`, όπου ήταν ο μοναδικός καταναλωτής. Με
 * τη Φάση 3β εμφανίστηκε δεύτερος (το MCP transport). Η αντιγραφή των ~20
 * γραμμών θα ήταν το κλασικό «sibling clone» που πιάνει το CHECK 3.28 — και
 * χειρότερα, θα ήταν **δύο registries**: δύο στιγμιότυπα των ίδιων επτά
 * δυνατοτήτων, που θα μπορούσαν να αποκλίνουν σε ένα μελλοντικό `deps`. Ένα
 * `boq_get_item` που συμπεριφέρεται αλλιώς στον in-app πράκτορα και αλλιώς στο
 * Claude Desktop είναι ακριβώς η κατηγορία σφάλματος που το ADR-734 §5.2
 * υπάρχει για να αποκλείσει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ SINGLETON ΕΙΝΑΙ ΤΕΜΠΕΛΙΚΟ — ΜΗΝ ΤΟ ΛΥΣΕΙΣ ΣΕ MODULE SCOPE
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `getBoqAdminReadService()` χρειάζεται διαπιστευτήρια Firebase. Αν λυνόταν
 * κατά τη φόρτωση, μια απλή εισαγωγή του module σε περιβάλλον χωρίς
 * διαπιστευτήρια (build step, στατική ανάλυση) θα έριχνε. Η σύνδεση λύνεται
 * στην πρώτη **κλήση**.
 *
 * Το ίδιο το registry, αντίθετα, χτίζεται κατά τη φόρτωση **επίτηδες**: οι
 * έλεγχοι κατασκευής του §5.3/§5.4 (μορφή ονόματος, απαγόρευση παραμέτρου
 * `companyId`, συμφωνία υπόδειξης με πολιτική) πρέπει να ρίχνουν στο πρώτο
 * import — δηλαδή στο πρώτο test — και όχι στο πρώτο αίτημα χρήστη.
 *
 * @module services/agent-capability/capabilities/boq/boq-admin-registry
 * @see ADR-734 §5.2, §8.3.1, §8.4
 */

import 'server-only';

import type { BOQCategory, BOQItem, BOQSummary } from '@/types/boq';
import type { BOQSearchFilters, BOQStats } from '@/services/measurements/contracts';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import { getBoqAdminReadService } from '@/services/measurements/admin/boq-admin-read-service';
import type { CapabilityRegistry } from '../../registry';
import { createBoqCapabilityRegistry } from './index';

/**
 * Τεμπέλης προώθηση προς το admin service.
 *
 * Οι έξι μέθοδοι γράφονται ρητά και όχι με `Proxy`: ο τύπος `IBOQReadService`
 * επιβάλλει την πληρότητα σε χρόνο μεταγλώττισης, ενώ ένα `Proxy` θα την
 * ανέβαλλε σε χρόνο εκτέλεσης.
 */
const lazyAdminBoq: IBOQReadService = {
  getByBuilding: (companyId: string, buildingId: string): Promise<BOQItem[]> =>
    getBoqAdminReadService().getByBuilding(companyId, buildingId),
  getById: (companyId: string, id: string): Promise<BOQItem | null> =>
    getBoqAdminReadService().getById(companyId, id),
  search: (companyId: string, buildingId: string, filters?: BOQSearchFilters): Promise<BOQItem[]> =>
    getBoqAdminReadService().search(companyId, buildingId, filters),
  getStatistics: (companyId: string, buildingId: string): Promise<BOQStats> =>
    getBoqAdminReadService().getStatistics(companyId, buildingId),
  getCategories: (companyId: string): Promise<BOQCategory[]> =>
    getBoqAdminReadService().getCategories(companyId),
  getBuildingSummary: (companyId: string, buildingId: string): Promise<BOQSummary | null> =>
    getBoqAdminReadService().getBuildingSummary(companyId, buildingId),
};

/**
 * Το registry των επτά εργαλείων BOQ, με Admin SDK.
 *
 * Μοιράζεται από τον in-app πράκτορα (`BoqCapabilityHandler`) και από το MCP
 * transport (`/api/mcp`). Ένας ορισμός, δύο μεταφορές — ADR-734 §5.2.
 */
export const boqAdminCapabilityRegistry: CapabilityRegistry =
  createBoqCapabilityRegistry({ boq: lazyAdminBoq });
