'use client';

/**
 * PurchaseOrderForm — Create / Edit PO form
 *
 * Two-column layout on desktop, single column on mobile.
 * Auto-calculated totals, inline validation.
 *
 * @see ADR-267 §Phase A
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/design-system';
import { Save, X, AlertCircle } from 'lucide-react';
import { PO_VAT_RATES } from '@/types/procurement';
import type { PurchaseOrder, POVatRate } from '@/types/procurement';
import { usePurchaseOrderForm } from '@/hooks/procurement';
import { PurchaseOrderItemsTable } from './PurchaseOrderItemsTable';
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PurchaseOrderFormProps {
  existingPO?: PurchaseOrder | null;
  onSuccess?: (id: string, poNumber: string) => void;
  onCancel?: () => void;
}

export function PurchaseOrderForm({
  existingPO,
  onSuccess,
  onCancel,
}: PurchaseOrderFormProps) {
  const { t } = useTranslation('procurement');
  const {
    form,
    setField,
    addItem,
    removeItem,
    updateItem,
    totals,
    validationErrors,
    isValid,
    isEditMode,
    submitting,
    submitError,
    submit,
  } = usePurchaseOrderForm(existingPO);

  const handleSubmit = async () => {
    const result = await submit(existingPO?.id);
    if (result.success && result.id && result.poNumber) {
      onSuccess?.(result.id, result.poNumber);
    }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: 'EUR',
    }).format(n);

  return (
    <div className="space-y-6">
      {/* Header fields */}
      <Card>
        <CardHeader>
          <CardTitle>
            {isEditMode
              ? t('form.editTitle')
              : t('form.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Project */}
            <div className="space-y-1.5">
              <Label>{t('form.project')} *</Label>
              <Input
                value={form.projectId}
                onChange={(e) => setField('projectId', e.target.value)}
                placeholder={t('form.projectPlaceholder')}
              />
            </div>

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label>{t('form.supplier')} *</Label>
              <Input
                value={form.supplierId}
                onChange={(e) => setField('supplierId', e.target.value)}
                placeholder={t('form.supplierPlaceholder')}
              />
            </div>

            {/* Building (optional) */}
            <div className="space-y-1.5">
              <Label>{t('form.building')}</Label>
              <Input
                value={form.buildingId ?? ''}
                onChange={(e) =>
                  setField('buildingId', e.target.value || null)
                }
                placeholder={t('form.buildingPlaceholder')}
              />
            </div>

            {/* Date needed */}
            <div className="space-y-1.5">
              <Label>{t('form.dateNeeded')}</Label>
              <Input
                type="date"
                value={form.dateNeeded}
                onChange={(e) => setField('dateNeeded', e.target.value)}
              />
            </div>

            {/* VAT Rate */}
            <div className="space-y-1.5">
              <Label>{t('form.vatRate')}</Label>
              <Select
                value={String(form.taxRate)}
                onValueChange={(v) =>
                  setField('taxRate', parseInt(v, 10) as POVatRate)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_VAT_RATES.map((r) => (
                    <SelectItem key={r.value} value={String(r.value)}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment terms */}
            <div className="space-y-1.5">
              <Label>{t('form.paymentTerms')}</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={form.paymentTermsDays}
                onChange={(e) => setField('paymentTermsDays', e.target.value)}
                placeholder="30"
              />
            </div>

            {/* Delivery address */}
            <div className="space-y-1.5 md:col-span-2">
              <Label>{t('form.deliveryAddress')}</Label>
              <Input
                value={form.deliveryAddress}
                onChange={(e) => setField('deliveryAddress', e.target.value)}
                placeholder={t('form.deliveryPlaceholder')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.items')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseOrderItemsTable
            items={form.items}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onRemoveItem={removeItem}
          />

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('form.subtotal')}
                </span>
                <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t('form.vatRate')} {form.taxRate}%
                </span>
                <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>{t('form.total')}</span>
                <span className="tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>{t('form.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t('form.supplierNotes')}</Label>
              <Textarea
                value={form.supplierNotes}
                onChange={(e) => setField('supplierNotes', e.target.value)}
                placeholder={t('form.supplierNotesPlaceholder')}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('form.internalNotes')}</Label>
              <Textarea
                value={form.internalNotes}
                onChange={(e) => setField('internalNotes', e.target.value)}
                placeholder={t('form.internalNotesPlaceholder')}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">
              {t('form.validationErrors')}
            </span>
          </div>
          <ul className="mt-1 ml-6 list-disc text-sm text-destructive">
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit error */}
      {submitError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className={cn(
        'flex gap-3',
        'sticky bottom-0 bg-background/95 py-3 backdrop-blur-sm',
        'md:static md:bg-transparent md:py-0 md:backdrop-blur-none',
      )}>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
        >
          <Save className="mr-1.5 h-4 w-4" />
          {submitting
            ? t('form.saving')
            : isEditMode
              ? t('form.save')
              : t('form.create')}
        </Button>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-1.5 h-4 w-4" />
            {t('form.cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
