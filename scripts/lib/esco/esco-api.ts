/**
 * ADR-132 — **Ο ΣΥΡΜΑΤΙΝΟΣ ΤΥΠΟΣ ΤΟΥ ESCO**, και η **ταξινόμηση των σφαλμάτων** του.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΟ `offset` ΤΟΥ ESCO ΕΙΝΑΙ **ΑΡΙΘΜΟΣ ΣΕΛΙΔΑΣ**, ΟΧΙ ΔΕΙΚΤΗΣ ΣΤΟΙΧΕΙΟΥ
 *
 * Επαληθεύτηκε στο **επίσημο OpenAPI v3** *(2026-08-26)*, όχι υποτέθηκε:
 *
 * > *«The offset of the returned resources. Supports paging where the 'offset'*
 * > *specifies the page number (zero-based numbering)»*
 *
 * Είναι **ασυνήθιστο** — οι περισσότερες REST ταξινομίες μετρούν σε στοιχεία —
 * και γι' αυτό γράφεται εδώ με παραπομπή: αν κάποιος «το διορθώσει» σε
 * `offset = page * limit`, θα πάρει τη **σελίδα 500** και ο εισαγωγέας θα
 * κατέβαζε ελάχιστα από όσα υπάρχουν. Το `harvestEscoConcepts` **θα το έπιανε**
 * *(κλειστή λογιστική μοναδικών URI)*, αλλά η παραπομπή είναι φθηνότερη.
 *
 * ⚠️ Ακόμη κι έτσι, **μην εμπιστευτείς αυτό το σχόλιο ως φρουρό**: ο φρουρός
 * είναι η σύγκριση `uniqueCount ↔ declaredTotal` του `esco-harvest.ts`.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ ΔΥΟ ΟΝΟΜΑΤΑ ΣΦΑΛΜΑΤΟΣ, ΚΑΙ ΟΧΙ ΕΝΑ
 *
 * Το `withRetry` *(SSoT: `src/services/entity-linking/utils/retry.ts`)* αποφασίζει
 * αν θα ξαναπροσπαθήσει **αντιστοιχίζοντας το μήνυμα** με το `retryableErrors`.
 * Ένα `404` ή ένα `400` **δεν γίνεται καλύτερο με αναμονή** — η επανάληψή του
 * είναι σπατάλη 5 προσπαθειών επί εκθετική υποχώρηση. Άρα η ταξινόμηση γίνεται
 * **στην πηγή**, με δύο ρητά προθέματα, και ο μηχανισμός επανάληψης μένει ο
 * κοινός. ⛔ **ΜΗΝ** γράψεις δικό σου backoff εδώ.
 *
 * @module scripts/lib/esco/esco-api
 * @see https://ec.europa.eu/esco/api/doc/esco-api-openapi-v3.yml
 */

import type { RetryConfig } from '../../../src/services/entity-linking/utils/retry';

/** Η ρίζα του δημόσιου ESCO web-service. Χωρίς κλειδί, χωρίς αυθεντικοποίηση. */
export const ESCO_API_BASE = 'https://ec.europa.eu/esco/api';

/** Το ανώτατο `limit` που δέχεται το `/search`. */
export const ESCO_MAX_PAGE_SIZE = 500;

/** Πρόθεμα μηνύματος για σφάλμα που **αξίζει** επανάληψη *(δίκτυο · 5xx · 429)*. */
export const ESCO_TRANSIENT = 'ESCO_TRANSIENT';

/** Πρόθεμα μηνύματος για σφάλμα που **δεν** βελτιώνεται με αναμονή *(4xx πλην 429)*. */
export const ESCO_PERMANENT = 'ESCO_PERMANENT';

/**
 * Ρύθμιση επανάληψης για το ESCO, πάνω στο **υπάρχον** `withRetry`.
 *
 * `retryableErrors: [ESCO_TRANSIENT]` σημαίνει: **μόνο** ό,τι ταξινομήθηκε ρητά
 * ως παροδικό ξαναδοκιμάζεται. Η προεπιλογή του SSoT *(«αν δεν οριστεί, όλα»)*
 * θα ξαναδοκίμαζε και τα `404`.
 */
export const ESCO_RETRY_CONFIG: Partial<RetryConfig> = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  useJitter: true,
  retryableErrors: [ESCO_TRANSIENT],
};

/** Ένα αποτέλεσμα του `/search`, όπως έρχεται στο σύρμα. */
export interface EscoSearchResult {
  readonly uri: string;
  readonly title?: string;
  readonly className?: string;
  readonly classId?: string;
  /** Ο κωδικός ESCO, π.χ. `"2142.1.9"`. **Λείπει** σε μέρος των εννοιών. */
  readonly code?: string;
  /** Ετικέτα ανά γλώσσα *(28 γλώσσες της ΕΕ)*. */
  readonly preferredLabel?: Record<string, string>;
  readonly broaderIscoGroup?: readonly string[];
  readonly broaderOccupation?: readonly string[];
  readonly isTopConceptInScheme?: readonly string[];
}

/** Η απόκριση του `/search`. Το `total` είναι η **δήλωση πληρότητας** της πηγής. */
export interface EscoSearchResponse {
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly _embedded?: { readonly results?: readonly EscoSearchResult[] };
}

/** Το είδος εννοιών που σαρώνεται. Καθορίζει `type=` και το concept-scheme. */
export type EscoConceptType = 'occupation' | 'skill';

/**
 * Η διεύθυνση **μίας** σελίδας περιήγησης concept-scheme.
 *
 * ⚠️ `offset` = **αριθμός σελίδας** (βλ. επικεφαλίδα). Το `language=en` επιλέγει
 * τη γλώσσα **αναζήτησης**, όχι των ετικετών: το `preferredLabel` γυρίζει
 * πάντα σε **όλες** τις γλώσσες, γι' αυτό αρκεί **ένα** πέρασμα για EL + EN.
 */
export function buildEscoPageUrl(
  conceptType: EscoConceptType,
  scheme: string,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams({
    type: conceptType,
    language: 'en',
    offset: String(page),
    limit: String(pageSize),
    isInScheme: scheme,
  });
  return `${ESCO_API_BASE}/search?${params.toString()}`;
}

/**
 * Κατεβάζει **μία** σελίδα και **ταξινομεί** την αποτυχία της.
 *
 * ⚠️ Δεν κάνει καμία επανάληψη — αυτό είναι δουλειά του `withRetry`. Εδώ
 * αποφασίζεται **μόνο** αν η αποτυχία είναι παροδική.
 */
export async function fetchEscoPage(url: string): Promise<EscoSearchResponse> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    // Αποτυχία μεταφοράς (DNS · TCP · TLS · timeout): πάντα παροδική.
    throw new Error(`${ESCO_TRANSIENT} network: ${String(cause)}`);
  }

  if (!response.ok) {
    const permanent = response.status >= 400 && response.status < 500 && response.status !== 429;
    const kind = permanent ? ESCO_PERMANENT : ESCO_TRANSIENT;
    throw new Error(`${kind} HTTP ${response.status} ${response.statusText}`);
  }

  try {
    return (await response.json()) as EscoSearchResponse;
  } catch (cause) {
    // Κομμένο σώμα απόκρισης: το αίτημα «πέτυχε» αλλά τα byte δεν ήρθαν όλα.
    throw new Error(`${ESCO_TRANSIENT} malformed JSON: ${String(cause)}`);
  }
}
