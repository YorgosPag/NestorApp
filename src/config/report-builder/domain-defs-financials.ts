/**
 * @module config/report-builder/domain-defs-financials
 * @enterprise ADR-268 Phase 5 — Financial Domain Definitions
 *
 * C1: Payment Plans (collectionGroup — subcollection of units)
 * C2: Cheques (top-level)
 * C3: Legal Contracts (top-level)
 */

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data)
// ============================================================================

const PAYMENT_PLAN_STATUSES = [
  'negotiation', 'draft', 'active', 'completed', 'cancelled',
] as const;

const PLAN_TYPES = ['joint', 'individual'] as const;

const TAX_REGIMES = [
  'vat_24', 'vat_suspension_3', 'transfer_tax_3', 'custom',
] as const;

const AGING_BUCKETS = ['0-30', '31-60', '61-90', '91-120', '120+'] as const;

// --- C2: Cheques ---
const CHEQUE_TYPES = ['bank_cheque', 'personal_cheque'] as const;
const CHEQUE_STATUSES = [
  'received', 'in_custody', 'deposited', 'clearing', 'cleared',
  'bounced', 'endorsed', 'cancelled', 'expired', 'replaced',
] as const;
const CHEQUE_CONTEXT_TYPES = ['unit_sale', 'supplier', 'contractor', 'other'] as const;
const CHEQUE_DIRECTIONS = ['incoming', 'outgoing'] as const;
const CHEQUE_MATURITY_BUCKETS = ['overdue', '0-7', '8-30', '31-60', '60+'] as const;

// --- C3: Legal Contracts ---
const CONTRACT_PHASES = ['preliminary', 'final', 'payoff'] as const;
const CONTRACT_STATUSES = ['draft', 'pending_signature', 'signed', 'completed'] as const;
const DEPOSIT_TERMS = ['forfeit', 'double_return', 'refund'] as const;
const STALE_BUCKETS = ['ok', 'slow', 'warning', 'critical'] as const;

// ============================================================================
// Computed Field Helpers — Payment Plans (C1)
// ============================================================================

interface InstallmentLike {
  dueDate?: string;
  status?: string;
  amount?: number;
  paidAmount?: number;
}

/** Terminal statuses — installment is settled */
const SETTLED_STATUSES = new Set(['paid', 'waived']);

function getInstallments(doc: Record<string, unknown>): InstallmentLike[] {
  const arr = doc['installments'];
  return Array.isArray(arr) ? (arr as InstallmentLike[]) : [];
}

function getUnpaidInstallments(installments: InstallmentLike[]): InstallmentLike[] {
  return installments.filter((i) => !SETTLED_STATUSES.has(i.status ?? ''));
}

function computeDaysOverdue(doc: Record<string, unknown>): number {
  const unpaid = getUnpaidInstallments(getInstallments(doc));
  if (unpaid.length === 0) return 0;
  const now = Date.now();
  let earliest = Infinity;
  for (const inst of unpaid) {
    if (inst.dueDate) {
      const due = new Date(inst.dueDate).getTime();
      if (due < earliest) earliest = due;
    }
  }
  if (earliest === Infinity) return 0;
  const diffMs = now - earliest;
  return diffMs > 0 ? Math.floor(diffMs / 86_400_000) : 0;
}

function computeAgingBucket(doc: Record<string, unknown>): string | null {
  const days = computeDaysOverdue(doc);
  if (days === 0) return null;
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  if (days <= 120) return '91-120';
  return '120+';
}

function computeCompletionPct(doc: Record<string, unknown>): number | null {
  const total = doc['totalAmount'];
  const paid = doc['paidAmount'];
  if (typeof total !== 'number' || total === 0) return null;
  if (typeof paid !== 'number') return 0;
  return Math.round((paid / total) * 10000) / 100; // 2 decimal places
}

function computeOverdueAmount(doc: Record<string, unknown>): number {
  const now = Date.now();
  let total = 0;
  for (const inst of getUnpaidInstallments(getInstallments(doc))) {
    if (inst.dueDate && new Date(inst.dueDate).getTime() < now) {
      const remaining = (inst.amount ?? 0) - (inst.paidAmount ?? 0);
      if (remaining > 0) total += remaining;
    }
  }
  return Math.round(total * 100) / 100;
}

function computeNextDueDate(doc: Record<string, unknown>): string | null {
  const unpaid = getUnpaidInstallments(getInstallments(doc));
  let earliest: string | null = null;
  for (const inst of unpaid) {
    if (inst.dueDate && (!earliest || inst.dueDate < earliest)) {
      earliest = inst.dueDate;
    }
  }
  return earliest;
}

