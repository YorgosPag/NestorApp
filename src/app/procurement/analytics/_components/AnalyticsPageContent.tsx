'use client';

/**
 * AnalyticsPageContent — Top-level client view for the spend analytics page.
 *
 * Owns the `useSpendAnalytics` lifecycle, renders the filter bar / refresh /
 * export controls, KPI tiles and (Phase E placeholder) chart slot. Wraps the
 * data-bearing parts in a ComponentErrorBoundary per ADR-331 §4 D27.
 *
 * @see ADR-331 §2.2, §4 D17, D18, D27, D28
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpendAnalytics } from '@/hooks/procurement';
import { ComponentErrorBoundary } from '@/components/ui/ErrorBoundary/enterprise-wrappers';

import { AnalyticsFiltersBar } from './AnalyticsFiltersBar';
import { AnalyticsKpiTiles } from './AnalyticsKpiTiles';
import { AnalyticsRefreshButton } from './AnalyticsRefreshButton';
import { AnalyticsExportButton } from './AnalyticsExportButton';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

export function AnalyticsPageContent() {
  const { t } = useTranslation('procurement');
  const analytics = useSpendAnalytics();
  const { data, isLoading, isRefreshing, error, filters, setFilters, refresh } = analytics;

  const isEmpty = !isLoading && !error && data?.current.kpis.totalPOs === 0;

  return (
    <main className="flex flex-col gap-6 px-4 pb-10 pt-4 sm:px-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('analytics.description')}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-end">
          <AnalyticsRefreshButton onRefresh={refresh} isRefreshing={isRefreshing} />
          <AnalyticsExportButton filters={filters} disabled={isLoading || isEmpty} />
        </div>
      </header>

      <ComponentErrorBoundary componentName="AnalyticsFiltersBar">
        <AnalyticsFiltersBar filters={filters} onChange={setFilters} />
      </ComponentErrorBoundary>

      {error && (
        <output className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t('analytics.errors.loadFailed')}
        </output>
      )}

      <ComponentErrorBoundary componentName="AnalyticsKpiTiles">
        <AnalyticsKpiTiles
          kpis={data?.current.kpis ?? null}
          deltas={data?.comparison.deltas ?? null}
          previousFrom={data?.comparison.previousFrom ?? ''}
          previousTo={data?.comparison.previousTo ?? ''}
          isLoading={isLoading}
        />
      </ComponentErrorBoundary>

      {isEmpty && <AnalyticsEmptyState />}
    </main>
  );
}
