/**
 * 🏢 Payment Report Types — ADR-234 Phase 5
 *
 * Types for payment report generation and Excel export.
 *
 * @module services/payment-export/types
 */

import type { PaymentPlanStatus, LoanStatus, LoanTrackingStatus } from '@/types/payment-plan';

// =============================================================================
// REPORT ROW — One row per unit
// =============================================================================

export interface PaymentReportRow {
  unitId: string;
  unitLabel: string;
  buildingName: string;
  buyerName: string;
  planStatus: PaymentPlanStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paidPercentage: number;
  totalInstallments: number;
  paidInstallments: number;
  overdueInstallments: number;
  nextInstallmentDate: string | null;
  nextInstallmentAmount: number | null;
  loanStatus: LoanStatus;
  primaryLoanStatus: LoanTrackingStatus | null;
  primaryLoanBank: string | null;
}

// =============================================================================
// REPORT DATA — Full project report
// =============================================================================

export interface PaymentReportSummary {
  totalUnitsWithPlan: number;
  totalUnitsWithoutPlan: number;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  totalOverdueCount: number;
  paidPercentage: number;
}

export interface PaymentReportData {
  projectId: string;
  projectName: string;
  generatedAt: string;
  currency: 'EUR';
  rows: PaymentReportRow[];
  summary: PaymentReportSummary;
}
