/**
 * =============================================================================
 * Η ΠΟΡΤΑ ΕΞΟΔΟΥ ΠΡΟΣ ΤΟΝ MAILGUN — το ΜΟΝΟ αρχείο που μιλά με το `mailgun.net`
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (ADR-876 §5.8 Σ22): URL περιοχής + Basic auth ζούσαν **δύο** φορές
 * (`mailgun-sender` · `EmailAdapter`), η δεύτερη **χωρίς** όριο χρόνου (το μάθημα ADR-853 Φ5 δεν
 * είχε φτάσει εκεί), και καμία δεν ήξερε για emulator.
 *
 * 🔑 **Πρώτη ερώτηση κάθε συνάρτησης: `emailDeliveryMode()`.** Σε emulator το μήνυμα πάει στο
 * outbox **πριν** από κάθε έλεγχο κλειδιών — ο emulator δεν μπορεί να στείλει, όσα κλειδιά κι αν
 * υπάρχουν. Κλείδωμα: module `email-egress` στο `.ssot-registry.json` (κανένα άλλο αρχείο με `mailgun.net`).
 *
 * @module server/comms/egress/mailgun-transport
 * @see ADR-876 §5.8 Σ22 · ADR-853 Φ5 (όριο χρόνου) · ADR-841 §7 Α21.20 (bounces)
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { PROVIDER_TIMEOUT_MS } from '@/server/comms/email-provider-chain';
import { resolveSenderHeader } from '@/services/company/sender-identity';
import { EMAIL_DELIVERY_VARIABLES, type EmailDeliveryCorrelation } from '@/types/email-delivery';

import type { EgressEmail, EgressResult } from './egress-email';
import { emailDeliveryMode } from './email-delivery-mode';
import { captureEmail } from './email-outbox';

const logger = createModuleLogger('MAILGUN_TRANSPORT');

/** Όριο της ταυτότητας συσχέτισης — ο Mailgun κόβει τις μεταβλητές πάνω από 4KB στα webhooks. */
const CORRELATION_REF_MAX = 200;

interface MailgunCredentials {
  readonly apiKey: string;
  readonly domain: string;
}

function mailgunCredentials(): MailgunCredentials | null {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  return apiKey && domain ? { apiKey, domain } : null;
}

/** Μπορεί να «σταλεί» email από εδώ; — σε emulator **πάντα** (το outbox δεν θέλει κλειδιά). */
export function mailgunAvailable(): boolean {
  return emailDeliveryMode() === 'capture' || mailgunCredentials() !== null;
}

function mailgunRequest(credentials: MailgunCredentials, pathAndQuery: string, init: RequestInit): Promise<Response> {
  const region = process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  return fetch(`https://${region}/v3/${credentials.domain}${pathAndQuery}`, {
    ...init,
    headers: { Authorization: `Basic ${Buffer.from(`api:${credentials.apiKey}`).toString('base64')}` },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
}

function appendCorrelation(form: FormData, correlation: EmailDeliveryCorrelation | undefined): void {
  const ref = correlation?.ref.trim() ?? '';
  if (!correlation || ref === '' || ref.length > CORRELATION_REF_MAX) return;
  form.append(`v:${EMAIL_DELIVERY_VARIABLES.purpose}`, correlation.purpose);
  form.append(`v:${EMAIL_DELIVERY_VARIABLES.ref}`, ref);
}

function messageForm(email: EgressEmail): FormData {
  const form = new FormData();
  form.append('from', email.from ?? resolveSenderHeader());
  form.append('to', email.to);
  form.append('subject', email.subject);
  form.append('text', email.text);
  if (email.html) form.append('html', email.html);
  // Το Mailgun δέχεται δικές μας κεφαλίδες ως `h:<Όνομα>` — ένα δικό μας `List-Unsubscribe` υπερισχύει.
  for (const [name, value] of Object.entries(email.headers ?? {})) form.append(`h:${name}`, value);
  appendCorrelation(form, email.correlation);
  for (const attachment of email.attachments ?? []) {
    const blob = attachment.content instanceof Blob
      ? attachment.content
      : new Blob([new Uint8Array(attachment.content)], { type: attachment.contentType });
    form.append('attachment', blob, attachment.filename);
  }
  return form;
}

/** **Στείλε ένα μήνυμα.** Σε emulator: outbox, ποτέ δίκτυο. */
export async function mailgunSendMessage(email: EgressEmail): Promise<EgressResult> {
  if (emailDeliveryMode() === 'capture') return captureEmail(email);
  const credentials = mailgunCredentials();
  if (!credentials) return { ok: false, error: 'Mailgun not configured: missing MAILGUN_API_KEY or MAILGUN_DOMAIN' };
  try {
    const response = await mailgunRequest(credentials, '/messages', { method: 'POST', body: messageForm(email) });
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mailgun API error', { status: response.status, body: errorText.slice(0, 500), to: email.to });
      return { ok: false, error: `Mailgun API ${response.status}: ${errorText.slice(0, 200)}` };
    }
    const result = (await response.json()) as { id?: string };
    logger.info('Email sent via Mailgun', { messageId: result.id, to: email.to, subject: email.subject.slice(0, 100) });
    return { ok: true, messageId: result.id ?? undefined };
  } catch (error) {
    const reason = getErrorMessage(error);
    logger.error('Mailgun send failed', { error: reason, to: email.to });
    return { ok: false, error: reason };
  }
}

export type MailgunBounceClearance = 'cleared' | 'not-listed' | 'failed';

/**
 * **Βγάλε τη διεύθυνση από τη λίστα bounces** (ADR-841 §7 Α21.20). `404` ⇒ `not-listed`.
 * Σε emulator δεν υπάρχει λίστα bounces να καθαριστεί ⇒ `not-listed`, **χωρίς** δίκτυο.
 */
export async function mailgunDeleteBounce(address: string): Promise<MailgunBounceClearance> {
  if (emailDeliveryMode() === 'capture') return 'not-listed';
  const credentials = mailgunCredentials();
  if (!credentials) return 'failed';
  try {
    const response = await mailgunRequest(credentials, `/bounces/${encodeURIComponent(address)}`, { method: 'DELETE' });
    if (response.status === 404) return 'not-listed';
    if (response.ok) return 'cleared';
    logger.error('Mailgun bounce clearance refused', { status: response.status });
    return 'failed';
  } catch (error) {
    logger.error('Mailgun bounce clearance failed', { error: getErrorMessage(error) });
    return 'failed';
  }
}
