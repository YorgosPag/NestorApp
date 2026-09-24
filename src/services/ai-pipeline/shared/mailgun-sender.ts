/**
 * =============================================================================
 * 🏢 ENTERPRISE: CENTRALIZED MAILGUN EMAIL SENDER
 * =============================================================================
 *
 * Shared utility for sending reply emails via Mailgun API.
 * Used by all UC modules that need to send outbound emails after pipeline execution.
 *
 * 🔑 **ΔΕΝ μιλά πια με το δίκτυο** (ADR-876 §5.8 Σ22): αναθέτει στην ΜΙΑ πόρτα εξόδου
 * (`server/comms/egress/mailgun-transport`) — εκεί ζουν περιοχή, auth, όριο χρόνου και το
 * «σε emulator ⇒ outbox». Το δημόσιο API μένει ίδιο για τους ~20 καλούντες.
 *
 * @module services/ai-pipeline/shared/mailgun-sender
 * @see UC-001 (Appointment Request)
 * @see UC-003 (Property Search)
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import {
  mailgunDeleteBounce,
  mailgunSendMessage,
  type MailgunBounceClearance,
} from '@/server/comms/egress/mailgun-transport';
import type { EmailDeliveryCorrelation } from '@/types/email-delivery';

// ============================================================================
// TYPES
// ============================================================================

/** Result of a Mailgun send operation */
export interface MailgunSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Email attachment for Mailgun multipart/form-data upload */
export interface MailgunAttachment {
  /** Filename as it appears in the email (e.g. 'A-42_Acme_20260317.pdf') */
  filename: string;
  /** Raw file data — Buffer (server) or Blob (browser) */
  content: Buffer | Blob;
  /** MIME type (e.g. 'application/pdf') */
  contentType: string;
}

/** Parameters for sending an email */
export interface MailgunSendParams {
  to: string;
  subject: string;
  textBody: string;
  /** Optional HTML body — if provided, email is sent as multipart (text + html) */
  htmlBody?: string;
  /** Optional file attachments — Mailgun multipart upload */
  attachments?: MailgunAttachment[];
  /**
   * 🔑 ADR-841 §7 Α21.20 — **ποιος γέννησε αυτό το μήνυμα**. Ταξιδεύει ως `v:` μεταβλητές και
   * γυρίζει σε κάθε συμβάν παράδοσης (bounce · complaint), ώστε ο δέκτης να μη μαντεύει από κείμενο.
   */
  correlation?: EmailDeliveryCorrelation;
}

export type { MailgunBounceClearance };

/**
 * **Βγάλε τη διεύθυνση από τη λίστα bounces του domain** (ADR-841 §7 Α21.20).
 *
 * 🔴 Μετά από hard bounce ο Mailgun **αρνείται σιωπηλά** κάθε επόμενη αποστολή (605) — η αποστολή
 * επιστρέφει 200 και το email **δεν φεύγει ποτέ**. Όταν ο άνθρωπος δηλώνει ότι διόρθωσε το
 * γραμματοκιβώτιο, το καθάρισμα **πρέπει** να προηγηθεί της αποστολής.
 */
export function clearMailgunBounce(address: string): Promise<MailgunBounceClearance> {
  return mailgunDeleteBounce(address);
}

/**
 * Send an email via the Mailgun egress door (from = ADR-857 Φ9 sender root, όριο χρόνου ADR-853 Φ5).
 *
 * @param params - Email parameters (to, subject, textBody)
 * @returns MailgunSendResult with success status and optional messageId
 */
export async function sendReplyViaMailgun(params: MailgunSendParams): Promise<MailgunSendResult> {
  const result = await mailgunSendMessage({
    to: params.to,
    subject: params.subject,
    text: params.textBody,
    html: params.htmlBody,
    attachments: params.attachments,
    correlation: params.correlation,
  });
  return result.ok ? { success: true, messageId: result.messageId } : { success: false, error: result.error };
}
