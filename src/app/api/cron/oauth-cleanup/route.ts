/**
 * GET /api/cron/oauth-cleanup — εκκαθάριση ληγμένων εγγράφων OAuth
 *
 * Η *πολιτική* (τι σβήνεται, πότε, και γιατί όχι νωρίτερα) ζει ολόκληρη στο
 * `lib/oauth/oauth-cleanup.ts`. Εδώ μένει μόνο ο πυροκροτητής: ταυτοποίηση του
 * καλούντος και μεταφορά του αποτελέσματος. Λογική διαμοιρασμένη ανάμεσα σε
 * route και module θα σήμαινε ότι η απάντηση στο «πότε σβήνεται ένα token;»
 * απαιτεί ανάγνωση δύο αρχείων.
 *
 * @module api/cron/oauth-cleanup
 * @see ADR-738 §10
 */

import { type NextRequest, NextResponse } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { cleanupExpiredOAuthDocuments } from '@/lib/oauth/oauth-cleanup';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronOAuthCleanup');

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuthorization(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
