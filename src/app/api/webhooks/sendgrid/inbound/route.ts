/**
 * =============================================================================
 * 🏢 ENTERPRISE: SendGrid Inbound Parse Webhook
 * =============================================================================
 *
 * Receives incoming emails via SendGrid Inbound Parse and creates
 * in-app notifications for the admin.
 *
 * Setup Required:
 * 1. Configure MX record for your inbound domain (e.g., errors.nestor-app.com)
 * 2. Set up Inbound Parse in SendGrid dashboard pointing to this endpoint
 * 3. Set SENDGRID_INBOUND_WEBHOOK_SECRET env variable
 *
 * @endpoint POST /api/webhooks/sendgrid/inbound
 * @enterprise SendGrid Inbound Parse Integration
 * @created 2026-01-24
 */

import { NextRequest, NextResponse } from 'next/server';
import { createNotification } from '@/services/notificationService';
import { logWebhookEvent } from '@/lib/auth';
import {
  adminConfigService,
  isErrorReportingEnabled
} from '@/services/adminConfigService';
import type { Notification } from '@/types/notification';
import { withWebhookRateLimit } from '@/lib/middleware/with-rate-limit';

// =============================================================================
// CONFIGURATION
// =============================================================================

const NODE_ENV = process.env.NODE_ENV || 'development';
const SENDGRID_INBOUND_SECRET = process.env.SENDGRID_INBOUND_WEBHOOK_SECRET;
const MAX_PAYLOAD_SIZE = 25 * 1024 * 1024; // 25MB (emails can have attachments)
const WEBHOOK_TIMEOUT_MS = 30000;

// Rate limiting (in-memory - use Redis in production)
const inboundRateLimit = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // 100 emails per minute

// =============================================================================
// TYPES
// =============================================================================

interface SendGridInboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  sender_ip?: string;
  spam_score?: string;
  spam_report?: string;
  envelope?: string;
  charsets?: string;
  SPF?: string;
  attachments?: string; // Number of attachments
  'attachment-info'?: string; // JSON with attachment metadata
}

interface ParsedErrorReport {
  errorMessage?: string;
  errorDigest?: string;
  timestamp?: string;
  url?: string;
  stackTrace?: string;
  component?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = inboundRateLimit.get(ip);

  if (!limit || now > limit.resetTime) {
    inboundRateLimit.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  limit.count++;
  return true;
}

function sanitizeEmail(email: string): string {
  // Extract email from format "Name <email@domain.com>" or plain email
  const match = email.match(/<([^>]+)>/) || [null, email];
  return (match[1] || email).toLowerCase().trim().replace(/[<>]/g, '');
}

function sanitizeText(text: string, maxLength: number = 5000): string {
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\r\n/g, '\n')
    .trim()
    .substring(0, maxLength);
}

/**
 * Parse error report from email body
 * Extracts structured data from the error report format
 */
function parseErrorReport(text: string): ParsedErrorReport {
  const report: ParsedErrorReport = {};

  // Extract error message
  const errorMatch = text.match(/Error Message:\s*(.+?)(?:\n|$)/i);
  if (errorMatch) {
    report.errorMessage = errorMatch[1].trim();
  }

  // Extract error digest (unique identifier)
  const digestMatch = text.match(/Error Digest:\s*(.+?)(?:\n|$)/i);
  if (digestMatch && digestMatch[1].trim() !== 'N/A') {
    report.errorDigest = digestMatch[1].trim();
  }

  // Extract timestamp
  const timestampMatch = text.match(/Timestamp:\s*(.+?)(?:\n|$)/i);
  if (timestampMatch) {
    report.timestamp = timestampMatch[1].trim();
  }

  // Extract URL
  const urlMatch = text.match(/URL:\s*(.+?)(?:\n|$)/i);
  if (urlMatch) {
    report.url = urlMatch[1].trim();
  }

  // Extract component (from subject or body)
  const componentMatch = text.match(/Component:\s*(.+?)(?:\n|$)/i) ||
                         text.match(/ERROR REPORT - (.+?)(?:\n|$)/i);
  if (componentMatch) {
    report.component = componentMatch[1].trim();
  }

  // Extract stack trace (everything after "Stack Trace:")
  const stackMatch = text.match(/Stack Trace:\s*\n([\s\S]*?)(?:\n---|\n\n|$)/i);
  if (stackMatch) {
    report.stackTrace = stackMatch[1].trim().substring(0, 2000);
  }

  return report;
}

/**
 * Determine notification severity based on email content
 */
