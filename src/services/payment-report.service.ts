/**
 * 🏢 Payment Report Service — ADR-234 Phase 5
 *
 * Generates payment reports per project using denormalized PaymentSummary data.
 * ZERO N+1 queries — all data comes from unit.commercial.paymentSummary.
 *
 * @module services/payment-report
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { formatOwnerNames } from '@/lib/ownership/owner-utils';
import type { PaymentReportData, PaymentReportRow } from '@/services/payment-export/types';
import type { PaymentSummary } from '@/types/payment-plan';

const logger = createModuleLogger('PaymentReportService');

// =============================================================================
// TYPES — Firestore unit document shape (minimal)
// =============================================================================

interface UnitDoc {
  id: string;
  label?: string;
  name?: string;
  buildingId?: string;
  buildingName?: string;
  project?: string;
  commercial?: {
    owners?: ReadonlyArray<{ contactId: string; name: string; ownershipPct: number; role: string; paymentPlanId: string | null }> | null;
    paymentSummary?: PaymentSummary | null;
  } | null;
}

interface ProjectDoc {
  name?: string;
  title?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

export class PaymentReportService {
  /**
   * Generate a full payment report for a project.
   * ONE Firestore query — units where project == projectId.
   */
  static async getProjectReport(projectId: string): Promise<PaymentReportData> {
    const db = getAdminFirestore();

    // Fetch project name
    const projectSnap = await db.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
    const projectData = projectSnap.data() as ProjectDoc | undefined;
    const projectName = projectData?.name ?? projectData?.title ?? projectId;

    // Fetch ALL units for this project — single query
    const unitsSnap = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('project', '==', projectId)
      .get();

    const rows: PaymentReportRow[] = [];
    let totalUnitsWithPlan = 0;
    let totalUnitsWithoutPlan = 0;
    let totalAmount = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalOverdueCount = 0;

    for (const doc of unitsSnap.docs) {
      const unit = { id: doc.id, ...doc.data() } as UnitDoc;
      const summary = unit.commercial?.paymentSummary;

      if (!summary) {
        totalUnitsWithoutPlan++;
        continue;
      }

      totalUnitsWithPlan++;
      totalAmount += summary.totalAmount;
      totalPaid += summary.paidAmount;
      totalRemaining += summary.remainingAmount;
      totalOverdueCount += summary.overdueInstallments;

      rows.push({
        unitId: unit.id,
        unitLabel: unit.label ?? unit.name ?? unit.id,
        buildingName: unit.buildingName ?? unit.buildingId ?? '-',
        buyerName: formatOwnerNames(unit.commercial?.owners ?? []) ?? '-',
        planStatus: summary.planStatus,
        totalAmount: summary.totalAmount,
        paidAmount: summary.paidAmount,
        remainingAmount: summary.remainingAmount,
        paidPercentage: summary.paidPercentage,
        totalInstallments: summary.totalInstallments,
        paidInstallments: summary.paidInstallments,
        overdueInstallments: summary.overdueInstallments,
        nextInstallmentDate: summary.nextInstallmentDate,
        nextInstallmentAmount: summary.nextInstallmentAmount,
        loanStatus: summary.loanStatus,
        primaryLoanStatus: summary.primaryLoanStatus ?? null,
        primaryLoanBank: summary.primaryLoanBank ?? null,
      });
    }

    // Sort: overdue first, then by unit label
    rows.sort((a, b) => {
      if (a.overdueInstallments > 0 && b.overdueInstallments === 0) return -1;
      if (a.overdueInstallments === 0 && b.overdueInstallments > 0) return 1;
      return a.unitLabel.localeCompare(b.unitLabel, 'el');
    });

    const overallPaidPercentage = totalAmount > 0
      ? Math.round((totalPaid / totalAmount) * 10000) / 100
      : 0;

    logger.info('Payment report generated', {
      projectId,
      totalUnits: unitsSnap.size,
      withPlan: totalUnitsWithPlan,
      overdue: totalOverdueCount,
    });

    return {
      projectId,
      projectName,
      generatedAt: new Date().toISOString(),
      currency: 'EUR',
      rows,
      summary: {
        totalUnitsWithPlan,
        totalUnitsWithoutPlan,
        totalAmount,
        totalPaid,
        totalRemaining,
        totalOverdueCount,
        paidPercentage: overallPaidPercentage,
      },
    };
  }

  /**
   * Get all units with overdue installments — for cron alert scanning.
   * Returns minimal data needed for notification creation.
   */
  static async getOverdueUnits(): Promise<Array<{
    unitId: string;
    unitLabel: string;
    projectId: string;
    buyerName: string;
    overdueCount: number;
    remainingAmount: number;
  }>> {
    const db = getAdminFirestore();

    // Query units where paymentSummary exists and has overdue > 0
    // Firestore doesn't support > on nested fields directly,
    // so we query all units with a paymentSummary and filter in-memory
    const unitsSnap = await db
      .collection(COLLECTIONS.PROPERTIES)
      .where('commercial.paymentSummary.overdueInstallments', '>', 0)
      .get();

    return unitsSnap.docs.map(doc => {
      const data = doc.data() as UnitDoc;
      const summary = data.commercial?.paymentSummary;

      return {
        unitId: doc.id,
        unitLabel: data.label ?? data.name ?? doc.id,
        projectId: data.project ?? '',
        buyerName: formatOwnerNames(data.commercial?.owners ?? []) ?? '-',
        overdueCount: summary?.overdueInstallments ?? 0,
        remainingAmount: summary?.remainingAmount ?? 0,
      };
    });
  }
}
