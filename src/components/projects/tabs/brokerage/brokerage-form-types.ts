/**
 * =============================================================================
 * Brokerage Form Types — Inline form state & unit lookup
 * =============================================================================
 *
 * @module components/projects/tabs/brokerage/brokerage-form-types
 * @enterprise ADR-230 / SPEC-230B
 */

import type { ExclusivityType, CommissionType } from '@/types/brokerage';
import { nowISO } from '@/lib/date-local';
import {
  linkedRetiredProperties,
  liveProperties,
} from '@/components/properties/shared/linked-retired-properties';

// =============================================================================
// TYPES
// =============================================================================

export interface InlineFormState {
  agentContactId: string;
  agentName: string;
  scope: 'project' | 'property';
  propertyId: string;
  exclusivity: ExclusivityType;
  commissionType: CommissionType;
  commissionPercentage: string;
  commissionFixedAmount: string;
  startDate: string;
  endDate: string;
  notes: string;
}

export interface PropertySummary {
  id: string;
  name: string;
  /** Κύκλος ζωής — αποσυρμένο ακίνητο (κάδος · αρχείο) φαίνεται, δεν προσφέρεται (ADR-329 §3.9). */
  status: string | null;
}

/**
 * Τι δείχνει ο επιλογέας ακινήτου: τα ζωντανά, και — τελευταίο — το αποσυρμένο που η
 * σύμβαση **ήδη** αναφέρει, ώστε το πεδίο να μη φαίνεται άδειο.
 */
export function selectableUnits(
  units: readonly PropertySummary[],
  linkedPropertyId: string,
): PropertySummary[] {
  return [
    ...liveProperties(units),
    ...linkedRetiredProperties(units, linkedPropertyId ? [linkedPropertyId] : []),
  ];
}

// =============================================================================
// DEFAULTS
// =============================================================================

export const EMPTY_FORM: InlineFormState = {
  agentContactId: '',
  agentName: '',
  scope: 'project',
  propertyId: '',
  exclusivity: 'non_exclusive',
  commissionType: 'percentage',
  commissionPercentage: '',
  commissionFixedAmount: '',
  startDate: nowISO().split('T')[0],
  endDate: '',
  notes: '',
};
