/**
 * =============================================================================
 * ΔΙΑΔΡΟΜΗ CRON ΣΑΡΩΣΗΣ — GET wiring για τους πυροκροτητές εργασιών (ADR-740)
 * =============================================================================
 *
 * Αδελφό module του `queue-cron-route.ts`. Εκείνο τυποποιεί τις διαδρομές
 * **ουράς** (που εκθέτουν και υγεία)· αυτό τυποποιεί τις διαδρομές **σάρωσης**:
 * μια εργασία τρέχει, επιστρέφει `CronJobResult`, τέλος.
 *
 *   GET + εξουσιοδότηση → force run ΜΕΣΑ από τον executor (lease + monitor + κατάσταση)
 *   GET χωρίς           → `200` liveness probe, **καμία** σάρωση, **κανένα** δεδομένο
 *
 * 🔴 ADR-777 §8.69.14 — **μέχρι 2026-09-15 εδώ καλούνταν το `run()` ΩΜΑ**: χωρίς lease, χωρίς
 * Sentry monitor, χωρίς κατάσταση. Χειροκίνητο + προγραμματισμένο μαζί ⇒ διπλή εκτέλεση. Πλέον
 * περνά από το `runCronJobNow` (`cron-job-executor.ts`), τον **ίδιο** executor με το ρολόι.
 * Κλήση: `npm run cron:run -- <slug>` (ποτέ `curl` — βλ. ADR-740 §9).
 *
 * ⚠️ **Γεννήθηκε από το CHECK 3.28**, όπως και το αδελφό του: μόλις το §8.23
 * πρόσθεσε δύο πυροκροτητές (`demand-interest-announce`, `outbound-email-flush`),
 * το jscpd εντόπισε τα δίδυμα **μέσα στο ίδιο commit**. Ένας φύλακας γραμμένος δύο
 * φορές είναι ένας φύλακας που θα διορθωθεί μία.
 *
 * @module lib/cron/scan-cron-route
 * @see lib/cron/queue-cron-route — το αδελφό, για διαδρομές ουράς
 * @see ADR-740 · ADR-777 §8.23 · §8.69.14
 */

import { NextResponse, type NextRequest } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { runCronJobNow } from '@/lib/cron/cron-job-executor';
import { cronRunHttpStatus, cronRunResponseFields, logCronRunOutcome } from '@/lib/cron/cron-run-response';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

export interface ScanCronRouteOptions {
  /**
   * Το slug της εργασίας στο `CRON_SCHEDULE` — **ίδιο με τον φάκελο του route** (το επιβάλλει
   * το `cron-route-contract.test.ts`). Είναι το κλειδί του lease και του monitor.
   */
  readonly slug: string;
  /** Ταυτότητα υπηρεσίας στο probe, π.χ. `outbound-email-flush`. */
  readonly service: string;
  /** Φράση για τα logs, π.χ. `Outbound email flush`. */
  readonly label: string;
  readonly logger: ModuleLogger;
  /** Η εργασία. **Καθαρή συνάρτηση — καμία γνώση HTTP.** */
  readonly run: () => Promise<CronJobResult>;
}

export interface ScanCronRoute {
  readonly GET: (request: NextRequest) => Promise<Response> | Response;
}

/**
 * Φτιάχνει τον `GET` ενός πυροκροτητή σάρωσης.
 *
 * ⚠️ Η μη εξουσιοδοτημένη κλήση επιστρέφει `200` με `authorized: false` —
 * **σκόπιμα**, ως liveness probe. Δεν είναι χαλάρωση: το σώμα δεν περιέχει κανένα
 * δεδομένο και **καμία εργασία δεν ξεκινά**.
 *
 * 🔴 **ΔΙΟΡΘΩΣΗ ΙΣΧΥΡΙΣΜΟΥ (§8.27)**: η επιλογή `200` **κρατήθηκε** μετά τη μέτρηση επειδή το
 * αδελφό `queue-cron-route` κάνει ήδη το ίδιο σε `GET` — **ένα** σχήμα σε ολόκληρη την
 * οικογένεια cron (ADR-749), όχι επειδή «το κάνουν όλα» (δεν το έκαναν).
 */
export function createScanCronRoute(options: ScanCronRouteOptions): ScanCronRoute {
  async function handleGET(request: NextRequest): Promise<Response> {
    if (!verifyCronAuthorization(request)) {
      return NextResponse.json({
        ok: true,
        service: options.service,
        authorized: false,
        message: 'Health check — authorization required for scan',
      });
    }

    const startTime = Date.now();
    options.logger.info(`${options.label} triggered`, { slug: options.slug });

    try {
      const outcome = await runCronJobNow({ slug: options.slug, run: options.run });
      const elapsedMs = Date.now() - startTime;
      logCronRunOutcome(options.logger, options.label, outcome, elapsedMs);

      return NextResponse.json(
        { ...cronRunResponseFields(outcome), elapsedMs },
        { status: cronRunHttpStatus(outcome) },
      );
    } catch (error) {
      // Μόνο αν σκάσει ο ίδιος ο executor (π.χ. η συναλλαγή lease) — η αποτυχία της ΕΡΓΑΣΙΑΣ είναι `failed`.
      const elapsedMs = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);

      options.logger.error(`${options.label} error`, { error: errorMessage, elapsedMs });

      return NextResponse.json({ ok: false, error: errorMessage, elapsedMs }, { status: 500 });
    }
  }

  return { GET: withSensitiveRateLimit(handleGET) };
}
