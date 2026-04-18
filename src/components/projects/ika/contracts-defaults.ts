/**
 * =============================================================================
 * IKA/EFKA Labor Compliance — Default Configuration & Factory Helpers
 * =============================================================================
 *
 * Extracted from contracts.ts (C.5.23 SRP split) — ADR-314.
 * Contains KPK 781 default rates/classes + EFKA declaration factory.
 *
 * @module components/projects/ika/contracts-defaults
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import { nowISO } from '@/lib/date-local';
import type {
  ContributionRates,
  EfkaDeclarationData,
  EfkaDocument,
  InsuranceClass,
  LaborComplianceConfig,
} from './contracts';

// ============================================================================
// DEFAULT CONFIGURATION (KPK 781 — Οικοδομοτεχνικά, 01/01/2025)
// ============================================================================

/**
 * Default contribution rates for KPK 781 (construction workers).
 * Source: ΕΦΚΑ Εγκύκλιος 39/2024 — effective 01/01/2025.
 * Total: Employer 57.427%, Employee 16.820%, Combined 74.247%.
 */
export const DEFAULT_CONTRIBUTION_RATES: ContributionRates = {
  mainPension: { employer: 13.33, employee: 6.67 },
  health: { employer: 4.55, employee: 2.55 },
  supplementary: { employer: 3.25, employee: 3.25 },
  unemployment: { employer: 2.43, employee: 2.00 },
  iek: { employer: 0.837, employee: 2.32 },
  oncePayment: { employee: 4.00 },
};

/**
 * Default insurance classes for construction workers (2025).
 * Source: ΕΦΚΑ Εγκύκλιος 39/2024 — adjusted +2.4% from 01/01/2025.
 * Contains representative classes — full 28-class table loaded from config.
 */
export const DEFAULT_INSURANCE_CLASSES: InsuranceClass[] = [
  { classNumber: 1, minDailyWage: 0.01, maxDailyWage: 11.45, imputedDailyWage: 8.22, year: 2025 },
  { classNumber: 2, minDailyWage: 11.46, maxDailyWage: 13.47, imputedDailyWage: 12.46, year: 2025 },
  { classNumber: 3, minDailyWage: 13.48, maxDailyWage: 15.57, imputedDailyWage: 14.52, year: 2025 },
  { classNumber: 4, minDailyWage: 15.58, maxDailyWage: 18.57, imputedDailyWage: 17.07, year: 2025 },
  { classNumber: 5, minDailyWage: 18.58, maxDailyWage: 21.12, imputedDailyWage: 19.85, year: 2025 },
  { classNumber: 6, minDailyWage: 21.13, maxDailyWage: 24.13, imputedDailyWage: 22.63, year: 2025 },
  { classNumber: 7, minDailyWage: 24.14, maxDailyWage: 27.14, imputedDailyWage: 25.63, year: 2025 },
  { classNumber: 8, minDailyWage: 27.15, maxDailyWage: 34.52, imputedDailyWage: 30.83, year: 2025 },
  { classNumber: 9, minDailyWage: 34.53, maxDailyWage: 37.73, imputedDailyWage: 36.13, year: 2025 },
  { classNumber: 10, minDailyWage: 37.74, maxDailyWage: 40.49, imputedDailyWage: 39.08, year: 2025 },
  { classNumber: 11, minDailyWage: 40.50, maxDailyWage: 43.70, imputedDailyWage: 42.10, year: 2025 },
  { classNumber: 12, minDailyWage: 43.71, maxDailyWage: 46.90, imputedDailyWage: 45.30, year: 2025 },
  { classNumber: 13, minDailyWage: 46.91, maxDailyWage: 52.96, imputedDailyWage: 49.93, year: 2025 },
  { classNumber: 14, minDailyWage: 52.97, maxDailyWage: 56.17, imputedDailyWage: 54.57, year: 2025 },
  { classNumber: 15, minDailyWage: 56.18, maxDailyWage: 59.37, imputedDailyWage: 57.77, year: 2025 },
  { classNumber: 16, minDailyWage: 59.38, maxDailyWage: 62.57, imputedDailyWage: 60.97, year: 2025 },
  { classNumber: 17, minDailyWage: 62.58, maxDailyWage: 66.00, imputedDailyWage: 64.29, year: 2025 },
  { classNumber: 18, minDailyWage: 66.01, maxDailyWage: 69.40, imputedDailyWage: 67.70, year: 2025 },
  { classNumber: 19, minDailyWage: 69.41, maxDailyWage: 72.61, imputedDailyWage: 71.01, year: 2025 },
  { classNumber: 20, minDailyWage: 72.62, maxDailyWage: 75.81, imputedDailyWage: 74.21, year: 2025 },
  { classNumber: 21, minDailyWage: 75.82, maxDailyWage: 79.24, imputedDailyWage: 77.53, year: 2025 },
  { classNumber: 22, minDailyWage: 79.25, maxDailyWage: 84.04, imputedDailyWage: 81.64, year: 2025 },
  { classNumber: 23, minDailyWage: 84.05, maxDailyWage: 87.24, imputedDailyWage: 85.64, year: 2025 },
  { classNumber: 24, minDailyWage: 87.25, maxDailyWage: 90.44, imputedDailyWage: 88.84, year: 2025 },
  { classNumber: 25, minDailyWage: 90.45, maxDailyWage: 97.04, imputedDailyWage: 93.74, year: 2025 },
  { classNumber: 26, minDailyWage: 97.05, maxDailyWage: 100.25, imputedDailyWage: 98.65, year: 2025 },
  { classNumber: 27, minDailyWage: 100.26, maxDailyWage: 106.25, imputedDailyWage: 103.25, year: 2025 },
  { classNumber: 28, minDailyWage: 106.26, maxDailyWage: 999999, imputedDailyWage: 109.69, year: 2025 },
];

