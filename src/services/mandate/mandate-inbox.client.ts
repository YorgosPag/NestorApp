/**
 * @fileoverview **ΤΑ ΕΙΣΕΡΧΟΜΕΝΑ, ΟΠΩΣ ΤΑ ΒΛΕΠΕΙ Η ΟΘΟΝΗ** — μεταφορά, όχι κρίση.
 * @related ADR-827 §9.21 · services/mandate/mandate-inbox.service.ts
 * @module services/mandate/mandate-inbox.client
 *
 * 🔴 **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** Η ομαδοποίηση *(ενεργό · ληγμένο · κριμένο)* υπολογίζεται
 * **στον διακομιστή** και ταξιδεύει έτοιμη. Δεύτερος υπολογισμός στον πελάτη θα
 * σήμαινε **δύο ρολόγια** — και η οθόνη θα πρόσφερε «Αποδοχή» σε αίτημα που ο
 * διακομιστής θεωρεί ληγμένο, επειδή το ρολόι του υπολογιστή του μεσίτη πάει πίσω.
 *
 * ⛔ **ΚΑΙ ΟΧΙ `onSnapshot`.** Το `mandate_requests` έχει **`read: false`**
 * (`firestore.rules`) ⇒ ζωντανή συνδρομή είναι **δομικά αδύνατη**, όχι απλώς
 * ανεπιθύμητη. Η κατάσταση της οθόνης είναι **διακριτή ένωση** με πηγή `fetch` —
 * μοτίβο `mandate-catalog.client.ts`, ποτέ `useOwnedList`.
 *
 * ⚠️ **Ο `apiClient` πετά σε μη-2xx**, οπότε κάθε πράξη μεταφράζεται εδώ σε **ρητή
 * ένωση αποτελεσμάτων** — η οθόνη δεν πιάνει εξαιρέσεις.
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { MandateInbox } from '@/services/mandate/mandate-inbox.service';
import type { MandateDecisionRefusal } from '@/services/mandate/mandate-decision-vocabulary';
import type {
  MandateRequestDecision,
  MandateRequestForAgency,
} from '@/types/mandate-request';

const logger = createModuleLogger('mandate-inbox.client');

const INBOX_URL = '/api/mandate-requests/inbox';
const REQUEST_URL = '/api/mandate-requests';

/** Τι έγινε με την **ανάγνωση** των εισερχομένων. */
export type InboxLoad =
  | { readonly kind: 'ready'; readonly inbox: MandateInbox }
  | { readonly kind: 'failed' };

/** **Φέρε τα εισερχόμενα.** Η εμβέλεια είναι το γραφείο του συνδεδεμένου, πάντα. */
export async function fetchMandateInbox(): Promise<InboxLoad> {
  try {
    return { kind: 'ready', inbox: await apiClient.get<MandateInbox>(INBOX_URL) };
  } catch (cause) {
    logger.error('Τα εισερχόμενα αιτήματα δεν φορτώθηκαν', {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

/** Τι έγινε με το **άνοιγμα** ενός αιτήματος. */
export type OpenResult =
  | { readonly kind: 'opened'; readonly request: MandateRequestForAgency }
  | { readonly kind: 'failed' };

/**
 * **Άνοιξε ένα αίτημα** — και σφράγισε ότι το είδες.
 *
 * ⚠️ Η σφραγίδα μπαίνει **στον διακομιστή**, με τη λογική write-once. Η οθόνη δεν
 * στέλνει «σημείωσέ το ως αναγνωσμένο»: θα ήταν **δεύτερη** πράξη για ένα γεγονός
 * που είναι απλώς *«το άνοιξα»*.
 */
export async function openMandateRequest(requestId: string): Promise<OpenResult> {
  try {
    const body = await apiClient.get<{ request: MandateRequestForAgency }>(
      `${REQUEST_URL}/${encodeURIComponent(requestId)}`,
    );
    return { kind: 'opened', request: body.request };
  } catch (cause) {
    logger.error('Το αίτημα δεν άνοιξε', {
      data: { requestId },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}

/** Τι έγινε με την **απόφαση**. */
export type DecisionResult =
  | { readonly kind: 'decided'; readonly decision: MandateRequestDecision }
  | { readonly kind: 'refused'; readonly reason: MandateDecisionRefusal }
  | { readonly kind: 'failed' };

/**
 * Ο λόγος άρνησης όπως τον έστειλε ο διακομιστής, ή `null` όταν η αποτυχία ήταν
 * **δικτύου** — δύο πράγματα που η οθόνη πρέπει να πει διαφορετικά.
 *
 * ⚠️ **Το `as` είναι ειλικρινές**: το σώμα έρχεται από το δίκτυο και ο πελάτης **δεν**
 * ξαναεπικυρώνει το κλειστό σύνολο. Η οθόνη το χρησιμοποιεί **μόνο** ως κλειδί σε
 * πίνακα κειμένων, και άγνωστος κωδικός πέφτει στο γενικό μήνυμα — ποτέ σε ωμό κλειδί.
 */
function refusalOf(cause: unknown): MandateDecisionRefusal | null {
  const body = (cause as { data?: { error?: unknown; reason?: unknown } } | null)?.data;
  if (body?.error !== 'DECISION_REFUSED') return null;
  return typeof body.reason === 'string' ? (body.reason as MandateDecisionRefusal) : null;
}

/**
 * **Αποφάσισε** — αποδοχή, «στείλε ξανά», ή οριστικό όχι.
 *
 * ⚠️ Η οθόνη **δεν** «διορθώνει» τη γραμμή τοπικά μετά· ζητά **νέα** εισερχόμενα. Ένα
 * αισιόδοξο `status: 'accepted'` θα ήταν **τρίτος** ταξινομητής (μετά τον διακομιστή
 * και τον κοινό κριτή) — και θα απέκλινε την πρώτη φορά που κάποιος άλλαζε τον κανόνα
 * σε ένα από τα δύο άλλα σημεία.
 */
export async function decideMandateRequestFromScreen(
  requestId: string,
  decision: MandateRequestDecision,
): Promise<DecisionResult> {
  try {
    await apiClient.patch(`${REQUEST_URL}/${encodeURIComponent(requestId)}`, { decision });
    return { kind: 'decided', decision };
  } catch (cause) {
    const reason = refusalOf(cause);
    if (reason !== null) return { kind: 'refused', reason };

    logger.error('Η απόφαση δεν καταγράφηκε', {
      data: { requestId, decision },
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return { kind: 'failed' };
  }
}
