/**
 * GET /api/cron/purge-deleted-entities
 *
 * Daily cleanup for ALL soft-deletable entities.
 * Replaces purge-deleted-contacts (contacts-only) — SOFT_DELETE_CONFIG.contact already
 * covers COLLECTIONS.CONTACTS. Το προηγούμενο route παραμένει ως εφεδρικό μέχρι να
 * αποδειχθεί αυτό σε παραγωγή (ADR-739 §Αποφάσεις).
 *
 * ⚠️ ΤΟ GUARD ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΟ. Το route καλεί `executeDeletion()` — **οριστική**
 * διαγραφή με cascade. Μέχρι 2026-07-31 δεν είχε καθόλου ταυτοποίηση: το κάλυπτε κατά
 * λάθος το bot-block του `middleware.ts`, που όμως μπλοκάρει user-agent — αλλάζει σε ένα
 * δευτερόλεπτο και **δεν είναι εξουσιοδότηση**. Μην αφαιρέσεις το verifyCronAuthorization.
 * Το test κάλυψης guard (`src/lib/cron/__tests__/cron-route-contract.test.ts`) το επιβάλλει.
 *
 * @module api/cron/purge-deleted-entities
 * @enterprise ADR-281 — SSOT Soft-Delete System
 * @see ADR-739 — χρονοπρογραμματισμός· το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createModuleLogger } from '@/lib/telemetry';
import { TRASH_RETENTION_MS, rejectUnauthorizedCron } from '@/lib/cron-auth';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { executeDeletion } from '@/lib/firestore/deletion-guard';
import { SOFT_DELETE_CONFIG } from '@/lib/firestore/soft-delete-config';
import { getErrorMessage } from '@/lib/error-utils';
import type { SoftDeletableEntityType } from '@/types/soft-deletable';

const logger = createModuleLogger('CronPurgeDeletedEntities');

export const maxDuration = 60;

/** Max documents per entity type per cron run (avoid timeout) */
const PER_TYPE_LIMIT = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const unauthorized = rejectUnauthorizedCron(request);
  if (unauthorized) return unauthorized;

  const startTime = Date.now();
  const db = getAdminFirestore();
  const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

  const results: Record<string, { purged: number; skipped: number; checked: number }> = {};

  const entityTypes = Object.keys(SOFT_DELETE_CONFIG) as SoftDeletableEntityType[];

  for (const entityType of entityTypes) {
    const config = SOFT_DELETE_CONFIG[entityType];
    let purged = 0;
    let skipped = 0;

    try {
      const snapshot = await db
        .collection(config.collection)
        .where('status', '==', 'deleted')
        .where('deletedAt', '<=', cutoffDate)
        .limit(PER_TYPE_LIMIT)
        .get();

      if (!snapshot.empty) {
        for (const doc of snapshot.docs) {
          try {
            const docData = doc.data();
            const docCompanyId = (docData.companyId as string) ?? '';
            await executeDeletion(db, entityType, doc.id, 'system:cron-purge', docCompanyId);
            purged++;
          } catch (error) {
            skipped++;
            logger.warn(`Skipped purge for ${entityType}`, {
              entityId: doc.id, error: getErrorMessage(error),
            });
          }
        }
      }

      results[entityType] = { purged, skipped, checked: snapshot.size };
    } catch (error) {
      logger.error(`Failed to purge ${entityType}`, { error: getErrorMessage(error) });
      results[entityType] = { purged: 0, skipped: 0, checked: 0 };
    }
  }

  const totalPurged = Object.values(results).reduce((sum, r) => sum + r.purged, 0);
  const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);

  logger.info('Entity purge complete', { results, totalPurged, totalSkipped, durationMs: Date.now() - startTime });

  return NextResponse.json({
    success: true,
    results,
    totalPurged,
    totalSkipped,
    durationMs: Date.now() - startTime,
  });
}
