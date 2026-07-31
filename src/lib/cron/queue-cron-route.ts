/**
 * =============================================================================
 * ΔΙΑΔΡΟΜΗ CRON ΟΥΡΑΣ — GET/POST wiring για τα δύο queue routes (ADR-739)
 * =============================================================================
 *
 * Αδελφό module του `queue-batch-response.ts`: εκείνο τυποποιεί το **σώμα** της
 * απάντησης παρτίδας, αυτό τυποποιεί το **περίβλημα** — ποιος επιτρέπεται να την
 * ενεργοποιήσει και τι βλέπει όποιος δεν επιτρέπεται.
 *
 * Το `/api/cron/ai-pipeline` και το `/api/cron/email-ingestion` έχουν πανομοιότυπο
 * σχήμα εισόδου, και το σχόλιο του πρώτου το έλεγε ρητά (*«same pattern»*):
 *
 *   GET  + εξουσιοδότηση → παρτίδα
 *   GET  χωρίς           → liveness probe: **αν** η ουρά είναι υγιής, ποτέ **τι** περιέχει
 *   POST                 → πάντα εξουσιοδότηση, αλλιώς 401
 *
 * Το CHECK 3.28 (jscpd, ADR-584) εντόπισε τις 12 γραμμές του wiring ως διπλότυπο τη
 * στιγμή που τα δύο routes έγιναν πυροκροτητές. Το διπλότυπο εδώ είναι **έλεγχος
 * πρόσβασης**: η ασυμμετρία που θέλει το ADR-739 §2β να μην ξανασυμβεί ήταν ακριβώς
 * αυτή — το ένα σκέλος διέρρεε `intakeSubject` και διευθύνσεις αποστολέων επειδή το
 * μη ταυτοποιημένο μονοπάτι είχε γραφτεί χωριστά. Ένας φύλακας γραμμένος δύο φορές
 * είναι ένας φύλακας που θα διορθωθεί μία.
 *
 * @module lib/cron/queue-cron-route
 * @see lib/cron/queue-batch-response — το σώμα της απάντησης
 * @see ADR-739
 */

import { NextResponse, type NextRequest } from 'next/server';

import { rejectUnauthorizedCron, verifyCronAuthorization } from '@/lib/cron-auth';
import { respondWithQueueBatch } from '@/lib/cron/queue-batch-response';
import { getErrorMessage } from '@/lib/error-utils';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import type { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

/**
 * Ό,τι επιστρέφει ένας queue worker ως υγεία.
 *
 * Το `stats` είναι generic επειδή κάθε ουρά μετρά δικά της πράγματα — και μένει
 * generic αντί να ισοπεδωθεί σε `Record<string, number>`: ο τύπος του κάθε worker
 * είναι η τεκμηρίωση του τι εκθέτει το probe.
 */
export interface QueueLivenessHealth<TStats> {
  readonly healthy: boolean;
  readonly warnings: readonly string[];
  readonly stats: TStats;
}

export interface QueueCronRouteOptions<TStats> {
  /** Όνομα για τα logs, π.χ. `AI pipeline`. */
  readonly label: string;
  /** Ταυτότητα υπηρεσίας στο probe, π.χ. `ai-pipeline-worker`. */
  readonly service: string;
  /** Έκδοση συμβολαίου probe, π.χ. `v1`. */
  readonly version: string;
  readonly logger: ModuleLogger;
  /** Η εργασία παρτίδας. Καθαρή συνάρτηση — καμία γνώση HTTP. */
  readonly run: () => Promise<CronJobResult>;
  /** Υγεία ουράς για το μη ταυτοποιημένο GET. */
  readonly readHealth: () => Promise<QueueLivenessHealth<TStats>>;
  /** Προαιρετικά πεδία στην επιτυχή απάντηση παρτίδας. */
  readonly augment?: (result: CronJobResult) => Promise<Record<string, unknown>>;
}

export interface QueueCronRoute {
  readonly GET: (request: NextRequest) => Promise<Response> | Response;
  readonly POST: (request: NextRequest) => Promise<Response> | Response;
}

/**
 * Παράγει τους δύο handlers ενός queue cron route, με rate limit ήδη εφαρμοσμένο.
 *
 * Το route που το καλεί κρατά **μόνο** τη δήλωση: ποια ουρά, ποιος worker, ποιο
 * διαγνωστικό. Καμία απόφαση πρόσβασης δεν γράφεται δεύτερη φορά.
 */
export function createQueueCronRoute<TStats>(
  options: QueueCronRouteOptions<TStats>
): QueueCronRoute {
  const { label, service, version, logger, run, readHealth, augment } = options;

  const executeBatch = (trigger: 'manual-post' | 'api-call'): Promise<NextResponse> =>
    respondWithQueueBatch({ label, trigger, logger, run, augment });

  async function handleGET(request: NextRequest): Promise<Response> {
    if (verifyCronAuthorization(request)) {
      return executeBatch('api-call');
    }

    // Μη ταυτοποιημένος → **μόνο** liveness probe. Καμία πληροφορία περιεχομένου.
    try {
      const health = await readHealth();

      return NextResponse.json({
        ok: true,
        service,
        version,
        authorized: false,
        health: {
          healthy: health.healthy,
          warnings: health.warnings,
          stats: health.stats,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { ok: false, service, error: getErrorMessage(error) },
        { status: 500 }
      );
    }
  }

  async function handlePOST(request: NextRequest): Promise<Response> {
    const unauthorized = rejectUnauthorizedCron(request);
    if (unauthorized) {
      logger.warn(`Unauthorized POST to ${label} cron`);
      return unauthorized;
    }

    return executeBatch('manual-post');
  }

  return {
    GET: withSensitiveRateLimit(handleGET),
    POST: withSensitiveRateLimit(handlePOST),
  };
}
