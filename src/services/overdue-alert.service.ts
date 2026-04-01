/**
 * 🏢 Overdue Alert Service — ADR-234 Phase 5
 *
 * Scans for units with overdue installments and creates notification documents.
 * Deduplication: tag-based — `overdue_{propertyId}_{date}` prevents duplicates.
 *
 * @module services/overdue-alert
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';
import { generateNotificationId } from '@/services/enterprise-id.service';
import { PaymentReportService } from '@/services/payment-report.service';

const logger = createModuleLogger('OverdueAlertService');

// =============================================================================
// TYPES
// =============================================================================

interface ScanResult {
  processed: number;
  notified: number;
  skipped: number;
  errors: number;
}

// =============================================================================
// SERVICE
// =============================================================================

export class OverdueAlertService {
  /**
   * Scan all units with overdue installments and create notifications.
   * Dedup: checks if notification with same tag already exists for today.
   */
  static async scanAndNotify(): Promise<ScanResult> {
    const result: ScanResult = { processed: 0, notified: 0, skipped: 0, errors: 0 };

    try {
      const overdueUnits = await PaymentReportService.getOverdueUnits();
      result.processed = overdueUnits.length;

      if (overdueUnits.length === 0) {
        logger.info('No overdue units found');
        return result;
      }

      const db = getAdminFirestore();
      const todayISO = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const batch = db.batch();
      let batchCount = 0;

      for (const unit of overdueUnits) {
        try {
          const dedupTag = `overdue_${unit.propertyId}_${todayISO}`;

          // Check dedup — does a notification with this tag exist today?
          const existing = await db
            .collection(COLLECTIONS.NOTIFICATIONS)
            .where('tags', 'array-contains', dedupTag)
            .limit(1)
            .get();

          if (!existing.empty) {
            result.skipped++;
            continue;
          }

          // Create notification document — enterprise ID (SOS N.6)
          const notificationRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(generateNotificationId());
          const amountFormatted = new Intl.NumberFormat('el-GR', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
          }).format(unit.remainingAmount);

          batch.set(notificationRef, {
            title: 'Ληξιπρόθεσμη Δόση',
            body: `Μονάδα ${unit.propertyLabel}: ${unit.overdueCount} ληξιπρόθεσμ${unit.overdueCount === 1 ? 'η' : 'ες'} δόσ${unit.overdueCount === 1 ? 'η' : 'εις'} (${amountFormatted})`,
            severity: 'warning',
            tags: ['overdue', unit.propertyId, todayISO, dedupTag],

            source: {
              service: 'payment-alerts',
              feature: 'overdue-detection',
            },

            actions: [
              {
                id: 'view',
                label: 'Προβολή',
                url: `/properties/${unit.propertyId}`,
              },
            ],

            channel: 'in_app',
            delivery: { state: 'pending', attempts: 0 },

            createdAt: new Date().toISOString(),
            meta: {
              propertyId: unit.propertyId,
              projectId: unit.projectId,
              overdueCount: unit.overdueCount,
              remainingAmount: unit.remainingAmount,
            },
          });

          batchCount++;
          result.notified++;

          // Firestore batch limit = 500
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        } catch (unitError) {
          result.errors++;
          logger.error('Failed to process unit for overdue alert', {
            propertyId: unit.propertyId,
            error: getErrorMessage(unitError),
          });
        }
      }

      // Commit remaining
      if (batchCount > 0) {
        await batch.commit();
      }

      logger.info('Overdue scan completed', result);
      return result;
    } catch (error) {
      logger.error('Overdue scan failed', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }
}