function determineSeverity(subject: string, text: string): 'error' | 'warning' | 'info' {
  const lowerSubject = subject.toLowerCase();
  const lowerText = text.toLowerCase();

  if (lowerSubject.includes('critical') || lowerSubject.includes('🚨')) {
    return 'error';
  }

  if (lowerSubject.includes('error') || lowerText.includes('uncaught') || lowerText.includes('exception')) {
    return 'error';
  }

  if (lowerSubject.includes('warning') || lowerSubject.includes('⚠️')) {
    return 'warning';
  }

  return 'info';
}

/**
 * Verify basic authentication (simple token check)
 * SendGrid Inbound Parse doesn't support HMAC, but you can add a query parameter
 */
function verifyInboundAuth(request: NextRequest): boolean {
  if (!SENDGRID_INBOUND_SECRET) {
    console.warn('⚠️ SENDGRID_INBOUND_WEBHOOK_SECRET not configured');
    return NODE_ENV === 'development';
  }

  // Check for token in query parameter or header
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  const tokenHeader = request.headers.get('x-webhook-token');

  const providedToken = tokenParam || tokenHeader;

  if (!providedToken) {
    console.warn('⚠️ No authentication token provided');
    return NODE_ENV === 'development';
  }

  return providedToken === SENDGRID_INBOUND_SECRET;
}

