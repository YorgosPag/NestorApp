'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VATRateSelector } from '../../shared/VATRateSelector';
import type { InvoiceLineItem, MyDataIncomeType } from '@/subapps/accounting/types';

interface LineItemsEditorProps {
  lineItems: InvoiceLineItem[];
  onLineItemsChange: (items: InvoiceLineItem[]) => void;
}

export function LineItemsEditor({ lineItems, onLineItemsChange }: LineItemsEditorProps) {
  const { t } = useTranslation('accounting');

  const DEFAULT_LINE_ITEM: InvoiceLineItem = {
    lineNumber: 1,
    description: '',
    quantity: 1,
    unit: t('units.pieces'),
    unitPrice: 0,
    vatRate: 24,
    netAmount: 0,
    mydataCode: 'category1_3' as MyDataIncomeType,
  };

  const addItem = useCallback(() => {
    onLineItemsChange([
      ...lineItems,
      { ...DEFAULT_LINE_ITEM, lineNumber: lineItems.length + 1 },
    ]);
  }, [lineItems, onLineItemsChange]);

  const removeItem = useCallback(
    (index: number) => {
      const updated = lineItems
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, lineNumber: i + 1 }));
      onLineItemsChange(updated);
    },
    [lineItems, onLineItemsChange]
  );

  const updateItem = useCallback(
    (index: number, field: keyof InvoiceLineItem, value: string | number) => {
      const updated = lineItems.map((item, i) => {
        if (i !== index) return item;
        const newItem = { ...item, [field]: value };
        newItem.netAmount = Math.round(newItem.quantity * newItem.unitPrice * 100) / 100;
        return newItem;
      });
      onLineItemsChange(updated);
    },
    [lineItems, onLineItemsChange]
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="space-y-4">
      {lineItems.map((item, index) => {
        const netAmount = Math.round(item.quantity * item.unitPrice * 100) / 100;
        const vatAmount = Math.round(netAmount * (item.vatRate / 100) * 100) / 100;
        const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;

        return (
          <article
            key={index}
            className="border border-border rounded-lg p-4 relative"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                #{item.lineNumber}
              </span>
              {lineItems.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(index)}
                  className="h-8 w-8 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <fieldset className="md:col-span-3">
                <Label>{t('forms.lineDescription')}</Label>
                <Input
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  placeholder={t('forms.lineDescription')}
                />
              </fieldset>

              <fieldset>
                <Label>{t('forms.quantity')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                />
              </fieldset>

              <fieldset>
                <Label>{t('forms.unit')}</Label>
                <Input
                  value={item.unit}
                  onChange={(e) => updateItem(index, 'unit', e.target.value)}
                />
              </fieldset>

              <fieldset>
                <Label>{t('forms.unitPrice')}</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                />
              </fieldset>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <fieldset>
                <Label>ΦΠΑ</Label>
                <VATRateSelector
                  value={item.vatRate}
                  onValueChange={(rate) => updateItem(index, 'vatRate', rate)}
                />
              </fieldset>

              <div className="flex flex-col justify-end">
                <span className="text-xs text-muted-foreground">{t('forms.subtotal')}</span>
                <span className="text-sm font-medium">{formatCurrency(netAmount)}</span>
              </div>

              <div className="flex flex-col justify-end">
                <span className="text-xs text-muted-foreground">ΦΠΑ</span>
                <span className="text-sm font-medium">{formatCurrency(vatAmount)}</span>
              </div>

              <div className="flex flex-col justify-end">
                <span className="text-xs text-muted-foreground">{t('forms.grandTotal')}</span>
                <span className="text-sm font-bold">{formatCurrency(grossAmount)}</span>
              </div>
            </div>
          </article>
        );
      })}

      <Button variant="outline" onClick={addItem} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('forms.addLineItem')}
      </Button>
    </div>
  );
}
