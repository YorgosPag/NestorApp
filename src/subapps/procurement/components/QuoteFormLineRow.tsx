'use client';

/**
 * Γραμμή της φόρμας χειροκίνητης προσφοράς (`QuoteForm`) — εξήχθη 2026-10-28 (N.7.1, 500 γραμμές).
 * Μονάδα ΜΟΝΟ από το μητρώο (`UomSelect`, ADR-327 §8.5.4) — ο ίδιος επιλογέας με τον έλεγχο σάρωσης και την παραγγελία.
 *
 * @module subapps/procurement/components/QuoteFormLineRow
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { UomSelect } from '@/components/shared/UomSelect';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { AtoeCategoryCodeSelect } from './AtoeCategoryCodeSelect';
import type { QuoteLine } from '@/subapps/procurement/types/quote';

const VAT_RATES = [0, 6, 13, 24] as const;

export interface LineRowProps {
  line: QuoteLine;
  index: number;
  suggestedAtoeCodes: readonly string[];
  onUpdate: (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => void;
  onRemove: (index: number) => void;
}

export function LineRow({ line, index, suggestedAtoeCodes, onUpdate, onRemove }: LineRowProps) {
  const { t } = useTranslation('quotes');

  const handleQtyPrice = (field: 'quantity' | 'unitPrice', raw: string) => {
    const n = parseFloat(raw) || 0;
    onUpdate(index, field, n);
    const qty = field === 'quantity' ? n : line.quantity;
    const price = field === 'unitPrice' ? n : line.unitPrice;
    onUpdate(index, 'lineTotal', parseFloat((qty * price).toFixed(2)));
  };

  // Κάθε κελί ονομάζεται με το κείμενο της κεφαλίδας του (WCAG 2.5.3, ADR-598 G11).
  return (
    <tr className="border-b text-sm">
      <td className="py-1 pr-2">
        <Input
          aria-label={t('quotes.lineDescription')}
          value={line.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder={t('quotes.lineDescription')}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-1 pr-2 w-28">
        <AtoeCategoryCodeSelect
          aria-label={t('quotes.categoryCode')}
          value={line.categoryCode}
          onChange={(code) => onUpdate(index, 'categoryCode', code)}
          suggestedCodes={suggestedAtoeCodes}
          placeholder={t('quotes.categoryCodePlaceholder')}
          noneLabel={t('quotes.noCategoryCode')}
        />
      </td>
      <td className="py-1 pr-2 w-20">
        <Input
          aria-label={t('quotes.quantity')}
          type="number"
          value={line.quantity}
          onChange={(e) => handleQtyPrice('quantity', e.target.value)}
          className="h-8 text-sm"
          min={0}
        />
      </td>
      <td className="py-1 pr-2 w-20">
        {/* Μονάδα ΜΟΝΟ από το μητρώο (ποτέ ελεύθερο κείμενο): ο ίδιος επιλογέας με τον έλεγχο σάρωσης και την παραγγελία. */}
        <UomSelect
          value={line.unit}
          onValueChange={(unit) => onUpdate(index, 'unit', unit)}
          units={PROCUREMENT_UNIT_OPTIONS}
          ariaLabel={t('quotes.unit')}
          size="sm"
          compact
        />
      </td>
      <td className="py-1 pr-2 w-24">
        <Input
          aria-label={t('quotes.unitPrice')}
          type="number"
          value={line.unitPrice}
          onChange={(e) => handleQtyPrice('unitPrice', e.target.value)}
          className="h-8 text-sm"
          min={0}
          step={0.01}
        />
      </td>
      <td className="py-1 pr-2 w-20">
        <Select
          value={String(line.vatRate)}
          onValueChange={(v) => onUpdate(index, 'vatRate', parseInt(v, 10) as QuoteLine['vatRate'])}
        >
          <SelectTrigger aria-label={t('quotes.vatRate')} className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {VAT_RATES.map((r) => (
              <SelectItem key={r} value={String(r)}>{r}%</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 pr-2 w-24 text-right font-medium">
        {line.lineTotal.toFixed(2)}
      </td>
      <td className="py-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onRemove(index)}
          aria-label={t('quotes.actions.removeLine')}
        >
          <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}
