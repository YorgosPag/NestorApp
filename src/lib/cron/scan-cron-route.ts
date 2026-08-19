/**
 * =============================================================================
 * ΔΙΑΔΡΟΜΗ CRON ΣΑΡΩΣΗΣ — GET wiring για τους πυροκροτητές εργασιών (ADR-740)
 * =============================================================================
 *
 * Αδελφό module του `queue-cron-route.ts`. Εκείνο τυποποιεί τις διαδρομές
 * **ουράς** (που εκθέτουν και υγεία)· αυτό τυποποιεί τις διαδρομές **σάρωσης**:
 * μια εργασία τρέχει, επιστρέφει `CronJobResult`, τέλος.
 *
 *   GET + εξουσιοδότηση → τρέξε τη σάρωση, επίστρεψε περίληψη + metrics
 *   GET χωρίς           → `200` liveness probe, **καμία** σάρωση, **κανένα** δεδομένο
 *
 * ⚠️ **Γεννήθηκε από το CHECK 3.28**, όπως και το αδελφό του: μόλις το §8.23
 * πρόσθεσε δύο πυροκροτητές (`demand-interest-announce`, `outbound-email-flush`),
 * το jscpd εντόπισε τα δίδυμα **μέσα στο ίδιο commit**. Ο κανόνας N.18 λέει ότι
 * αυτό δεν επιτρέπεται να φύγει ως «done» — και έχει δίκιο: το διπλότυπο εδώ
 * περιέχει τον **έλεγχο πρόσβασης** σε διαδρομές που **στέλνουν email σε
 * ανθρώπους**. Ένας φύλακας γραμμένος δύο φορές είναι ένας φύλακας που θα
 * διορθωθεί μία.
 *
 * 🔶 **Ονομασμένη ευκαιρία, μη εκτελεσμένη**: το ίδιο σχήμα το επαναλαμβάνουν
 * **επτά** προϋπάρχουσες διαδρομές (`overdue-alerts` · `backup` · `file-purge` ·
 * `oauth-cleanup` · `purge-deleted-entities` · `onboarding-reminder` ·
 * `ai-learning`). Δεν μεταναστεύτηκαν εδώ **σκόπιμα**: είναι ξένος κώδικας σε
 * σχέση με το §8.23, η αλλαγή τους δεν έχει καμία σχέση με τη ζήτηση ακινήτων,
 * και επτά ταυτόχρονες μεταναστεύσεις σε διαδρομές παραγωγής είναι ρίσκο που
 * κανείς δεν ζήτησε. Είναι καθαρή, μηχανική δουλειά για δικό της πέρασμα.
 *
 * @module lib/cron/scan-cron-route
 * @see lib/cron/queue-cron-route — το αδελφό, για διαδρομές ουράς
 * @see ADR-740 · ADR-777 §8.23
 */

import { NextResponse, type NextRequest } from 'next/server';

import { verifyCronAuthorization } from '@/lib/cron-auth';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

export interface ScanCronRouteOptions {
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
 * **σκόπιμα**, ως liveness probe, και είναι η διατηρημένη συμπεριφορά όλων των
 * αδελφών cron routes. Δεν είναι χαλάρωση: το σώμα δεν περιέχει κανένα δεδομένο
 * και **καμία εργασία δεν ξεκινά**. Ένα `401` εδώ θα ήταν **δεύτερο** σχήμα
 * απάντησης για το ίδιο ερώτημα (ADR-749).
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
    options.logger.info(`${options.label} triggered`);

    try {
      const result = await options.run();
      const elapsedMs = Date.now() - startTime;

      options.logger.info(`${options.label} completed`, {
        summary: result.summary,
        elapsedMs,
      });

      return NextResponse.json({
        ok: true,
        summary: result.summary,
        ...result.metrics,
        elapsedMs,
      });
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = getErrorMessage(error);

      options.logger.error(`${options.label} error`, { error: errorMessage, elapsedMs });

      return NextResponse.json({ ok: false, error: errorMessage, elapsedMs }, { status: 500 });
    }
  }

  return { GET: withSensitiveRateLimit(handleGET) };
}
