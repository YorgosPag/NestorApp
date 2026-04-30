'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDirtyForm } from '@/providers/DirtyFormProvider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TradeSelector } from './TradeSelector';
import { POProjectSelector, POSupplierSelector } from '@/components/procurement/POEntitySelectors';
import { computeQuoteTotals } from '@/subapps/procurement/types/quote';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import type { QuoteLine, CreateQuoteDTO } from '@/subapps/procurement/types/quote';
import type { TradeCode } from '@/subapps/procurement/types/trade';

// ============================================================================
// TYPES
// ============================================================================

interface FormState {
  projectId: string;
  vendorContactId: string;
  trade: TradeCode | '';
  rfqId: string;
  validUntil: string;
  paymentTerms: string;
  deliveryTerms: string;
  notes: string;
  lines: QuoteLine[];
}

const EMPTY_LINE: Omit<QuoteLine, 'id'> = {
  description: '',
  categoryCode: null,
  quantity: 1,
  unit: 'τεμ',
  unitPrice: 0,
  vatRate: 24,
  lineTotal: 0,
  notes: null,
};

const VAT_RATES = [0, 6, 13, 24] as const;

// ============================================================================
// LINE ROW
// ============================================================================

interface LineRowProps {
  line: QuoteLine;
  index: number;
  suggestedAtoeCodes: string[];
  onUpdate: (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => void;
  onRemove: (index: number) => void;
}

function LineRow({ line, index, suggestedAtoeCodes, onUpdate, onRemove }: LineRowProps) {
  const { t } = useTranslation('quotes');

  const remainingCodes = ATOE_MASTER_CATEGORIES
    .map((c) => c.code)
    .filter((c) => !suggestedAtoeCodes.includes(c));

  const handleQtyPrice = (field: 'quantity' | 'unitPrice', raw: string) => {
    const n = parseFloat(raw) || 0;
    onUpdate(index, field, n);
    const qty = field === 'quantity' ? n : line.quantity;
    const price = field === 'unitPrice' ? n : line.unitPrice;
    onUpdate(index, 'lineTotal', parseFloat((qty * price).toFixed(2)));
  };

  return (
    <tr className="border-b text-sm">
      <td className="py-1 pr-2">
        <Input
          value={line.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder={t('quotes.lineDescription')}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-1 pr-2 w-28">
        <Select
          value={line.categoryCode ?? SELECT_CLEAR_VALUE}
          onValueChange={(v) => onUpdate(index, 'categoryCode', v === SELECT_CLEAR_VALUE ? null : v)}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('quotes.categoryCodePlaceholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_CLEAR_VALUE}>{t('quotes.noCategoryCode')}</SelectItem>
            {suggestedAtoeCodes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
            {suggestedAtoeCodes.length > 0 && remainingCodes.length > 0 && <SelectSeparator />}
            {remainingCodes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 pr-2 w-20">
        <Input
          type="number"
          value={line.quantity}
          onChange={(e) => handleQtyPrice('quantity', e.target.value)}
          className="h-8 text-sm"
          min={0}
        />
      </td>
      <td className="py-1 pr-2 w-20">
        <Input
          value={line.unit}
          onChange={(e) => onUpdate(index, 'unit', e.target.value)}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-1 pr-2 w-24">
        <Input
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
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
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
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onRemove(index)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}

// ============================================================================
// FORM
// ============================================================================

interface QuoteFormProps {
  rfqId?: string;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

const FORM_ID = 'quote-form';

export function QuoteForm({ rfqId, onSuccess, onCancel }: QuoteFormProps) {
  const { t } = useTranslation('quotes');
  const { registerDirty, clearDirty } = useDirtyForm();
  const [form, setForm] = useState<FormState>({
    projectId: '',
    vendorContactId: '',
    trade: '',
    rfqId: rfqId ?? '',
    validUntil: '',
    paymentTerms: '',
    deliveryTerms: '',
    notes: '',
    lines: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (hasInteracted) registerDirty(FORM_ID);
    else clearDirty(FORM_ID);
  }, [hasInteracted, registerDirty, clearDirty]);

  useEffect(() => () => clearDirty(FORM_ID), [clearDirty]);

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setHasInteracted(true);
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const atoeCodesForTrade = form.trade ? getAtoeCodesForTrade(form.trade as TradeCode) : [];

  const addLine = () => {
    const id = `line_${Date.now()}`;
    const defaultCategoryCode = atoeCodesForTrade[0] ?? null;
    setHasInteracted(true);
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, { id, ...EMPTY_LINE, categoryCode: defaultCategoryCode }],
    }));
  };

  const removeLine = (index: number) => {
    setHasInteracted(true);
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  };

  const updateLine = (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => {
    setHasInteracted(true);
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  };

  const totals = computeQuoteTotals(form.lines);

  const isValid = form.projectId && form.vendorContactId && form.trade;

  const handleSubmit = async () => {
    if (!isValid || !form.trade) return;
    setSubmitting(true);
    setError(null);
    try {
      const dto: CreateQuoteDTO = {
        projectId: form.projectId,
        vendorContactId: form.vendorContactId,
        trade: form.trade as TradeCode,
        source: 'manual',
        rfqId: form.rfqId || null,
        lines: form.lines,
        validUntil: form.validUntil || null,
        paymentTerms: form.paymentTerms || null,
        deliveryTerms: form.deliveryTerms || null,
        notes: form.notes || null,
      };
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      clearDirty(FORM_ID);
      onSuccess?.(json.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotes.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (!hasInteracted) { onCancel?.(); return; }
    setDiscardOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('quotes.create')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('quotes.project')}</Label>
            <POProjectSelector
              value={form.projectId}
              onSelect={(id) => setField('projectId', id)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('quotes.vendor')}</Label>
            <POSupplierSelector
              value={form.vendorContactId}
              onSelect={(id) => setField('vendorContactId', id)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('quotes.trade')}</Label>
            <TradeSelector
              value={form.trade}
              onChange={(code) => setField('trade', code)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('quotes.validUntil')}</Label>
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setField('validUntil', e.target.value)}
            />
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label>{t('quotes.lines')}</Label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('quotes.actions.addLine')}
            </Button>
          </div>
          {form.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.lineDescription')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.categoryCode')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.quantity')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unit')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.unitPrice')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('quotes.vatRate')}</th>
                    <th className="pb-1 pr-2 text-right font-normal">{t('quotes.lineTotal')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, i) => (
                    <LineRow key={line.id} line={line} index={i} suggestedAtoeCodes={atoeCodesForTrade} onUpdate={updateLine} onRemove={removeLine} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {form.lines.length > 0 && (
            <div className="mt-2 flex justify-end gap-4 text-sm">
              <span className="text-muted-foreground">{t('quotes.subtotal')}: {totals.subtotal.toFixed(2)}</span>
              <span className="text-muted-foreground">{t('quotes.vatAmount')}: {totals.vatAmount.toFixed(2)}</span>
              <span className="font-semibold">{t('quotes.total')}: {totals.total.toFixed(2)} €</span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('quotes.paymentTerms')}</Label>
            <Input
              value={form.paymentTerms}
              onChange={(e) => setField('paymentTerms', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('quotes.deliveryTerms')}</Label>
            <Input
              value={form.deliveryTerms}
              onChange={(e) => setField('deliveryTerms', e.target.value)}
            />
          </div>
          <div className="col-span-full space-y-1.5">
            <Label>{t('quotes.notes')}</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={handleCancel}>
              <X className="mr-1 h-4 w-4" />
              {t('quotes.cancel')}
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            <Save className="mr-1 h-4 w-4" />
            {t('quotes.submit')}
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('rfqs.unsaved.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('rfqs.unsaved.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('rfqs.unsaved.keep')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { clearDirty(FORM_ID); onCancel?.(); }}>
              {t('rfqs.unsaved.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
