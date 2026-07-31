/**
 * JOB: ai-pipeline — επεξεργασία παρτίδας από την ουρά του AI pipeline.
 *
 * ⚠️ **Δεν προγραμματίστηκε ποτέ.** Το route υπάρχει από την αρχή αλλά δεν μπήκε ποτέ
 * στο `vercel.json` — άρα δεν έτρεξε ούτε όσο ζούσε το Vercel. Δηλωμένο στο
 * `src/config/cron-schedule.ts` ως `enabled: false` με `disabledReason:
 * 'never-scheduled'`, ώστε να είναι **ορατό** αντί να ξαναξεχαστεί.
 *
 * Η συμπεριφορά του σε παραγωγή είναι **άγνωστη**· δεν ενεργοποιείται στα τυφλά.
 *
 * @module lib/cron/jobs/ai-pipeline
 * @see ADR-739 §Αποφάσεις
 */

import 'server-only';

import { processAIPipelineBatch } from '@/server/ai/workers/ai-pipeline-worker';
import type { CronJobResult } from '@/types/cron-schedule';

export async function runAiPipeline(): Promise<CronJobResult> {
  const result = await processAIPipelineBatch();

  return {
    summary: `processed ${result.processed}, failed ${result.failed}, recovered ${result.recovered}`,
    metrics: {
      processed: result.processed,
      failed: result.failed,
      recovered: result.recovered,
    },
  };
}
