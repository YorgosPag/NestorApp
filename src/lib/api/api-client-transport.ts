/**
 * @module api-client-transport
 * @description Οι **μηχανικές** του καλωδίου, χωρίς κράτος — ADR-826 §4.3.
 *
 * 🔑 **Γιατί ζουν χωριστά**: ο `EnterpriseApiClient` απαντά *«ποιος ρωτά και τι σημαίνει η
 * απάντηση»* — κρατά ταυτότητα, cache διακριτικού, ετοιμότητα. Οι τέσσερις συναρτήσεις εδώ
 * δεν ξέρουν **τίποτα** από αυτά: μετρήθηκε ότι **καμία** δεν άγγιζε το `this`. Ήταν ιδιωτικές
 * μέθοδοι μόνο επειδή γεννήθηκαν εκεί — όχι επειδή χρειάζονταν το αντικείμενο.
 *
 * ⚠️ Η μετακίνηση έγινε **επειδή το επέβαλε το όριο των 500 γραμμών (N.7.1)** όταν ο πελάτης
 * απέκτησε το φράγμα ετοιμότητας ταυτότητας. **Εξαγωγή, όχι ψαλίδισμα**: το όριο ζητά να
 * φύγει **ευθύνη**, όχι να κοπούν σχόλια — ένα αρχείο 499 γραμμών με δύο δουλειές παραβιάζει
 * τον ίδιο κανόνα που το όριο υπηρετεί.
 *
 * 🔑 **Και έγιναν ΔΟΚΙΜΑΣΙΜΕΣ**: ως ιδιωτικές μέθοδοι singleton, το «ο εκθετικός backoff
 * κορυφώνεται στα 10s» ήταν ελέγξιμο μόνο **έμμεσα**, μέσα από ολόκληρο αίτημα.
 */

import { retryAfterMs } from '@/lib/http/retry-after';
import { generateIdempotencyKey } from '@/services/enterprise-id.service';

import { ApiClientError, isBinaryRequestBody, type HttpMethod } from './api-client-types';
import { IDEMPOTENCY_KEY_HEADER, IDEMPOTENCY_RETRYABLE_CODES } from './idempotency/idempotency-contract';

/** Εκθετικό backoff: βάση, οροφή, και το εύρος του τυχαίου «τρέμουλου». */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 10_000;
/** ±10% γύρω από την τιμή — διασκορπίζει τα ταυτόχρονα retry (thundering herd). */
const BACKOFF_JITTER_RATIO = 0.2;

/**
 * **Οι μέθοδοι που ο πελάτης ξαναστέλνει ΜΟΝΟΣ του, ΧΩΡΙΣ κλειδί** — ADR-853 Ε3.
 *
 * 🔴 Σφάλμα δικτύου ή `5xx` **ΔΕΝ** σημαίνει «δεν εκτελέστηκε»: ο handler μπορεί να έγραψε και να χάθηκε
 * μόνο η απάντηση (504 · κομμένη σύνδεση). Η επανάληψη ενός `POST` **χωρίς** κλειδί είναι **δεύτερη πράξη**
 * (μετρημένο 21/09: 3×503 ⇒ τρεις αποστολές της ίδιας πράξης πρόσκλησης).
 * ⚠️ `PUT`/`DELETE` είναι ιδεμποτικά **κατά το RFC 9110**, όχι κατά τους δικούς μας handlers (ίχνος ελέγχου ανά
 * κλήση · `404` στη 2η διαγραφή) ⇒ ξαναστέλνονται **μόνο** με κλειδί, όπως το `POST`.
 */
const REPLAYABLE_METHODS: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET']);

/**
 * **Παίρνει αυτό το αίτημα `Idempotency-Key`;** — ADR-853 Ε3 Φάση 2 (Stripe: «All POST requests accept
 * idempotency keys»). Κάθε πράξη εκτός `GET`, με σώμα JSON ή χωρίς σώμα. ⚠️ **Όχι** δυαδικό σώμα
 * (`FormData`/`Blob`): το σύνορο δεν ορίζει αποτύπωμα πάνω σε ροή, άρα δεν το αναγνωρίζει ως «την ίδια» πράξη.
 */
export function isKeyedRequest(method: HttpMethod, body: unknown): boolean {
  return !REPLAYABLE_METHODS.has(method) && !isBinaryRequestBody(body);
}

