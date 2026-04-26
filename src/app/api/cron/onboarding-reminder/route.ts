/**
 * =============================================================================
 * CRON: ONBOARDING REMINDER — ADR-326 Phase 8
 * =============================================================================
 *
 * GET /api/cron/onboarding-reminder
 * Triggered daily at 05:00 UTC by Vercel Cron.
 *
 * Scans all companies where:
 *   - settings.onboarding.skippedAt is set
 *   - settings.onboarding.completedAt is null
 *   - skippedAt is more than 7 days ago
 *
 * For each eligible company, sends a reminder email to the company_admin.
 *
 * Configuration in vercel.json:
 * ```json
 * { "path": "/api/cron/onboarding-reminder", "schedule": "0 5 * * *" }
 * ```
 *
 * @module api/cron/onboarding-reminder
 * @enterprise ADR-326 Phase 8
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { verifyCronAuthorization } from '@/lib/cron-auth';
import { getErrorMessage } from '@/lib/error-utils';
import { findCompaniesNeedingReminder } from '@/services/onboarding/onboarding-state-service';
import { EmailAdapter } from '@/server/comms/email-adapter';

const logger = createModuleLogger('ONBOARDING_REMINDER_CRON');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app';

// ─── Email builder ────────────────────────────────────────────────────────────

const REMINDER_TEXTS = {
  subject: 'Υπενθύμιση: Ρύθμιση δομής οργανισμού Nestor',
  greeting: 'Αγαπητέ διαχειριστή,',
  bodyShort: 'Το τμήμα Λογιστηρίου δεν έχει ρυθμιστεί εντός 7 ημερών.',
  bodyLong: 'Το τμήμα Λογιστηρίου δεν έχει ρυθμιστεί εντός 7 ημερών από την αρχική πρόσκληση.',
  bodyAction: 'Παρακαλούμε συνδεθείτε και ολοκληρώστε τη ρύθμιση:',
  cta: 'Ρύθμιση τώρα',
  footer: 'Αυτό το μήνυμα στάλθηκε αυτόματα από το Nestor.',
} as const;

function buildReminderEmail(adminEmail: string): Parameters<EmailAdapter['sendEmail']>[0] {
  const configureUrl = `${APP_URL}/onboarding/organization`;
  const t = REMINDER_TEXTS;

  return {
    id: `onboarding-reminder-${adminEmail}-${Date.now()}`,
    to: adminEmail,
    subject: t.subject,
    content: [t.greeting, '', t.bodyShort, t.bodyAction, configureUrl, '', t.footer].join('\n'),
    html: [
      `<p>${t.greeting}</p>`,
      `<p>${t.bodyLong}</p>`,
      `<p><a href="${configureUrl}" style="font-weight:bold">${t.cta}</a></p>`,
      `<p style="color:#888;font-size:12px">${t.footer}</p>`,
    ].join('\n'),
    attempts: 1,
    maxAttempts: 3,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handleScan(): Promise<{ sent: number; errors: number; skipped: number }> {
  const candidates = await findCompaniesNeedingReminder();
  const adapter = new EmailAdapter();

  let sent = 0;
  let errors = 0;
  const skipped = 0;

  for (const { companyId, adminEmail } of candidates) {
    try {
      const result = await adapter.sendEmail(buildReminderEmail(adminEmail));

      if (result.success) {
        logger.info('Reminder sent', { companyId, adminEmail });
        sent++;
      } else {
        logger.warn('Reminder send failed', { companyId, adminEmail, error: result.error });
        errors++;
      }
    } catch (err) {
      logger.error('Reminder send threw', { companyId, err: getErrorMessage(err) });
      errors++;
    }
  }

  return { sent, errors, skipped };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({
      ok: true,
      service: 'onboarding-reminder',
      authorized: false,
      message: 'Health check — authorization required for scan',
    });
  }

  const startTime = Date.now();
  const userAgent = request.headers.get('user-agent') ?? '';
  const trigger = userAgent.includes('vercel-cron') ? 'vercel-cron' : 'api-call';

  logger.info('Onboarding reminder scan triggered', { trigger });

  try {
    const result = await handleScan();
    const elapsedMs = Date.now() - startTime;

    logger.info('Onboarding reminder scan completed', { ...result, trigger, elapsedMs });

    return NextResponse.json({ ok: true, trigger, ...result, elapsedMs });
  } catch (err) {
    const errorMessage = getErrorMessage(err);
    logger.error('Onboarding reminder cron failed', { errorMessage });

    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
