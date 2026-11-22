/**
 * =============================================================================
 * API FAILURE REPORT — «ποιος απάντησε;» για μια αποτυχημένη κλήση στο δικό μας `/api`
 * =============================================================================
 *
 * Το `httpClientIntegration` του Sentry (`instrumentation-client.ts`) καταγράφει **κάθε** 5xx του `/api` με διαδρομή
 * και status — αλλά **δεν μπορεί** να πει αν την απάντηση την έγραψε ο server μας ή κάποιος ενδιάμεσος (Traefik):
 * χωρίς `sendDefaultPii` δεν κρατά headers, και το `beforeSend` δεν βλέπει την απόκριση. Αυτό το ξέρει **μόνο** όποιος
 * διάβασε την απόκριση. Εδώ ζει η ΜΙΑ κρίση, ώστε κάθε φόρμα που θέλει διάγνωση να ρωτά το ίδιο πράγμα.
 *
 * `envelope` = τι **σώμα** ήρθε:
 * - `json`  ⇒ απάντησε ο server μας (κάθε διαδρομή απαντά με `NextResponse.json`)·
 * - `none`  ⇒ σώμα που δεν είναι JSON: ενδιάμεσος (proxy, «no available server») ή κατάρρευση πριν τον χειριστή.
 * `kind` = `http` (ήρθε απάντηση) · `network` (δεν ήρθε — `fetch` πέταξε `TypeError`) · `unexpected` (κάτι άλλο).
 *
 * ⚠️ Για 5xx το ίδιο αίτημα δίνει **δύο** γεγονότα: της ολοκλήρωσης (κάλυψη) και αυτό (διάγνωση). Επίτηδες: το
 *    πρώτο λέει «κάτι έσπασε, οπουδήποτε», το δεύτερο «ποιος το έσπασε». Ομαδοποιούνται χωριστά, από το μήνυμα.
 * ⚠️ ΜΗΝ προσθέσεις εδώ σώμα απόκρισης ή στοιχεία αιτήματος: σε αυτές τις διαδρομές περνούν στοιχεία επαφών
 *    (ίδιος λόγος με το `ApiClientError.errorBody`, που δεν σειριοποιείται ποτέ).
 *
 * @module lib/telemetry/api-failure-report
 * @see ADR-327 §7.5 — τα 503 της προεπισκόπησης πρόσκλησης RFQ
 */

import { ApiClientError } from '@/lib/api/api-client-types';
import { createModuleLogger } from './Logger';
import { captureMessage } from './sentry';

const logger = createModuleLogger('API_FAILURE');

export type ApiFailureKind = 'http' | 'network' | 'unexpected';
export type ApiFailureEnvelope = 'json' | 'none';

export interface ApiFailureClassification {
  readonly kind: ApiFailureKind;
  readonly status?: number;
  readonly errorCode?: string;
  readonly envelope?: ApiFailureEnvelope;
}

const envelopeOf = (response: Response | undefined): ApiFailureEnvelope | undefined => {
  if (!response) return undefined;
  return (response.headers.get('content-type') ?? '').includes('application/json') ? 'json' : 'none';
};

/** Η ΜΙΑ κρίση: τι είδους αποτυχία, και ποιος απάντησε. */
export function classifyApiFailure(cause: unknown): ApiFailureClassification {
  if (ApiClientError.isApiClientError(cause)) {
    return {
      kind: 'http',
      status: cause.statusCode,
      errorCode: cause.errorCode,
      envelope: envelopeOf(cause.response),
    };
  }
  return { kind: cause instanceof TypeError ? 'network' : 'unexpected' };
}

/**
 * Καταγράφει την αποτυχία στο Sentry (και στο log του browser). Δεν πετά ποτέ.
 * Ο καλών **δεν** το καλεί για ακύρωση (`AbortController`): εκείνη είναι δική του απόφαση, όχι αποτυχία.
 *
 * @param operation σταθερό όνομα της πράξης (π.χ. `rfq-invite-preview`) — ετικέτα και κλειδί ομαδοποίησης.
 */
export function reportApiFailure(operation: string, cause: unknown): ApiFailureClassification {
  const failure = classifyApiFailure(cause);
  const tags: Record<string, string> = { operation, kind: failure.kind };
  if (failure.status !== undefined) tags.status = String(failure.status);
  if (failure.envelope) tags.envelope = failure.envelope;
  if (failure.errorCode) tags.errorCode = failure.errorCode;

  const summary = `API failure: ${operation} ${failure.status ?? failure.kind}${failure.envelope ? ` (${failure.envelope})` : ''}`;
  logger.warn(summary, tags);
  captureMessage(summary, 'warning', { tags });
  return failure;
}
