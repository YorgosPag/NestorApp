/**
 * Tenant guard για πρόσβαση σε μεμονωμένο BOQ item — ΜΙΑ πόρτα
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΙ ΑΛΛΑΞΕ ΣΤΙΣ 2026-07-31 (ADR-734 §7 → επιλογή Β)
 * ─────────────────────────────────────────────────────────────────────────────
 * Μέχρι τότε το `IBOQService.getById(id)` **δεν έπαιρνε `companyId`** και ο
 * έλεγχος ιδιοκτησίας ζούσε **εδώ**, μετά το fetch (επιλογή Α). Αυτό κάλυπτε
 * **μόνο** τη διαδρομή του πράκτορα: κάθε άλλος καλών του service έμενε
 * ακάλυπτος, και η μόνη άμυνα για το `agent-capability/` ήταν ένα regex στο
 * `.ssot-registry.json` — δηλαδή μια σύμβαση, όχι το σύστημα τύπων.
 *
 * Πλέον ο tenant είναι μέρος της **υπογραφής** (`getById(companyId, id)`) και ο
 * έλεγχος γίνεται μέσα στα δύο μονοπάτια δεδομένων
 * (`boq-tenant-ownership.ts`). Αυτό το αρχείο **δεν είναι πια η άμυνα**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΣΥΝΕΧΙΖΕΙ ΝΑ ΥΠΑΡΧΕΙ — ΔΥΟ ΛΟΓΟΙ, ΚΑΝΕΝΑΣ ΔΙΑΚΟΣΜΗΤΙΚΟΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Μεταφράζει** `null` → `NOT_FOUND` του registry. Οι δυνατότητες μιλούν τη
 *    γλώσσα των `CapabilityError`, όχι των `null`.
 * 2. **Επιβάλλει το συμβόλαιο στις υλοποιήσεις.** Ο μεταγλωττιστής εγγυάται ότι
 *    το `companyId` **περνιέται**· δεν μπορεί να εγγυηθεί ότι κάθε υλοποίηση του
 *    `IBOQReadService` το **τιμά**. Ο έλεγχος παρακάτω είναι η δεύτερη ζώνη
 *    (N.7.2 #4) που πιάνει ακριβώς αυτό — π.χ. νέο adapter ή ψεύτη που το
 *    αγνοεί. Αν ποτέ γίνει νεκρός κλάδος, αυτό είναι **απόδειξη ορθότητας**, όχι
 *    λόγος αφαίρεσης.
 *
 * ⚠️ **Καμία άλλη διαδρομή προς το `getById` δεν επιτρέπεται μέσα στο
 * `agent-capability/`.** Το `.ssot-registry.json` (module `boq-capability-tenant-guard`)
 * μπλοκάρει την απευθείας κλήση εκτός αυτού του αρχείου.
 *
 * @module services/agent-capability/capabilities/boq/boq-tenant-guard
 * @see ADR-734 §5.4, §7
 */

import type { BOQItem } from '@/types/boq';
import type { IBOQReadService } from '@/services/measurements/boq-read-contract';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { type CapabilityError, notFoundError } from '../../registry';

const logger = createModuleLogger('BoqTenantGuard');

/** Το ανθρώπινο όνομα του πόρου στα μηνύματα σφάλματος. */
const RESOURCE = 'BOQ item';

export type OwnedItemResult =
  | { readonly ok: true; readonly item: BOQItem }
  | { readonly ok: false; readonly error: CapabilityError };

/**
 * Φέρνει BOQ item **και** επιβεβαιώνει ότι ανήκει στον καλούντα tenant.
 *
 * ⚠️ Και οι δύο αστοχίες — «δεν υπάρχει» και «ανήκει σε άλλον» — επιστρέφουν
 * **το ίδιο** `NOT_FOUND`. Ένα ξεχωριστό `PERMISSION_DENIED` θα επιβεβαίωνε ότι
 * το id υπάρχει, δηλαδή θα λειτουργούσε ως μαντείο ύπαρξης για πράκτορα που
 * δοκιμάζει ids. Η απόπειρα **καταγράφεται** — είναι σήμα ασφαλείας, όχι θόρυβος.
 */
export async function fetchOwnedBoqItem(
  boq: IBOQReadService,
  itemId: string,
  companyId: string,
  requestId: string,
): Promise<OwnedItemResult> {
  const item = await boq.getById(companyId, itemId);

  if (item === null) {
    return { ok: false, error: notFoundError(RESOURCE, itemId) };
  }

  // Δεύτερη ζώνη: το συμβόλαιο λέει ότι εδώ φτάνει μόνο δική μας γραμμή. Αν μια
  // υλοποίηση αγνοήσει το `companyId`, ο πράκτορας ΔΕΝ θα δει ξένα δεδομένα —
  // θα δει `NOT_FOUND` και θα μείνει ίχνος με το `requestId`.
  // 🔴 ADR-742 §4 — η δεύτερη ζώνη ρωτά με τον SSoT, όχι με σκέτο `!==`: γραμμή
  // **χωρίς** `companyId` και πράκτορας με κενό `companyId` ταίριαζαν.
  if (!isPayloadOwnedByCompany(item, companyId)) {
    logger.error('Contract violation: getById returned a cross-tenant BOQ item', {
      itemId,
      requestId,
      callerCompanyId: companyId,
    });
    return { ok: false, error: notFoundError(RESOURCE, itemId) };
  }

  return { ok: true, item };
}