/**
 * Default labor compliance configuration.
 * Used as fallback when system/settings.laborCompliance is not yet configured.
 */
export const DEFAULT_LABOR_COMPLIANCE_CONFIG: LaborComplianceConfig = {
  insuranceClasses: DEFAULT_INSURANCE_CLASSES,
  contributionRates: DEFAULT_CONTRIBUTION_RATES,
  lastUpdated: '2025-01-01',
};

/** Default EFKA documents template */
export const DEFAULT_EFKA_DOCUMENTS: EfkaDocument[] = [
  {
    type: 'E1',
    label: 'Ε.1 — Αναγγελία Πρόσληψης',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
  {
    type: 'E3',
    label: 'Ε.3 — Αναγγελία Οικοδομοτεχνικού Έργου',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
  {
    type: 'E4',
    label: 'Ε.4 — Πίνακας Προσωπικού',
    status: 'pending',
    fileUrl: null,
    uploadedAt: null,
    submittedAt: null,
    notes: null,
  },
];

/**
 * Creates a default (empty) EFKA declaration for a new project.
 *
 * NOTE: `createdBy` is populated from the caller-provided `creatorId` (the
 * authenticated user's uid), not via `createEntity()` — this factory only
 * assembles the in-memory struct; persistence is handled by the caller.
 */
export function createDefaultEfkaDeclaration(creatorId: string): EfkaDeclarationData {
  const now = nowISO();
  return {
    employerVatNumber: null,
    projectAddress: null,
    projectDescription: null,
    startDate: null,
    estimatedEndDate: null,
    estimatedWorkerCount: null,
    projectCategory: null,
    amoe: null,
    amoeAssignedDate: null,
    status: 'draft',
    documents: [...DEFAULT_EFKA_DOCUMENTS],
    createdAt: now,
    createdBy: creatorId,
    updatedAt: now,
    updatedBy: creatorId,
    submittedAt: null,
    submittedBy: null,
    notes: null,
  };
}
