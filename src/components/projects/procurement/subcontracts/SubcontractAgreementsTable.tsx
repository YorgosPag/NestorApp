'use client';

/**
 * Ο πίνακας συμφωνητικών υπεργολαβίας ενός έργου (ADR-928 §5.14 · Φ3α-2) — στήλες στο πρότυπο Procore «Commitments»
 * (αριθμός · τίτλος · υπεργολάβος · κατάσταση · αξία), με ό,τι λείπει από εκεί και εδώ μετρά:
 * - **εμβέλεια**: συμφωνητικό του έργου ή κύρια σύμβαση με εντολή εργασίας σε αυτό (έναρξη) — AIA A421/A422·
 * - **αξία ως κατώτατο** όταν γραμμές τιμής μονάδας δεν έχουν εκτίμηση ποσότητας («≥ 12.400 €»), ποτέ σιωπηλό μηδέν·
 * - **αποκλίσεις**: ορατό σήμα όταν απόκλιση περιμένει έγκριση ή απορρίφθηκε (μπλοκάρει την έκδοση).
 * Τα πολύγλωσσα δεδομένα (τίτλος) στη γλώσσα της οθόνης, με εφεδρεία· τα στιγμιότυπα μερών όπως τυπώνονται.
 */

import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useLocalizedTextReader } from '@/components/catalog/shared/catalog-neutral-hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/procurement/shared/procurement-table-parts';
import { SubcontractAgreementStatusBadge } from '@/components/procurement/subcontracts/SubcontractAgreementStatusBadge';
import { formatCalendarDate, formatDate } from '@/lib/intl-utils';
import { formatMinor } from '@/lib/money/money';
import { getAgreementUrlIn } from '@/lib/navigation/procurement-urls';
import { Link } from '@/lib/workspace/navigation';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import type { SubcontractListRow } from './subcontract-list-view';
import type { RowAction } from './subcontract-row-actions';
import { SubcontractRowActions } from './SubcontractRowActions';

interface SubcontractAgreementsTableProps {
  /**
   * Το έργο του πλαισίου: η σελίδα λεπτομέρειας ανοίγει μέσα σε αυτό (και για κύρια σύμβαση με εντολή εργασίας εδώ).
   * `null` ⇒ η λίστα κύριων συμβάσεων της εταιρείας (ADR-928 §5.24).
   */
  readonly projectId: string | null;
  readonly rows: readonly SubcontractListRow[];
  readonly actionsOf: (agreement: SubcontractAgreement) => readonly RowAction[];
  readonly pendingIds: ReadonlySet<string>;
  readonly onRun: (agreement: SubcontractAgreement, action: RowAction) => void;
  readonly onPreview: (agreement: SubcontractAgreement) => void;
}

type RowHandlers = Pick<SubcontractAgreementsTableProps, 'projectId' | 'onRun' | 'onPreview'>;

function ValueCell({ row }: { row: SubcontractListRow }) {
  const { t } = useTranslation('procurement');
  const { amount, unpricedLines } = row.value;
  if (amount === 0 && unpricedLines > 0) return <span className="text-muted-foreground">{t('subcontracts.list.value.unitRatesOnly')}</span>;
  return (
    <span className="flex flex-col items-end">
      <span>{unpricedLines > 0 ? t('subcontracts.list.value.atLeast', { amount: formatMinor(amount) }) : formatMinor(amount)}</span>
      {unpricedLines > 0 && <span className="text-xs text-muted-foreground">{t('subcontracts.list.value.unpricedLines', { count: unpricedLines })}</span>}
    </span>
  );
}

/** `projectId === null`: λίστα της εταιρείας ⇒ μετρά τις εντολές· αλλιώς η εντολή **αυτού** του έργου. */
function ScopeCell({ row, projectId }: { row: SubcontractListRow; projectId: string | null }) {
  const { t } = useTranslation('procurement');
  if (row.agreement.scope.kind === 'single_project') return <span>{t('subcontracts.list.scope.single')}</span>;
  const start = row.assignment?.startDate;
  return (
    <span className="flex flex-col">
      <span>{t('subcontracts.list.scope.master')}</span>
      <span className="text-xs text-muted-foreground">
        {projectId === null
          ? t('subcontracts.masters.workOrdersSummary', { count: row.workOrders?.count ?? 0, projects: row.workOrders?.projects ?? 0 })
          : start ? t('subcontracts.list.scope.workOrderFrom', { date: formatCalendarDate(start) }) : t('subcontracts.list.scope.workOrder')}
      </span>
    </span>
  );
}

