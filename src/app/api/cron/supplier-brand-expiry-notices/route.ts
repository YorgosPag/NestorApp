/**
 * 🏢 Supplier Brand Expiry Notices Cron Endpoint — ADR-923 §16
 *
 * **Πυροκροτητής, όχι λογική.** Η σάρωση ζει στο `server/catalog/supplier-brand-expiry-notices.server.ts`, ο
 * προσαρμογέας στο `lib/cron/jobs/supplier-brand-expiry-notices.job.ts`. Ταυτοποίηση με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740): χωρίς έγκυρο μυστικό **καμία** σάρωση δεν τρέχει.
 *
 * @module api/cron/supplier-brand-expiry-notices
 */

import 'server-only';

import { runSupplierBrandExpiryNotices } from '@/lib/cron/jobs/supplier-brand-expiry-notices.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'supplier-brand-expiry-notices',
  label: 'Supplier brand expiry notices sweep',
  logger: createModuleLogger('SUPPLIER_BRAND_EXPIRY_NOTICES_CRON'),
  slug: 'supplier-brand-expiry-notices',
  category: 'SENSITIVE',
  run: runSupplierBrandExpiryNotices,
});
