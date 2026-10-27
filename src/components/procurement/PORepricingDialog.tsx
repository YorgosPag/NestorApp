'use client';

/**
 * PORepricingDialog — προεπισκόπηση της «Επανατιμολόγησης» (ADR-923 §5.11 «3γ», Α9)
 *
 * Δείχνει ΑΝΑ ΓΡΑΜΜΗ τι κρατά σήμερα η παραγγελία και τι θα έδιναν οι σημερινοί όροι, με την αιτία
 * (ισοπαλία συμβάσεων · άλλη σύμβαση · καμία), και τη διαφορά του πληρωτέου. Τίποτα δεν αλλάζει
 * χωρίς επιβεβαίωση (commercetools Recalculate · SAP pricing type B · Oracle retroactive update).
 *
 * @module components/procurement/PORepricingDialog
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { POPricing } from '@/lib/procurement/price-purchase-order-pure';
import type { POPricingDrift } from '@/lib/procurement/po-pricing-carry';
import type { POLineFaDiscount } from '@/types/procurement/purchase-order';
import { formatPOCurrency } from './utils/procurement-format';

interface PORepricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kept: POPricing;
  current: POPricing;
  drift: POPricingDrift;
  /** Περιγραφές γραμμών, με τη σειρά της τιμολόγησης. */
  descriptions: readonly string[];
  titleOf: (agreementId: string) => string | null;
  onConfirm: () => void;
}

export function PORepricingDialog({
  open,
  onOpenChange,
  kept,
  current,
  drift,
  descriptions,
  titleOf,
  onConfirm,
}: PORepricingDialogProps) {
  const { t } = useTranslation('procurement');

  const termsLabel = (terms: POLineFaDiscount | null, ambiguous: boolean): string => {
    if (ambiguous) return t('repricing.ambiguous');
    if (!terms) return t('repricing.noAgreement');
    const title = titleOf(terms.agreementId) ?? t('repricing.removedAgreement');
    return t('repricing.terms', { title, percent: terms.discountPercent, amount: formatPOCurrency(terms.discountAmount) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('repricing.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('repricing.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="py-1 pr-2 font-medium">{t('repricing.line')}</th>
              <th scope="col" className="py-1 pr-2 font-medium">{t('repricing.kept')}</th>
              <th scope="col" className="py-1 font-medium">{t('repricing.current')}</th>
            </tr>
          </thead>
          <tbody>
            {drift.lineIndexes.map((index) => (
              <tr key={index} className="border-b align-top">
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  {descriptions[index] || t('repricing.lineNumber', { line: index + 1 })}
                </th>
                <td className="py-1 pr-2">{termsLabel(kept.lines[index]?.faDiscount ?? null, false)}</td>
                <td className="py-1">
                  {termsLabel(current.lines[index]?.faDiscount ?? null, current.lines[index]?.selection?.kind === 'ambiguous')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t('repricing.keptTotal')}</dt>
            <dd className="tabular-nums">{formatPOCurrency(kept.totals.total)}</dd>
          </div>
          <div className="flex justify-between font-medium">
            <dt>{t('repricing.currentTotal')}</dt>
            <dd className="tabular-nums">{formatPOCurrency(current.totals.total)}</dd>
          </div>
        </dl>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('repricing.keepTerms')}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t('repricing.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