function StatusCell({ row }: { row: SubcontractListRow }) {
  const { t } = useTranslation('procurement');
  return (
    <span className="flex flex-col items-start gap-1">
      <SubcontractAgreementStatusBadge status={row.agreement.status} />
      {row.deviationsOpen && (
        <span className="flex items-center gap-1 text-xs text-[hsl(var(--text-warning))]">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {t('subcontracts.list.deviationsOpen')}
        </span>
      )}
    </span>
  );
}

function WorkCell({ agreement }: { agreement: SubcontractAgreement }) {
  const { t, i18n } = useTranslation(['procurement', 'quotes']);
  const { text } = useLocalizedTextReader(i18n.language);
  return (
    <span className="flex flex-col">
      <span className="font-medium">{text(agreement.title, agreement.documentNumber)}</span>
      <span className="text-xs text-muted-foreground">{t(`quotes:trades.${agreement.trade}`)}</span>
    </span>
  );
}

function AgreementRow({ projectId, row, actions, pending, onRun, onPreview }: RowHandlers & { row: SubcontractListRow; actions: readonly RowAction[]; pending: boolean }) {
  const { t } = useTranslation('procurement');
  const { agreement } = row;
  return (
    <TableRow aria-busy={pending || undefined}>
      <TableCell className="whitespace-nowrap">
        <span className="flex flex-col">
          <Link href={getAgreementUrlIn(projectId, agreement.id)} className="font-mono text-sm underline-offset-4 hover:underline">{agreement.documentNumber}</Link>
          <span className="text-xs text-muted-foreground">{t(`subcontracts.list.role.${agreement.role}`)}</span>
        </span>
      </TableCell>
      <TableCell><WorkCell agreement={agreement} /></TableCell>
      <TableCell>{agreement.parties.subcontractor.name}</TableCell>
      <TableCell className="text-sm"><ScopeCell row={row} projectId={projectId} /></TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap"><ValueCell row={row} /></TableCell>
      <TableCell><StatusCell row={row} /></TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(agreement.updatedAt)}</TableCell>
      <TableCell className="w-10 text-right">
        <SubcontractRowActions agreement={agreement} actions={actions} pending={pending} onRun={onRun} onPreview={onPreview} />
      </TableCell>
    </TableRow>
  );
}

export function SubcontractAgreementsTable({ projectId, rows, actionsOf, pendingIds, onRun, onPreview }: SubcontractAgreementsTableProps) {
  const { t } = useTranslation('procurement');
  return (
    <Table aria-label={t('subcontracts.list.ariaLabel')}>
      <TableHeader>
        <TableRow>
          <TableHead>{t('subcontracts.list.columns.document')}</TableHead>
          <TableHead>{t('subcontracts.list.columns.work')}</TableHead>
          <TableHead>{t('subcontracts.list.columns.subcontractor')}</TableHead>
          <TableHead>{t('subcontracts.list.columns.scope')}</TableHead>
          <TableHead className="text-right">{t('subcontracts.list.columns.value')}</TableHead>
          <TableHead>{t('subcontracts.list.columns.status')}</TableHead>
          <TableHead>{t('subcontracts.list.columns.updated')}</TableHead>
          <TableHead className="w-10"><span className="sr-only">{t('subcontracts.list.columns.actions')}</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <AgreementRow
            key={row.agreement.id}
            projectId={projectId}
            row={row}
            actions={actionsOf(row.agreement)}
            pending={pendingIds.has(row.agreement.id)}
            onRun={onRun}
            onPreview={onPreview}
          />
        ))}
      </TableBody>
    </Table>
  );
}
