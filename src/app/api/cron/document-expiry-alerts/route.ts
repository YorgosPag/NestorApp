/**
 * 🏢 Document Expiry Alerts Cron Endpoint — ADR-915 Φ5α · §12
 *
 * **Πυροκροτητής, όχι λογική.** Η σάρωση ζει στο `services/document-registry/registry-expiry-alerts.server.ts`, ο
 * προσαρμογέας στο `lib/cron/jobs/document-expiry-alerts.job.ts`. Ταυτοποίηση με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740): χωρίς έγκυρο μυστικό **καμία** σάρωση δεν τρέχει.
 *
 * @module api/cron/document-expiry-alerts
 */

import 'server-only';

import { runDocumentExpiryAlerts } from '@/lib/cron/jobs/document-expiry-alerts.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'document-expiry-alerts',
  label: 'Document expiry alerts sweep',
  logger: createModuleLogger('DOCUMENT_EXPIRY_ALERTS_CRON'),
  slug: 'document-expiry-alerts',
  category: 'SENSITIVE',
  run: runDocumentExpiryAlerts,
});
