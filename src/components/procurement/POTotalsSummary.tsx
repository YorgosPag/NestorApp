'use client';

/**
 * POTotalsSummary — τα σύνολα μιας παραγγελίας, ΙΔΙΑ σε φόρμα και σε προβολή (ADR-923 §5.11 «3γ»).
 *
 * Υποσύνολο → έκπτωση σύμβασης → φορολογητέα αξία → ΦΠΑ → πληρωτέο (EN 16931 BT-106…BT-112).
 * Οι αριθμοί έρχονται έτοιμοι από το `lib/procurement/po-totals` — εδώ δεν υπολογίζεται τίποτα.
 *
 * @module components/procurement/POTotalsSummary
 */

import { cn } from '@/lib/design-system';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { POTotals } from '@/lib/procurement/po-totals';
import { formatPOCurrency } from './utils/procurement-format';

interface POTotalsSummaryProps {
  totals: POTotals;
  taxRate: number;
  /** Τίτλοι των συμβάσεων που έδωσαν έκπτωση (μόνο όπου είναι γνωστοί). */
  agreementTitles?: readonly string[];
  /** Γραμμές με ισοπαλία συμβάσεων — καμία έκπτωση, ορατή προειδοποίηση. */
  ambiguousLineCount?: number;
}

interface TotalsRowProps {
  label: string;
  value: string;
  className?: string;
}

function TotalsRow({ label, value, className }: TotalsRowProps) {
  return (
    <div className={cn('flex justify-between text-sm', className)}>
      <dt className={cn(!className && 'text-muted-foreground')}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

export function POTotalsSummary({ totals, taxRate, agreementTitles = [], ambiguousLineCount = 0 }: POTotalsSummaryProps) {
  const { t } = useTranslation('procurement');
  const hasDiscount = totals.discountAmount > 0;

  return (
    <section aria-label={t('totals.label')} className="mt-4 flex justify-end">
      <div className="w-full max-w-xs space-y-1 text-right">
        {hasDiscount && agreementTitles.length > 0 && (
          <p className="rounded-md border border-[hsl(var(--text-success))]/60 bg-[hsl(var(--bg-success))]/40 px-2 py-1 text-left text-xs text-[hsl(var(--text-success))]">
            {t('totals.faApplied', { titles: agreementTitles.join(' · ') })}
          </p>
        )}
        {ambiguousLineCount > 0 && (
          <p role="status" className="rounded-md border border-[hsl(var(--text-warning))]/60 bg-[hsl(var(--bg-warning))]/40 px-2 py-1 text-left text-xs text-[hsl(var(--text-warning))]">
            {t('totals.faAmbiguous', { count: ambiguousLineCount })}
          </p>
        )}
        <dl className="space-y-1">
          <TotalsRow label={t('totals.subtotal')} value={formatPOCurrency(totals.subtotal)} />
          {hasDiscount && (
            <>
              <TotalsRow
                label={t('totals.faDiscount')}
                value={`−${formatPOCurrency(totals.discountAmount)}`}
                className="text-[hsl(var(--text-success))]"
              />
              <TotalsRow label={t('totals.taxable')} value={formatPOCurrency(totals.taxableAmount)} />
            </>
          )}
          <TotalsRow label={t('totals.vat', { rate: taxRate })} value={formatPOCurrency(totals.taxAmount)} />
          <TotalsRow
            label={t('totals.total')}
            value={formatPOCurrency(totals.total)}
            className="border-t pt-1 text-base font-semibold"
          />
        </dl>
      </div>
    </section>
  );
}
