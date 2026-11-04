/**
 * =============================================================================
 * Η ΑΣΠΙΔΑ ΤΩΝ ΑΠΟΚΡΙΣΕΩΝ — ό,τι φεύγει από ένα `defineRoute`, φεύγει από εδώ (ADR-603 §Ασπίδα · ADR-923 §23.5 Β2)
 * =============================================================================
 *
 * Δύο ερωτήσεις, ΜΙΑ απάντηση για όλα τα routes του factory:
 *
 * 1. **Τι επιτρέπεται να κρατηθεί;** Κάθε απόκριση — επιτυχία, άρνηση `withAuth`, 429 του ορίου ρυθμού, 400 του
 *    σχήματος, σφάλμα του handler — παίρνει `Cache-Control` από τη **δηλωμένη** πολιτική του route (προεπιλογή
 *    `private, no-store`). Άρνηση ή σφάλμα (≥400) ⇒ **πάντα** `private, no-store`, ό,τι κι αν δήλωσε. Η ασπίδα
 *    **γράφει πάνω** σε ό,τι έβαλε ο handler: η πολιτική ζει στη δήλωση, όχι σε κεφαλίδα κρυμμένη στο σώμα.
 *
 * 2. **Τι επιτρέπεται να μάθει ο πελάτης για μια απρόβλεπτη βλάβη;** Τίποτα εσωτερικό: γενικό μήνυμα (το
 *    `fallbackError` του route, γραμμένο από άνθρωπο) + σταθερός κωδικός `INTERNAL_SERVER_ERROR` (αναγνωρίσιμος· μετάφραση στον client: εκκρεμεί) +
 *    **αναγνωριστικό αιτήματος** στο σώμα και στην κεφαλίδα `X-Request-ID` (Stripe `Request-Id` · GitHub
 *    `X-GitHub-Request-Id` · AWS `x-amzn-RequestId`). Η λεπτομέρεια (μήνυμα, όνομα, stack) **μόνο** στο log του
 *    διακομιστή, κάτω από το ίδιο αναγνωριστικό — OWASP ASVS 4.0.3 V7.4.1.
 *
 * 🔑 Το αναγνωριστικό το **παράγει ο διακομιστής** (`generateRequestId`, enterprise-id SSoT) — ποτέ από κεφαλίδα του
 * πελάτη: τιμή του πελάτη μέσα στο log είναι πόρτα για ψεύτικες εγγραφές (log injection, OWASP).
 *
 * @module lib/api/route-response-shield
 * @see ADR-603 API Route-Handler Factory SSoT
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { cacheControlFor, type ResponseCachePolicy } from '@/lib/http/cache-control';
import { INTERNAL_ERROR_CODE, REQUEST_ID_HEADER } from '@/lib/api/api-error-types';
import { generateRequestId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('API_ROUTE');

/** Το γενικό μήνυμα όταν το route δεν δήλωσε δικό του `fallbackError`. */
export const GENERIC_INTERNAL_ERROR = 'Internal server error';

/**
 * Γράφει κεφαλίδες σε μια απόκριση. Οι `Response` του `fetch` και του `Response.redirect` έχουν **αμετάβλητες**
 * κεφαλίδες (φρουρός «immutable» του Fetch Standard) ⇒ τότε χτίζεται αντίγραφο με το ίδιο σώμα, χωρίς ανάγνωσή του.
 */
function withHeaders(response: Response, entries: Readonly<Record<string, string>>): Response {
  const apply = (headers: Headers) => {
    for (const name of RIVAL_CACHE_HEADERS) headers.delete(name);
    for (const [name, value] of Object.entries(entries)) headers.set(name, value);
  };
  try {
    apply(response.headers);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    apply(headers);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
}

/**
 * Κεφαλίδες που **ανταγωνίζονται** το `Cache-Control`: το `CDN-Cache-Control` (RFC 9213) και το `Surrogate-Control`
 * τα διαβάζουν CDN **πριν** από το `Cache-Control`, και το `Expires` ισχύει όπου λείπει `max-age`. Αν τις άφηνε ένας
 * handler, θα παρέκαμπταν τη δηλωμένη πολιτική στον ενδιάμεσο — η ασπίδα τις σβήνει.
 */
const RIVAL_CACHE_HEADERS = ['CDN-Cache-Control', 'Surrogate-Control', 'Expires'] as const;

/** Η πολιτική cache της απόκρισης, κατά την κατάστασή της (άρνηση/σφάλμα ⇒ πάντα `no-store`). */
export function shieldResponse(response: Response, policy: ResponseCachePolicy): Response {
  return withHeaders(response, { 'Cache-Control': cacheControlFor(response.status, policy) });
}

/** Ό,τι χρειάζεται ο μηχανικός για να βρει τη βλάβη — μόνο για το log, ποτέ για τον πελάτη. */
function diagnosticOf(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { errorName: error.name, error: error.message, stack: error.stack };
  return { error: typeof error === 'string' ? error : 'non-Error value thrown', errorType: typeof error };
}

/**
 * Απρόβλεπτη βλάβη (ή `ApiError` ≥500, που κρατά τον κωδικό HTTP και τον δηλωμένο σταθερό `errorCode` του — ποτέ το μήνυμα) ⇒ γενικό μήνυμα + κωδικό + αναγνωριστικό. Το σχήμα `{ success:false, error }` μένει όπως
 * το περιμένουν `ApiClientError` / `fetchJson` — μόνο **προστίθενται** `errorCode` και `requestId`.
 */
export function unexpectedErrorResponse(
  error: unknown,
  req: NextRequest,
  fallbackError?: string,
  status = 500,
  errorCode: string = INTERNAL_ERROR_CODE,
): NextResponse {
  const requestId = generateRequestId();
  logger.error('Route handler error', {
    requestId,
    method: req.method,
    path: new URL(req.url).pathname,
    ...diagnosticOf(error),
  });
  return NextResponse.json(
    {
      success: false,
      error: fallbackError ?? GENERIC_INTERNAL_ERROR,
      errorCode,
      requestId,
    },
    { status, headers: { [REQUEST_ID_HEADER]: requestId } },
  );
}
