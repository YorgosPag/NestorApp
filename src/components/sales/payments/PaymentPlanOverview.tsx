/* eslint-disable design-system/enforce-semantic-colors */
'use client';

/**
 * PaymentPlanOverview — Summary card with progress bar
 * @enterprise ADR-234 - Payment Plan & Installment Tracking
 */

import React from 'react';
import { CreditCard, AlertTriangle, CalendarDays } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PaymentPlan } from '@/types/payment-plan';
import '@/lib/design-system';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

// ============================================================================
// STATUS BADGE CONFIG
// ============================================================================

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  negotiation: 'outline',
  draft: 'secondary',
  active: 'default',
  completed: 'default',
  cancelled: 'destructive',
};

// ============================================================================
// COMPONENT
// ============================================================================

interface PaymentPlanOverviewProps {
  plan: PaymentPlan;
}

export function PaymentPlanOverview({ plan }: PaymentPlanOverviewProps) {
  const colors = useSemanticColors();
  const { t } = useTranslation('payments');

  const paidPercentage = plan.totalAmount > 0
    ? Math.round((plan.paidAmount / plan.totalAmount) * 100)
    : 0;

  const paidInstallments = plan.installments.filter(
    (i) => i.status === 'paid' || i.status === 'waived'
  ).length;

  const now = new Date().toISOString();
  const overdueCount = plan.installments.filter((i) => {
    if (i.status === 'paid' || i.status === 'waived') return false;
    return i.dueDate < now && i.paidAmount < i.amount;
  }).length;

  const nextInstallment = plan.installments.find(
    (i) => i.status === 'pending' || i.status === 'due' || i.status === 'partial'
  );

  return (
    <section className="rounded-lg border p-4 space-y-3">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className={cn("h-4 w-4", colors.text.muted)} />
          <h3 className="text-sm font-semibold">
            {t('paymentPlan.title')}
          </h3>
        </div>
        <Badge variant={STATUS_VARIANT[plan.status] ?? 'secondary'}>
          {t(`paymentPlan.status.${plan.status}`)}
        </Badge>
      </header>

      {/* Amounts */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className={cn("text-[10px] uppercase", colors.text.muted)}>
            {t('labels.totalAmount')}
          </dt>
          <dd className="text-sm font-semibold">
            €{plan.totalAmount.toLocaleString('el-GR')}
          </dd>
        </div>
        <div>
          <dt className={cn("text-[10px] uppercase", colors.text.muted)}>
            {t('labels.paidAmount')}
          </dt>
          <dd className="text-sm font-semibold text-green-600">
            €{plan.paidAmount.toLocaleString('el-GR')}
          </dd>
        </div>
        <div>
          <dt className={cn("text-[10px] uppercase", colors.text.muted)}>
            {t('labels.remainingAmount')}
          </dt>
          <dd className="text-sm font-semibold text-orange-600">
            €{plan.remainingAmount.toLocaleString('el-GR')}
          </dd>
        </div>
      </dl>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={paidPercentage} className="h-2" />
        <p className={cn("text-[10px] text-right", colors.text.muted)}>{paidPercentage}%</p>
      </div>

      {/* Footer stats */}
      <footer className={cn("flex items-center justify-between text-xs", colors.text.muted)}>
        <span>
          {paidInstallments}/{plan.installments.length}{' '}
          {t('installments.title')}
        </span>

        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {overdueCount} {t('labels.overdueCount')}
          </span>
        )}

        {nextInstallment && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            €{nextInstallment.amount.toLocaleString('el-GR')}{' '}
            {new Date(nextInstallment.dueDate).toLocaleDateString('el-GR')}
          </span>
        )}
      </footer>
    </section>
  );
}
