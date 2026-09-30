/**
 * 🏢 Storage Bucket Drift Cron Endpoint — ADR-884 Φ2ζ ζ5 (πρότυπο ADR-851)
 *
 * **Πυροκροτητής, όχι λογική.** Οι δηλωμένες καταστάσεις ζουν στο `config/gcs-buckets`, οι ελεγκτές στο
 * `server/storage/declared-private-bucket` (δηλώσεις: `private-bucket-registry`) και στο `services/listings/public-shelf-provision`, ο προσαρμογέας στο
 * `lib/cron/jobs/storage-bucket-drift.job.ts`.
 *
 * 🔒 Μόνο ανάγνωση metadata/IAM — αλλά με το διαπιστευτήριο Admin, άρα η ταυτοποίηση γίνεται με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740).
 *
 * @module api/cron/storage-bucket-drift
 */

import 'server-only';

import { runStorageBucketDrift } from '@/lib/cron/jobs/storage-bucket-drift.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'storage-bucket-drift',
  label: 'Storage bucket drift audit',
  logger: createModuleLogger('STORAGE_BUCKET_DRIFT_CRON'),
  slug: 'storage-bucket-drift',
  run: runStorageBucketDrift,
});
