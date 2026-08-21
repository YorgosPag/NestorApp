/**
 * @fileoverview **Ο ΚΑΤΑΛΟΓΟΣ, ΟΠΩΣ ΤΟΝ ΒΛΕΠΕΙ Η ΟΘΟΝΗ** — μεταφορά, όχι κρίση.
 * @related ADR-777 §8.34 · services/mandate/mandate-catalog.service.ts · lib/api/enterprise-api-client.ts
 * @module services/mandate/mandate-catalog.client
 *
 * 🔑 **Καμία κρίση εδώ.** Η κατάσταση κάθε εντολής υπολογίζεται **στον διακομιστή**
 * ({@link mandateStandingOf}) και ταξιδεύει έτοιμη. Ένας δεύτερος υπολογισμός στον
 * πελάτη θα σήμαινε **δύο ρολόγια** — και η οθόνη θα μπορούσε να λέει «λήγει σε 0
 * μέρες» για γραμμή που ο διακομιστής έκρινε ζωντανή, επειδή το ρολόι του υπολογιστή
 * του μεσίτη πάει μπροστά.
 *
 * ⚠️ **Ο `apiClient` πετά σε μη-2xx**, οπότε κάθε πράξη μεταφράζεται εδώ σε **ρητή
 * ένωση αποτελεσμάτων** — η οθόνη δεν πιάνει εξαιρέσεις.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type {
  MandateAction,
  MandateActionRejection,
} from '@/lib/mandate/mandate-actions';
import type { MandateActionOutcome } from '@/services/mandate/mandate-actions.service';
import type { MandateCatalog } from '@/services/mandate/mandate-catalog.service';

const logger = createModuleLogger('mandate-catalog.client');

const CATALOG_URL = '/api/owner-properties/brokered';

/** Τι έγινε με την **ανάγνωση**, όπως το βλέπει η οθόνη. */
export type CatalogLoad =
  | { readonly kind: 'ready'; readonly catalog: MandateCatalog }
  | { readonly kind: 'failed'; readonly message: string };

/** **Φέρε τον κατάλογο.** Η εμβέλεια είναι το γραφείο του συνδεδεμένου, πάντα. */
export async function fetchMandateCatalog(): Promise<CatalogLoad> {
  try {
    return { kind: 'ready', catalog: await apiClient.get<MandateCatalog>(CATALOG_URL) };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error('Ο κατάλογος εντολών δεν φορτώθηκε', { error: message });
    return { kind: 'failed', message };
  }
}

/**
 * Ο λόγος απόρριψης όπως τον έστειλε ο διακομιστής, ή `null` όταν η αποτυχία ήταν
 * **δικτύου** — δύο πράγματα που η οθόνη πρέπει να πει διαφορετικά.
 */
function rejectionOf(cause: unknown): MandateActionRejection | null {
  const body = (cause as { data?: { error?: unknown } } | null)?.data;
  const error = body?.error;
  return typeof error === 'string' ? (error as MandateActionRejection) : null;
}

/** Τι έγινε με την **πράξη**. */
export type ActionResult =
  | { readonly kind: 'done'; readonly outcome: MandateActionOutcome }
  | { readonly kind: 'rejected'; readonly reason: MandateActionRejection }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * **Εκτέλεσε πράξη** πάνω σε μία εντολή.
 *
 * ⚠️ Η οθόνη **δεν** ξαναϋπολογίζει την κατάσταση μετά· ζητά **νέο κατάλογο**. Ένας
 * τοπικός υπολογισμός «τώρα είναι awaiting-view» θα ήταν τρίτος ταξινομητής, και θα
 * απέκλινε την πρώτη φορά που κάποιος άλλαζε τον κανόνα στον διακομιστή.
 */
export async function runMandateAction(
  ownerPropertyId: string,
  action: MandateAction,
): Promise<ActionResult> {
  try {
    const outcome = await apiClient.post<MandateActionOutcome>(
      `${CATALOG_URL}/${encodeURIComponent(ownerPropertyId)}`,
      { action },
    );
    return { kind: 'done', outcome };
  } catch (cause) {
    const reason = rejectionOf(cause);
    if (reason !== null) return { kind: 'rejected', reason };

    const message = cause instanceof Error ? cause.message : String(cause);
    logger.error('Η πράξη στην εντολή απέτυχε', {
      data: { ownerPropertyId, action },
      error: message,
    });
    return { kind: 'failed', message };
  }
}
