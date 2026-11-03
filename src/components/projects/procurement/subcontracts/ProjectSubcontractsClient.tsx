'use client';

/**
 * ProjectSubcontractsClient — η καρτέλα «Υπεργολαβίες» των προμηθειών ενός έργου (ADR-928 §5.14 · §5.15 · Φ3α-2 · Φ3γ).
 *
 * Ιδιοκτησία κατάστασης:
 *   - λίστα → ζωντανή ανάγνωση (`useProjectSubcontractAgreements`), καμία τοπική αντιγραφή·
 *   - φίλτρο κατάστασης → το URL (`?status=`, ίδιο hook με κάθε λίστα προμηθειών): μοιράζεται, «Πίσω» δουλεύει·
 *   - αναζήτηση → τοπική (μισογραμμένη λέξη δεν είναι διεύθυνση)·
 *   - δικαίωμα ανά έγγραφο → `useSubcontractAuthority` (έργο για `single_project`, εταιρεία για κύρια σύμβαση).
 * Οι ενέργειες κρίνονται με τους **ίδιους** κριτές με τον γραφέα (`useSubcontractRowActions`).
 * «Νέο» (Φ3γ): ο διάλογος φτάνει με `import()` — η καρτέλα δεν κουβαλά πρότυπα ή κριτή.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProcurementTableNotice } from '@/components/procurement/shared/procurement-table-parts';
import { useProjectSubcontractAgreements } from '@/hooks/procurement/subcontracts/useProjectSubcontractAgreements';
import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { KpiChartSkeleton } from '../overview/skeleton/KpiSkeleton';
import { useStatusDrillParam } from '../clients/useStatusDrillParam';
import { filterListRows, statusTotals, SUBCONTRACT_STATUS_VOCABULARY, toListRows } from './subcontract-list-view';
import { SubcontractAgreementsTable } from './SubcontractAgreementsTable';
import { SubcontractSummary } from './SubcontractSummary';
import { useAgreementTransition } from './useAgreementTransition';
import { useSubcontractRowActions } from './useSubcontractRowActions';
import routeSlice from '@/i18n/generated/routes/o__workspace__projects__id__procurement__subcontracts.el.json';
import { registerRouteSlice } from '@/i18n/route-slice';

registerRouteSlice(routeSlice);

// Μοντέλο εγγράφου, bundles εγγράφου και ολογράφως φτάνουν μόνο όταν ζητηθεί προεπισκόπηση (ADR-744 §34 · ADR-928 §5.17).
const AgreementPreviewDialog = dynamic(() => import('@/components/procurement/subcontracts/document/AgreementPreviewDialog'), { ssr: false });
const NewAgreementDialog = dynamic(() => import('@/components/procurement/subcontracts/editor/NewAgreementDialog'), { ssr: false });

interface Props {
  readonly projectId: string;
}

function SubcontractsBody({ projectId, agreements }: Props & { agreements: readonly SubcontractAgreement[] }) {
  const { t } = useTranslation('procurement');
  const filter = useStatusDrillParam(SUBCONTRACT_STATUS_VOCABULARY);
  const [search, setSearch] = useState('');
  const rows = useMemo(() => toListRows(agreements, projectId), [agreements, projectId]);
  const visible = useMemo(() => filterListRows(rows, filter.statuses, search), [rows, filter.statuses, search]);
  const totals = useMemo(() => statusTotals(rows), [rows]);
  const actionsOf = useSubcontractRowActions(projectId);
  const transition = useAgreementTransition();
  // Το id, όχι το αντικείμενο: η προεπισκόπηση ακολουθεί τη ζωντανή εκδοχή του εγγράφου.
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewing = previewId === null ? null : agreements.find((agreement) => agreement.id === previewId) ?? null;

  return (
    <>
      <SubcontractSummary totals={totals} active={filter.statuses} onChange={filter.set} />
      <SearchInput value={search} onChange={setSearch} placeholder={t('subcontracts.list.search')} debounceMs={150} showClearButton />
      {visible.length === 0
        ? <ProcurementTableNotice>{t('subcontracts.list.emptyFiltered')}</ProcurementTableNotice>
        : <SubcontractAgreementsTable projectId={projectId} rows={visible} actionsOf={actionsOf} pendingIds={transition.pendingIds} onRun={transition.run} onPreview={(agreement) => setPreviewId(agreement.id)} />}
      <ConfirmDialog {...transition.dialogProps} />
      {previewing && <AgreementPreviewDialog agreement={previewing} onClose={() => setPreviewId(null)} />}
    </>
  );
}

/** «Νέο» μόνο όταν ο θεατής μπορεί να γεννήσει κάτι — συμφωνητικό του έργου ή κύρια σύμβαση (§5.15, fail-closed). */
function NewAgreementButton({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const authority = useSubcontractAuthority(projectId);
  const [open, setOpen] = useState(false);
  if (!authority.canCreateForProject && !authority.canCreateMaster) return null;
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" aria-hidden />{t('subcontracts.editor.new.action')}</Button>
      {open && <NewAgreementDialog projectId={projectId} canCreateForProject={authority.canCreateForProject} canCreateMaster={authority.canCreateMaster} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ProjectSubcontractsClient({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const { items, loading, error } = useProjectSubcontractAgreements(projectId);

  return (
    <section aria-labelledby="subcontracts-title" className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <hgroup>
          <h2 id="subcontracts-title" className="text-lg font-semibold">{t('subcontracts.list.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subcontracts.list.subtitle')}</p>
        </hgroup>
        <NewAgreementButton projectId={projectId} />
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
