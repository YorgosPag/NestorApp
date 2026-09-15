/**
 * =============================================================================
 * ΑΠΑΝΤΗΣΗ ΠΑΡΤΙΔΑΣ ΟΥΡΑΣ — κοινό σώμα για τα δύο queue cron routes (ADR-740)
 * =============================================================================
 *
 * Τα `/api/cron/email-ingestion` και `/api/cron/ai-pipeline` είναι **αδέρφια εξ
 * αρχής**: το ίδιο το σχόλιο του δεύτερου έγραφε *«same pattern»*. Και τα δύο
 * τρέχουν έναν worker παρτίδας, μετρούν τον χρόνο, καταγράφουν και τυλίγουν το
 * αποτέλεσμα σε `NextResponse` με πανομοιότυπο σχήμα.
 *
 * Το CHECK 3.28 (jscpd, ADR-584) τα εντόπισε ως 17 γραμμές / 75 tokens διπλότυπο τη
 * στιγμή που έγιναν πυροκροτητές. Η διπλή γραφή δεν είναι απλώς σπατάλη: σημαίνει ότι
 * μια αλλαγή στο σχήμα της απάντησης εφαρμόζεται στη μία ουρά και ξεχνιέται στην άλλη.
 *
 * 🔗 ADR-777 §8.69.14 — η παρτίδα **δεν** τρέχει πια εδώ ωμά: ο καλών δίνει `execute`, που
 * περνά από τον executor (lease + monitor + κατάσταση). Εδώ μόνο η **απάντηση**, με την ίδια
 * αντιστοίχιση outcome → HTTP με τα routes σάρωσης (`cron-run-response.ts`).
 *
 * @module lib/cron/queue-batch-response
 * @see ADR-740
 */

import { NextResponse } from 'next/server';

import { cronRunHttpStatus, cronRunResponseFields, logCronRunOutcome } from '@/lib/cron/cron-run-response';
import { getErrorMessage } from '@/lib/error-utils';
import type { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult, CronRunOutcome } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

/** Ποιος ενεργοποίησε την παρτίδα (HTTP ρήμα) — μόνο για logs και για την απάντηση. */
export type QueueBatchTrigger = 'manual-post' | 'api-call';

export interface QueueBatchOptions {
  /** Όνομα για τα logs, π.χ. `AI pipeline`. */
  readonly label: string;
  readonly trigger: QueueBatchTrigger;
  readonly logger: ModuleLogger;
  /** Η εκτέλεση **μέσα από τον executor** — ποτέ ο ωμός worker. */
  readonly execute: () => Promise<CronRunOutcome>;
  /**
   * Προαιρετικά πρόσθετα πεδία στην **επιτυχή** απάντηση (π.χ. διαγνωστικά όταν
   * υπάρχουν αποτυχίες). Τρέχει μόνο αν η εκτέλεση ολοκληρώθηκε.
   */
  readonly augment?: (result: CronJobResult) => Promise<Record<string, unknown>>;
}

/**
 * Τρέχει μια παρτίδα ουράς και επιστρέφει την τυποποιημένη HTTP απάντηση.
 *
 * Η αποτυχία γίνεται `500` με το μήνυμα — **δεν** καταπίνεται: αυτό το route είναι η
 * χειροκίνητη διαδρομή, και ένας άνθρωπος που το καλεί πρέπει να δει τι έσπασε.
 */
export async function respondWithQueueBatch(
  options: QueueBatchOptions
): Promise<NextResponse> {
  const { label, trigger, logger, execute, augment } = options;
  const startTime = Date.now();

  logger.info(`${label} batch triggered`, { trigger });

  try {
    const outcome = await execute();
    const elapsedMs = Date.now() - startTime;
    logCronRunOutcome(logger, `${label} batch`, outcome, elapsedMs);

    const extra = outcome.status === 'success' && augment
      ? await augment({ summary: outcome.summary, metrics: outcome.metrics })
      : {};

    return NextResponse.json(
      { ...cronRunResponseFields(outcome), trigger, ...extra, elapsedMs },
      { status: cronRunHttpStatus(outcome) },
    );
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = getErrorMessage(error);

    logger.error(`${label} batch error`, { trigger, error: errorMessage, elapsedMs });

    return NextResponse.json(
      { ok: false, trigger, error: errorMessage, elapsedMs },
      { status: 500 }
    );
  }
}
