/**
 * @fileoverview **Ο ΠΡΟΣΑΡΜΟΓΕΑΣ MAILGUN** — webhook συμβάντος → {@link EmailDeliveryEvent} (ADR-841 §7 Α21.20).
 * @related types/email-delivery.ts · app/api/communications/webhooks/mailgun/events/route.ts
 * @module lib/communications/email-delivery/mailgun-event-read
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΠΙΝΑΚΑΣ ΑΠΟΔΕΙΞΗΣ — ΤΟ ΜΟΝΟ ΣΗΜΕΙΟ ΠΟΥ ΑΠΟΦΑΣΙΖΕΙ «ΝΕΚΡΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Mailgun | Απόδειξη | Γιατί |
 * |---|---|---|
 * | `reason: suppress-*` · κωδικός 605/606/607 | `suppressed-send` | ο Mailgun **δεν δοκίμασε** — ήξερε ήδη |
 * | `reason: old` | `exhausted-retries` | 8ω προσωρινών αποτυχιών — ο διακομιστής μπορεί απλώς να έπεσε |
 * | enhanced `x.2.2` | `mailbox-full` | γεμάτο = **ζει** |
 * | enhanced `5.7.*` · `espblock/blacklisted/greylisted` | `policy` | φήμη/spam, όχι ύπαρξη |
 * | `bounce/hardfail` + enhanced `5.1.*`/`5.2.1` | `mailbox-absent` | RFC 3463: άγνωστος παραλήπτης/domain · απενεργοποιημένο |
 * | `bounce/hardfail` + **χωρίς** enhanced + SMTP 550/551/553 | `mailbox-absent` | πολλοί MTA δεν στέλνουν enhanced· ο Mailgun το έκρινε `bounce` |
 * | ό,τι άλλο | `unknown` | ποτέ μαντεψιά προς «νεκρό» |
 *
 * Πηγές: Mailgun *Tracking Failures* · *Suppressions* (605) · RFC 3463 §3.2-3.3.
 *
 * ⚠️ **Tolerant ανάγνωση**: ό,τι δεν καταλαβαίνουμε ⇒ `null` (το route απαντά 200 — ένα συμβάν που
 * δεν αφορά κανέναν δεν αξίζει 8 ώρες επαναλήψεων).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις.
 */

import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import type { MailgunSignatureFields } from '@/lib/communications/mailgun-webhook/mailgun-signature';
import {
  EMAIL_DELIVERY_PURPOSES,
  EMAIL_DELIVERY_VARIABLES,
  type EmailDeliveryEvent,
  type EmailDeliveryKind,
  type EmailDeliveryPurpose,
  type EmailFailureEvidence,
} from '@/types/email-delivery';

type Json = Record<string, unknown>;

const SUPPRESSION_CODES: ReadonlySet<number> = new Set([605, 606, 607]);
const POLICY_REASONS: ReadonlySet<string> = new Set(['espblock', 'blacklisted', 'greylisted']);
const RECIPIENT_REASONS: ReadonlySet<string> = new Set(['bounce', 'hardfail']);
const ABSENT_WITHOUT_ENHANCED: ReadonlySet<number> = new Set([550, 551, 553]);

function objectOf(value: unknown): Json | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : null;
}

/** Ένα enhanced code **αποδεικνύει** ανυπαρξία; (`5.1.*` διεύθυνση/domain · `5.2.1` απενεργοποιημένο). */
function enhancedProvesAbsence(enhanced: string): boolean {
  return /^5\.1\.\d+$/.test(enhanced) || enhanced === '5.2.1';
}

