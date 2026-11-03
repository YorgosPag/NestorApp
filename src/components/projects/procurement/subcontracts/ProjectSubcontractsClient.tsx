'use client';

/**
 * ProjectSubcontractsClient — η καρτέλα «Υπεργολαβίες» των προμηθειών ενός έργου (ADR-928 §5.14 · §5.15 · Φ3α-2).
 *
 * Ιδιοκτησία κατάστασης:
 *   - λίστα → ζωντανή ανάγνωση (`useProjectSubcontractAgreements`), καμία τοπική αντιγραφή·
 *   - φίλτρο κατάστασης → το URL (`?status=`, ίδιο hook με κάθε λίστα προμηθειών): μοιράζεται, «Πίσω» δουλεύει·
 *   - αναζήτηση → τοπική (μισογραμμένη λέξη δεν είναι διεύθυνση)·
 *   - δικαίωμα ανά έγγραφο → `useSubcontractAuthority` (έργο για `single_project`, εταιρεία για κύρια σύμβαση).
 * Οι ενέργειες κρίνονται με τους **ίδιους** κριτές με τον γραφέα (`subcontract-row-actions`).
 */

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { SearchInput } from '@/components/ui/search';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProcurementTableNotice } from '@/components/procurement/shared/procurement-table-parts';
import { useProjectSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useSubcontractClauseLibrary } from '@/hooks/procurement/subcontracts/useSubcontractLibrary';
import { todayLocalDate } from '@/lib/date-local';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { KpiChartSkeleton } from '../overview/skeleton/KpiSkeleton';
import { useStatusDrillParam } from '../clients/useStatusDrillParam';
import { filterListRows, statusTotals, SUBCONTRACT_STATUS_VOCABULARY, toListRows } from './subcontract-list-view';
import { rowActionsOf, type RowAction } from './subcontract-row-actions';
import { SubcontractAgreementsTable } from './SubcontractAgreementsTable';
import { SubcontractSummary } from './SubcontractSummary';
import { useAgreementTransition } from './useAgreementTransition';
import routeSlice from '@/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

interface Props {
  readonly projectId: string;
}

/** Οι ενέργειες ανά έγγραφο: μόνο όπου ο θεατής έχει δικαίωμα, κρινόμενες με τη βιβλιοθήκη όπως είναι τώρα. */
function useRowActions(projectId: string): (agreement: SubcontractAgreement) => readonly RowAction[] {
  const { user } = useAuth();
  const authority = useSubcontractAuthority(projectId);
  const { library, loading } = useSubcontractClauseLibrary();
  return useCallback(
    (agreement: SubcontractAgreement) => {
      if (!user || !authority.canManage(agreement)) return [];
      return rowActionsOf(agreement, { today: todayLocalDate(), library: loading ? null : library, actorUid: user.uid });
    },
    [authority, library, loading, user],
  );
}

function SubcontractsBody({ projectId, agreements }: Props & { agreements: readonly SubcontractAgreement[] }) {
  const { t } = useTranslation('procurement');
  const filter = useStatusDrillParam(SUBCONTRACT_STATUS_VOCABULARY);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => toListRows(agreements, projectId), [agreements, projectId]);
  const visible = useMemo(() => filterListRows(rows, filter.statuses, search), [rows, filter.statuses, search]);
  const totals = useMemo(() => statusTotals(rows), [rows]);
  const actionsOf = useRowActions(projectId);
  const transition = useAgreementTransition();

  return (
    <>
      <SubcontractSummary totals={totals} active={filter.statuses} onChange={filter.set} />
      <SearchInput value={search} onChange={setSearch} placeholder={t('subcontracts.list.search')} debounceMs={150} showClearButton />
      {visible.length === 0
        ? <ProcurementTableNotice>{t('subcontracts.list.emptyFiltered')}</ProcurementTableNotice>
        : <SubcontractAgreementsTable rows={visible} actionsOf={actionsOf} pendingIds={transition.pendingIds} onRun={transition.run} />}
      <ConfirmDialog {...transition.dialogProps} />
    </>
  );
}

export function ProjectSubcontractsClient({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const { items, loading, error } = useProjectSubcontractAgreements(projectId);

  return (
    <section aria-labelledby="subcontracts-title" className="space-y-4">
      <header>
        <h2 id="subcontracts-title" className="text-lg font-semibold">{t('subcontracts.list.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subcontracts.list.subtitle')}</p>
      </header>
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {t('subcontracts.list.error')}
        </p>
      ) : loading && items.length === 0 ? (
        <KpiChartSkeleton />
      ) : items.length === 0 ? (
        <ProcurementTableNotice>{t('subcontracts.list.empty')}</ProcurementTableNotice>
      ) : (
        <SubcontractsBody projectId={projectId} agreements={items} />
      )}
    </section>
  );
}
