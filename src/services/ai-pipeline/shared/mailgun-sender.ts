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

/** Parameters for sending an email */
export interface MailgunSendParams {
  to: string;
  subject: string;
  textBody: string;
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

  // Derive "from" address: noreply@{MAILGUN_DOMAIN} (nestorconstruct.gr)
  const fromEmail = process.env.MAILGUN_FROM_EMAIL?.trim()
    ?? `noreply@${domain}`;

  const region = process.env.MAILGUN_REGION === 'eu'
    ? 'api.eu.mailgun.net'
    : 'api.mailgun.net';
  const url = `https://${region}/v3/${domain}/messages`;

  try {
    const formData = new FormData();
    formData.append('from', fromEmail);
    formData.append('to', params.to);
    formData.append('subject', params.subject);
    formData.append('text', params.textBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
      },
      body: formData,
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
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Mailgun send failed', {
      error: msg,
      to: params.to,
    });
    return { success: false, error: msg };
  }
}
