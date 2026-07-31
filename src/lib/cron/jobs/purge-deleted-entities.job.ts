/**
 * =============================================================================
 * JOB: purge-deleted-entities — οριστική διαγραφή ληγμένων soft-deleted
 * =============================================================================
 *
 * Η λογική ζει εδώ, όχι στο route. Το `/api/cron/purge-deleted-entities` μένει
 * λεπτός πυροκροτητής — το ίδιο μοτίβο με το `oauth-cleanup` (ADR-738 §10).
 *
 * Γιατί μετακινήθηκε (ADR-740): όσο η λογική ζούσε μέσα σε `export async function GET`,
 * ήταν αδύνατο να δοκιμαστεί χωρίς να στηθεί ολόκληρο Next request — γι' αυτό ακριβώς
 * υπήρχαν **μηδέν tests** σε όλα τα cron routes. Ο χρονοπρογραμματιστής καλεί αυτή τη
 * συνάρτηση **απευθείας**, χωρίς HTTP: κανένα middleware, κανένα rate limit, καμία
 * εξάρτηση από user-agent.
 *
 * @module lib/cron/jobs/purge-deleted-entities
 * @enterprise ADR-281 — SSOT Soft-Delete System
 * @see ADR-740
 */

import { TRASH_RETENTION_MS } from '@/lib/cron-auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import { getErrorMessage } from '@/lib/error-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';
import type { CronJobResult } from '@/types/cron-schedule';

const logger = createModuleLogger('CronPurgeDeletedEntities');

/**
 * Ανώτατο πλήθος εγγράφων ανά τύπο οντότητας, ανά εκτέλεση.
 *
 * ⚠️ Επιλέχθηκε για το όριο **60s του Vercel serverless**, το οποίο σε Docker/Netcup
 * δεν ισχύει (ADR-740 §Γνωστά όρια). Παραμένει ως έχει: η αλλαγή του είναι απόφαση με
 * δικά της δεδομένα (πόσα εκκρεμούν, πόσο κρατά ένα `executeDeletion` με cascade), όχι
 * παρενέργεια της μετακόμισης. Το batching κάνει το job **επαναληπτικό**: ό,τι δεν
 * προλάβει σήμερα, το παίρνει αύριο.
 */
const PER_TYPE_LIMIT = 20;

/** Ανά τύπο απολογισμός — διατηρείται στο αποτέλεσμα για διάγνωση. */
interface EntityPurgeTally {
  purged: number;
  skipped: number;
  checked: number;
}

/**
 * Σαρώνει έναν τύπο οντότητας και διαγράφει οριστικά ό,τι έληξε.
 *
 * Ένα έγγραφο που αποτυγχάνει (π.χ. μπλοκάρεται από εξάρτηση) **δεν** ρίχνει τη
 * σάρωση: μετριέται ως `skipped` και η σάρωση συνεχίζει. Διαφορετικά μία κλειδωμένη
 * επαφή θα εμπόδιζε την εκκαθάριση κάθε άλλης οντότητας για πάντα.
 */
async function purgeEntityType(
  db: FirebaseFirestore.Firestore,
  entityType: SoftDeletableEntityType,
  cutoffDate: Date
): Promise<EntityPurgeTally> {
  const config = SOFT_DELETE_CONFIG[entityType];
  let purged = 0;
  let skipped = 0;

  const snapshot = await db
    .collection(config.collection)
    .where('status', '==', 'deleted')
    .where('deletedAt', '<=', cutoffDate)
    .limit(PER_TYPE_LIMIT)
    .get();

  for (const doc of snapshot.docs) {
    try {
      const docData = doc.data();
      const docCompanyId = (docData.companyId as string) ?? '';
      await executeDeletion(db, entityType, doc.id, 'system:cron-purge', docCompanyId);
      purged++;
    } catch (error) {
      skipped++;
      logger.warn(`Skipped purge for ${entityType}`, {
        entityId: doc.id,
        error: getErrorMessage(error),
      });
    }
  }

  return { purged, skipped, checked: snapshot.size };
}

/** Πλήρες αποτέλεσμα, ώστε το route να μπορεί να το επιστρέψει αυτούσιο. */
export interface PurgeDeletedEntitiesReport {
  readonly results: Readonly<Record<string, EntityPurgeTally>>;
  readonly totalPurged: number;
  readonly totalSkipped: number;
  readonly durationMs: number;
}

/** Εκτελεί την εκκαθάριση για **όλους** τους soft-deletable τύπους. */
export async function purgeDeletedEntities(): Promise<PurgeDeletedEntitiesReport> {
  const startTime = Date.now();
  const db = getAdminFirestore();
  const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

  const results: Record<string, EntityPurgeTally> = {};
  const entityTypes = Object.keys(SOFT_DELETE_CONFIG) as SoftDeletableEntityType[];

  for (const entityType of entityTypes) {
    try {
      results[entityType] = await purgeEntityType(db, entityType, cutoffDate);
    } catch (error) {
      // Αποτυχία σε επίπεδο ερωτήματος (π.χ. λείπει index) — δεν σταματά τους άλλους τύπους.
      logger.error(`Failed to purge ${entityType}`, { error: getErrorMessage(error) });
      results[entityType] = { purged: 0, skipped: 0, checked: 0 };
    }
  }

  const tallies = Object.values(results);
  const totalPurged = tallies.reduce((sum, r) => sum + r.purged, 0);
  const totalSkipped = tallies.reduce((sum, r) => sum + r.skipped, 0);
  const durationMs = Date.now() - startTime;

  logger.info('Entity purge complete', { results, totalPurged, totalSkipped, durationMs });

  return { results, totalPurged, totalSkipped, durationMs };
}

/** Προσαρμογέας για τον χρονοπρογραμματιστή. */
export async function runPurgeDeletedEntities(): Promise<CronJobResult> {
  const report = await purgeDeletedEntities();
  return {
    summary: `purged ${report.totalPurged}, skipped ${report.totalSkipped}`,
    metrics: { purged: report.totalPurged, skipped: report.totalSkipped },
  };
}
