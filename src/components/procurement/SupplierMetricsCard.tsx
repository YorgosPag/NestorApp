'use client';

/**
 * SupplierMetricsCard — Performance KPIs for a single supplier
 *
 * Shows: total orders, total spend, on-time %, avg lead time,
 * cancellation rate, category breakdown.
 *
 * @see ADR-267 Phase C (Supplier Metrics)
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/design-system';
import {
  Package,
  Clock,
  TrendingUp,
  XCircle,
  CheckCircle,
  BarChart3,
} from 'lucide-react';

import type { SupplierMetrics, CategorySpend } from '@/types/procurement';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatPOCurrency } from './utils/procurement-format';

// ============================================================================
// TYPES
// ============================================================================

interface SupplierMetricsCardProps {
  metrics: SupplierMetrics;
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SupplierMetricsCard({ metrics, className }: SupplierMetricsCardProps) {
  const typography = useTypography();
  const { t } = useTranslation('procurement');

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <h3 className={cn(typography.heading.h4, 'flex items-center gap-2')}>
          <BarChart3 className="h-5 w-5" />
          {t('supplierMetrics.title')}
        </h3>
        <p className={cn(typography.body.sm, 'text-sm')}>{metrics.supplierName}</p>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricItem
            label={t('supplierMetrics.totalOrders')}
            value={String(metrics.totalOrders)}
            icon={<Package className="h-4 w-4" />}
          />
          <MetricItem
            label={t('supplierMetrics.totalSpend')}
            value={formatPOCurrency(metrics.totalSpend)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricItem
            label={t('supplierMetrics.averageOrder')}
            value={formatPOCurrency(metrics.averageOrderValue)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricItem
            label={t('supplierMetrics.onTimeRate')}
            value={`${metrics.onTimeDeliveryRate}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant={getOnTimeVariant(metrics.onTimeDeliveryRate)}
          />
          <MetricItem
            label={t('supplierMetrics.avgLeadTime')}
            value={metrics.averageLeadTimeDays !== null ? `${metrics.averageLeadTimeDays} ${t('supplierMetrics.days')}` : '—'}
            icon={<Clock className="h-4 w-4" />}
          />
          <MetricItem
            label={t('supplierMetrics.cancellationRate')}
            value={`${metrics.cancellationRate}%`}
            icon={<XCircle className="h-4 w-4" />}
            variant={metrics.cancellationRate > 20 ? 'warning' : 'default'}
          />
        </dl>

        {metrics.categoryBreakdown.length > 0 && (
          <section className="mt-4 border-t pt-4">
            <h4 className={cn(typography.label.xs, 'mb-2 font-medium')}>
              {t('supplierMetrics.categoryBreakdown')}
            </h4>
            <ul className="space-y-1">
              {metrics.categoryBreakdown.slice(0, 5).map((cat: CategorySpend) => (
                <li key={cat.categoryCode} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {cat.categoryCode}
                    </Badge>
                    <span className={typography.body.sm}>{cat.categoryName}</span>
                  </span>
                  <span className="font-medium">{formatPOCurrency(cat.totalSpend)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// METRIC ITEM
// ============================================================================

interface MetricItemProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning';
}

function MetricItem({ label, value, icon, variant = 'default' }: MetricItemProps) {
  const typography = useTypography();

  return (
    <div className="flex flex-col gap-1">
      <dt className={cn(typography.body.sm, 'flex items-center gap-1 text-xs')}>
        {icon}
        {label}
      </dt>
      <dd className={cn(
        'text-lg font-semibold',
        variant === 'success' && 'text-emerald-600 dark:text-emerald-400',
        variant === 'warning' && 'text-amber-600 dark:text-amber-400',
      )}>
        {value}
      </dd>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getOnTimeVariant(rate: number): 'success' | 'warning' | 'default' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'default';
  return 'warning';
}
