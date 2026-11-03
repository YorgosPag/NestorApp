'use client';

/**
 * Η σύνοψη των συμφωνητικών ενός έργου (ADR-928 Φ3α-2): **δεσμευμένο** και **σε εκκρεμότητα** σε € (Procore «Committed
 * / Pending» των Commitments), και ένας διακόπτης ανά κατάσταση **που υπάρχει** στο έργο — με πλήθος και αξία.
 *
 * Οι διακόπτες **είναι** το φίλτρο της λίστας από κάτω (μοτίβο Buyout, ADR-330 §5.1 S3.2): `aria-pressed`, κανένας
 * πατημένος = όλα, και η κατάσταση ζει στο URL (`?status=`). Ποσό με κατώτατες γραμμές ⇒ «≥» και πόσα έγγραφα το έχουν.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatMinor } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import {
  SUBCONTRACT_AGREEMENT_STATUS_PRESENTATION,
  subcontractStatusToneClasses,
} from '@/components/procurement/subcontracts/SubcontractAgreementStatusBadge';
import {
  SUBCONTRACT_AGREEMENT_STATUSES,
  type SubcontractAgreementStatus,
} from '@/subapps/procurement/subcontracts/types/agreement';
import { COMMITTED_STATUSES, PENDING_STATUSES, phaseTotal, type PhaseTotal, type StatusTotals } from './subcontract-list-view';

interface SubcontractSummaryProps {
  readonly totals: StatusTotals;
  readonly active: readonly SubcontractAgreementStatus[];
  readonly onChange: (statuses: SubcontractAgreementStatus[]) => void;
}

function toggled(active: readonly SubcontractAgreementStatus[], status: SubcontractAgreementStatus): SubcontractAgreementStatus[] {
  return active.includes(status) ? active.filter((s) => s !== status) : [...active, status];
}

function useAmountText(): (total: PhaseTotal) => string {
  const { t } = useTranslation('procurement');
  return (total) =>
    total.partial > 0 ? t('subcontracts.list.value.atLeast', { amount: formatMinor(total.amount) }) : formatMinor(total.amount);
}

function PhaseFigure({ label, total }: { label: string; total: PhaseTotal }) {
  const { t } = useTranslation('procurement');
  const amountText = useAmountText();
  return (
    <div className="flex flex-col rounded-lg border bg-card p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{amountText(total)}</dd>
      <dd className="text-xs text-muted-foreground tabular-nums">{t('subcontracts.summary.documents', { count: total.count })}</dd>
    </div>
  );
}

function StatusToggle({ status, total, pressed, onToggle }: { status: SubcontractAgreementStatus; total: PhaseTotal; pressed: boolean; onToggle: () => void }) {
  const { t } = useTranslation('procurement');
  const amountText = useAmountText();
  const Icon = SUBCONTRACT_AGREEMENT_STATUS_PRESENTATION[status].icon;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-left text-sm transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed && 'ring-2 ring-ring',
      )}
    >
      <span className={cn('flex items-center gap-1.5 font-medium', subcontractStatusToneClasses(status))}>
        <Icon className="h-4 w-4" aria-hidden />
        {t(`subcontracts.status.${status}`)}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t('subcontracts.summary.statusFigure', { count: total.count, amount: amountText(total) })}
      </span>
    </button>
  );
}

export function SubcontractSummary({ totals, active, onChange }: SubcontractSummaryProps) {
  const { t } = useTranslation('procurement');
  const present = SUBCONTRACT_AGREEMENT_STATUSES.filter((status) => totals[status].count > 0 || active.includes(status));
  return (
    <section aria-label={t('subcontracts.summary.ariaLabel')} className="space-y-3">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PhaseFigure label={t('subcontracts.summary.committed')} total={phaseTotal(totals, COMMITTED_STATUSES)} />
        <PhaseFigure label={t('subcontracts.summary.pending')} total={phaseTotal(totals, PENDING_STATUSES)} />
      </dl>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('subcontracts.summary.filterLabel')}>
        {present.map((status) => (
          <li key={status}>
            <StatusToggle status={status} total={totals[status]} pressed={active.includes(status)} onToggle={() => onChange(toggled(active, status))} />
          </li>
        ))}
      </ul>
    </section>
  );
}
