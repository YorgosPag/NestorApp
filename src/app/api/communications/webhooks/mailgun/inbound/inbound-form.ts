/**
 * 🏢 MAILGUN INBOUND — ανάγνωση της φόρμας του webhook (ADR-071).
 *
 * Εξήχθη από το `route.ts` (CHECK 4: API route ≤300 γραμμές). Καθαρές συναρτήσεις πάνω στο `FormData`
 * — καμία εγγραφή, κανένα δίκτυο.
 *
 * @module api/communications/webhooks/mailgun/inbound/inbound-form
 */

import 'server-only';

import { isNonEmptyTrimmedString } from '@/lib/type-guards';
import type { InboundEmailAttachment, MailgunStorageInfo } from '@/services/communications/inbound';

/** Η πρώτη μη κενή τιμή ανάμεσα σε εναλλακτικά ονόματα πεδίου (το Mailgun δεν είναι συνεπές). */
export function getFormString(formData: FormData, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = formData.get(key);
    if (isNonEmptyTrimmedString(value)) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * 🏢 ENTERPRISE: Extract Mailgun storage info for deferred download
 *
 * Mailgun provides a message-url that allows retrieving the full message
 * with attachments later (up to 3 days). This enables the "Store Reference,
 * Fetch Later" pattern used by SAP, Salesforce, and enterprise systems.
 *
 * @see https://documentation.mailgun.com/en/latest/api-sending-messages.html#retrieving-stored-messages
 */
export function extractMailgunStorageInfo(formData: FormData): MailgunStorageInfo | undefined {
  const messageUrl = getFormString(formData, ['message-url', 'Message-Url', 'message-headers']);

  if (!messageUrl) {
    return undefined;
  }

  // Extract storage key from URL (last path segment)
  const urlMatch = messageUrl.match(/messages\/([A-Za-z0-9_-]+)$/);
  const storageKey = urlMatch ? urlMatch[1] : undefined;

  return {
    messageUrl,
    storageKey,
    region: messageUrl.includes('europe') ? 'eu' : 'us',
  };
}

export function extractAttachments(formData: FormData): InboundEmailAttachment[] {
  const attachments: InboundEmailAttachment[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('attachment-')) continue;
    if (!(value instanceof File)) continue;

    const filename = value.name || key;
    const contentType = value.type || 'application/octet-stream';
    const sizeBytes = value.size;

    attachments.push({
      filename,
      contentType,
      sizeBytes,
      download: async () => {
        const buffer = Buffer.from(await value.arrayBuffer());
        return { buffer, contentType };
      },
    });
  }

  return attachments;
}

export function buildFallbackKey(params: {
  senderEmail: string;
  recipients: string[];
  subject: string;
  timestamp?: string;
  content: string;
}): string {
  const recipientKey = params.recipients.join(',');
  const timestamp = params.timestamp || '';
  const content = params.content.slice(0, 256);
  return [params.senderEmail, recipientKey, params.subject, timestamp, content].join('|');
}
