'use client';

/**
 * Η λίστα συμφωνητικών υπεργολαβίας — **μία** για τη λίστα ενός έργου (ADR-928 §5.14 · Φ3α-2) και τη λίστα κύριων
 * συμβάσεων της εταιρείας (§5.24). Καταστάσεις (σφάλμα · φόρτωση · κενό), σύνολα ανά φάση, φίλτρο, αναζήτηση, πίνακας,
 * μεταβάσεις, προεπισκόπηση. Ο καλών δίνει τη ζωντανή ανάγνωση και το πλαίσιο (`projectId` ή `null`).
 *
 * Ιδιοκτησία κατάστασης:
 *   - λίστα → ζωντανή ανάγνωση του καλούντος, καμία τοπική αντιγραφή·
 *   - φίλτρο κατάστασης → το URL (`?status=`, ίδιο hook με κάθε λίστα προμηθειών): μοιράζεται, «Πίσω» δουλεύει·
 *   - αναζήτηση → τοπική (μισογραμμένη λέξη δεν είναι διεύθυνση).
 * Οι ενέργειες κρίνονται με τους **ίδιους** κριτές με τον γραφέα (`useSubcontractRowActions`).
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { SearchInput } from '@/components/ui/search';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProcurementTableNotice } from '@/components/procurement/shared/procurement-table-parts';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { KpiChartSkeleton } from '../overview/skeleton/KpiSkeleton';
import { useStatusDrillParam } from '../clients/useStatusDrillParam';
import { filterListRows, statusTotals, SUBCONTRACT_STATUS_VOCABULARY, toListRows } from './subcontract-list-view';
import { SubcontractAgreementsTable } from './SubcontractAgreementsTable';
import { SubcontractSummary } from './SubcontractSummary';
import { useAgreementTransition } from './useAgreementTransition';
import { useSubcontractRowActions } from './useSubcontractRowActions';

// Μοντέλο εγγράφου, bundles εγγράφου και ολογράφως φτάνουν μόνο όταν ζητηθεί προεπισκόπηση (ADR-744 §34 · ADR-928 §5.17).
const AgreementPreviewDialog = dynamic(() => import('@/components/procurement/subcontracts/document/AgreementPreviewDialog'), { ssr: false });

interface BodyProps {
  /** Το έργο του πλαισίου· `null` ⇒ λίστα κύριων συμβάσεων της εταιρείας. */
  readonly projectId: string | null;
  readonly agreements: readonly SubcontractAgreement[];
}

function SubcontractsBody({ projectId, agreements }: BodyProps) {
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

interface SubcontractAgreementsListProps extends Pick<BodyProps, 'projectId'> {
  readonly items: readonly SubcontractAgreement[];
  readonly loading: boolean;
  readonly error: unknown;
  /** Το κείμενο της κενής λίστας — διαφέρει ανά πλαίσιο. */
  readonly emptyText: string;
}

export function SubcontractAgreementsList({ projectId, items, loading, error, emptyText }: SubcontractAgreementsListProps) {
  const { t } = useTranslation('procurement');
  if (error) {
    return (
      <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        {t('subcontracts.list.error')}
      </p>
    );
  }
  if (loading && items.length === 0) return <KpiChartSkeleton />;
  if (items.length === 0) return <ProcurementTableNotice>{emptyText}</ProcurementTableNotice>;
  return <SubcontractsBody projectId={projectId} agreements={items} />;
}
