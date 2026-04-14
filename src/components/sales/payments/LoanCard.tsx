'use client';

/**
 * LoanCard — Summary card for a single loan
 * Shows: bank, status badge, amounts, LTV progress, disbursement progress, actions.
 *
 * @enterprise ADR-234 Phase 2 — SPEC-234C
 */

import React from 'react';
import { Eye } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { LoanStatusTimeline } from '@/components/sales/payments/LoanStatusTimeline';
import type { LoanTracking } from '@/types/loan-tracking';
import { calculateLTV, getLtvComplianceLevel } from '@/types/loan-tracking';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// STATUS → BADGE VARIANT
// ============================================================================

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_applicable: 'outline',
  exploring: 'secondary',
  applied: 'secondary',
  pre_approved: 'default',
  appraisal_pending: 'secondary',
  appraisal_completed: 'secondary',
  legal_review: 'secondary',
  approved: 'default',
  collateral_pending: 'secondary',
  collateral_registered: 'default',
  disbursement_pending: 'secondary',
  partially_disbursed: 'default',
  fully_disbursed: 'default',
  rejected: 'destructive',
  cancelled: 'destructive',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface LoanCardProps {
  loan: LoanTracking;
  onViewDetails: () => void;
}

export function LoanCard({ loan, onViewDetails }: LoanCardProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation(['payments', 'payments-cost-calc', 'payments-loans']);

  const ltv = calculateLTV(loan.approvedAmount, loan.appraisalValue);
  const ltvLevel = getLtvComplianceLevel(ltv);

  const disbursementPercent = loan.approvedAmount && loan.approvedAmount > 0
    ? Math.round((loan.disbursedAmount / loan.approvedAmount) * 100)
    : 0;

  const isTerminal = loan.status === 'rejected' || loan.status === 'cancelled';

  return (
    <article className={`rounded-md border p-3 space-y-2 ${isTerminal ? 'opacity-60' : ''}`}>
      {/* Header: Bank + Status */}
      <header className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-medium truncate">{loan.bankName || '—'}</h4>
          {loan.isPrimary && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {t('loanTracking.primaryLoan')}
            </Badge>
          )}
        </span>
        <Badge variant={STATUS_VARIANT[loan.status] ?? 'secondary'} className="shrink-0">
          {t(`loanTracking.status.${loan.status}`)}
        </Badge>
      </header>

      {/* Amounts */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {loan.requestedAmount !== null && (
          <>
            <dt className={colors.text.muted}>
              {t('loanTracking.fields.requestedAmount')}
            </dt>
            <dd className="font-medium">€{loan.requestedAmount.toLocaleString('el-GR')}</dd>
          </>
        )}
        {loan.approvedAmount !== null && (
          <>
            <dt className={colors.text.muted}>
              {t('loanTracking.fields.approvedAmount')}
            </dt>
            <dd className="font-medium">€{loan.approvedAmount.toLocaleString('el-GR')}</dd>
          </>
        )}
        {loan.interestRate !== null && (
          <>
            <dt className={colors.text.muted}>
              {t('loanTracking.fields.interestRate')}
            </dt>
            <dd className="font-medium">
              {loan.interestRate}%
              {loan.interestRateType && ` (${loan.interestRateType})`}
            </dd>
          </>
        )}
        {loan.termYears !== null && (
          <>
            <dt className={colors.text.muted}>
              {t('loanTracking.fields.termYears')}
            </dt>
            <dd className="font-medium">{loan.termYears} {t('loanTracking.fields.yearsUnit')}</dd>
          </>
        )}
      </dl>

      {/* LTV Indicator */}
      {ltv !== null && (
        <section className="space-y-1">
          <span className="flex items-center justify-between text-xs">
            <span className={colors.text.muted}>LTV</span>
            <span className={
              ltvLevel === 'exceeded' ? 'text-destructive font-medium'
                : ltvLevel === 'warning' ? 'text-amber-600 font-medium'
                  : 'text-green-600'
            }>
              {ltv}%
            </span>
          </span>
          <Progress
            value={Math.min(ltv, 100)}
            className="h-1.5"
          />
        </section>
      )}

      {/* Disbursement Progress */}
      {loan.approvedAmount !== null && loan.approvedAmount > 0 && (
        <section className="space-y-1">
          <span className="flex items-center justify-between text-xs">
            <span className={colors.text.muted}>
              {t('loanTracking.fields.disbursedAmount')}
            </span>
            <span>
              €{loan.disbursedAmount.toLocaleString('el-GR')} / €{loan.approvedAmount.toLocaleString('el-GR')}
            </span>
          </span>
          <Progress value={disbursementPercent} className="h-1.5" />
        </section>
      )}

      {/* Timeline (compact) */}
      <LoanStatusTimeline status={loan.status} compact />

      {/* Actions */}
      <footer className="flex justify-end pt-1">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-xs h-7"
          onClick={onViewDetails}
        >
          <Eye className="h-3 w-3" />
          {t('actions.viewDetails')}
        </Button>
      </footer>
    </article>
  );
}
