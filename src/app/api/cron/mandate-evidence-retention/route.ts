/**
 * 🏢 Mandate Evidence Retention Cron Endpoint — ADR-864 §20
 *
 * **Πυροκροτητής, όχι λογική.** Η κρίση ζει στο `lib/mandate/evidence-retention.ts`, η πράξη στο
 * `services/mandate/evidence-retention.service.ts`, ο προσαρμογέας στο `lib/cron/jobs/mandate-evidence-retention.job.ts`.
 *
 * ⚠️ **Αυτή η διαδρομή ΚΛΕΙΔΩΝΕΙ ΚΑΙ ΔΙΑΘΕΤΕΙ ΑΠΟΔΕΙΚΤΙΚΑ.** Ταυτοποίηση με το υπάρχον SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο μυστικό **καμία σάρωση δεν τρέχει**.
 *
 * @module api/cron/mandate-evidence-retention
 */

import 'server-only';

import { runMandateEvidenceRetention } from '@/lib/cron/jobs/mandate-evidence-retention.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'mandate-evidence-retention',
  label: 'Mandate evidence retention sweep',
  logger: createModuleLogger('MANDATE_EVIDENCE_RETENTION_CRON'),
  slug: 'mandate-evidence-retention',
  run: runMandateEvidenceRetention,
});
