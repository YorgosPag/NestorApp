/**
 * FrameworkAgreement — Procurement Framework Agreement (ADR-330 Phase 5)
 *
 * Multi-project contracts with vendor commitments and volume-based discount
 * rules. MVP scope is reference-only: agreements are stored, listed, and
 * editable, but auto-application of discounts on PO totals is deferred to
 * Phase 5.5 (requires PO listener + recompute hook).
 *
 * Schema decisions (ADR-330 §3 Phase 5):
 *   - Greenfield collection `framework_agreements/`
 *   - Soft-delete (`isDeleted`) for audit consistency with PO/Material patterns
 *   - `agreementNumber` unique per (companyId, agreementNumber)
 *   - Vendor FK to `contacts` (supplier persona), single vendor per agreement
 *   - Scope filters: `applicableProjectIds`/`applicableMaterialIds`/
 *     `applicableAtoeCategoryCodes` — null = all, empty array = none, list = specific
 *   - Discount: `flat` percent OR `volume_breakpoints` (array, sorted ASC by threshold)
 */

import type { Timestamp } from 'firebase/firestore';

export const FRAMEWORK_AGREEMENT_STATUSES = [
  'draft',
  'active',
  'expired',
  'terminated',
] as const;
export type FrameworkAgreementStatus = (typeof FRAMEWORK_AGREEMENT_STATUSES)[number];

export const DISCOUNT_TYPES = ['flat', 'volume_breakpoints'] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export interface VolumeBreakpoint {
  /** Cumulative spend threshold in EUR — applies once running total reaches this value */
  thresholdEur: number;
  /** Discount % applied beyond this threshold (0–100) */
  discountPercent: number;
}

export interface FrameworkAgreement {
  id: string;                                    // fwa_*
  companyId: string;
  agreementNumber: string;                       // unique per (companyId), e.g. "FWA-2026-001"
  title: string;
  description: string | null;
  vendorContactId: string;                       // FK contacts (supplier persona)
  status: FrameworkAgreementStatus;

  // Validity period
  validFrom: Timestamp;
  validUntil: Timestamp;

  // Scope (null = all, [] = none, [...] = specific)
  applicableProjectIds: string[] | null;
  applicableMaterialIds: string[] | null;
  applicableAtoeCategoryCodes: string[] | null;

  // Financial terms
  currency: string;                              // 'EUR' MVP
  totalCommitment: number | null;                // contractual € volume

  // Discount rules
  discountType: DiscountType;
  flatDiscountPercent: number | null;            // if discountType === 'flat'
  volumeBreakpoints: VolumeBreakpoint[];         // if discountType === 'volume_breakpoints'

  // Lifecycle
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface CreateFrameworkAgreementDTO {
  agreementNumber: string;
  title: string;
  description?: string | null;
  vendorContactId: string;
  status?: FrameworkAgreementStatus;
  validFrom: string;                             // ISO at API boundary
  validUntil: string;                            // ISO
  applicableProjectIds?: string[] | null;
  applicableMaterialIds?: string[] | null;
  applicableAtoeCategoryCodes?: string[] | null;
  currency?: string;
  totalCommitment?: number | null;
  discountType: DiscountType;
  flatDiscountPercent?: number | null;
  volumeBreakpoints?: VolumeBreakpoint[];
}

export interface UpdateFrameworkAgreementDTO {
  agreementNumber?: string;
  title?: string;
  description?: string | null;
  vendorContactId?: string;
  status?: FrameworkAgreementStatus;
  validFrom?: string;
  validUntil?: string;
  applicableProjectIds?: string[] | null;
  applicableMaterialIds?: string[] | null;
  applicableAtoeCategoryCodes?: string[] | null;
  currency?: string;
  totalCommitment?: number | null;
  discountType?: DiscountType;
  flatDiscountPercent?: number | null;
  volumeBreakpoints?: VolumeBreakpoint[];
}

export interface FrameworkAgreementFilters {
  status?: FrameworkAgreementStatus;
  vendorContactId?: string;
  search?: string;                               // matches agreementNumber OR title (substring, case-insensitive)
  includeDeleted?: boolean;
}

export class FrameworkAgreementNumberConflictError extends Error {
  readonly conflictingAgreementId: string;
  constructor(agreementNumber: string, conflictingAgreementId: string) {
    super(`Framework agreement number "${agreementNumber}" already exists`);
    this.name = 'FrameworkAgreementNumberConflictError';
    this.conflictingAgreementId = conflictingAgreementId;
  }
}

export class FrameworkAgreementValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = 'FrameworkAgreementValidationError';
    this.field = field;
  }
}
