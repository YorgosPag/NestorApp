/**
 * @fileoverview **Η ΔΙΑΓΡΑΦΗ ΑΠΟ ΤΑ EMAIL — ΕΝΑ ΚΛΙΚ** (ADR-848, RFC 8058).
 * @module app/api/notifications/email/subscription/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΑΝΑΓΝΩΣΤΕΣ, ΕΝΑ ENDPOINT
 * ────────────────────────────────────────────────────────────────────────────
 * 1. **Το πρόγραμμα email** (Gmail · Outlook · Yahoo), όταν ο άνθρωπος πατά το δικό
 *    του «Κατάργηση εγγραφής» δίπλα στον αποστολέα. Στέλνει **ακριβώς** το σώμα του
 *    RFC 8058 §3.2 — `List-Unsubscribe=One-Click` — χωρίς cookies και χωρίς JavaScript.
 * 2. **Η σελίδα προτιμήσεων** (`/email/preferences/<token>`), με JSON `{ change }` —
 *    διακοπή · μία σύνοψη την ημέρα · αναίρεση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΕΧΕΙ `withAuth` — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΧΕΙ `GET`
 * ────────────────────────────────────────────────────────────────────────────
 * - Η διαγραφή **δεν επιτρέπεται να ζητά σύνδεση** (Google: «must not require the
 *   recipient to log in»). Η εξουσιοδότηση **είναι** το υπογεγραμμένο token: ένας
 *   χρήστης, ένας σκοπός, μυστικό που ζει μόνο στον διακομιστή. Ίδιο σχήμα με το
 *   `/api/mandate/[token]`.
 * - **Κανένα `GET`** — ο Next απαντά 405. Οι σαρωτές συνδέσμων (Microsoft Safe Links,
 *   antivirus) **ανοίγουν** κάθε GET πριν τον άνθρωπο· «διαγραφή σε GET» θα διέγραφε
 *   ανθρώπους που δεν πάτησαν ποτέ τίποτα. Γι' αυτό υπάρχει το RFC 8058.
 *
 * ⚠️ **Εξαιρείται από το μπλοκάρισμα bot του middleware** (`isMachineEndpoint`) — ο
 * αιτών είναι μηχανή εξ ορισμού — και έχει **δικό του** κάδο ρυθμού (`WEBHOOK`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import {
  parseEmailSubscriptionChange,
  type EmailSubscriptionChange,
  type SubscriptionFailure,
  type SubscriptionResponse,
} from '@/lib/notifications/email-subscription-contract';
import { EMAIL_SUBSCRIPTION_TOKEN_PARAM } from '@/lib/notifications/email-subscription-routes';
import { createModuleLogger } from '@/lib/telemetry';
import { applyEmailSubscriptionChange } from '@/server/notifications/email-subscription';
import { readEmailSubscriptionToken } from '@/services/notifications/email-subscription-token.service';

const logger = createModuleLogger('EmailSubscriptionRoute');

/** Το σώμα του RFC 8058 §3.2, **κατά λέξη** — τίποτα άλλο δεν είναι one-click. */
const ONE_CLICK_FIELD = 'List-Unsubscribe';
const ONE_CLICK_VALUE = 'One-Click';

function fail(reason: SubscriptionFailure, status: number): NextResponse<SubscriptionResponse> {
  return NextResponse.json({ ok: false, reason }, { status });
}

/**
 * **Το αίτημα → αλλαγή.** JSON από τη σελίδα· φόρμα από το πρόγραμμα email.
 *
 * ⚠️ Το one-click αναγνωρίζεται **μόνο** από το ακριβές σώμα του RFC — ένα άδειο POST
 * **δεν** διαγράφει. Αλλιώς οποιοσδήποτε σαρωτής κάνει POST θα έκανε ό,τι απαγορεύουμε
 * στο GET.
 */
async function changeFromRequest(request: NextRequest): Promise<EmailSubscriptionChange | null> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body: unknown = await request.json().catch(() => null);
    const change: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'change') : null;
    return parseEmailSubscriptionChange(change);
  }

  const form = await request.formData().catch(() => null);
  return form?.get(ONE_CLICK_FIELD) === ONE_CLICK_VALUE ? { kind: 'unsubscribe' } : null;
}

async function handler(request: NextRequest): Promise<NextResponse<SubscriptionResponse>> {
  const token = request.nextUrl.searchParams.get(EMAIL_SUBSCRIPTION_TOKEN_PARAM) ?? '';
  const verdict = readEmailSubscriptionToken(token);

  // ⚠️ **503 και ΟΧΙ 400** όταν λείπει το μυστικό: ο σύνδεσμος του ανθρώπου μπορεί να
  //    είναι έγκυρος — φταίμε εμείς, και ένα 4xx θα το έλεγε σε κάθε αναγνώστη.
  if (!verdict.ok) {
    return verdict.reason === 'server-config'
      ? fail('service-unavailable', 503)
      : fail('link-invalid', 400);
  }

  const change = await changeFromRequest(request);
  if (change === null) return fail('request-invalid', 400);

  try {
    const applied = await applyEmailSubscriptionChange(verdict.uid, change);
    logger.info('Αλλαγή συνδρομής στα email ειδοποιήσεων', {
      data: { uid: verdict.uid, change: change.kind, emailEnabled: applied.current.emailEnabled },
    });
    return NextResponse.json({ ok: true, previous: applied.previous, current: applied.current });
  } catch (error) {
    logger.error('Η αλλαγή συνδρομής email ΔΕΝ γράφτηκε', {
      data: { uid: verdict.uid, error: error instanceof Error ? error.message : String(error) },
    });
    return fail('write-failed', 500);
  }
}

export const POST = withWebhookRateLimit(handler);
