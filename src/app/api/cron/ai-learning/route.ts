/**
 * =============================================================================
 * CRON: Εξαγωγή μοτίβων + εκκαθάριση (ADR-173)
 * =============================================================================
 *
 * Τα πέντε βήματα ζουν στο `lib/cron/jobs/ai-learning.job.ts`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * ℹ️ Αυτό το route καλούσε **ήδη** τη σωστή συνάρτηση· η μετανάστευση αφαίρεσε μόνο
 * το διπλότυπο wiring και ενοποίησε το σχήμα απάντησης.
 *
 * @module api/cron/ai-learning
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runAiLearning } from '@/lib/cron/jobs/ai-learning.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'ai-learning',
  label: 'AI learning',
  logger: createModuleLogger('CRON_AI_LEARNING'),
  run: runAiLearning,
});
