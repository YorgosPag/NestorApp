/* eslint-disable design-system/enforce-semantic-colors */
/* eslint-disable custom/no-hardcoded-strings */
'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TableRow, TableCell } from '@/components/ui/table';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { CounterproposalScenario } from '@/types/interest-calculator';
import '@/lib/design-system';

// =============================================================================
// HELPERS
// =============================================================================

export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

// =============================================================================
// TYPES
// =============================================================================

interface ScenarioRowProps {
  scenario: CounterproposalScenario;
  variant: 'baseline' | 'sweetSpot' | 'default';
  t: (key: string, opts?: Record<string, string>) => string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ScenarioRow({ scenario, variant, t }: ScenarioRowProps) {
  const colors = useSemanticColors();
  const rowClass =
    variant === 'sweetSpot'
      ? 'bg-green-50 dark:bg-green-950/20'
      : variant === 'baseline'
        ? 'bg-muted/40'
        : '';

  return (
    <TableRow className={rowClass}>
      <TableCell className="font-medium text-xs">
        <span className="flex items-center gap-1.5">
          {t(scenario.nameKey)}
          {variant === 'sweetSpot' && (
            <Badge variant="outline" className="text-[10px] border-green-500 text-green-700 dark:text-green-400">
              {t('costCalculator.counterproposal.badges.sweetSpot')}
            </Badge>
          )}
          {variant === 'baseline' && (
            <Badge variant="secondary" className="text-[10px]">
              {t('costCalculator.counterproposal.badges.baseline')}
            </Badge>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {scenario.upfrontPercent}%
        {scenario.remainingMonths > 0 && (
          <span className={cn("ml-1", colors.text.muted)}>
            + {scenario.remainingMonths}{t('costCalculator.counterproposal.table.monthsAbbr')}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {fmtCurrency(scenario.npv)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-green-600 dark:text-green-400">
        {scenario.timeCostSaved > 0 ? fmtCurrency(scenario.timeCostSaved) : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {scenario.maxDiscount > 0
          ? `${fmtCurrency(scenario.maxDiscount)} (${fmtPercent(scenario.maxDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-amber-600 dark:text-amber-400">
        {scenario.suggestedDiscount > 0
          ? `${fmtCurrency(scenario.suggestedDiscount)} (${fmtPercent(scenario.suggestedDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums font-medium">
        {fmtCurrency(scenario.finalPrice)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400 font-medium">
        {scenario.builderNetGain > 0
          ? `${fmtCurrency(scenario.builderNetGain)} (${fmtPercent(scenario.builderNetGainPercent)})`
          : '—'}
      </TableCell>
    </TableRow>
  );
}
