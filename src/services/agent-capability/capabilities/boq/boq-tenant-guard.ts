/**
 * Tenant guard για πρόσβαση σε μεμονωμένο BOQ item — ΜΙΑ πόρτα
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (ADR-734 §7, διόρθωση 1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `IBOQService.getById(id)` **δεν παίρνει `companyId`** — μοναδική εξαίρεση
 * σε ένα interface που παντού αλλού απαιτεί tenant. Στο UI δεν πείραζε: το id
 * ερχόταν από λίστα που είχε ήδη φιλτραριστεί κατά `companyId`. Με πράκτορα
 * αλλάζει η απειλή: **ο πράκτορας είναι αναξιόπιστη πηγή id** — μπορεί να το
 * μαντέψει, να το δει σε παλιό μήνυμα ή να το λάβει από τον χρήστη.
 *
 * Λύση (επιλογή Α του handoff): ο έλεγχος ιδιοκτησίας γίνεται **μετά** το fetch,
 * εδώ, στο ντετερμινιστικό στρώμα (ADR-734 §5.4) — χωρίς να αγγιχτεί το
 * δοκιμασμένο `boqService`, το οποίο το ADR §9 παγώνει στις Φάσεις 1-3.
 *
 * Η προσθήκη `companyId` στην υπογραφή του `getById` (επιλογή Β) παραμένει το
 * σωστό τελικό σχήμα και είναι καταγεγραμμένη ως χρέος ασφαλείας στο
 * `.claude-rules/pending-ratchet-work.md`.
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
  const item = await boq.getById(itemId);

  if (item === null) {
    return { ok: false, error: notFoundError(RESOURCE, itemId) };
  }

  if (item.companyId !== companyId) {
    logger.warn('Cross-tenant BOQ item access blocked', {
      itemId,
      requestId,
      callerCompanyId: companyId,
    });
    return { ok: false, error: notFoundError(RESOURCE, itemId) };
  }

  return { ok: true, item };
}
