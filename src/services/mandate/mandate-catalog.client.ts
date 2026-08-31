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

import { apiClient, apiErrorBodyOf } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isMandateActionRejection,
  type MandateAction,
  type MandateActionRejection,
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
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΓΡΑΦΕ ΕΔΩ ΩΣ ΤΙΣ 2026-08-31, ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΑΟΡΑΤΟ (ADR-834 §6.5.ε)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * const body = (cause as { data?: { error?: unknown } } | null)?.data;   // ⛔
 * return typeof error === 'string' ? (error as MandateActionRejection) : null;
 * ```
 *
 * Δύο λάθη μαζί, και **το ένα έκρυβε το άλλο**:
 *
 * 1. **Ελλιπές** — η `ApiClientError` **δεν είχε ποτέ** πεδίο `data` *(το όνομα ήταν
 *    μισοθυμημένο Axios: εκεί λέγεται `error.response.data`)* ⇒ **πάντα `null`** ⇒ κάθε
 *    άρνηση γινόταν *«δεν υπήρξε απάντηση, ελέγξτε τη σύνδεσή σας»*. Μετρημένο ζωντανά:
 *    ο διακομιστής είπε `409 {"error":"no-address"}` και ο μεσίτης διάβασε «δικτυακό».
 * 2. **Υπερβολικά επιτρεπτικό** — το δομικό cast ταιριάζει σε **οποιοδήποτε** throwable
 *    με πεδίο `data` *(π.χ. σφάλμα Firebase)*, και το `as` δεχόταν **οποιαδήποτε**
 *    συμβολοσειρά ως λόγο. Όσο το (1) δεν πυροδοτούσε ποτέ, το (2) ήταν αθέατο.
 *
 * ✅ Τώρα: ο **ΕΝΑΣ** κριτής ({@link apiErrorBodyOf} — ρωτά `isApiClientError`, το SSoT
 * με 20+ σημεία κλήσης) **και** ο φρουρός του κλειστού συνόλου.
 *
 * 🔑 **Η επιλογή πεδίου μένει ΕΔΩ, τοπικά.** Αυτή η πόρτα βάζει τον λόγο **μέσα** στο
 * `error`· η αδελφή της *(εισερχόμενα)* τον βάζει σε ξεχωριστό `reason` πίσω από τον
 * διακριτή `DECISION_REFUSED`, επειδή εκεί ο **κωδικός κατάστασης δεν επιτρέπεται να
 * αποκαλύψει ύπαρξη** (ADR-787 Ε-5). Η διαφορά είναι **απόφαση ασφαλείας** — ένας
 * γενικός `rejectionFrom(cause, field, guard)` θα την έκρυβε ακριβώς από τον αναγνώστη
 * που πρέπει να τη δει.
 */
function rejectionOf(cause: unknown): MandateActionRejection | null {
  const body = apiErrorBodyOf(cause);
  if (body === null) return null;

  return isMandateActionRejection(body.error) ? body.error : null;
}

/**
 * **Η ΕΠΙΤΥΧΙΑ, ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΗΝ ΕΝΩΣΗ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ** — ADR-834 §6.5.ε.
 *
 * 🔴 Το `MandateActionOutcome` περιέχει και `ok: false`, αλλά ο διακομιστής στέλνει
 * **200 ΜΟΝΟ** για `ok: true` *(κάθε άρνηση φεύγει 404/409/502 — `respondToAction`)*.
 * Άρα ο τύπος στο `done` **υποσχόταν κατάσταση που δεν φτάνει ποτέ**, και η οθόνη
 * κουβαλούσε γι' αυτήν **δεύτερο** κλάδο προς τα `REJECTION_KEYS` — δομικά ανέφικτο.
 */
export type MandateActionSuccess = Extract<MandateActionOutcome, { ok: true }>;

/** Τι έγινε με την **πράξη**. */
export type ActionResult =
  | { readonly kind: 'done'; readonly outcome: MandateActionSuccess }
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

    // 🔴 **ΤΟ ΣΥΝΟΡΟ ΕΠΙΚΥΡΩΝΕΙ — parse, don't validate** (ADR-834 §6.5.ε).
    //    Σήμερα ο διακομιστής **δεν** στέλνει 200 με `ok: false`. Ένα σκέτο στένεμα
    //    τύπου θα το εμπιστευόταν σιωπηλά, και αν κάποτε άλλαζε, η **άρνηση θα
    //    παρουσιαζόταν ως επιτυχία** — χειρότερο από το ελάττωμα που κλείνουμε. Εδώ η
    //    αδύνατη κατάσταση **ανιχνεύεται και ονομάζεται**: ο τύπος παύει να ψεύδεται
    //    χωρίς να αγοράζουμε τυφλότητα.
    if (!outcome.ok) {
      return isMandateActionRejection(outcome.reason)
        ? { kind: 'rejected', reason: outcome.reason }
        : { kind: 'failed', message: 'unexpected-success-envelope' };
    }

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
