'use client';

/**
 * Buyout summary — one toggle per status with its count AND its value, plus coverage by VALUE.
 *
 * Here the cards ARE in-place filters (the list sits right below them — the Zendesk/Linear «view chips»
 * pattern), unlike the overview cards, which navigate. Toggles are `aria-pressed` buttons; none pressed = all.
 * Coverage is shown in € as well as in count: «0/49» says nothing about how much money is still unbought
 * (Procore's «uncommitted budget»).
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { BUYOUT_STATUSES, type BuyoutStatus, type BuyoutTotal, type ProjectBuyout } from '@/services/procurement/buyout/project-buyout';
import { BUYOUT_STATUS_ICON, buyoutToneClasses } from './BuyoutStatusBadge';

interface BuyoutSummaryProps {
  buyout: ProjectBuyout;
  active: readonly BuyoutStatus[];
  onChange: (statuses: BuyoutStatus[]) => void;
}

function toggled(active: readonly BuyoutStatus[], status: BuyoutStatus): BuyoutStatus[] {
  return active.includes(status) ? active.filter(s => s !== status) : [...active, status];
}

interface StatusToggleProps {
  status: BuyoutStatus;
  total: BuyoutTotal;
  pressed: boolean;
  onToggle: () => void;
}

function StatusToggle({ status, total, pressed, onToggle }: StatusToggleProps) {
  const { t } = useTranslation('procurement');
  const Icon = BUYOUT_STATUS_ICON[status];
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-describedby={`buyout-hint-${status}`}
      onClick={onToggle}
      className={cn(
        'flex h-full w-full flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed && 'ring-2 ring-ring',
      )}
    >
      <span className={cn('flex items-center gap-1.5 text-sm font-medium', buyoutToneClasses(status))}>
        <Icon className="h-4 w-4" aria-hidden />
        {t(`buyout.status.${status}`)}
      </span>
      <span className="text-2xl font-bold tabular-nums">{total.count}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(total.amount)}</span>
      <span id={`buyout-hint-${status}`} className="sr-only">{t(`buyout.statusHint.${status}`)}</span>
    </button>
  );
}

export function BuyoutSummary({ buyout, active, onChange }: BuyoutSummaryProps) {
  const { t } = useTranslation('procurement');
  const totalAmount = BUYOUT_STATUSES.reduce((sum, status) => sum + buyout.totals[status].amount, 0);
  const coveredAmount = buyout.totals.committed.amount;
  const valuePct = totalAmount > 0 ? Math.round((coveredAmount / totalAmount) * 100) : 0;

  return (
    <section aria-label={t('buyout.summary.ariaLabel')} className="space-y-3">
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {BUYOUT_STATUSES.map(status => (
          <li key={status}>
            <StatusToggle
              status={status}
              total={buyout.totals[status]}
              pressed={active.includes(status)}
              onToggle={() => onChange(toggled(active, status))}
            />
          </li>
        ))}
      </ul>
      <div className="space-y-1">
        <Progress value={valuePct} className="h-2" />
        <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{t('buyout.summary.coveredValue', { covered: formatCurrency(coveredAmount), total: formatCurrency(totalAmount) })}</span>
          <span>{t('buyout.summary.coveredCount', { covered: buyout.coveredBoqItemCount, total: buyout.boqItemCount })}</span>
        </p>
      </div>
    </section>
  );
}
