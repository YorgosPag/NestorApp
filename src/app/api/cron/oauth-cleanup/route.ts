/**
 * GET /api/cron/oauth-cleanup — εκκαθάριση ληγμένων εγγράφων OAuth
 *
 * Η *πολιτική* (τι σβήνεται, πότε, και γιατί όχι νωρίτερα) ζει ολόκληρη στο
 * `lib/oauth/oauth-cleanup.ts`. Εδώ μένει μόνο ο πυροκροτητής: ταυτοποίηση του
 * καλούντος και μεταφορά του αποτελέσματος. Λογική διαμοιρασμένη ανάμεσα σε
 * route και module θα σήμαινε ότι η απάντηση στο «πότε σβήνεται ένα token;»
 * απαιτεί ανάγνωση δύο αρχείων.
 *
 * ⚠️ **Μην πειράξεις τα δύο παράθυρα διατήρησης** (ADR-738 §10.1) — το δεύτερο
 * τροφοδοτεί ανιχνευτή επαναχρησιμοποίησης κωδικού· συντόμευσή του σπάει τον
 * ανιχνευτή κλοπής.
 *
 * ℹ️ Το path παραμένει **ονομαστική** εξαίρεση στο `isMachineEndpoint` του
 * `middleware.ts`, ώστε να είναι δοκιμάσιμο χειροκίνητα με `curl`. Ο
 * χρονοπρογραμματιστής **δεν** το χρειάζεται: καλεί τη συνάρτηση απευθείας.
 *
 * @module api/cron/oauth-cleanup
 * @see ADR-738 §10
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (06:00 Europe/Athens)
 */

import { type NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { cleanupExpiredOAuthDocuments } from '@/lib/oauth/oauth-cleanup';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronOAuthCleanup');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const report = await cleanupExpiredOAuthDocuments();

    return NextResponse.json({
      success: true,
      totalDeleted: report.totalDeleted,
      durationMs: report.durationMs,
      results: report.results,
    });
  } catch (error) {
    const message = getErrorMessage(error, 'OAuth cleanup failed');
    logger.error(`OAuth cleanup error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