/**
 * Οι κεφαλίδες του καλούντος **συν** το `Idempotency-Key`, όταν η πράξη το παίρνει (ADR-853 Ε3 Φάση 2).
 *
 * 🔑 Καλείται **ΜΙΑ φορά ανά κλήση, ΠΡΙΝ τον βρόχο** επανάληψης: κάθε επανάληψη στέλνει το **ίδιο** κλειδί,
 * άρα ο διακομιστής τη βλέπει ως **την ίδια** πράξη και αναπαράγει την απάντηση αντί να εκτελέσει ξανά.
 * Κλειδί που έδωσε ήδη ο καλών (σε οποιαδήποτε γραφή κεφαλαίων) **μένει** — χωρίς δεύτερο αντίγραφο.
 *
 * ⚠️ Ο **ένας** κριτής του «ξαναστέλνεται;» είναι ο `shouldRetry`· ο βρόχος κρατά μόνο το ταβάνι. Όταν η
 * απόφαση ζούσε και στο όριο του βρόχου, κάθε μισό έκρυβε το άλλο (μετάλλαξη Φάσης 1: 2 επιζώντες).
 */
export function keyedHeaders(method: HttpMethod, body: unknown, headers: Record<string, string>): Record<string, string> {
  if (!isKeyedRequest(method, body)) return headers;
  const given = Object.keys(headers).find((name) => name.toLowerCase() === IDEMPOTENCY_KEY_HEADER.toLowerCase());
  const key = given === undefined ? generateIdempotencyKey() : headers[given];
  const rest = Object.fromEntries(Object.entries(headers).filter(([name]) => name !== given));
  return { ...rest, [IDEMPOTENCY_KEY_HEADER]: key };
}

/**
 * **Επιτρέπεται να ξανασταλεί αυτό το αίτημα χωρίς να ρωτηθεί ο άνθρωπος;**
 *
 * Ασφαλής μέθοδος — ή πράξη που **έφυγε με κλειδί**: το σύνορο του διακομιστή εκτελεί μία φορά και στις
 * επαναλήψεις αναπαράγει την απάντηση (ADR-853 Ε3 Φάση 2). Ό,τι άλλο αστοχεί **μία** φορά.
 */
export function isReplayableRequest(method: HttpMethod, keyed: boolean): boolean {
  return keyed || REPLAYABLE_METHODS.has(method);
}

/**
 * **Ξαναδοκιμάζουμε ΜΟΝΟ ό,τι μπορεί να πετύχει την επόμενη φορά.**
 *
 * Δικτυακή αστοχία και `5xx` είναι **παροδικά**. Ένα `4xx` είναι **κρίση** του διακομιστή:
 * η επανάληψη θα πάρει την ίδια απάντηση και θα καθυστερήσει τον άνθρωπο χωρίς λόγο.
 */
export function shouldRetry(
  error: unknown,
  attempt: number,
  maxRetries: number,
  retryEnabled: boolean,
): boolean {
  if (!retryEnabled || attempt >= maxRetries) return false;
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  if (!ApiClientError.isApiClientError(error)) return false;
  // 🔑 ADR-853 Ε3 — «η ίδια πράξη τρέχει ακόμη» (IETF 409): ξανά με το ΙΔΙΟ κλειδί, όχι κρίση του διακομιστή.
  if (error.statusCode === 409) return IDEMPOTENCY_RETRYABLE_CODES.has(error.errorCode ?? '');
  return error.statusCode >= 500 && error.statusCode < 600;
}

/** Εκθετικό backoff με τρέμουλο, φραγμένο στην οροφή. */
export function calculateBackoff(attempt: number): number {
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt - 1), BACKOFF_MAX_MS);
  const jitter = delay * BACKOFF_JITTER_RATIO * (Math.random() - 0.5);
  return Math.round(delay + jitter);
}

/**
 * Πόσο περιμένουμε πριν την επόμενη προσπάθεια. 🔑 **Ο διακομιστής προηγείται**: αν είπε `Retry-After`
 * (π.χ. `409 IDEMPOTENCY_IN_FLIGHT`), ξέρει πότε τελειώνει η πρώτη εκτέλεση· αλλιώς το εκθετικό backoff.
 */
export function retryDelay(error: unknown, attempt: number): number {
  const asked = ApiClientError.isApiClientError(error) ? retryAfterMs(error.response, BACKOFF_MAX_MS) : null;
  return asked ?? calculateBackoff(attempt);
}

/** Προσαρτά παραμέτρους ερωτήματος, σεβόμενο τυχόν υπάρχον `?`. */
export function buildUrl(url: string, params?: Record<string, string | number | boolean>): string {
  if (!params) return url;
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => searchParams.set(key, String(value)));
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${searchParams.toString()}`;
}

/**
 * `fetch` με προθεσμία.
 *
 * ⚠️ Η ακύρωση καθαρίζεται **και στα δύο** μονοπάτια: χρονόμετρο που επιβιώνει της απάντησης
 * κρατά ζωντανό handle και, σε Node, **καθυστερεί τον τερματισμό της διεργασίας**.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      throw new ApiClientError(`Request timeout after ${timeout}ms`, 408, 'REQUEST_TIMEOUT');
    }
    throw error;
  }
}
