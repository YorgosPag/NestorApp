'use client';

/**
 * PORepricingNotice — ένδειξη μετατόπισης όρων στην επεξεργασία PO (ADR-923 §5.11 «3γ», Α9)
 *
 * Η παραγγελία κρατά τους όρους με τους οποίους εκδόθηκε. Όταν οι ΣΗΜΕΡΙΝΟΙ όροι διαφέρουν
 * (νέα / τερματισμένη / ισοπαλία συμβάσεων), το λέει — χωρίς να αλλάξει τίποτα — και προσφέρει
 * ρητή «Επανατιμολόγηση». Αν ζητήθηκε, το λέει επίσης και επιτρέπει αναίρεση πριν την αποθήκευση.
 *
 * @module components/procurement/PORepricingNotice
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import type { POPricingDrift, POPricingMode } from '@/lib/procurement/po-pricing-carry';
import { formatPOCurrency } from './utils/procurement-format';

interface PORepricingNoticeProps {
  pricingMode: POPricingMode;
  drift: POPricingDrift | null;
  onReview: () => void;
  onUndo: () => void;
}

export function PORepricingNotice({ pricingMode, drift, onReview, onUndo }: PORepricingNoticeProps) {
  const { t } = useTranslation('procurement');

  if (pricingMode === 'redetermine') {
    return (
      <aside role="status" className="mt-4 flex items-center justify-between gap-3 rounded-md border border-[hsl(var(--text-warning))]/60 bg-[hsl(var(--bg-warning))]/40 px-3 py-2 text-sm text-[hsl(var(--text-warning))]">
        <p>{t('repricing.pending')}</p>
        <Button type="button" size="sm" variant="outline" onClick={onUndo}>{t('repricing.undo')}</Button>
      </aside>
    );
  }
  if (!drift || drift.lineIndexes.length === 0) return null;

  const delta = `${drift.totalDelta >= 0 ? '+' : '−'}${formatPOCurrency(Math.abs(drift.totalDelta))}`;
  return (
    <aside role="status" className="mt-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
      <p>{t('repricing.drift', { count: drift.lineIndexes.length, delta })}</p>
      <Button type="button" size="sm" variant="outline" onClick={onReview}>{t('repricing.review')}</Button>
    </aside>
  );
}
