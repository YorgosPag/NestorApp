/**
 * @fileoverview **WEBHOOK ΣΥΜΒΑΝΤΩΝ ΠΑΡΑΔΟΣΗΣ MAILGUN** — delivered · failed · complained · unsubscribed
 *   (ADR-841 §7 Α21.20).
 * @related lib/communications/mailgun-webhook/mailgun-signature.ts (η πύλη) ·
 *   lib/communications/email-delivery/mailgun-event-read.ts (η ανάγνωση) ·
 *   server/comms/email-delivery/email-delivery-ledger.ts (το ημερολόγιο) ·
 *   server/comms/email-delivery/mailbox-absent-consumers.ts (οι συνέπειες)
 * @module app/api/communications/webhooks/mailgun/events/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΟΙ ΚΩΔΙΚΟΙ ΑΠΑΝΤΗΣΗΣ ΕΙΝΑΙ ΠΟΛΙΤΙΚΗ ΕΠΑΝΑΛΗΨΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Απάντηση | Σημαίνει για τον Mailgun | Πότε |
 * |---|---|---|
 * | `200` | παραδόθηκε, τέλος | καταγράφηκε · διπλό · συμβάν που δεν μας αφορά |
 * | `401` | ξαναδοκιμάζει | άκυρη υπογραφή — ⚠️ αν λείπει το κλειδί, οι επαναλήψεις δίνουν χρόνο να ρυθμιστεί |
 * | `406` | **μην** ξαναδοκιμάσεις | σώμα που δεν είναι JSON — καμία επανάληψη δεν θα το διορθώσει |
 * | `500` | ξαναδοκιμάζει (~8ω) | βλάβη βάσης ή καταναλωτή — η ιδεμποτένεια κάνει την επανάληψη ακίνδυνη |
 *
 * ⚠️ **ΑΝΤΙΘΕΤΟ από το inbound** (που απαντά 200 σε βλάβη): εκεί μια επανάληψη **ξαναβάζει** email στην
 * ουρά· εδώ το ίδιο συμβάν πέφτει στο **ίδιο** κλειδί, άρα η επανάληψη είναι η θεραπεία, όχι ο κίνδυνος.
 *
 * Ρυθμίζεται στον Mailgun: Sending → Webhooks → `permanent_fail` · `temporary_fail` · `complained` ·
 * `delivered` · `unsubscribed` → `/api/communications/webhooks/mailgun/events`.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

import { readMailgunEvent, readMailgunSignatureFields } from '@/lib/communications/email-delivery/mailgun-event-read';
import { isStandingEvidence } from '@/lib/communications/email-delivery/recipient-standing';
import { verifyMailgunSignature } from '@/lib/communications/mailgun-webhook/mailgun-signature';
import { nowISO } from '@/lib/date-local';
import { getErrorMessage } from '@/lib/error-utils';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry/Logger';
import { recordEmailDeliveryEvent } from '@/server/comms/email-delivery/email-delivery-ledger';
import { absenceOf, announceMailboxAbsent } from '@/server/comms/email-delivery/mailbox-absent-consumers';

const logger = createModuleLogger('MAILGUN_EVENTS_WEBHOOK');

async function readBody(request: NextRequest): Promise<unknown | undefined> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function handleMailgunEvent(request: NextRequest): Promise<Response> {
  const body = await readBody(request);
  if (body === undefined) return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 406 });

  const verdict = verifyMailgunSignature(readMailgunSignatureFields(body));
  if (!verdict.valid) {
    logger.warn('Υπογραφή συμβάντος απορρίφθηκε', { reason: verdict.reason });
    return NextResponse.json({ ok: false, error: verdict.reason }, { status: 401 });
  }
  if (!verdict.verified) logger.warn('Συμβάν ΑΝΕΠΙΒΕΒΑΙΩΤΟ — λείπει το κλειδί (επιτρέπεται μόνο εκτός παραγωγής)');

  const event = readMailgunEvent(body);
  if (event === null) return NextResponse.json({ ok: true, ignored: true });

  try {
    const adminDb = getAdminFirestore();
    const record = await recordEmailDeliveryEvent(adminDb, event, nowISO());
    const absence = absenceOf(record.standing);
    if (absence !== null && isStandingEvidence(record.standing, event.providerEventId)) {
      await announceMailboxAbsent(adminDb, absence);
    }
    return NextResponse.json({ ok: true, outcome: record.outcome });
  } catch (error) {
    logger.error('Το συμβάν δεν ολοκληρώθηκε — ο πάροχος θα ξαναστείλει', {
      kind: event.kind, evidence: event.evidence, error: getErrorMessage(error),
    });
    return NextResponse.json({ ok: false, error: 'not_recorded' }, { status: 500 });
  }
}

export const POST = withWebhookRateLimit(handleMailgunEvent);
