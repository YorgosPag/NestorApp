/**
 * =============================================================================
 * Η ΠΟΡΤΑ ΤΟΥ ΕΣΩΤΕΡΙΚΟΥ WEBHOOK — ένα σύνορο για κάθε κλήση Cloud Functions → Next.js (ADR-905 §6)
 * =============================================================================
 *
 * Ο καλών δεν είναι άνθρωπος: είναι **δικό μας** Cloud Function, που αποδεικνύει την ταυτότητά του με υπογραφή
 * HMAC (`lib/webhooks/internal-webhook-signature` — ο **ίδιος** πυρήνας υπογράφει εκεί και κρίνει εδώ). Σειρά:
 *
 *   1. **Υπογραφή πάνω στο ωμό σώμα** — πριν από κάθε ανάλυση· πλαστό ⇒ μηδέν ανάγνωση, μηδέν βάση.
 *   2. **Σύνορο ιδεμποτίας** (CHECK 3.92) με principal `internal-webhook:<πηγή>` και `Idempotency-Key` = η ταυτότητα
 *      του γεγονότος: η επανάληψη του trigger (at-least-once) **και** η επανάληψη μέσα στο παράθυρο της υπογραφής
 *      εκτελούνται **μία** φορά — με τον μηχανισμό που ήδη υπάρχει, όχι με δεύτερο μητρώο.
 *   3. **JSON** — άκυρο ⇒ 400 (ο trigger δεν ξαναδοκιμάζει ό,τι δεν θα γίνει ποτέ έγκυρο).
 *
 * Κωδικοί → συμπεριφορά του trigger (το λεξικό ζει στο `lib/webhooks/internal-webhook-delivery`, προβαλλόμενο στον
 * αποστολέα): **2xx** τέλος · **4xx** τέλος + καταγραφή (λάθος δεν διορθώνεται με επανάληψη) · **408/425/429** και
 * **5xx** επανάληψη — το 429 του `withWebhookRateLimit` είναι αντίθλιψη, όχι απώλεια. Γι' αυτό το «λείπει το μυστικό **εδώ**» είναι **503**: είναι ρύθμιση που θα διορθωθεί, και
 * τα γεγονότα περιμένουν αντί να χαθούν.
 *
 * @module server/internal-webhooks/signed-webhook-door
 * @enterprise ADR-905 §6 · ADR-872 · CHECK 3.92
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { runIdempotently } from '@/lib/api/idempotency/with-idempotency';
import type { IdempotencyPolicy } from '@/lib/api/idempotency/idempotency-contract';
import { readConfiguredValue } from '@/lib/environment/environment-audit';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import {
  INTERNAL_WEBHOOK_SIGNATURE_HEADER,
  judgeInternalWebhook,
  type InternalWebhookRefusal,
} from '@/lib/webhooks/internal-webhook-signature';

const logger = createModuleLogger('INTERNAL_WEBHOOK_DOOR');

/** Το μυστικό που μοιράζονται Functions (Secret Manager) και Netcup (env). Literal — το βλέπει το environment contract. */
export const INTERNAL_WEBHOOK_SECRET_ENV = 'INTERNAL_WEBHOOK_SECRET';
/** Μόνο κατά την περιστροφή: το προηγούμενο κλειδί, αποδεκτό ώσπου να ανανεωθούν όλοι οι υπογραφείς. */
export const INTERNAL_WEBHOOK_PREVIOUS_SECRET_ENV = 'INTERNAL_WEBHOOK_SECRET_PREVIOUS';

const REFUSAL_STATUS: Record<InternalWebhookRefusal, number> = {
  secret_missing: 503,
  signature_missing: 401,
  signature_malformed: 401,
  timestamp_expired: 401,
  signature_invalid: 401,
};

export interface SignedWebhookOptions {
  /** Ποιος καλεί — μέρος του principal της ιδεμποτίας (δύο πηγές με ίδιο κλειδί δεν συγκρούονται). */
  readonly source: string;
  /** Μόνο με **απόδειξη** στον handler (CHECK 3.92 Κ1: `why` ≥ 15). */
  readonly idempotency?: IdempotencyPolicy;
}

export type SignedWebhookHandler = (body: unknown) => Promise<NextResponse>;

function configuredSecrets(): string[] {
  return [INTERNAL_WEBHOOK_SECRET_ENV, INTERNAL_WEBHOOK_PREVIOUS_SECRET_ENV]
    .map((name) => readConfiguredValue(process.env, name))
    .filter((value): value is string => value !== null);
}

function parseJson(raw: string): { readonly ok: true; readonly body: unknown } | { readonly ok: false } {
  try {
    return { ok: true, body: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

/** **Η πόρτα.** Επιστρέφει handler έτοιμο για `withWebhookRateLimit`. */
export function withSignedInternalWebhook(
  options: SignedWebhookOptions,
  handler: SignedWebhookHandler,
): (request: NextRequest) => Promise<NextResponse> {
  return async (request) => {
    const raw = await request.clone().text();
    const verdict = judgeInternalWebhook(request.headers.get(INTERNAL_WEBHOOK_SIGNATURE_HEADER), raw, {
      secrets: configuredSecrets(),
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!verdict.valid) {
      logger.warn('Internal webhook refused', { source: options.source, reason: verdict.reason });
      return NextResponse.json({ ok: false, error: verdict.reason }, { status: REFUSAL_STATUS[verdict.reason] });
    }
    const parsed = parseJson(raw);
    if (!parsed.ok) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });

    return runIdempotently(request, `internal-webhook:${options.source}`, options.idempotency, async () => {
      try {
        return { response: await handler(parsed.body), thrown: false };
      } catch (error) {
        logger.error('Internal webhook failed — the sender will retry', { source: options.source, error: getErrorMessage(error, 'unknown') });
        return { response: NextResponse.json({ ok: false, error: 'not_applied' }, { status: 500 }), thrown: true };
      }
    });
  };
}
