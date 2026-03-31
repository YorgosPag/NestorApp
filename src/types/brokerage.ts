/**
 * =============================================================================
 * Brokerage Types — Μεσιτικές Συμφωνίες & Προμήθειες
 * =============================================================================
 *
 * Types για τη διαχείριση μεσιτικών συμβάσεων και υπολογισμό προμηθειών.
 * Ελληνική αγορά ακινήτων — ΓΕ.ΜΗ. αδειοδοτημένοι μεσίτες.
 *
 * @module types/brokerage
 * @enterprise ADR-230 - Contract Workflow (SPEC-230B)
 */

// ============================================================================
// BROKERAGE AGREEMENT
// ============================================================================

/** Τύπος αποκλειστικότητας μεσιτικής σύμβασης */
export type ExclusivityType = 'exclusive' | 'non_exclusive' | 'semi_exclusive';

/** Τύπος υπολογισμού προμήθειας */
export type CommissionType = 'percentage' | 'fixed' | 'tiered';

/** Κατάσταση μεσιτικής σύμβασης */
export type BrokerageStatus = 'active' | 'expired' | 'terminated';

/**
 * Μεσιτική σύμβαση — Firestore document.
 * Collection: brokerage_agreements
 *
 * Σχέση: 1 μεσίτης (contact with real_estate_agent persona) → N agreements
 * Scope: project ή unit level
 */
export interface BrokerageAgreement {
  id: string;

  // === Αναφορές ===
  /** Contact ID μεσίτη (πρέπει να έχει real_estate_agent persona) */
  agentContactId: string;
  /** Denormalized όνομα μεσίτη */
  agentName: string;
  /** Scope σύμβασης */
  scope: 'project' | 'unit';
  /** Project ID (πάντα παρόν) */
  projectId: string;
  /** Unit ID (μόνο αν scope === 'unit') */
  unitId: string | null;

  // === Όροι ===
  exclusivity: ExclusivityType;
  commissionType: CommissionType;
  /** Ποσοστό προμήθειας (π.χ. 2 = 2%) — μόνο αν commissionType === 'percentage' */
  commissionPercentage: number | null;
  /** Σταθερό ποσό προμήθειας (EUR) — μόνο αν commissionType === 'fixed' */
  commissionFixedAmount: number | null;

  // === Κατάσταση ===
  status: BrokerageStatus;

  // === Ημερομηνίες ===
  startDate: string; // ISO date
  endDate: string | null; // ISO date — null = αόριστη διάρκεια
  terminatedAt: string | null; // ISO timestamp

  // === Tenant ===
  /** Company ID for tenant-scoped Firestore rules */
  companyId: string;

  // === Audit ===
  notes: string | null;
  createdBy: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// ============================================================================
// COMMISSION RECORD
// ============================================================================

/** Κατάσταση πληρωμής προμήθειας */
export type CommissionPaymentStatus = 'pending' | 'paid' | 'cancelled';

/**
 * Εγγραφή προμήθειας — δημιουργείται κατά την πώληση.
 * Collection: commission_records
 *
 * ΚΑΝΟΝΑΣ: Πληρώνεται ΜΟΝΟ ο μεσίτης που έφερε τον αγοραστή,
 * όχι αυτόματα — ο χρήστης επιλέγει στο SellDialog.
 */
export interface CommissionRecord {
  id: string;

  // === Αναφορές ===
  brokerageAgreementId: string;
  agentContactId: string;
  agentName: string;
  unitId: string;
  projectId: string;
  /** Primary buyer contact ID (snapshot at commission time) */
  primaryBuyerContactId: string;

  // === Ποσά ===
  salePrice: number;
  commissionAmount: number;
  commissionType: CommissionType;
  commissionPercentage: number | null;

  // === Κατάσταση ===
  paymentStatus: CommissionPaymentStatus;
  paidAt: string | null; // ISO timestamp

  // === Tenant ===
  /** Company ID for tenant-scoped Firestore rules */
  companyId: string;

  // === Audit ===
  createdBy: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

// ============================================================================
// COMMISSION CALCULATION
// ============================================================================

/** Input για υπολογισμό προμήθειας */
export interface CommissionCalculationInput {
  commissionType: CommissionType;
  salePrice: number;
  commissionPercentage: number | null;
  commissionFixedAmount: number | null;
}

/**
 * Υπολογίζει προμήθεια μεσίτη.
 * Pure function — no side effects.
 *
 * @returns Ποσό προμήθειας σε EUR (στρογγυλοποίηση 2 δεκαδικών)
 */
export function calculateCommission(input: CommissionCalculationInput): number {
  if (input.commissionType === 'percentage' && input.commissionPercentage !== null) {
    return Math.round(input.salePrice * (input.commissionPercentage / 100) * 100) / 100;
  }
  if (input.commissionType === 'fixed' && input.commissionFixedAmount !== null) {
    return input.commissionFixedAmount;
  }
  return 0;
}

// ============================================================================
// CREATE/UPDATE INPUTS
// ============================================================================

/** Input για δημιουργία μεσιτικής σύμβασης */
export interface CreateBrokerageAgreementInput {
  agentContactId: string;
  agentName: string;
  scope: 'project' | 'unit';
  projectId: string;
  unitId?: string | null;
  exclusivity: ExclusivityType;
  commissionType: CommissionType;
  commissionPercentage?: number | null;
  commissionFixedAmount?: number | null;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
}

/** Input για εγγραφή προμήθειας κατά την πώληση */
export interface RecordCommissionInput {
  brokerageAgreementId: string;
  agentContactId: string;
  agentName: string;
  unitId: string;
  projectId: string;
  primaryBuyerContactId: string;
  salePrice: number;
  commissionType: CommissionType;
  commissionPercentage: number | null;
  commissionFixedAmount: number | null;
}

// ============================================================================
// EXCLUSIVITY VALIDATION
// ============================================================================

/** Severity validation issue */
export type ValidationSeverity = 'error' | 'warning';

/** Μεμονωμένο ζήτημα που βρέθηκε κατά τον έλεγχο αποκλειστικότητας */
export interface ExclusivityValidationIssue {
  severity: ValidationSeverity;
  /** i18n key (π.χ. sales.legal.exclusivityConflictProjectExclusive) */
  messageKey: string;
  /** interpolation params για i18n */
  messageParams: Record<string, string>;
  conflictingAgreementId: string | null;
  conflictingAgentName: string | null;
}

/** Input για τον έλεγχο αποκλειστικότητας */
export interface ExclusivityValidationInput {
  projectId: string;
  unitId: string | null;
  scope: 'project' | 'unit';
  exclusivity: ExclusivityType;
  /** Εξαίρεση εαυτού κατά update — δεν ελέγχει τη σύμβαση με αυτό το ID */
  excludeAgreementId?: string;
}

/** Αποτέλεσμα validation αποκλειστικότητας (enhanced) */
export interface ExclusivityValidationResult {
  /** true αν 0 errors (warnings OK) */
  canProceed: boolean;
  /** Λίστα errors + warnings */
  issues: ExclusivityValidationIssue[];
  /** Rule 3: units που εξαιρούνται (project exclusive + existing unit agreements) */
  excludedUnitIds: string[];
  // --- backward compat (deprecated) ---
  /** @deprecated Χρησιμοποίησε canProceed */
  valid: boolean;
  /** @deprecated Χρησιμοποίησε issues[0].conflictingAgreementId */
  conflictingAgreementId: string | null;
  /** @deprecated Χρησιμοποίησε issues[0].messageKey */
  reason: string | null;
}
