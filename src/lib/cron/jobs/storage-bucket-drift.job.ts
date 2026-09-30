/**
 * =============================================================================
 * JOB: storage-bucket-drift — **ΣΥΜΦΩΝΟΥΝ ΟΙ ΚΑΔΟΙ ΜΕ ΤΟ GIT;** (ADR-884 Φ2ζ ζ5 · πρότυπο ADR-851)
 * =============================================================================
 *
 * 🔴 **Γιατί υπάρχει**: η κατάσταση κάθε δικού μας κάδου **δηλώνεται** στο `config/gcs-buckets` και ένας ελεγκτής
 * (`inspect…Bucket`) την κρίνει — αλλά μόνο όταν τον τρέξει άνθρωπος. Ένα CORS που «καθαρίστηκε» στην κονσόλα, ένα
 * soft delete που ξαναγύρισε στις 7 ημέρες, μια δημόσια ανάγνωση που αφαιρέθηκε: όλα **σιωπηλά**. Εδώ φαίνονται σε ≤24 ώρες.
 *
 * 🏆 **ΕΝΑΣ cron για ΟΛΟΥΣ τους δηλωμένους κάδους**, όχι ένας ανά κάδο: νέος ιδιωτικός κάδος = μία δήλωση στο `private-bucket-registry` (ADR-895 Α5).
 *
 * ⚠️ **Απόκλιση ≠ αποτυχία εργασίας** (ADR-851): η εργασία **πέτυχε** να κοιτάξει· η απόκλιση είναι εύρημα ⇒ Sentry.
 * Αποτυχία είναι μόνο το «δεν μπορέσαμε να κρίνουμε» (σφάλμα GCS) ⇒ **πετά**, ώστε να χτυπήσει ο monitor του ADR-740.
 *
 * 🔒 **Δεν γράφει ΠΟΤΕ.** Η διόρθωση είναι πράξη ανθρώπου (`npm run provision:<id> -- --apply` · `/api/admin/public-shelf`).
 *
 * @module lib/cron/jobs/storage-bucket-drift.job
 */

import 'server-only';

import { GCS_PUBLIC_MEDIA_BUCKET_CONFIG } from '@/config/gcs-buckets';
import { sentryCaptureMessage } from '@/lib/telemetry';
import { inspectPrivateBucket } from '@/server/storage/declared-private-bucket';
import { DECLARED_PRIVATE_BUCKETS } from '@/server/storage/private-bucket-registry';
import { inspectPublicShelfBucket, type PublicShelfBucketState } from '@/services/listings/public-shelf-provision';
import type { CronJobResult } from '@/types/cron-schedule';

/** Ό,τι λέει κάθε ελεγκτής, στο κοινό σχήμα. `drift` κενό ⇒ ο κάδος είναι ακριβώς όπως η δήλωση. */
export interface BucketDriftReport {
  readonly bucketName: string;
  readonly exists: boolean;
  readonly drift: readonly string[];
}

interface DeclaredBucket {
  readonly name: string;
  readonly inspect: () => Promise<BucketDriftReport>;
}

/**
 * Ο δημόσιος ελεγκτής **παρατηρεί** (booleans) αντί να κρίνει· εδώ γίνεται κρίση έναντι της δήλωσης.
 * `publiclyReadable` και `browserReadable` είναι **δύο** ερωτήσεις (Ο-21) — γι' αυτό και δύο πεδία απόκλισης.
 */
export function publicShelfDrift(state: PublicShelfBucketState): string[] {
  if (!state.exists) return ['exists'];
  const checks: ReadonlyArray<readonly [string, boolean]> = [
    ['location', (state.location ?? '').toUpperCase() === GCS_PUBLIC_MEDIA_BUCKET_CONFIG.location],
    ['uniform-access', state.uniformAccess === GCS_PUBLIC_MEDIA_BUCKET_CONFIG.uniformBucketLevelAccess],
    ['public-read', state.publiclyReadable],
    ['cors', state.browserReadable],
  ];
  return checks.filter(([, ok]) => !ok).map(([field]) => field);
}

/**
 * **Οι δηλωμένοι κάδοι** — οι ιδιωτικοί έρχονται **από το μητρώο τους** (`private-bucket-registry`: νέα δήλωση ⇒ επιτήρηση
 * αυτόματα, καμία δεύτερη λίστα)· το δημόσιο ράφι έχει δικό του ελεγκτή (αντίθετη πολιτική, ADR-895 §7.2).
 */
const DECLARED_BUCKETS: readonly DeclaredBucket[] = [
  ...DECLARED_PRIVATE_BUCKETS.map((decl) => ({ name: decl.id, inspect: () => inspectPrivateBucket(decl) })),
  {
    name: 'public-shelf',
    inspect: async () => {
      const state = await inspectPublicShelfBucket();
      return { bucketName: state.bucketName, exists: state.exists, drift: publicShelfDrift(state) };
    },
  },
];

export async function runStorageBucketDrift(): Promise<CronJobResult> {
  const reports = await Promise.all(
    DECLARED_BUCKETS.map(async (declared) => ({ name: declared.name, ...(await declared.inspect()) })),
  );
  const drifted = reports.filter((report) => report.drift.length > 0);

  if (drifted.length > 0) {
    sentryCaptureMessage('Storage bucket drifted from git', 'warning', {
      tags: { component: 'storage-bucket-drift' },
      extra: { drifted: drifted.map(({ name, bucketName, exists, drift }) => ({ name, bucketName, exists, drift })) },
    });
  }

  return {
    summary: `buckets ${reports.length}, drifted ${drifted.length}`
      + (drifted.length > 0 ? ` (${drifted.map((r) => `${r.name}: ${r.drift.join(',')}`).join(' · ')})` : ''),
    metrics: {
      buckets: reports.length,
      drifted: drifted.length,
      ...Object.fromEntries(reports.map((report) => [`drift_${report.name}`, report.drift.length])),
    },
  };
}
