'use client';

/**
 * SpendByProjectChart — τα 10 κορυφαία έργα σε **κατακόρυφες** στήλες. Τα
 * ονόματα έργων λύνονται από το SSoT `useProjectsList` (με cache)· κλικ σε
 * στήλη → λίστα εντολών αγοράς με `projectId`.
 *
 * ⚠️ **ADR-710 (μετανάστευση 2026-08-01)**: πλαίσιο κάρτας, κενή κατάσταση και
 * `ResponsiveContainer` ζουν στο `<ChartCard>`. Το ελεύθερο ύψος 280px γίνεται
 * το ονομασμένο βήμα `md` (h-64 = 256px).
 *
 * 🔴 **ADR-742 §7quaterdecies**: η σύνθεση recharts έφυγε στο `<SpendTopBarChart>`.
 * Δικό της μένει **μόνο** η επίλυση ονομάτων έργου — και μαζί της ο λόγος που η
 * κάρτα έχει **δεύτερη** πηγή φόρτωσης: το γράφημα δεν είναι έτοιμο όσο τα
 * ονόματα λείπουν, αλλιώς θα ζωγράφιζε για μια στιγμή ωμά `projectId`.
 *
 * @see ADR-331 §2.5, §4 D4, D5, D22, D23 · ADR-710 · ADR-742 §7quaterdecies
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { useProjectsList } from '@/hooks/useProjectsList';
import { SpendTopBarChart } from './SpendTopBarChart';
import { truncateLabel } from './chart-utils';
import type {
  ProjectPoint,
  SpendAnalyticsFilters,
} from '@/services/procurement/aggregators/spendAnalyticsAggregator';

interface SpendByProjectChartProps {
  data: readonly ProjectPoint[];
  filters: SpendAnalyticsFilters;
  isLoading: boolean;
  className?: string;
}

interface ProjectRow {
  projectId: string;
  label: string;
  total: number;
}

export function SpendByProjectChart({
  data,
  filters,
  isLoading,
  className,
}: SpendByProjectChartProps) {
  const { t } = useTranslation('procurement');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjectsList({
    enabled: !authLoading && isAuthenticated,
  });

  const rows = useMemo<ProjectRow[]>(() => {
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    return data.map((point) => ({
      projectId: point.projectId,
      label: truncateLabel(nameById.get(point.projectId) ?? point.projectId, 22),
      total: point.total,
    }));
  }, [data, projects]);

  return (
    <SpendTopBarChart
      className={className}
      isLoading={isLoading || projectsLoading}
      rows={rows}
      categoryKey="label"
      valueKey="total"
      orientation="columns"
      title={t('analytics.charts.byProject.title')}
      emptyMessage={t('analytics.charts.byProject.empty')}
      categoryLabel={t('analytics.charts.byProject.categoryLabel')}
      drillDown={{ filters, rowKey: 'projectId', filterKey: 'projectId' }}
    />
  );
}
