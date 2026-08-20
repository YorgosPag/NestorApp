/**
 * =============================================================================
 * CRON: Ληξιπρόθεσμες δόσεις — ειδοποιήσεις (ADR-234)
 * =============================================================================
 *
 * Σάρωση ληξιπρόθεσμων δόσεων και αποστολή ειδοποιήσεων. Η σάρωση ζει στο
 * `OverdueAlertService`, ο προσαρμογέας στο `lib/cron/jobs/overdue-alerts.job.ts`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * ℹ️ Αυτό το route καλούσε **ήδη** τη σωστή συνάρτηση· η μετανάστευση αφαίρεσε μόνο
 * το διπλότυπο wiring και ενοποίησε το σχήμα απάντησης.
 *
 * @module api/cron/overdue-alerts
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runOverdueAlerts } from '@/lib/cron/jobs/overdue-alerts.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'overdue-alerts',
  label: 'Overdue alerts scan',
  logger: createModuleLogger('OVERDUE_ALERTS_CRON'),
  run: runOverdueAlerts,
});
