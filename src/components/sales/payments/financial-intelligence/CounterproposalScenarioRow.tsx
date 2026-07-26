'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TableRow, TableCell } from '@/components/ui/table';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { formatCurrencyWhole, formatPercentage } from '@/lib/intl-utils';
import type { CounterproposalScenario } from '@/types/interest-calculator';
import '@/lib/design-system';

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
      ? 'bg-[hsl(var(--bg-success))]/10'
      : variant === 'baseline'
        ? 'bg-muted/40'
        : '';

  return (
    <TableRow className={rowClass}>
      <TableCell className="font-medium text-xs">
        <span className="flex items-center gap-1.5">
          {t(scenario.nameKey)}
          {variant === 'sweetSpot' && (
            <Badge variant="outline" className="text-[10px] border-border text-[hsl(var(--text-success))]">
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
        {formatCurrencyWhole(scenario.npv)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-[hsl(var(--text-success))]">
        {scenario.timeCostSaved > 0 ? formatCurrencyWhole(scenario.timeCostSaved) : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums">
        {scenario.maxDiscount > 0
          ? `${formatCurrencyWhole(scenario.maxDiscount)} (${formatPercentage(scenario.maxDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-[hsl(var(--text-warning))]">
        {scenario.suggestedDiscount > 0
          ? `${formatCurrencyWhole(scenario.suggestedDiscount)} (${formatPercentage(scenario.suggestedDiscountPercent)})`
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums font-medium">
        {formatCurrencyWhole(scenario.finalPrice)}
      </TableCell>
      <TableCell className="text-right text-xs font-mono tabular-nums text-primary font-medium">
        {scenario.builderNetGain > 0
          ? `${formatCurrencyWhole(scenario.builderNetGain)} (${formatPercentage(scenario.builderNetGainPercent)})`
          : '—'}
      </TableCell>
    </TableRow>
  );
}
