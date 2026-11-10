'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UomSelect } from '@/components/shared/UomSelect';
import { UOM_CODES, toStoredUom } from '@/lib/uom/uom-registry';
import { newInvoiceLineItem } from './invoice-line-defaults';
import { withVatExemption, withVatRate } from '../../shared/vat-rate-transition';
import { invoiceAmountsOf, lineNetAmount } from '@/subapps/accounting/utils/invoice-amounts';
import { isVatExemptionCode } from '@/subapps/accounting/services/config/vat-exemption-reasons';
import { VATRateSelector } from '../../shared/VATRateSelector';
import { VatExemptionReasonField } from '../../shared/VatExemptionReasonField';
import { ServicePresetCombobox } from '../../shared/ServicePresetCombobox';
import type { InvoiceLineItem, ServicePreset } from '@/subapps/accounting/types';
import type { CompanyLineVatDefault } from '@/subapps/accounting/services/setup/company-vat-regime';
import { requiresVatExemption } from '@/subapps/accounting/services/mydata/mydata-codes';
import { formatAccountingCurrency } from '../../../utils/format';

import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { cn } from '@/lib/utils';
import type { InvoiceReviewFinding } from '@/subapps/accounting/services/invoices/invoice-review';
import {
  invoiceAddLineId,
  invoiceLineId,
  invoiceLineReviewId,
  invoiceLineVatExemptionId,
} from './invoice-field-ids';
import { InvoiceLineReviewNote } from './invoice-review-presentation';

interface LineItemsEditorProps {
  lineItems: InvoiceLineItem[];
  onLineItemsChange: (items: InvoiceLineItem[]) => void;
  presets: ServicePreset[];
  /** Ημερομηνία έκδοσης — ορίζει ποια έκδοση του Κώδικα ΦΠΑ αναγράφει η αιτία εξαίρεσης. */
  issueDate: string;
  /** ΦΠΑ κάθε νέας γραμμής — από το καθεστώς της επιχείρησης (`companyLineVatDefault`, ADR-ACC-003 §22.4). */
  lineVatDefault: CompanyLineVatDefault;
  /** Πρόθεμα των `id` — κοινό με τη σύνοψη ελέγχου, για τη «μετάβαση στο πεδίο» (ADR-ACC-003 §22.8). */
  fieldIdPrefix: string;
  /** Τα ευρήματα του ελέγχου πριν την έκδοση· κάθε γραμμή δείχνει τα δικά της. */
  findings: readonly InvoiceReviewFinding[];
}

/** Τα ευρήματα μιας γραμμής που δεν τα λέει ήδη το πεδίο της αιτίας (το «λείπει» το δείχνει μόνο του). */
function lineFindingsOf(findings: readonly InvoiceReviewFinding[], lineNumber: number): InvoiceReviewFinding[] {
  return findings.filter((finding) => finding.lineNumber === lineNumber && finding.code !== 'VAT_EXEMPTION_MISSING');
}

