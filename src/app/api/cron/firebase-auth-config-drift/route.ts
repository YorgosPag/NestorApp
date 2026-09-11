/**
 * 🏢 Firebase Auth Config Drift Cron Endpoint — ADR-851
 *
 * **Πυροκροτητής, όχι λογική.** Η σύγκριση ζει στο `server/firebase-auth-config/*`, ο
 * προσαρμογέας στο `lib/cron/jobs/firebase-auth-config-drift.job.ts`.
 *
 * 🔒 Μόνο ανάγνωση της ρύθμισης Auth — αλλά με το διαπιστευτήριο Admin, άρα η ταυτοποίηση
 * γίνεται με το **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740).
 *
 * @module api/cron/firebase-auth-config-drift
 */

import 'server-only';

import { runFirebaseAuthConfigDrift } from '@/lib/cron/jobs/firebase-auth-config-drift.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'firebase-auth-config-drift',
  label: 'Firebase Auth config drift audit',
  logger: createModuleLogger('FIREBASE_AUTH_CONFIG_DRIFT_CRON'),
  run: runFirebaseAuthConfigDrift,
});
