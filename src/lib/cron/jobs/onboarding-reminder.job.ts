/**
 * =============================================================================
 * JOB: onboarding-reminder — υπενθύμιση σε εταιρείες με ημιτελές onboarding
 * =============================================================================
 *
 * Σαρώνει εταιρείες όπου το onboarding παραλείφθηκε πριν πάνω από 7 ημέρες και δεν
 * ολοκληρώθηκε ποτέ, και στέλνει υπενθύμιση στον διαχειριστή.
 *
 * @module lib/cron/jobs/onboarding-reminder
 * @enterprise ADR-326 Phase 8
 * @see ADR-739
 */

import { findCompaniesNeedingReminder } from '@/services/onboarding/onboarding-state-service';
import { EmailAdapter } from '@/server/comms/email-adapter';
import { getPublicBaseUrl } from '@/lib/oauth/oauth-config';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('ONBOARDING_REMINDER_CRON');

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
  // ⚠️ Ήταν `process.env.NEXT_PUBLIC_APP_URL ?? 'https://nestor-app.vercel.app'` — δηλαδή
  // fallback σε **νεκρό** domain (το Vercel είναι παγωμένο από 2026-05-09). Κάθε
  // υπενθύμιση που θα στελνόταν χωρίς τη μεταβλητή θα έστελνε τον παραλήπτη σε πεθαμένο
  // σύνδεσμο — και το job θα ανέφερε `sent: N`, δηλαδή **επιτυχία**. Το `getPublicBaseUrl()`
  // είναι το SSoT και **ρίχνει** σε production αν λείπει η μεταβλητή: καλύτερα να αποτύχει
  // ορατά το job (και να χτυπήσει το Sentry monitor) παρά να σταλούν άχρηστα email.
  const configureUrl = `${getPublicBaseUrl()}/onboarding/organization`;
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

export interface OnboardingReminderReport {
  readonly sent: number;
  readonly errors: number;
  readonly skipped: number;
}

/**
 * Στέλνει υπενθύμιση σε κάθε επιλέξιμη εταιρεία.
 *
 * Η αποτυχία ενός παραλήπτη **δεν** ρίχνει τη σάρωση: μετριέται και η σάρωση συνεχίζει.
 * Ένα λάθος email σε μία εταιρεία δεν είναι λόγος να μη λάβουν οι υπόλοιπες.
 */
export async function sendOnboardingReminders(): Promise<OnboardingReminderReport> {
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

/** Προσαρμογέας για τον χρονοπρογραμματιστή. */
export async function runOnboardingReminder(): Promise<CronJobResult> {
  const report = await sendOnboardingReminders();

  // Μια σάρωση όπου **κάθε** αποστολή απέτυχε δεν είναι επιτυχία, όσο κι αν δεν
  // πέταξε εξαίρεση. Το ανεβάζουμε σε σφάλμα ώστε το Sentry monitor να το δει.
  if (report.errors > 0 && report.sent === 0) {
    throw new Error(
      `Onboarding reminder: όλες οι ${report.errors} αποστολές απέτυχαν`
    );
  }

  return {
    summary: `sent ${report.sent}, errors ${report.errors}`,
    metrics: { sent: report.sent, errors: report.errors, skipped: report.skipped },
  };
}
