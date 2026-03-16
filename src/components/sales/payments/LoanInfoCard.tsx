'use client';

/**
 * LoanInfoCard — Display loan tracking information
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React from 'react';
import { Landmark } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { LoanInfo } from '@/types/payment-plan';

// ============================================================================
// COMPONENT
// ============================================================================

interface LoanInfoCardProps {
  loan: LoanInfo;
}

const LOAN_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_applicable: 'outline',
  pending: 'secondary',
  applied: 'secondary',
  pre_approved: 'default',
  approved: 'default',
  disbursed: 'default',
  rejected: 'destructive',
};

export function LoanInfoCard({ loan }: LoanInfoCardProps) {
  const { t } = useTranslation('payments');

  if (loan.status === 'not_applicable') return null;

  return (
    <section className="rounded-lg border p-3 space-y-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            {t('loan.title')}
          </h3>
        </div>
        <Badge variant={LOAN_STATUS_VARIANT[loan.status] ?? 'secondary'}>
          {t(`loan.status.${loan.status}`)}
        </Badge>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {loan.bankName && (
          <>
            <dt className="text-muted-foreground">{t('loan.bankName')}</dt>
            <dd className="font-medium">{loan.bankName}</dd>
          </>
        )}
        {loan.loanAmount !== null && (
          <>
            <dt className="text-muted-foreground">{t('loan.loanAmount')}</dt>
            <dd className="font-medium">€{loan.loanAmount.toLocaleString('el-GR')}</dd>
          </>
        )}
        {loan.financingPercentage !== null && (
          <>
            <dt className="text-muted-foreground">{t('loan.financingPercentage')}</dt>
            <dd className="font-medium">{loan.financingPercentage}%</dd>
          </>
        )}
        {loan.interestRate !== null && (
          <>
            <dt className="text-muted-foreground">{t('loan.interestRate')}</dt>
            <dd className="font-medium">{loan.interestRate}%</dd>
          </>
        )}
        {loan.termYears !== null && (
          <>
            <dt className="text-muted-foreground">{t('loan.termYears')}</dt>
            <dd className="font-medium">{loan.termYears} {t('loan.termYears')}</dd>
          </>
        )}
      </dl>

      {loan.notes && (
        <p className="text-xs text-muted-foreground border-t pt-2">{loan.notes}</p>
      )}
    </section>
  );
}
