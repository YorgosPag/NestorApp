'use client';

/**
 * =============================================================================
 * StampsSummaryDashboard — 4 summary cards for stamps calculation
 * =============================================================================
 *
 * Displays: Total Stamps, Employer Contribution, Employee Contribution, Total.
 * Pattern: Same as AttendanceDashboard (Phase 2).
 *
 * @module components/projects/ika/components/StampsSummaryDashboard
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System (Phase 3)
 */

import React from 'react';
import { Stamp, Building2, User, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import type { StampsMonthSummary } from '../contracts';

interface StampsSummaryDashboardProps {
  /** Monthly stamps summary */
  summary: StampsMonthSummary;
}

/**
 * Formats a number as Euro currency (e.g., "€1.234,56").
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function StampsSummaryDashboard({ summary }: StampsSummaryDashboardProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const cards = [
    {
      key: 'stamps',
      label: t('ika.stampsTab.dashboard.totalStamps'),
      value: summary.totalStamps.toLocaleString('el-GR'),
      icon: Stamp,
      colorText: colors.text.info,
      colorBg: colors.bg.info,
    },
    {
      key: 'employer',
      label: t('ika.stampsTab.dashboard.employerContribution'),
      value: formatCurrency(summary.totalEmployerContribution),
      icon: Building2,
      colorText: colors.text.error,
      colorBg: colors.bg.error,
    },
    {
      key: 'employee',
      label: t('ika.stampsTab.dashboard.employeeContribution'),
      value: formatCurrency(summary.totalEmployeeContribution),
      icon: User,
      colorText: colors.text.warning,
      colorBg: colors.bg.warning,
    },
    {
      key: 'total',
      label: t('ika.stampsTab.dashboard.totalContribution'),
      value: formatCurrency(summary.totalContribution),
      icon: Wallet,
      colorText: colors.text.success,
      colorBg: colors.bg.success,
    },
  ];

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4', spacing.gap.md)}>
      {cards.map((card) => (
        <Card key={card.key}>
          <CardContent className={cn('flex items-center', spacing.padding.md)}>
            <div className={cn('rounded-lg', spacing.padding.sm, card.colorBg)}>
              <card.icon className={cn(iconSizes.lg, card.colorText)} />
            </div>
            <div className={spacing.margin.left.md}>
              <p className={cn(typography.card.statValue, card.colorText)}>
                {card.value}
              </p>
              <p className={typography.card.statLabel}>
                {card.label}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