export function LineItemsEditor({
  lineItems, onLineItemsChange, presets, issueDate, lineVatDefault, fieldIdPrefix, findings,
}: LineItemsEditorProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const colors = useSemanticColors();


  const addItem = useCallback(() => {
    onLineItemsChange([
      ...lineItems,
      newInvoiceLineItem(lineItems.length + 1, lineVatDefault),
    ]);
  }, [lineItems, onLineItemsChange, lineVatDefault]);

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
        newItem.netAmount = lineNetAmount(newItem.quantity, newItem.unitPrice);
        return newItem;
      });
      onLineItemsChange(updated);
    },
    [lineItems, onLineItemsChange]
  );

  /** Αντικαθιστά μία γραμμή με το αποτέλεσμα μιας καθαρής μετάβασης. */
  const replaceItem = useCallback(
    (index: number, next: (item: InvoiceLineItem) => InvoiceLineItem) => {
      onLineItemsChange(lineItems.map((item, i) => (i === index ? next(item) : item)));
    },
    [lineItems, onLineItemsChange]
  );

  const applyPreset = useCallback(
    (index: number, preset: ServicePreset) => {
      replaceItem(index, (item) => {
        const withRate = withVatRate({
          ...item,
          description: preset.description,
          unit: toStoredUom(preset.unit),
          unitPrice: preset.unitPrice,
          mydataCode: preset.mydataCode,
          netAmount: lineNetAmount(item.quantity, preset.unitPrice),
        }, preset.vatRate);
        // ADR-ACC-003 §22.3: η αιτία της υπηρεσίας περνά στη γραμμή· υπηρεσία χωρίς αιτία ΔΕΝ σβήνει αιτία που
        // διάλεξε ήδη ο χρήστης στο 0% (σιωπή ≠ «καμία αιτία»).
        const code = preset.vatExemptionCategory;
        return isVatExemptionCode(code) ? withVatExemption(withRate, code) : withRate;
      });
    },
    [replaceItem]
  );

  return (
    <div className="space-y-4">
      {lineItems.map((item, index) => {
        // Ο ΕΝΑΣ υπολογισμός (ADR-ACC-003 §22.2): ό,τι δείχνει η γραμμή είναι ό,τι ελέγχει ο διακομιστής.
        const {
          totalNetAmount: netAmount, totalVatAmount: vatAmount, totalGrossAmount: grossAmount,
        } = invoiceAmountsOf([item]);
        // Η αρίθμηση της υποβολής (θέση + 1) — ίδια με του ελέγχου, ώστε άγκυρα και στοιχείο να συμπίπτουν.
        const lineNumber = index + 1;
        const lineFindings = lineFindingsOf(findings, lineNumber);
        const reviewNoteId = invoiceLineReviewId(fieldIdPrefix, lineNumber);

        return (
          <article
            key={index}
            id={invoiceLineId(fieldIdPrefix, lineNumber)}
            tabIndex={-1}
            className="border border-border rounded-lg p-4 relative"
          >
            <div className="flex items-start justify-between mb-3">
              <span className={cn("text-sm font-medium", colors.text.muted)}>
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
                <ServicePresetCombobox
                  value={item.description}
                  onDescriptionChange={(desc) => updateItem(index, 'description', desc)}
                  onPresetSelect={(preset) => applyPreset(index, preset)}
                  presets={presets}
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
                <Label htmlFor={`${fieldIdPrefix}-unit-${index}`}>{t('forms.unit')}</Label>
                <UomSelect
                  id={`${fieldIdPrefix}-unit-${index}`}
                  value={item.unit}
                  onValueChange={(code) => updateItem(index, 'unit', code)}
                  units={UOM_CODES}
                  compact
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
                <Label>{t('invoices.vatLabel')}</Label>
                <VATRateSelector
                  value={item.vatRate}
                  onValueChange={(rate) => replaceItem(index, (current) => withVatRate(current, rate))}
                />
              </fieldset>

              <div className="flex flex-col justify-end">
                <span className={cn("text-xs", colors.text.muted)}>{t('forms.subtotal')}</span>
                <span className="text-sm font-medium">{formatAccountingCurrency(netAmount)}</span>
              </div>

              <div className="flex flex-col justify-end">
                <span className={cn("text-xs", colors.text.muted)}>{t('invoices.vatLabel')}</span>
                <span className="text-sm font-medium">{formatAccountingCurrency(vatAmount)}</span>
              </div>

              <div className="flex flex-col justify-end">
                <span className={cn("text-xs", colors.text.muted)}>{t('forms.grandTotal')}</span>
                <span className="text-sm font-bold">{formatAccountingCurrency(grossAmount)}</span>
              </div>
            </div>

            {requiresVatExemption(item.vatRate) && (
              <VatExemptionReasonField
                id={invoiceLineVatExemptionId(fieldIdPrefix, lineNumber)}
                value={item.vatExemptionCategory}
                issueDate={issueDate}
                onValueChange={(code) => replaceItem(index, (current) => withVatExemption(current, code))}
                reviewNoteId={lineFindings.length > 0 ? reviewNoteId : undefined}
              />
            )}
            <InvoiceLineReviewNote id={reviewNoteId} findings={lineFindings} />
          </article>
        );
      })}

      <Button id={invoiceAddLineId(fieldIdPrefix)} variant="outline" onClick={addItem} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        {t('forms.addLineItem')}
      </Button>
    </div>
  );
}
