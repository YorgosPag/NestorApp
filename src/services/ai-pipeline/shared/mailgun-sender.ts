/**
 * =============================================================================
 * 🏢 ENTERPRISE: CENTRALIZED MAILGUN EMAIL SENDER
 * =============================================================================
 *
 * Shared utility for sending reply emails via Mailgun API.
 * Used by all UC modules that need to send outbound emails after pipeline execution.
 *
 * Uses server-side env vars (MAILGUN_API_KEY, MAILGUN_DOMAIN).
 * Supports EU and US Mailgun regions.
 *
 * @module services/ai-pipeline/shared/mailgun-sender
 * @see UC-001 (Appointment Request)
 * @see UC-003 (Property Search)
 * @see ADR-080 (Pipeline Implementation)
 */

import 'server-only';

import { createModuleLogger } from '@/lib/telemetry/Logger';
import { getErrorMessage } from '@/lib/error-utils';
import { PROVIDER_TIMEOUT_MS } from '@/server/comms/email-provider-chain';
import { resolveSenderHeader } from '@/services/company/sender-identity';
import { EMAIL_DELIVERY_VARIABLES, type EmailDeliveryCorrelation } from '@/types/email-delivery';

const logger = createModuleLogger('PIPELINE_MAILGUN_SENDER');

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

/** Όριο της ταυτότητας συσχέτισης — ο Mailgun κόβει τις μεταβλητές πάνω από 4KB στα webhooks. */
const CORRELATION_REF_MAX = 200;

function appendCorrelation(formData: FormData, correlation: EmailDeliveryCorrelation | undefined): void {
  if (correlation === undefined) return;
  const ref = correlation.ref.trim();
  if (ref === '' || ref.length > CORRELATION_REF_MAX) return;
  formData.append(`v:${EMAIL_DELIVERY_VARIABLES.purpose}`, correlation.purpose);
  formData.append(`v:${EMAIL_DELIVERY_VARIABLES.ref}`, ref);
}

function mailgunBaseUrl(domain: string): string {
  const region = process.env.MAILGUN_REGION === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
  return `https://${region}/v3/${domain}`;
}

