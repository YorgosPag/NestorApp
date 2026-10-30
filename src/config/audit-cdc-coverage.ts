/**
 * CDC audit coverage — SSoT (ADR-195 Phase 3).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ
 * Το audit trail γράφεται από **δύο** συγγραφείς:
 *   1. service layer — `EntityAuditService.recordChange()` (`source: 'service'`)
 *   2. CDC — το Cloud Function `auditContactWrite` (`source: 'cdc'`)
 *
 * Ο CDC καλύπτει **μόνο** το `contacts/{docId}` (είναι ο μοναδικός Firestore
 * trigger που γράφει στο `entity_audit_trail` — επαληθευμένο στο `functions/src`).
 * Οι engines `soft-delete-engine` / `deletion-guard` όμως είναι **κοινοί για όλες**
 * τις soft-deletable οντότητες, οπότε για τις επαφές — και μόνο γι' αυτές — η
 * κλήση τους παρήγαγε **διπλότυπη** εγγραφή για το ίδιο ακριβώς γεγονός.
 *
 * Η ADR-195 (changelog 2026-04-21, «Phase 2 CDC Cutover») είχε ήδη διατυπώσει την αρχή:
 *   «The root cause was the service-layer call itself — dedup was a temporary bridge,
 *    not a permanent fix. Removing the source eliminates the duplicate at origin.»
 * Είχε όμως εφαρμοστεί μόνο σε `createContact` / `updateContactFromForm`.
 * Αυτό το μητρώο επεκτείνει την ίδια αρχή στα soft_deleted / restored.
 *
 * ⚠️ ΠΡΟΣΘΕΤΕΙΣ ΤΥΠΟ ΕΔΩ ΜΟΝΟ όταν υπάρχει **πραγματικά** Firestore trigger που
 * γράφει audit για τη συλλογή του. Λάθος καταχώριση = **σιωπηλή απώλεια ιστορικού**
 * (σιγάζεται ο service writer χωρίς να υπάρχει CDC να τον αντικαταστήσει).
 *
 * @see functions/src/audit/contact-audit-trigger.ts — ο μοναδικός CDC writer σήμερα
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { auditEntitySpec } from '@/config/audit-entity-registry';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuditAction } from '@/types/audit-trail';

/**
 * Entity types των οποίων οι μεταβολές καταγράφονται ήδη από Firestore trigger.
 * Σήμερα: μόνο οι επαφές.
 */
export const CDC_COVERED_ENTITY_TYPES: ReadonlySet<string> = new Set<string>(['contact']);

/**
 * Οι **συλλογές** όπου ακούει ο CDC — ΠΑΡΑΓΩΓΟ των τύπων παραπάνω μέσω του μητρώου οντοτήτων, ποτέ δεύτερη λίστα.
 *
 * Ο CDC διαβάζει τον δράστη από το ίδιο το έγγραφο (`_lastModifiedBy` / `_lastModifiedByName`), άρα κάθε
 * μαζικός γραφέας που αγγίζει αυτές τις συλλογές **οφείλει** σφραγίδα φορέα — αλλιώς η γραμμή Ιστορικού
 * γράφεται `cdc_unknown` (ADR-195 · ADR-704, 2026-10-30: `flushInBatches` / `openDeclaredBatch`).
 *
 * Τύπος CDC χωρίς δική του συλλογή ⇒ σφάλμα κατά τη φόρτωση: σιωπηλή παράλειψη θα έκρυβε ακριβώς τη συλλογή
 * που χρειάζεται σφραγίδα.
 */
export const CDC_WATCHED_COLLECTIONS: ReadonlySet<string> = new Set<string>(
  [...CDC_COVERED_ENTITY_TYPES].map((type) => {
    const key = auditEntitySpec(type)?.collectionKey;
    if (!key) throw new Error(`CDC entity type "${type}" has no collection in the audit entity registry`);
    return COLLECTIONS[key];
  }),
);

/**
 * Ενέργειες για τις οποίες ο CDC παράγει **ισοδύναμη** εγγραφή με το service layer.
 *
 * 🚫 Το `deleted` (οριστική διαγραφή) **ΔΕΝ** ανήκει εδώ, και δεν πρέπει να μπει.
 * Η service-side εγγραφή του `deletion-guard` μεταφέρει `_snapshot` (πλήρες JSON
 * της εγγραφής πριν χαθεί), `_cascade_deletions` και `_storage_cleanup` — δεδομένα
 * που ο CDC **αδυνατεί** να παραγάγει, γιατί βλέπει μόνο το document, όχι τις
 * παράπλευρες διαγραφές. Εκεί οι δύο εγγραφές είναι **συμπληρωματικές** (forensic
 * trail), όχι διπλότυπες.
 */
export const CDC_EQUIVALENT_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'soft_deleted',
  'restored',
]);

/**
 * Πρέπει ο service writer να **σιγήσει** για αυτό το ζεύγος (τύπος, ενέργεια);
 *
 * `true` σημαίνει: ο CDC θα γράψει ήδη ισοδύναμη εγγραφή — μια δεύτερη από το
 * service layer θα ήταν καθαρό διπλότυπο.
 */
export function isCdcAuditDuplicate(entityType: string, action: AuditAction): boolean {
  return CDC_COVERED_ENTITY_TYPES.has(entityType) && CDC_EQUIVALENT_ACTIONS.has(action);
}