function computeNextDueAmount(doc: Record<string, unknown>): number | null {
  const nextDate = computeNextDueDate(doc);
  if (!nextDate) return null;
  const unpaid = getUnpaidInstallments(getInstallments(doc));
  const match = unpaid.find((i) => i.dueDate === nextDate);
  if (!match) return null;
  return (match.amount ?? 0) - (match.paidAmount ?? 0);
}

// ============================================================================
// C1: Payment Plans (collectionGroup)
// ============================================================================

export const PAYMENT_PLANS_DEFINITION: DomainDefinition = {
  id: 'paymentPlans',
  collection: SUBCOLLECTIONS.UNIT_PAYMENT_PLANS,
  group: 'financial',
  queryType: 'collectionGroup',
  // eslint-disable-next-line custom/no-hardcoded-strings -- i18n key
  labelKey: 'domains.paymentPlans.label',
  descriptionKey: 'domains.paymentPlans.description',
  // eslint-disable-next-line custom/no-hardcoded-strings -- route template
  entityLinkPath: '/units/{unitId}',
  defaultSortField: 'updatedAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'ownerName', labelKey: 'domains.paymentPlans.fields.ownerName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: 'domains.paymentPlans.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: PAYMENT_PLAN_STATUSES, enumLabelPrefix: 'domains.paymentPlans.enums.status' },
    { key: 'planType', labelKey: 'domains.paymentPlans.fields.planType', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: PLAN_TYPES, enumLabelPrefix: 'domains.paymentPlans.enums.planType' },
    // Amounts
    { key: 'totalAmount', labelKey: 'domains.paymentPlans.fields.totalAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'paidAmount', labelKey: 'domains.paymentPlans.fields.paidAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'remainingAmount', labelKey: 'domains.paymentPlans.fields.remainingAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    // Tax
    { key: 'taxRegime', labelKey: 'domains.paymentPlans.fields.taxRegime', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: TAX_REGIMES, enumLabelPrefix: 'domains.paymentPlans.enums.taxRegime' },
    { key: 'taxRate', labelKey: 'domains.paymentPlans.fields.taxRate', type: 'percentage', filterable: true, sortable: true, defaultVisible: false, format: 'percentage' },
    // Refs
    { key: 'projectId', labelKey: 'domains.paymentPlans.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'buildingId', labelKey: 'domains.paymentPlans.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'unitId', labelKey: 'domains.paymentPlans.fields.unit', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'units', refDisplayField: 'name' },
    { key: 'ownerContactId', labelKey: 'domains.paymentPlans.fields.owner', type: 'text', filterable: false, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'firstName' },
    // Computed — Aging
    { key: 'daysOverdue', labelKey: 'domains.paymentPlans.fields.daysOverdue', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number', computed: true, computeFn: computeDaysOverdue },
    { key: 'agingBucket', labelKey: 'domains.paymentPlans.fields.agingBucket', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: AGING_BUCKETS, enumLabelPrefix: 'domains.paymentPlans.enums.agingBucket', computed: true, computeFn: computeAgingBucket },
    { key: 'completionPct', labelKey: 'domains.paymentPlans.fields.completionPct', type: 'percentage', filterable: true, sortable: true, defaultVisible: true, format: 'percentage', computed: true, computeFn: computeCompletionPct },
    { key: 'overdueAmount', labelKey: 'domains.paymentPlans.fields.overdueAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeOverdueAmount },
    { key: 'nextDueDate', labelKey: 'domains.paymentPlans.fields.nextDueDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date', computed: true, computeFn: computeNextDueDate },
    { key: 'nextDueAmount', labelKey: 'domains.paymentPlans.fields.nextDueAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency', computed: true, computeFn: computeNextDueAmount },
    // Dates
    { key: 'createdAt', labelKey: 'domains.paymentPlans.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.paymentPlans.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// Computed Field Helpers — Cheques (C2)
// ============================================================================

/** Terminal cheque statuses (no longer in active lifecycle) */
const CHEQUE_TERMINAL = new Set(['cleared', 'endorsed', 'cancelled', 'expired', 'replaced']);

function computeDaysToMaturity(doc: Record<string, unknown>): number | null {
  const maturity = doc['maturityDate'];
  if (typeof maturity !== 'string') return null;
  return Math.round((new Date(maturity).getTime() - Date.now()) / 86_400_000);
}

function computeMaturityBucket(doc: Record<string, unknown>): string | null {
  const days = computeDaysToMaturity(doc);
  if (days === null) return null;
  if (days < 0) return 'overdue';
  if (days <= 7) return '0-7';
  if (days <= 30) return '8-30';
  if (days <= 60) return '31-60';
  return '60+';
}

function computeChequeIsOverdue(doc: Record<string, unknown>): boolean {
  const maturity = doc['maturityDate'];
  const status = doc['status'];
  if (typeof maturity !== 'string' || typeof status !== 'string') return false;
  return new Date(maturity).getTime() < Date.now() && !CHEQUE_TERMINAL.has(status);
}

// ============================================================================
// C2: Cheques
// ============================================================================

export const CHEQUES_DEFINITION: DomainDefinition = {
  id: 'cheques',
  collection: COLLECTIONS.CHEQUES,
  group: 'financial',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.cheques.label',
  descriptionKey: 'domains.cheques.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/cheques/{chequeId}',
  defaultSortField: 'maturityDate',
  defaultSortDirection: 'asc',
  fields: [
    // Identity
    { key: 'chequeNumber', labelKey: 'domains.cheques.fields.chequeNumber', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'chequeType', labelKey: 'domains.cheques.fields.chequeType', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CHEQUE_TYPES, enumLabelPrefix: 'domains.cheques.enums.chequeType' },
    { key: 'amount', labelKey: 'domains.cheques.fields.amount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'bankName', labelKey: 'domains.cheques.fields.bankName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'drawerName', labelKey: 'domains.cheques.fields.drawerName', type: 'text', filterable: true, sortable: true, defaultVisible: true },
    { key: 'status', labelKey: 'domains.cheques.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CHEQUE_STATUSES, enumLabelPrefix: 'domains.cheques.enums.status' },
    // Dates
    { key: 'issueDate', labelKey: 'domains.cheques.fields.issueDate', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'maturityDate', labelKey: 'domains.cheques.fields.maturityDate', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    // Flags
    { key: 'postDated', labelKey: 'domains.cheques.fields.postDated', type: 'boolean', filterable: true, sortable: false, defaultVisible: false },
    { key: 'crossedCheque', labelKey: 'domains.cheques.fields.crossedCheque', type: 'boolean', filterable: true, sortable: false, defaultVisible: false },
    // Context
    { key: 'context.direction', labelKey: 'domains.cheques.fields.direction', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CHEQUE_DIRECTIONS, enumLabelPrefix: 'domains.cheques.enums.direction' },
    { key: 'context.type', labelKey: 'domains.cheques.fields.contextType', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: CHEQUE_CONTEXT_TYPES, enumLabelPrefix: 'domains.cheques.enums.contextType' },
    { key: 'context.projectId', labelKey: 'domains.cheques.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'projects', refDisplayField: 'name' },
    // Computed — Maturity
    { key: 'daysToMaturity', labelKey: 'domains.cheques.fields.daysToMaturity', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number', computed: true, computeFn: computeDaysToMaturity },
    { key: 'maturityBucket', labelKey: 'domains.cheques.fields.maturityBucket', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: CHEQUE_MATURITY_BUCKETS, enumLabelPrefix: 'domains.cheques.enums.maturityBucket', computed: true, computeFn: computeMaturityBucket },
    { key: 'isOverdue', labelKey: 'domains.cheques.fields.isOverdue', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: computeChequeIsOverdue },
    // Computed — Chain
    { key: 'isReplacement', labelKey: 'domains.cheques.fields.isReplacement', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: (doc) => doc['replacesChequeId'] != null },
    { key: 'hasBeenReplaced', labelKey: 'domains.cheques.fields.hasBeenReplaced', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: (doc) => doc['replacedByChequeId'] != null },
    { key: 'isInChain', labelKey: 'domains.cheques.fields.isInChain', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: (doc) => doc['replacesChequeId'] != null || doc['replacedByChequeId'] != null },
    // Audit
    { key: 'createdAt', labelKey: 'domains.cheques.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
  ],
};

// ============================================================================
// Computed Field Helpers — Legal Contracts (C3)
// ============================================================================

function computeContractDaysInStatus(doc: Record<string, unknown>): number | null {
  const updated = doc['updatedAt'];
  if (typeof updated !== 'string') return null;
  return Math.max(0, Math.floor((Date.now() - new Date(updated).getTime()) / 86_400_000));
}

function computeDaysSinceSigned(doc: Record<string, unknown>): number | null {
  const signed = doc['signedAt'];
  if (typeof signed !== 'string') return null;
  return Math.max(0, Math.floor((Date.now() - new Date(signed).getTime()) / 86_400_000));
}

function computeIsStale(doc: Record<string, unknown>): boolean {
  if (doc['status'] !== 'pending_signature') return false;
  const days = computeContractDaysInStatus(doc);
  return days !== null && days > 90;
}

function computePhaseProgressDays(doc: Record<string, unknown>): number | null {
  const created = doc['createdAt'];
  if (typeof created !== 'string') return null;
  return Math.max(0, Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000));
}

function computeStaleBucket(doc: Record<string, unknown>): string | null {
  const days = computeContractDaysInStatus(doc);
  if (days === null) return null;
  if (days <= 30) return 'ok';
  if (days <= 60) return 'slow';
  if (days <= 90) return 'warning';
  return 'critical';
}

// ============================================================================
// C3: Legal Contracts
// ============================================================================

export const LEGAL_CONTRACTS_DEFINITION: DomainDefinition = {
  id: 'legalContracts',
  collection: COLLECTIONS.LEGAL_CONTRACTS,
  group: 'financial',
  // eslint-disable-next-line custom/no-hardcoded-strings
  labelKey: 'domains.legalContracts.label',
  descriptionKey: 'domains.legalContracts.description',
  // eslint-disable-next-line custom/no-hardcoded-strings
  entityLinkPath: '/units/{unitId}',
  defaultSortField: 'updatedAt',
  defaultSortDirection: 'desc',
  fields: [
    // Identity
    { key: 'phase', labelKey: 'domains.legalContracts.fields.phase', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CONTRACT_PHASES, enumLabelPrefix: 'domains.legalContracts.enums.phase' },
    { key: 'status', labelKey: 'domains.legalContracts.fields.status', type: 'enum', filterable: true, sortable: true, defaultVisible: true, enumValues: CONTRACT_STATUSES, enumLabelPrefix: 'domains.legalContracts.enums.status' },
    // Financial
    { key: 'contractAmount', labelKey: 'domains.legalContracts.fields.contractAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: true, format: 'currency' },
    { key: 'depositAmount', labelKey: 'domains.legalContracts.fields.depositAmount', type: 'currency', filterable: true, sortable: true, defaultVisible: false, format: 'currency' },
    { key: 'depositTerms', labelKey: 'domains.legalContracts.fields.depositTerms', type: 'enum', filterable: true, sortable: false, defaultVisible: false, enumValues: DEPOSIT_TERMS, enumLabelPrefix: 'domains.legalContracts.enums.depositTerms' },
    // Refs
    { key: 'projectId', labelKey: 'domains.legalContracts.fields.project', type: 'text', filterable: true, sortable: false, defaultVisible: true, refDomain: 'projects', refDisplayField: 'name' },
    { key: 'buildingId', labelKey: 'domains.legalContracts.fields.building', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'buildings', refDisplayField: 'name' },
    { key: 'unitId', labelKey: 'domains.legalContracts.fields.unit', type: 'text', filterable: true, sortable: false, defaultVisible: false, refDomain: 'units', refDisplayField: 'name' },
    { key: 'primaryBuyerContactId', labelKey: 'domains.legalContracts.fields.buyer', type: 'text', filterable: false, sortable: false, defaultVisible: false, refDomain: 'individuals', refDisplayField: 'firstName' },
    // Dates
    { key: 'signedAt', labelKey: 'domains.legalContracts.fields.signedAt', type: 'date', filterable: true, sortable: true, defaultVisible: true, format: 'date' },
    { key: 'completedAt', labelKey: 'domains.legalContracts.fields.completedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'createdAt', labelKey: 'domains.legalContracts.fields.createdAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    { key: 'updatedAt', labelKey: 'domains.legalContracts.fields.updatedAt', type: 'date', filterable: true, sortable: true, defaultVisible: false, format: 'date' },
    // Computed — Bottleneck detection
    { key: 'daysInStatus', labelKey: 'domains.legalContracts.fields.daysInStatus', type: 'number', filterable: true, sortable: true, defaultVisible: true, format: 'number', computed: true, computeFn: computeContractDaysInStatus },
    { key: 'daysSinceSigned', labelKey: 'domains.legalContracts.fields.daysSinceSigned', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computeDaysSinceSigned },
    { key: 'isStale', labelKey: 'domains.legalContracts.fields.isStale', type: 'boolean', filterable: true, sortable: false, defaultVisible: false, computed: true, computeFn: computeIsStale },
    { key: 'phaseProgressDays', labelKey: 'domains.legalContracts.fields.phaseProgressDays', type: 'number', filterable: true, sortable: true, defaultVisible: false, format: 'number', computed: true, computeFn: computePhaseProgressDays },
    { key: 'staleBucket', labelKey: 'domains.legalContracts.fields.staleBucket', type: 'enum', filterable: true, sortable: true, defaultVisible: false, enumValues: STALE_BUCKETS, enumLabelPrefix: 'domains.legalContracts.enums.staleBucket', computed: true, computeFn: computeStaleBucket },
  ],
};
