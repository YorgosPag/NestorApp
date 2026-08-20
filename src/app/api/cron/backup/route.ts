/**
 * =============================================================================
 * CRON: Προγραμματισμένο αντίγραφο ασφαλείας (ADR-313)
 * =============================================================================
 *
 * ⚠️ Αυτό είναι το job του οποίου η τρίμηνη σιωπή είναι το σοβαρότερο εύρημα του
 * ADR-740: από 2026-05-09 έως 2026-07-31 **δεν λήφθηκε κανένα αντίγραφο ασφαλείας**,
 * επειδή το πρόγραμμα ζούσε μόνο στο νεκρό `vercel.json`.
 *
 * ⚠️ **Πυροκροτητής, όχι λογική.** Το wiring (εξουσιοδότηση · ρυθμός · σχήμα
 * απάντησης · χειρισμός σφάλματος) ζει στο `lib/cron/scan-cron-route`.
 *
 * ℹ️ Αυτό το route καλούσε **ήδη** τη σωστή συνάρτηση· η μετανάστευση αφαίρεσε μόνο
 * το διπλότυπο wiring και ενοποίησε το σχήμα απάντησης.
 *
 * @module api/cron/backup
 * @see ADR-777 §8.27 — η μετανάστευση στο κοινό wiring
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runBackup } from '@/lib/cron/jobs/backup.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'backup',
  label: 'Scheduled backup',
  logger: createModuleLogger('CronBackup'),
  run: runBackup,
});
