/**
 * =============================================================================
 * Η ΠΟΡΤΑ ΕΞΟΔΟΥ ΠΡΟΣ ΤΟΝ RESEND — το ΜΟΝΟ αρχείο που εισάγει το `resend` SDK
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ** (ADR-876 §5.8 Σ22): το SDK το εισήγαγαν **δύο** αρχεία (`email-providers` ·
 * `procurement/.../email-channel`). Το δεύτερο διάβαζε `result.data` και **αγνοούσε** το
 * `result.error` ⇒ μια πρόσκληση που απέρριψε ο Resend γραφόταν «στάλθηκε».
 *
 * ⚠️ **Το Resend ΔΕΝ πετά σε σφάλμα API**: επιστρέφει `{ data:null, error:{…} }`. Ένα `try/catch`
 * μόνο θα διάβαζε κάθε απόρριψη ως **επιτυχία** — ακριβώς η περίπτωση που υπάρχει η αλυσίδα.
 *
 * ⚠️ **Δυναμική εισαγωγή**: περιβάλλον χωρίς `RESEND_API_KEY` δεν φορτώνει καν τη βιβλιοθήκη.
 * 🔑 Σε emulator: outbox, **πριν** από κάθε έλεγχο κλειδιού (`emailDeliveryMode`).
 *
 * @module server/comms/egress/resend-transport
 * @see ADR-876 §5.8 Σ22 · ADR-777 §8.26
 */

import 'server-only';

import { getErrorMessage } from '@/lib/error-utils';
import { resolveSenderHeader } from '@/services/company/sender-identity';

import type { EgressAttachment, EgressEmail, EgressResult } from './egress-email';
import { emailDeliveryMode } from './email-delivery-mode';
import { captureEmail } from './email-outbox';

type ResendSendResult = {
  data?: { id?: string } | null;
  error?: { message?: string } | null;
};

function resendApiKey(): string | null {
  return process.env.RESEND_API_KEY?.trim() || null;
}

/** Μπορεί να «σταλεί» email από εδώ; — σε emulator **πάντα** (το outbox δεν θέλει κλειδιά). */
export function resendAvailable(): boolean {
  return emailDeliveryMode() === 'capture' || resendApiKey() !== null;
}

async function resendAttachment(attachment: EgressAttachment): Promise<{ filename: string; content: Buffer }> {
  const content = attachment.content instanceof Blob
    ? Buffer.from(await attachment.content.arrayBuffer())
    : attachment.content;
  return { filename: attachment.filename, content };
}

/** **Στείλε ένα μήνυμα.** Σε emulator: outbox, ποτέ δίκτυο. */
export async function resendSendMessage(email: EgressEmail): Promise<EgressResult> {
  if (emailDeliveryMode() === 'capture') return captureEmail(email);
  const apiKey = resendApiKey();
  if (!apiKey) return { ok: false, error: 'resend: δεν είναι ρυθμισμένος' };
  try {
    const { Resend } = await import('resend');
    const headers = Object.entries(email.headers ?? {});
    const attachments = await Promise.all((email.attachments ?? []).map(resendAttachment));
    const result = (await new Resend(apiKey).emails.send({
      from: email.from ?? resolveSenderHeader(),
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(headers.length > 0 ? { headers: Object.fromEntries(headers) } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    })) as ResendSendResult;
    if (result.error) return { ok: false, error: result.error.message ?? 'resend: άγνωστο σφάλμα' };
    return { ok: true, messageId: result.data?.id ?? undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, 'resend: άγνωστο σφάλμα') };
  }
}
