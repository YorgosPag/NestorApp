'use client';

/**
 * @fileoverview Financial Report Card (Phase 2e)
 * @description Single dashboard card with key metric, trend indicator, click-to-navigate
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-30
 * @see DECISIONS-PHASE-2.md §2e (Q12 — dashboard tiles)
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Clock,
  Calculator,
  GitCompareArrows,
  Banknote,
  Users,
  PieChart,
  Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReportType, ChangeMetric } from '@/subapps/accounting/types';
import { formatCurrency } from '../../utils/format';

// ============================================================================
// CARD CONFIG
// ============================================================================

interface CardConfig {
  icon: LucideIcon;
  colorClass: string;
}

const REPORT_CARD_CONFIG: Record<ReportType, CardConfig> = {
  profit_and_loss: { icon: TrendingUp, colorClass: 'text-green-600' },
  trial_balance: { icon: Scale, colorClass: 'text-blue-600' },
  ar_aging: { icon: Clock, colorClass: 'text-orange-600' },
  tax_summary: { icon: Calculator, colorClass: 'text-purple-600' },
  bank_reconciliation: { icon: GitCompareArrows, colorClass: 'text-indigo-600' },
  cash_flow: { icon: Banknote, colorClass: 'text-emerald-600' },
  income_by_customer: { icon: Users, colorClass: 'text-cyan-600' },
  expense_by_category: { icon: PieChart, colorClass: 'text-rose-600' },
};

// ============================================================================
// TYPES
// ============================================================================

interface FinancialReportCardProps {
  type: ReportType;
  keyMetric: number;
  change: ChangeMetric | null;
  format: 'currency' | 'percentage' | 'number';
  loading?: boolean;
  onClick: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatMetricValue(value: number, format: 'currency' | 'percentage' | 'number'): string {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percentage') return `${value.toFixed(1)}%`;
  return value.toLocaleString('el-GR');
}

function TrendIndicator({ change }: { change: ChangeMetric | null }) {
  if (!change || change.percentage === null) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }

  const isPositive = change.percentage > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const variant = isPositive ? 'success' : 'destructive';
  const sign = isPositive ? '+' : '';

  return (
    <Badge variant={variant} className="text-xs">
      <Icon className="mr-1 h-3 w-3" />
      {sign}{change.percentage.toFixed(1)}%
    </Badge>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FinancialReportCard({
  type,
  keyMetric,
  change,
  format,
  loading,
  onClick,
}: FinancialReportCardProps) {
  const { t } = useTranslation(['accounting', 'accounting-setup', 'accounting-tax-offices']);
  const config = REPORT_CARD_CONFIG[type];
  const Icon = config.icon;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-5 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="cursor-pointer transition-shadow hover:shadow-md"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {t(`reports.reportTypes.${type}`)}
        </CardTitle>
        <Icon className={cn('h-4 w-4', config.colorClass)} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatMetricValue(keyMetric, format)}</p>
        <footer className="mt-1">
          <TrendIndicator change={change} />
        </footer>
      </CardContent>
    </Card>
  );
}
