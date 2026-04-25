/**
 * Department Codes SSoT (ADR-326 §3.3)
 * Two-layer model: 12 canonical (app-understood) + unlimited custom (tenant-defined).
 */

export const DEPARTMENT_CODES = {
  ACCOUNTING:           'accounting',
  ENGINEERING:          'engineering',
  ARCHITECTURE_STUDIES: 'architecture_studies',
  CONSTRUCTION:         'construction',
  SALES:                'sales',
  LEGAL:                'legal',
  HR:                   'hr',
  IT:                   'it',
  PROCUREMENT:          'procurement',
  OPERATIONS:           'operations',
  MANAGEMENT:           'management',
  CUSTOMER_SERVICE:     'customer_service',
  /** Wildcard — all user-defined tenant departments */
  CUSTOM:               'custom',
} as const;

export type DepartmentCode = typeof DEPARTMENT_CODES[keyof typeof DEPARTMENT_CODES];

/** Codes that have smart default routing and i18n labels */
export const CANONICAL_DEPARTMENT_CODES = Object.values(DEPARTMENT_CODES).filter(
  (c) => c !== DEPARTMENT_CODES.CUSTOM,
) as Exclude<DepartmentCode, 'custom'>[];