/** **Ο πίνακας** — δες την κεφαλίδα. Η σειρά των ελέγχων **είναι** η πολιτική. */
export function classifyMailgunFailure(
  reason: string | null,
  smtpCode: number | null,
  enhancedCode: string | null,
): EmailFailureEvidence {
  if ((reason?.startsWith('suppress-') ?? false) || (smtpCode !== null && SUPPRESSION_CODES.has(smtpCode))) {
    return 'suppressed-send';
  }
  if (reason === 'old') return 'exhausted-retries';
  if (enhancedCode !== null && /^[45]\.2\.2$/.test(enhancedCode)) return 'mailbox-full';
  if ((enhancedCode?.startsWith('5.7.') ?? false) || (reason !== null && POLICY_REASONS.has(reason))) return 'policy';
  if (reason === null || !RECIPIENT_REASONS.has(reason)) return 'unknown';
  if (enhancedCode !== null) return enhancedProvesAbsence(enhancedCode) ? 'mailbox-absent' : 'unknown';
  return smtpCode !== null && ABSENT_WITHOUT_ENHANCED.has(smtpCode) ? 'mailbox-absent' : 'unknown';
}

function kindOf(event: string | null, severity: string | null): EmailDeliveryKind | null {
  if (event === 'delivered' || event === 'complained' || event === 'unsubscribed') return event;
  if (event === 'failed') return severity === 'permanent' ? 'failed' : 'deferred';
  return null;
}

function purposeOf(value: unknown): EmailDeliveryPurpose | null {
  const text = textOf(value);
  return text !== null && (EMAIL_DELIVERY_PURPOSES as readonly string[]).includes(text) ? (text as EmailDeliveryPurpose) : null;
}

function occurredAtOf(timestamp: unknown): string | null {
  const seconds = typeof timestamp === 'number' ? timestamp : Number.NaN;
  return Number.isFinite(seconds) && seconds > 0 ? new Date(Math.round(seconds * 1000)).toISOString() : null;
}

function recipientOf(value: unknown): string | null {
  const text = textOf(value);
  return text !== null && text.includes('@') ? normaliseChannelEmail(text) : null;
}

/** Τα πεδία υπογραφής του σώματος JSON (`signature.{timestamp,token,signature}`). */
export function readMailgunSignatureFields(body: unknown): MailgunSignatureFields {
  const signature = objectOf(objectOf(body)?.signature);
  const timestamp = signature?.timestamp;
  return {
    timestamp: typeof timestamp === 'number' ? String(timestamp) : textOf(timestamp) ?? undefined,
    token: textOf(signature?.token) ?? undefined,
    signature: textOf(signature?.signature) ?? undefined,
  };
}

/** **Το συμβάν** — ή `null` αν δεν είναι συμβάν παράδοσης που καταλαβαίνουμε. */
export function readMailgunEvent(body: unknown): EmailDeliveryEvent | null {
  const data = objectOf(objectOf(body)?.['event-data']);
  const kind = kindOf(textOf(data?.event), textOf(data?.severity));
  const providerEventId = textOf(data?.id);
  const occurredAt = occurredAtOf(data?.timestamp);
  const recipient = recipientOf(data?.recipient);
  if (data === null || kind === null || providerEventId === null || occurredAt === null || recipient === null) return null;

  const status = objectOf(data['delivery-status']);
  const providerReason = textOf(data.reason);
  const smtpCode = numberOf(status?.code);
  const enhancedCode = textOf(status?.['enhanced-code']);
  const variables = objectOf(data['user-variables']);
  const headers = objectOf(objectOf(data.message)?.headers);
  const failing = kind === 'failed' || kind === 'deferred';

  return {
    provider: 'mailgun', providerEventId, occurredAt, recipient, kind,
    evidence: failing ? classifyMailgunFailure(providerReason, smtpCode, enhancedCode) : null,
    providerReason, smtpCode, enhancedCode,
    providerMessageId: textOf(headers?.['message-id']),
    purpose: purposeOf(variables?.[EMAIL_DELIVERY_VARIABLES.purpose]),
    ref: textOf(variables?.[EMAIL_DELIVERY_VARIABLES.ref]),
  };
}
