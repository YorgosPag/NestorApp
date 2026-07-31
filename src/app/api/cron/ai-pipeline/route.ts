/**
 * =============================================================================
 * AI PIPELINE CRON ENDPOINT
 * =============================================================================
 *
 * GET  → με εξουσιοδότηση: επεξεργασία παρτίδας· χωρίς: liveness probe.
 * POST → χειροκίνητη ενεργοποίηση (απαιτεί εξουσιοδότηση).
 *
 * ⚠️ **Δεν προγραμματίζεται σήμερα.** Το route υπάρχει από την αρχή αλλά δεν μπήκε
 * ποτέ στο `vercel.json` — άρα δεν έτρεξε ούτε όσο ζούσε το Vercel. Δηλωμένο στο
 * `src/config/cron-schedule.ts` ως `enabled: false` / `never-scheduled`, ώστε να είναι
 * **ορατό** αντί να ξαναξεχαστεί (ADR-740 §Αποφάσεις).
 *
 * ⚠️ **Το διαγνωστικό απαιτεί πλέον εξουσιοδότηση.** Μέχρι 2026-07-31 το μη
 * ταυτοποιημένο σκέλος επέστρεφε `intakeSubject` και `intakeSender` — δηλαδή **θέματα
 * και διευθύνσεις αποστολέων πραγματικών μηνυμάτων σε οποιονδήποτε καλούσε**. Το
 * κάλυπτε μόνο το bot-block του `middleware.ts`, που φιλτράρει user-agent και δεν είναι
 * εξουσιοδότηση. Το liveness probe χρειάζεται να ξέρει **αν** η ουρά είναι υγιής, όχι
 * **τι** περιέχει. Ο φύλακας ζει τώρα στο `lib/cron/queue-cron-route.ts`, κοινός με το
 * `/api/cron/email-ingestion` — γραμμένος μία φορά, άρα διορθώσιμος μία φορά.
 *
 * @module api/cron/ai-pipeline
 * @see ADR-080 (Pipeline Implementation)
 * @see api/cron/email-ingestion (same pattern — τώρα κυριολεκτικά ο ίδιος κώδικας)
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { collectAiPipelineDiagnostic } from '@/lib/cron/ai-pipeline-diagnostic';
import { runAiPipeline } from '@/lib/cron/jobs/ai-pipeline.job';
import { createQueueCronRoute } from '@/lib/cron/queue-cron-route';
import { getAIPipelineQueueHealth } from '@/server/ai/workers/ai-pipeline-worker';
import { createModuleLogger } from '@/lib/telemetry/Logger';

const logger = createModuleLogger('AI_PIPELINE_CRON');

export const maxDuration = 60;

const route = createQueueCronRoute({
  label: 'AI pipeline',
  service: 'ai-pipeline-worker',
  version: 'v1',
  logger,
  run: runAiPipeline,
  readHealth: getAIPipelineQueueHealth,
  // Το διαγνωστικό **μόνο** όταν υπάρχει κάτι να διαγνωστεί: περιέχει περιεχόμενο
  // μηνυμάτων και δεν είναι πληροφορία ρουτίνας.
  augment: async (result) =>
    (result.metrics?.failed ?? 0) > 0
      ? { diagnostic: await collectAiPipelineDiagnostic() }
      : {},
});

export const GET = route.GET;
export const POST = route.POST;
