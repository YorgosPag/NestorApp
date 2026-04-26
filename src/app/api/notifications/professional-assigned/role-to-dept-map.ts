/**
 * SSoT mapping: professional role → DepartmentCode for L2 org-structure routing.
 * Used by professional-assigned notification to resolve dept email from contact orgStructure.
 * ADR-326 Phase 6.2
 */

import type { DepartmentCode } from '@/config/department-codes';

const ROLE_TO_DEPT: Record<string, DepartmentCode> = {
  legal_advisor:    'legal',
  civil_engineer:   'engineering',
  architect:        'engineering',
  accountant:       'accounting',
  mechanical_eng:   'engineering',
  electrical_eng:   'engineering',
  topographer:      'engineering',
  financial_advisor: 'accounting',
};

/** Returns DepartmentCode for a professional role, or null if no mapping exists. */
export function mapRoleToDept(role: string): DepartmentCode | null {
  return ROLE_TO_DEPT[role] ?? null;
}
