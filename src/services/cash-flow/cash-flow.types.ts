/**
 * @fileoverview Cash Flow Forecast Types — ADR-268 Phase 8
 * @description All interfaces for the Cash Flow Forecast standalone module.
 * @see SPEC-007-phases.md Phase 8 (10 decisions by Γιώργος)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// =============================================================================
// SCENARIO
// =============================================================================

/** 3 σενάρια πρόβλεψης (Q3) */
export type CashFlowScenario = 'optimistic' | 'realistic' | 'pessimistic';

/** Ποσοστά είσπραξης ανά σενάριο */
export const SCENARIO_RATES: Record<CashFlowScenario, number> = {
  optimistic: 1.0,
  realistic: 0.85,
  pessimistic: 0.70,
} as const;

/** Μέσος αριθμός ημερών καθυστέρησης ανά σενάριο */
export const SCENARIO_DELAY_DAYS: Record<CashFlowScenario, number> = {
  optimistic: 0,
  realistic: 30,
  pessimistic: 60,
} as const;

// =============================================================================
// SETTINGS (Firestore: settings/{companyId}.cashFlowConfig)
// =============================================================================

export type RecurringFrequency = 'monthly' | 'quarterly' | 'annual';

export type RecurringCategory =
  | 'rent'
  | 'insurance'
  | 'utilities'
  | 'salaries'
  | 'loan'
  | 'taxes'
  | 'maintenance'
  | 'other';

/** Πάγια πληρωμή (Q4, Q8) */
export interface RecurringPayment {
  id: string;
  label: string;
  amount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  category: RecurringCategory;
  projectId?: string;
}

/** Ρυθμίσεις Cash Flow (Q2, Q8) — αποθηκεύεται στο Firestore settings */
export interface CashFlowConfig {
  initialBalance: number;
  updatedAt: string;
  recurringPayments: RecurringPayment[];
}

/** Default config για νέες εταιρείες */
export const DEFAULT_CASH_FLOW_CONFIG: CashFlowConfig = {
  initialBalance: 0,
  updatedAt: new Date().toISOString(),
  recurringPayments: [],
};

// =============================================================================
// MONTHLY PROJECTION ROW
// =============================================================================

/** Μηνιαία γραμμή πρόβλεψης (Q1) */
export interface CashFlowMonthRow {
  month: string;
  label: string;
  openingBalance: number;
  installmentsDue: number;
  chequesMaturingAmount: number;
  chequesMaturingCount: number;
  otherInflows: number;
  totalInflow: number;
  purchaseOrders: number;
  invoicesDue: number;
  efka: number;
  recurringPayments: number;
  totalOutflow: number;
  netCashFlow: number;
  closingBalance: number;
}

// =============================================================================
// SCENARIO PROJECTION
// =============================================================================

/** Αποτέλεσμα σεναρίου */
export interface ScenarioProjection {
  scenario: CashFlowScenario;
  collectionRate: number;
  months: CashFlowMonthRow[];
  totalInflow: number;
  totalOutflow: number;
  endingBalance: number;
  lowestBalance: number;
  lowestBalanceMonth: string;
  cashRunwayMonths: number;
}

// =============================================================================
// FORECAST VS ACTUAL (Q9)
// =============================================================================

export interface ActualVsForecast {
  month: string;
  label: string;
  forecastInflow: number;
  actualInflow: number;
  inflowVariance: number;
  inflowVariancePct: number;
  forecastOutflow: number;
  actualOutflow: number;
  outflowVariance: number;
  outflowVariancePct: number;
  forecastBalance: number;
  actualBalance: number;
}

// =============================================================================
// PDC CALENDAR (Q6)
// =============================================================================

export interface PDCCalendarCheque {
  id: string;
  amount: number;
  drawerName: string;
  status: string;
  chequeNumber: string;
}

export interface PDCCalendarDay {
  date: string;
  totalAmount: number;
  chequeCount: number;
  cheques: PDCCalendarCheque[];
}

// =============================================================================
// ALERTS (Q10)
// =============================================================================

export type CashFlowAlertType =
  | 'low-cash'
  | 'pdc-maturity'
  | 'collection-rate-drop';

export type CashFlowAlertSeverity = 'warning' | 'critical';

export interface CashFlowAlert {
  type: CashFlowAlertType;
  severity: CashFlowAlertSeverity;
  message: string;
  month?: string;
  value?: number;
  threshold?: number;
}

// =============================================================================
// ALERT THRESHOLDS
// =============================================================================

export interface AlertThresholds {
  lowCashWarning: number;
  lowCashCritical: number;
  pdcMaturityDays: number;
  collectionRateMinPct: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  lowCashWarning: 10_000,
  lowCashCritical: 0,
  pdcMaturityDays: 7,
  collectionRateMinPct: 80,
};

// =============================================================================
// API RESPONSE / REQUEST
// =============================================================================

export interface CashFlowFilter {
  companyId: string;
  projectId?: string;
  buildingId?: string;
  months?: number;
}

export interface CashFlowAPIResponse {
  config: CashFlowConfig;
  scenarios: ScenarioProjection[];
  actuals: ActualVsForecast[];
  pdcCalendar: PDCCalendarDay[];
  alerts: CashFlowAlert[];
  filter: { projectId?: string; buildingId?: string };
  generatedAt: string;
}

// =============================================================================
// RAW DATA (internal — used between fetcher and engine)
// =============================================================================

export interface RawInstallment {
  paymentPlanId: string;
  propertyId: string;
  projectId: string;
  buildingId: string;
  amount: number;
  dueDate: string;
  status: string;
  paidAmount: number;
  paidDate: string | null;
}

export interface RawCheque {
  chequeId: string;
  amount: number;
  maturityDate: string;
  status: string;
  drawerName: string;
  chequeNumber: string;
  direction: string;
  projectId?: string;
}

export interface RawPurchaseOrder {
  id: string;
  total: number;
  paymentDueDate: string;
  status: string;
  projectId: string;
  buildingId?: string;
}

export interface RawInvoice {
  invoiceId: string;
  balanceDue: number;
  dueDate: string;
  paymentStatus: string;
  projectId?: string;
}

export interface RawBankTransaction {
  transactionId: string;
  amount: number;
  direction: 'credit' | 'debit';
  valueDate: string;
}

export interface RawEFKA {
  paymentId: string;
  amount: number;
  dueDate: string;
  status: string;
}

export interface RawCashFlowData {
  config: CashFlowConfig;
  installments: RawInstallment[];
  cheques: RawCheque[];
  purchaseOrders: RawPurchaseOrder[];
  invoices: RawInvoice[];
  bankTransactions: RawBankTransaction[];
  efka: RawEFKA[];
}