function mailgunAuthorization(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`;
}

export type MailgunBounceClearance = 'cleared' | 'not-listed' | 'failed';

/**
 * **Βγάλε τη διεύθυνση από τη λίστα bounces του domain** (ADR-841 §7 Α21.20).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: μετά από hard bounce ο Mailgun **αρνείται σιωπηλά** κάθε επόμενη αποστολή στη
 * διεύθυνση (605 «Not delivering to previously bounced address») — η αποστολή επιστρέφει 200 και το
 * email **δεν φεύγει ποτέ**. Όταν ο άνθρωπος δηλώνει ρητά ότι διόρθωσε το γραμματοκιβώτιο, το
 * καθάρισμα **πρέπει** να προηγηθεί της αποστολής — αλλιώς το «στάλθηκε» είναι ψέμα.
 *
 * `404` = δεν ήταν στη λίστα ⇒ `not-listed` (καμία βλάβη).
 */
export async function clearMailgunBounce(address: string): Promise<MailgunBounceClearance> {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  if (!apiKey || !domain) return 'failed';
  try {
    const response = await fetch(`${mailgunBaseUrl(domain)}/bounces/${encodeURIComponent(address)}`, {
      method: 'DELETE',
      headers: { Authorization: mailgunAuthorization(apiKey) },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (response.status === 404) return 'not-listed';
    if (response.ok) return 'cleared';
    logger.error('Mailgun bounce clearance refused', { status: response.status });
    return 'failed';
  } catch (error) {
    logger.error('Mailgun bounce clearance failed', { error: getErrorMessage(error) });
    return 'failed';
  }
}

// ============================================================================
// MAILGUN SENDER
// ============================================================================

/**
 * Send a reply email via Mailgun API.
 *
 * Reads configuration from environment variables:
 * - MAILGUN_API_KEY: API key for authentication
 * - MAILGUN_DOMAIN: Sending domain (e.g. nestorconstruct.gr)
 * - MAILGUN_FROM_EMAIL: From address (fallback: noreply@{domain})
 * - MAILGUN_REGION: 'eu' or 'us' (default: eu)
 *
 * @param params - Email parameters (to, subject, textBody)
 * @returns MailgunSendResult with success status and optional messageId
 */
export async function sendReplyViaMailgun(
  params: MailgunSendParams
): Promise<MailgunSendResult> {
  const apiKey = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();

  if (!apiKey || !domain) {
    return {
      success: false,
      error: 'Mailgun not configured: missing MAILGUN_API_KEY or MAILGUN_DOMAIN',
    };
  }

  // 🔴 ADR-857 Φ9 — **ΑΥΤΗ Η ΓΡΑΜΜΗ ΕΣΤΕΛΝΕ >20 ΣΗΜΕΙΑ ΧΩΡΙΣ ΚΑΝΕΝΑ ΟΝΟΜΑ.**
  //    Ήταν `noreply@{MAILGUN_DOMAIN}` — **γυμνή διεύθυνση**, χωρίς όνομα εμφάνισης, ενώ
  //    από εδώ φεύγουν τιμολόγια, προσφορές, προσκλήσεις χώρου και email ταυτοποίησης.
  //    Ο παραλήπτης έβλεπε `noreply@…` εκεί όπου άλλες διαδρομές έλεγαν «Nestor App».
  // 🔑 Το όνομα εμφάνισης **δεν** επηρεάζει παραδοσιμότητα (αυτή κρίνεται από
  //    SPF/DKIM/DMARC στο **domain**) — επηρεάζει **αναγνωρισιμότητα**. Άρα η προσθήκη
  //    του είναι κέρδος χωρίς ρίσκο· η **διεύθυνση** μένει στο ίδιο επαληθευμένο domain.
  const fromEmail = resolveSenderHeader();

  const url = `${mailgunBaseUrl(domain)}/messages`;

  try {
    const formData = new FormData();
    formData.append('from', fromEmail);
    formData.append('to', params.to);
    formData.append('subject', params.subject);
    formData.append('text', params.textBody);
    if (params.htmlBody) {
      formData.append('html', params.htmlBody);
    }
    appendCorrelation(formData, params.correlation);
    if (params.attachments && params.attachments.length > 0) {
      for (const attachment of params.attachments) {
        const blob = attachment.content instanceof Blob
          ? attachment.content
          : new Blob([new Uint8Array(attachment.content)], { type: attachment.contentType });
        formData.append('attachment', blob, attachment.filename);
      }
    }

    // 🔴 **ΤΟ ΟΡΙΟ ΧΡΟΝΟΥ ΕΛΕΙΠΕ, ΚΑΙ ΤΟ ΠΛΗΡΩΝΑΝ ΚΑΙ ΟΙ ΕΝΝΕΑ ΚΑΤΑΝΑΛΩΤΕΣ** (2026-09-12,
    //    ADR-853 Φ5). Η κλήση ήταν **γυμνό `fetch`**: η συνηθέστερη βλάβη παρόχου δεν είναι
    //    το «όχι», είναι η **σιωπή** — και χωρίς όριο η σιωπή γίνεται αίτημα που δεν
    //    τελειώνει. Το ίδιο ακριβώς περιστατικό είναι ήδη γραμμένο στο έργο (2026-04-19,
    //    *«Resend hung silently → 408 in UI»*) και γέννησε το `PROVIDER_TIMEOUT_MS`· εκείνο
    //    όμως φυλούσε **μόνο** την αλυσίδα παρόχων, ενώ **αυτός** ο αποστολέας — που τον
    //    καλούν τα email λογαριασμού, η πρώτη επαφή, τα τιμολόγια και πλέον η πρόσκληση —
    //    ήταν **αφύλακτος**.
    // 🔑 **Η ΙΔΙΑ σταθερά, όχι δεύτερος αριθμός** (ADR-749): δύο όρια για το ίδιο ερώτημα
    //    θα απέκλιναν με την πρώτη ρύθμιση.
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      },
      body: formData,
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Mailgun API error', {
        status: response.status,
        body: errorText.slice(0, 500),
        to: params.to,
      });
      return {
        success: false,
        error: `Mailgun API ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    const result = await response.json() as { id?: string; message?: string };

    logger.info('Email sent via Mailgun', {
      messageId: result.id,
      to: params.to,
      subject: params.subject.slice(0, 100),
    });

    return {
      success: true,
      messageId: result.id ?? undefined,
    };
  } catch (error) {
    const msg = getErrorMessage(error);
    logger.error('Mailgun send failed', {
      error: msg,
      to: params.to,
    });
    return { success: false, error: msg };
  }
}
