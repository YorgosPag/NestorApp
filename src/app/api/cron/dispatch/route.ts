/**
 * GET /api/cron/dispatch — το χτύπημα ρολογιού του χρονοπρογραμματιστή (ADR-739)
 *
 * Καλείται **μία φορά το λεπτό** από μία Coolify Scheduled Task:
 *
 * ```
 * node -e "fetch('http://127.0.0.1:3000/api/cron/dispatch',{headers:{
 *   'x-cron-secret':process.env.CRON_SECRET,
 *   'user-agent':'nestor-scheduler/1'}}).then(r=>process.exit(r.ok?0:1))"
 * ```
 *
 * ⚠️ **`node -e`, όχι `curl`/`wget`.** Το `node:22-alpine` δεν έχει curl, και το `wget`
 * είναι στη `BLOCKED_BOT_PATTERNS` του `middleware.ts` μαζί με το `curl/` — θα έτρωγε
 * **403 από το Edge** πριν τρέξει γραμμή, σφάλμα που μοιάζει με «λάθος διαπιστευτήρια»
 * και δεν είναι. Ο ρητός user-agent το λύνει χωρίς να χρειαστεί εξαίρεση στο
 * `isMachineEndpoint`.
 *
 * Ο πυροκροτητής δεν περιέχει λογική: αξιολόγηση προγράμματος, κλείδωμα και check-ins
 * ζουν στο `lib/cron/`. Έτσι το «τι τρέχει πότε» απαντιέται διαβάζοντας **ένα** αρχείο
 * (`src/config/cron-schedule.ts`) — που είναι ολόκληρο το νόημα του ADR-739.
 *
 * @module api/cron/dispatch
 * @see ADR-739
 */

import { type NextRequest, NextResponse } from 'next/server';

import { rejectUnauthorizedCron } from '@/lib/cron-auth';
import { dispatchCronTick } from '@/lib/cron/cron-dispatcher';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('CronDispatch');

/**
 * Το όριο υπάρχει για τη μακρύτερη εργασία (backup, `maxRuntimeMinutes: 45`).
 *
 * ⚠️ Το `maxDuration` είναι σημασιολογία **Vercel serverless**· σε Docker/Netcup ο
 * πραγματικός περιοριστής είναι ο reverse proxy. Δηλώνεται για ειλικρίνεια της
 * πρόθεσης, όχι επειδή επιβάλλεται εδώ.
 */
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  try {
    const report = await dispatchCronTick();

    // Σιωπή όταν δεν οφείλεται τίποτα: ~1.430 από τα 1.440 λεπτά της ημέρας δεν έχουν
    // δουλειά, και μια γραμμή log ανά λεπτό θα έπνιγε τις γραμμές που έχουν σημασία.
    if (report.due.length > 0) {
      logger.info('Cron tick executed', {
        due: report.due,
        outcomes: report.outcomes,
        durationMs: report.durationMs,
      });
    }

    return NextResponse.json({ success: true, ...report });
  } catch (error) {
    const message = getErrorMessage(error, 'Cron dispatch failed');
    logger.error(`Cron dispatch error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
