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

import { ApiClientError } from './api-client-types';

/** Εκθετικό backoff: βάση, οροφή, και το εύρος του τυχαίου «τρέμουλου». */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 10_000;
/** ±10% γύρω από την τιμή — διασκορπίζει τα ταυτόχρονα retry (thundering herd). */
const BACKOFF_JITTER_RATIO = 0.2;

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
  if (ApiClientError.isApiClientError(error)) return error.statusCode >= 500 && error.statusCode < 600;
  return false;
}

/** Εκθετικό backoff με τρέμουλο, φραγμένο στην οροφή. */
export function calculateBackoff(attempt: number): number {
  const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt - 1), BACKOFF_MAX_MS);
  const jitter = delay * BACKOFF_JITTER_RATIO * (Math.random() - 0.5);
  return Math.round(delay + jitter);
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
