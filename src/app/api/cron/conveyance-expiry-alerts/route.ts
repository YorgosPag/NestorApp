/**
 * 🏢 Conveyance Expiry Alerts Cron Endpoint — ADR-901 Φ4 · §6 Σ-5
 *
 * **Πυροκροτητής, όχι λογική.** Η σάρωση ζει στο `services/conveyance/conveyance-expiry-alerts.server.ts`, ο
 * προσαρμογέας στο `lib/cron/jobs/conveyance-expiry-alerts.job.ts`. Ταυτοποίηση με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740): χωρίς έγκυρο μυστικό **καμία** σάρωση δεν τρέχει.
 *
 * @module api/cron/conveyance-expiry-alerts
 */

import 'server-only';

import { runConveyanceExpiryAlerts } from '@/lib/cron/jobs/conveyance-expiry-alerts.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'conveyance-expiry-alerts',
  label: 'Conveyance expiry alerts sweep',
  logger: createModuleLogger('CONVEYANCE_EXPIRY_ALERTS_CRON'),
  slug: 'conveyance-expiry-alerts',
  category: 'SENSITIVE',
  run: runConveyanceExpiryAlerts,
});