function logInboundAttempt(
  ip: string,
  success: boolean,
  from?: string,
  error?: string,
  duration?: number
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'sendgrid_inbound',
    ip,
    success,
    from: from ? sanitizeEmail(from) : undefined,
    error: error?.substring(0, 200),
    duration,
    environment: NODE_ENV
  };

  if (success) {
    console.log('✅ SendGrid inbound email processed:', JSON.stringify(logEntry));
  } else {
    console.error('❌ SendGrid inbound email error:', JSON.stringify(logEntry));
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * SendGrid Inbound Parse webhook handler
 * @rateLimit WEBHOOK (30 req/min) - SendGrid inbound email processing
 */
async function postHandler(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  try {
    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      logInboundAttempt(clientIP, false, undefined, 'Rate limit exceeded');
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // Check payload size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      logInboundAttempt(clientIP, false, undefined, 'Payload too large');
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    // Verify authentication
    if (!verifyInboundAuth(request)) {
      logInboundAttempt(clientIP, false, undefined, 'Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse form data (SendGrid sends multipart/form-data)
    const contentType = request.headers.get('content-type') || '';

    let emailData: SendGridInboundEmail;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      emailData = {
        from: formData.get('from') as string || '',
        to: formData.get('to') as string || '',
        subject: formData.get('subject') as string || '',
        text: formData.get('text') as string || '',
        html: formData.get('html') as string || undefined,
        sender_ip: formData.get('sender_ip') as string || undefined,
        spam_score: formData.get('spam_score') as string || undefined,
        envelope: formData.get('envelope') as string || undefined,
        SPF: formData.get('SPF') as string || undefined,
        attachments: formData.get('attachments') as string || undefined,
      };
    } else if (contentType.includes('application/json')) {
      emailData = await request.json();
    } else {
      // Try to parse as form-urlencoded
      const text = await request.text();
      const params = new URLSearchParams(text);
      emailData = {
        from: params.get('from') || '',
        to: params.get('to') || '',
        subject: params.get('subject') || '',
        text: params.get('text') || '',
        html: params.get('html') || undefined,
        sender_ip: params.get('sender_ip') || undefined,
      };
    }

    // Validate required fields
    if (!emailData.from || !emailData.subject) {
      logInboundAttempt(clientIP, false, emailData.from, 'Missing required fields');
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`📧 Received inbound email from: ${sanitizeEmail(emailData.from)}`);
    console.log(`📧 Subject: ${emailData.subject.substring(0, 100)}`);

    // Check spam score (reject high spam)
    const spamScore = parseFloat(emailData.spam_score || '0');
    if (spamScore > 5) {
      console.warn(`⚠️ High spam score (${spamScore}), rejecting email`);
      logInboundAttempt(clientIP, false, emailData.from, `High spam score: ${spamScore}`);
      return NextResponse.json({ error: 'Email rejected as spam' }, { status: 400 });
    }

    // Parse the error report from email body
    const emailBody = emailData.text || sanitizeText(emailData.html || '');
    const errorReport = parseErrorReport(emailBody);
    const severity = determineSeverity(emailData.subject, emailBody);

    // 🏢 ENTERPRISE: Check if error reporting is enabled
    const errorReportingEnabled = await isErrorReportingEnabled();
    if (!errorReportingEnabled) {
      console.log('⚠️ Error reporting disabled - skipping notification creation');
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Error reporting disabled in system configuration'
      });
    }

    // Get admin UID for notification targeting (enterprise config)
    const adminUid = await adminConfigService.getAdminUid();

    // Create notification for admin
    const notification: Omit<Notification, 'id'> = {
      tenantId: 'default',
      userId: adminUid,
      createdAt: new Date().toISOString(),
      severity,
      title: `📧 ${emailData.subject.substring(0, 100)}`,
      body: errorReport.errorMessage || emailBody.substring(0, 500),
      bodyRich: {
        type: 'markdown',
        content: `
**Από:** ${sanitizeEmail(emailData.from)}
**Ώρα:** ${errorReport.timestamp || new Date().toISOString()}
${errorReport.url ? `**URL:** ${errorReport.url}` : ''}
${errorReport.errorDigest ? `**Digest:** \`${errorReport.errorDigest}\`` : ''}
${errorReport.component ? `**Component:** ${errorReport.component}` : ''}

---

${errorReport.errorMessage || emailBody.substring(0, 1000)}

${errorReport.stackTrace ? `\n\`\`\`\n${errorReport.stackTrace.substring(0, 500)}\n\`\`\`` : ''}
        `.trim()
      },
      tags: ['error-report', 'email-inbound', errorReport.errorDigest || 'no-digest'].filter(Boolean),
      source: {
        service: 'sendgrid-inbound',
        feature: 'error-reporting',
        env: NODE_ENV as 'dev' | 'staging' | 'prod'
      },
      actions: errorReport.url ? [
        {
          id: 'view-page',
          label: 'Προβολή Σελίδας',
          url: errorReport.url
        }
      ] : undefined,
      channel: 'inapp',
      delivery: {
        state: 'delivered',
        attempts: 1
      },
      meta: {
        correlationId: errorReport.errorDigest,
        requestId: `inbound-${Date.now()}`
      }
    };

    // Save notification with timeout
    const savePromise = createNotification(notification);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Firestore timeout')), WEBHOOK_TIMEOUT_MS)
    );

    const notificationId = await Promise.race([savePromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    logInboundAttempt(clientIP, true, emailData.from, undefined, duration);

    // Audit logging (non-blocking)
    logWebhookEvent(
      'sendgrid-inbound',
      notificationId,
      {
        from: sanitizeEmail(emailData.from),
        subject: emailData.subject.substring(0, 100),
        errorDigest: errorReport.errorDigest,
        severity,
        spamScore,
        duration,
        success: true
      },
      request
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    console.log(`✅ Created notification ${notificationId} for error report`);

    return NextResponse.json({
      success: true,
      notificationId,
      errorDigest: errorReport.errorDigest,
      severity
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logInboundAttempt(clientIP, false, undefined, errorMessage, duration);

    // Audit logging for failure (non-blocking)
    logWebhookEvent(
      'sendgrid-inbound',
      'error-inbound',
      {
        error: errorMessage,
        duration,
        clientIP,
        success: false
      },
      request
    ).catch((err: unknown) => {
      console.error('⚠️ Audit logging failed (non-blocking):', err);
    });

    console.error('❌ SendGrid inbound webhook error:', error);

    return NextResponse.json(
      { error: 'Webhook processing failed', message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const POST = withWebhookRateLimit(postHandler);

// =============================================================================
// HEALTH CHECK
// =============================================================================

/**
 * Health check endpoint for SendGrid inbound webhook
 * @rateLimit WEBHOOK (30 req/min) - Health check
 */
async function getHandler(request: NextRequest) {
  const clientIP = getClientIP(request);

  console.log('🔍 SendGrid inbound webhook health check from:', clientIP);

  // 🏢 ENTERPRISE: Get admin config for health check response
  let adminEmail = 'not-configured';
  let errorReportingEnabled = false;
  try {
    const adminConfig = await adminConfigService.getConfiguration();
    adminEmail = adminConfig.adminEmail;
    errorReportingEnabled = adminConfig.enableErrorReporting;
  } catch {
    console.warn('⚠️ Could not load admin config for health check');
  }

  return NextResponse.json({
    status: 'healthy',
    service: 'sendgrid-inbound-webhook',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: {
      authentication: !!SENDGRID_INBOUND_SECRET,
      rate_limiting: true,
      spam_filtering: true,
      notification_creation: true,
      error_reporting_enabled: errorReportingEnabled
    },
    security: {
      max_payload_size: `${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
      timeout: `${WEBHOOK_TIMEOUT_MS / 1000}s`,
      rate_limit: `${RATE_LIMIT_MAX_REQUESTS}/minute`,
      spam_threshold: 5
    },
    admin: {
      email: adminEmail,
      config_source: 'firestore'
    }
  });
}

export const GET = withWebhookRateLimit(getHandler);
