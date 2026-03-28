/**
 * =============================================================================
 * Brokerage Helpers — Shared formatting & conversion utilities
 * =============================================================================
 *
 * SSOT for brokerage agreement display logic.
 * Used by: ProjectBrokersTab, BrokerageCard, BrokerageAgreementCard.
 *
 * @module components/projects/tabs/brokerage/brokerage-helpers
 * @enterprise ADR-230 / SPEC-230B
 */

import { formatCurrency } from '@/lib/intl-utils';
import type { BrokerageAgreement } from '@/types/brokerage';
import type { InlineFormState } from './brokerage-form-types';

// =============================================================================
// STATUS BADGE
// =============================================================================

export function getStatusBadge(
  agreement: BrokerageAgreement,
  t: (key: string) => string,
): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (agreement.status === 'terminated') {
    return { label: t('sales.legal.terminatedAgreement'), variant: 'destructive' };
  }
  if (agreement.endDate && new Date(agreement.endDate) < new Date()) {
    return { label: t('sales.legal.expiredAgreement'), variant: 'secondary' };
  }
  return { label: t('sales.legal.activeAgreement'), variant: 'default' };
}

// =============================================================================
// FORMAT COMMISSION
// =============================================================================

export function formatCommission(agreement: BrokerageAgreement): string {
  if (agreement.commissionType === 'percentage' && agreement.commissionPercentage !== null) {
    return `${agreement.commissionPercentage}%`;
  }
  if (agreement.commissionType === 'fixed' && agreement.commissionFixedAmount !== null) {
    return formatCurrency(agreement.commissionFixedAmount);
  }
  return '—';
}

// =============================================================================
// FORM ↔ AGREEMENT CONVERSION
// =============================================================================

export function agreementToFormState(a: BrokerageAgreement): InlineFormState {
  return {
    agentContactId: a.agentContactId,
    agentName: a.agentName,
    scope: a.scope,
    unitId: a.unitId ?? '',
    exclusivity: a.exclusivity,
    commissionType: a.commissionType,
    commissionPercentage: a.commissionPercentage !== null ? String(a.commissionPercentage) : '',
    commissionFixedAmount: a.commissionFixedAmount !== null ? String(a.commissionFixedAmount) : '',
    startDate: a.startDate.split('T')[0],
    endDate: a.endDate ? a.endDate.split('T')[0] : '',
    notes: a.notes ?? '',
  };
}
