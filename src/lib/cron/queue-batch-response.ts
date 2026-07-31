/**
 * =============================================================================
 * ΑΠΑΝΤΗΣΗ ΠΑΡΤΙΔΑΣ ΟΥΡΑΣ — κοινό σώμα για τα δύο queue cron routes (ADR-739)
 * =============================================================================
 *
 * Τα `/api/cron/email-ingestion` και `/api/cron/ai-pipeline` είναι **αδέρφια εξ
 * αρχής**: το ίδιο το σχόλιο του δεύτερου έγραφε *«same pattern»*. Και τα δύο
 * τρέχουν έναν worker παρτίδας, μετρούν τον χρόνο, καταγράφουν και τυλίγουν το
 * αποτέλεσμα σε `NextResponse` με πανομοιότυπο σχήμα.
 *
 * Το CHECK 3.28 (jscpd, ADR-584) τα εντόπισε ως 17 γραμμές / 75 tokens διπλότυπο τη
 * στιγμή που έγιναν πυροκροτητές. Η διπλή γραφή δεν είναι απλώς σπατάλη: σημαίνει ότι
 * μια αλλαγή στο σχήμα της απάντησης (π.χ. προσθήκη πεδίου συσχέτισης για διάγνωση)
 * εφαρμόζεται στη μία ουρά και ξεχνιέται στην άλλη — και η ασυμμετρία φαίνεται μόνο
 * όταν κάποιος διαβάζει logs υπό πίεση.
 *
 * @module lib/cron/queue-batch-response
 * @see ADR-739
 */

import { NextResponse } from 'next/server';

import { getErrorMessage } from '@/lib/error-utils';
import type { createModuleLogger } from '@/lib/telemetry';
import type { CronJobResult } from '@/types/cron-schedule';

type ModuleLogger = ReturnType<typeof createModuleLogger>;

/** Ποιος ενεργοποίησε την παρτίδα — μόνο για logs και για την απάντηση. */
export type QueueBatchTrigger = 'manual-post' | 'api-call';

export interface QueueBatchOptions {
  /** Όνομα για τα logs, π.χ. `AI pipeline`. */
  readonly label: string;
  readonly trigger: QueueBatchTrigger;
  readonly logger: ModuleLogger;
  /** Η εργασία. Καθαρή συνάρτηση — καμία γνώση HTTP. */
  readonly run: () => Promise<CronJobResult>;
  /**
   * Προαιρετικά πρόσθετα πεδία στην **επιτυχή** απάντηση (π.χ. διαγνωστικά όταν
   * υπάρχουν αποτυχίες). Τρέχει μόνο αν το `run` ολοκληρώθηκε.
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
  const { label, trigger, logger, run, augment } = options;
  const startTime = Date.now();

  logger.info(`${label} batch triggered`, { trigger });

  try {
    const result = await run();
    const elapsedMs = Date.now() - startTime;

    logger.info(`${label} batch completed`, { trigger, summary: result.summary, elapsedMs });

    const extra = augment ? await augment(result) : {};

    return NextResponse.json({
      ok: true,
      trigger,
      summary: result.summary,
      ...result.metrics,
      ...extra,
      elapsedMs,
    });
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
