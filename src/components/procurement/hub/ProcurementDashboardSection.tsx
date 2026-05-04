'use client';

/**
 * ProcurementDashboardSection — Cross-project KPI widgets on the hub landing
 *
 * @module components/procurement/hub/ProcurementDashboardSection
 * @see ADR-330 §3 Phase 6
 */

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, ChevronRight, ShoppingCart, TrendingUp, Truck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { useProcurementDashboard } from '@/hooks/procurement/useProcurementDashboard';
import type { CategorySpend, MonthlyPoint } from '@/hooks/procurement/useProcurementDashboard';

// ============================================================================
// KPI CARD
// ============================================================================

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  loading: boolean;
}

function KpiCard({ icon: Icon, label, value, loading }: KpiCardProps) {
  return (
    <article className="flex items-center gap-3 rounded-lg border bg-card p-4">
      <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{loading ? '—' : value}</p>
      </div>
    </article>
  );
}

// ============================================================================
// CATEGORY BARS
// ============================================================================

interface CategoryBarsProps {
  categories: CategorySpend[];
  loading: boolean;
}

function CategoryBars({ categories, loading }: CategoryBarsProps) {
  const { t } = useTranslation('procurement');
  const max = categories[0]?.total ?? 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('hub.dashboard.spendByCategory')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">—</p>}
        {!loading && categories.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('hub.dashboard.noCategoryData')}</p>
        )}
        {!loading && categories.map(({ code, total }) => (
          <div key={code} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium">{t(`categories.${code}`)}</span>
              <span className="text-muted-foreground">{formatCurrency(total, 'EUR')}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${(total / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MONTHLY TREND
// ============================================================================

interface MonthlyTrendProps {
  trend: MonthlyPoint[];
  loading: boolean;
}

function MonthlyTrend({ trend, loading }: MonthlyTrendProps) {
  const { t } = useTranslation('procurement');
  const max = Math.max(...trend.map((p) => p.total), 1);
  const hasData = trend.some((p) => p.total > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('hub.dashboard.monthlyTrend')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">—</p>}
        {!loading && !hasData && (
          <p className="text-sm text-muted-foreground">{t('hub.dashboard.noPOs')}</p>
        )}
        {!loading && hasData && (
          <figure className="flex h-24 items-end justify-between gap-1" aria-label={t('hub.dashboard.monthlyTrend')}>
            {trend.map(({ month, total }) => {
              const label = new Intl.DateTimeFormat(undefined, { month: 'short' }).format(
                new Date(`${month}-01`)
              );
              return (
                <div key={month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm bg-primary/70"
                    style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? '4px' : '0' }}
                    aria-label={`${label}: ${formatCurrency(total, 'EUR')}`}
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              );
            })}
          </figure>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN SECTION
// ============================================================================

export function ProcurementDashboardSection() {
  const { t } = useTranslation('procurement');
  const stats = useProcurementDashboard();

  return (
    <section aria-label={t('hub.dashboard.title')} className="space-y-4 px-4 pb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Link
          href="/procurement/analytics"
          className="group inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {t('hub.dashboard.title')}
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
        </Link>
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={ShoppingCart}
          label={t('hub.dashboard.totalPOs')}
          value={stats.totalPOs}
          loading={stats.loading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t('hub.dashboard.committed')}
          value={formatCurrency(stats.committedAmount, 'EUR')}
          loading={stats.loading}
        />
        <KpiCard
          icon={Truck}
          label={t('hub.dashboard.delivered')}
          value={formatCurrency(stats.deliveredAmount, 'EUR')}
          loading={stats.loading}
        />
        <KpiCard
          icon={Users}
          label={t('hub.dashboard.activeSuppliers')}
          value={stats.activeSuppliersCount}
          loading={stats.loading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryBars categories={stats.topCategories} loading={stats.loading} />
        <MonthlyTrend trend={stats.monthlyTrend} loading={stats.loading} />
      </div>
    </section>
  );
}
