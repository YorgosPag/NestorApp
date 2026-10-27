'use client';

/**
 * ProjectBuyoutClient — the «Coverage» sub-tab of project procurement (ADR-330 §5.1 S3.2, Procore «Buyout»).
 *
 * State ownership:
 *   - status filter → the URL (`?status=`, same param + hook as every procurement list): shareable, and the
 *     overview's «BOQ coverage» card lands here pre-filtered;
 *   - search + selection → local (a half-made selection is not an address).
 * Selection is pruned to what is still selectable whenever the data changes, so a stale id never reaches the RFQ.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SearchInput } from '@/components/ui/search';
import { useProjectBuyout } from '@/hooks/useProjectBuyout';
import { BUYOUT_STATUS_META, type ProjectBuyout } from '@/services/procurement/buyout/project-buyout';
import { ProcurementTableNotice } from '@/components/procurement/shared/procurement-table-parts';
import { KpiChartSkeleton } from '../overview/skeleton/KpiSkeleton';
import { useStatusDrillParam } from '../clients/useStatusDrillParam';
import { BuyoutSummary } from './BuyoutSummary';
import { BuyoutTable } from './BuyoutTable';
import { BuyoutActionBar } from './BuyoutActionBar';
import { countInProgress, filterBuyoutItems, groupBuyoutItems, pruneSelection, toggleGroupSelection, type BuyoutGroup } from './buyout-view';

interface Props {
  projectId: string;
}

function useBuyoutSelection(buyout: ProjectBuyout | null) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (buyout) setSelected(prev => pruneSelection(prev, buyout.items));
  }, [buyout]);
  const toggleItem = useCallback((id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (!next.delete(id)) next.add(id);
    return next;
  }), []);
  const toggleGroup = useCallback((group: BuyoutGroup) => setSelected(prev => toggleGroupSelection(group, prev)), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggleItem, toggleGroup, clear };
}

function BuyoutBody({ projectId, buyout }: Props & { buyout: ProjectBuyout }) {
  const { t } = useTranslation('procurement');
  const filter = useStatusDrillParam(BUYOUT_STATUS_META);
  const [search, setSearch] = useState('');
  const selection = useBuyoutSelection(buyout);
  const groups = useMemo(
    () => groupBuyoutItems(filterBuyoutItems(buyout.items, filter.statuses, search)),
    [buyout.items, filter.statuses, search],
  );

  return (
    <>
      <BuyoutSummary buyout={buyout} active={filter.statuses} onChange={filter.set} />
      <SearchInput value={search} onChange={setSearch} placeholder={t('buyout.search')} debounceMs={150} showClearButton />
      {groups.length === 0
        ? <ProcurementTableNotice>{t('buyout.emptyFiltered')}</ProcurementTableNotice>
        : <BuyoutTable projectId={projectId} groups={groups} selected={selection.selected} onToggleItem={selection.toggleItem} onToggleGroup={selection.toggleGroup} />}
      <BuyoutActionBar
        projectId={projectId}
        selectedIds={[...selection.selected]}
        inProgressCount={countInProgress(buyout.items, selection.selected)}
        onClear={selection.clear}
      />
    </>
  );
}

export function ProjectBuyoutClient({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const { buyout, isLoading, error } = useProjectBuyout(projectId);

  return (
    <section aria-labelledby="buyout-title" className="space-y-4">
      <header>
        <h2 id="buyout-title" className="text-lg font-semibold">{t('buyout.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('buyout.subtitle')}</p>
      </header>
      {error ? (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {t('buyout.error')}
        </p>
      ) : isLoading && !buyout ? (
        <KpiChartSkeleton />
      ) : !buyout || buyout.items.length === 0 ? (
        <ProcurementTableNotice>{t('buyout.empty')}</ProcurementTableNotice>
      ) : (
        <BuyoutBody projectId={projectId} buyout={buyout} />
      )}
    </section>
  );
}
