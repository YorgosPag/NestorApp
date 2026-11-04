'use client';

/**
 * @module spaces/common
 * @enterprise Common Spaces Dashboard — ΖΩΝΤΑΝΑ δεδομένα (ADR-931)
 * @lazy ADR-294 Batch 3 — Extracted for dynamic import
 *
 * Ως τις 2026-11-04 κάθε αριθμός εδώ ήταν γραμμένος με το χέρι ('42', 12, `count: 8`…) και
 * δεν υπήρχε καν οντότητα στη βάση. Τώρα: `common_spaces` (onSnapshot) → `computeCommonSpaceStats`
 * → οθόνη. Ομάδες από το λεξιλόγιο (ποτέ σκληρές κάρτες), κενή κατάσταση όταν δεν υπάρχει τίποτα.
 */

import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/workspace/navigation';
import { Building2, KeyRound, Ruler, Users } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatNumber } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { CommonSpaceStats } from '@/lib/common-spaces/common-space-stats';
import { CommonSpaceGroupCard } from '@/components/spaces/common/CommonSpaceGroupCard';
import { CommonSpacesByBuilding } from '@/components/spaces/common/CommonSpacesByBuilding';
import { useCommonSpacesOverview } from '@/components/spaces/common/useCommonSpacesOverview';
import '@/lib/design-system';

const BUILDINGS_HREF = '/buildings';

type Translate = ReturnType<typeof useTranslation>['t'];

function buildHeadlineStats(stats: CommonSpaceStats, loading: boolean, t: Translate): DashboardStat[] {
  const stable = { value: 0, label: t('stats.stable') };
  const value = (n: number) => (loading ? '…' : formatNumber(n));
  const areaDesc = stats.areaUnknownCount > 0
    ? t('stats.areaUnknown', { count: stats.areaUnknownCount })
    : t('stats.areaComplete');
  return [
    { title: t('stats.total'), value: value(stats.count), description: t('stats.totalDesc'), icon: Users, color: 'blue', trend: stable },
    {
      title: t('stats.area'),
      value: loading ? '…' : t('stats.areaValue', { area: formatNumber(stats.areaM2, { maximumFractionDigits: 1 }) }),
      description: areaDesc,
      icon: Ruler,
      color: 'green',
      trend: stable,
    },
    { title: t('stats.exclusiveUse'), value: value(stats.exclusiveUseCount), description: t('stats.exclusiveUseDesc'), icon: KeyRound, color: 'purple', trend: stable },
    { title: t('stats.buildings'), value: value(stats.buildings.length), description: t('stats.buildingsDesc'), icon: Building2, color: 'orange', trend: stable },
  ];
}

function CommonSpacesBody({ overview }: { overview: ReturnType<typeof useCommonSpacesOverview> }) {
  const { t } = useTranslation('common-spaces');
  const { stats, buildingNames, loading, error } = overview;

  if (error) return <EmptyState icon={Users} title={t('error.title')} description={error} variant="card" />;
  if (!loading && stats.count === 0) {
    return (
      <EmptyState icon={Users} title={t('empty.title')} description={t('empty.description')} variant="card">
        <Button asChild>
          <Link href={BUILDINGS_HREF}>{t('empty.action')}</Link>
        </Button>
      </EmptyState>
    );
  }
  return (
    <>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4" aria-label={t('overview')}>
        {stats.groups.map((group) => <CommonSpaceGroupCard key={group.group} tally={group} />)}
      </section>
      {stats.buildings.length > 0 && <CommonSpacesByBuilding buildings={stats.buildings} buildingNames={buildingNames} />}
    </>
  );
}

export function SpacesCommonPageContent() {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslation('common-spaces');
  const overview = useCommonSpacesOverview();

  return (
    <section className={cn('flex h-screen flex-col', colors.bg.primary)} aria-labelledby="common-spaces-title">
      <header className={cn('border-b flex h-14 items-center px-4', colors.bg.primary)}>
        <Users className={cn(iconSizes.md, colors.text.muted)} aria-hidden="true" />
        <h1 id="common-spaces-title" className="ml-2 text-lg font-semibold">{t('headerTitle')}</h1>
        <p className={cn('ml-auto text-sm', colors.text.muted)}>{t('headerSubtitle')}</p>
      </header>

      <section className="p-6 space-y-6 overflow-auto">
        <UnifiedDashboard title={t('overview')} stats={buildHeadlineStats(overview.stats, overview.loading, t)} variant="modern" />
        <CommonSpacesBody overview={overview} />
        <aside className={cn('p-4 bg-muted/50', quick.card)}>
          <p className="text-sm font-medium">{t('info.title')}</p>
          <p className={cn('text-sm mt-1', colors.text.muted)}>{t('info.description')}</p>
        </aside>
      </section>
    </section>
  );
}

export default SpacesCommonPageContent;
