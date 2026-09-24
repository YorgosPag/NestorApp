/**
 * =============================================================================
 * ΤΟ OUTBOX ΤΟΥ EMULATOR — ό,τι ΘΑ έφευγε, ως αρχείο `.eml` (ADR-876 §5.8 Σ22)
 * =============================================================================
 *
 * Όταν η πόρτα εξόδου κρατά ένα email (`emailDeliveryMode() === 'capture'`), το γράφει εδώ ως
 * **RFC 5322** μήνυμα — ανοίγει σε κάθε πελάτη αλληλογραφίας, και το διαβάζουν σενάρια
 * επαλήθευσης (π.χ. «στείλε μου νέο σύνδεσμο» → ο σύνδεσμος του `.eml` ανοίγει την πύλη).
 * Ο φάκελος: `/.emulator-outbox/` στη ρίζα του έργου — ένα αρχείο ανά μήνυμα, όνομα = χρονοσφραγίδα.
 *
 * 🔑 **Αρχείο, όχι συλλογή Firestore**: καμία νέα συλλογή/κανόνας στην παραγωγή για κάτι που
 * υπάρχει μόνο τοπικά (πρότυπο Django `filebased.EmailBackend`). Φάκελος gitignored.
 *
 * @module server/comms/egress/email-outbox
 * @see ADR-876 §5.8 Σ22
 */

import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';

import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { generateMessageId } from '@/services/enterprise-id.service';
import { resolveSenderHeader } from '@/services/company/sender-identity';

import type { EgressAttachment, EgressEmail, EgressResult } from './egress-email';

const logger = createModuleLogger('EMAIL_OUTBOX');

/** Ο φάκελος του outbox — στη ρίζα του έργου, αγκυρωμένος στο `.gitignore` (`/.emulator-outbox/`). */
const EMULATOR_OUTBOX_DIR = path.join(process.cwd(), '.emulator-outbox');

const CRLF = '\r\n';

function base64Lines(data: Buffer): string {
  return (data.toString('base64').match(/.{1,76}/g) ?? []).join(CRLF);
}

/** RFC 2047 — ελληνικό θέμα χωρίς να σπάσει η κεφαλίδα. */
function encodedWord(text: string): string {
  return `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
}

function textPart(contentType: 'text/plain' | 'text/html', body: string): string {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(Buffer.from(body, 'utf8')),
  ].join(CRLF);
}

async function attachmentPart(attachment: EgressAttachment): Promise<string> {
  const data = attachment.content instanceof Blob
    ? Buffer.from(await attachment.content.arrayBuffer())
    : attachment.content;
  return [
    `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    '',
    base64Lines(data),
  ].join(CRLF);
}

function multipart(boundary: string, parts: readonly string[]): string {
  return [...parts.map((part) => `--${boundary}${CRLF}${part}`), `--${boundary}--`].join(CRLF);
}

function envelope(email: EgressEmail, messageId: string): string[] {
  const lines = [
    `From: ${email.from ?? resolveSenderHeader()}`,
    `To: ${email.to}`,
    `Subject: ${encodedWord(email.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@emulator.local>`,
    'MIME-Version: 1.0',
    'X-Outbox-Captured: emulator',
  ];
  for (const [name, value] of Object.entries(email.headers ?? {})) lines.push(`${name}: ${value}`);
  if (email.correlation) lines.push(`X-Outbox-Correlation: ${email.correlation.purpose}/${email.correlation.ref}`);
  return lines;
}

/** Το μήνυμα ως κείμενο `.eml` (multipart/mixed ⊃ multipart/alternative + συνημμένα). */
async function renderEml(email: EgressEmail, messageId: string): Promise<string> {
  const bodies = [textPart('text/plain', email.text)];
  if (email.html) bodies.push(textPart('text/html', email.html));
  const alternative = `alt_${messageId}`;
  const mixed = `mix_${messageId}`;
  const attachments = await Promise.all((email.attachments ?? []).map(attachmentPart));
  const body = multipart(mixed, [
    `Content-Type: multipart/alternative; boundary="${alternative}"${CRLF}${CRLF}${multipart(alternative, bodies)}`,
    ...attachments,
  ]);
  return [...envelope(email, messageId), `Content-Type: multipart/mixed; boundary="${mixed}"`, '', body, ''].join(CRLF);
}

/** **Κράτα** το email: γράφεται στο outbox, **ποτέ** στο δίκτυο. */
export async function captureEmail(email: EgressEmail, dir: string = EMULATOR_OUTBOX_DIR): Promise<EgressResult> {
  try {
    const messageId = generateMessageId();
    const stamp = nowISO().replace(/[:.]/g, '-');
    const file = path.join(dir, `${stamp}_${messageId}.eml`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, await renderEml(email, messageId), 'utf8');
    logger.info('Email captured (emulator) — NOT sent', { to: email.to, file });
    return { ok: true, messageId: `captured_${messageId}` };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error('Email capture failed', { to: email.to, reason });
    return { ok: false, error: `outbox: ${reason}` };
  }
}
