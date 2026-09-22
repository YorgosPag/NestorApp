'use client';

import { useState, useCallback, useEffect, useId } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormActions } from '@/components/ui/form/FormActions';
import { FormField } from '@/components/ui/form/FormComponents';
import { Plus, Trash2, Save, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';
import { generateOptimisticId } from '@/services/enterprise-id.service';
import { TradeSelector } from './TradeSelector';
import { AtoeCategoryCodeSelect } from './AtoeCategoryCodeSelect';
import { LineItemsSection } from './LineItemsSection';
import { POProjectSelector, POSupplierSelector } from '@/components/procurement/POEntitySelectors';
import { computeQuoteTotals } from '@/subapps/procurement/types/quote';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
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

type SetField = <K extends keyof FormState>(key: K, val: FormState[K]) => void;

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

/** Κλειδί του μητρώου «μη αποθηκευμένων αλλαγών» (`DirtyFormProvider`) — ΟΧΙ `id` του DOM. */
const DIRTY_FORM_KEY = 'quote-form';

// ============================================================================
// LINE ROW
// ============================================================================

interface LineRowProps {
  line: QuoteLine;
  index: number;
  suggestedAtoeCodes: readonly string[];
  onUpdate: (index: number, field: keyof QuoteLine, value: QuoteLine[keyof QuoteLine]) => void;
  onRemove: (index: number) => void;
}

function LineRow({ line, index, suggestedAtoeCodes, onUpdate, onRemove }: LineRowProps) {
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
        <Input
          aria-label={t('quotes.unit')}
          value={line.unit}
          onChange={(e) => onUpdate(index, 'unit', e.target.value)}
          className="h-8 text-sm"
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

// ============================================================================
// FIELD GROUPS
// ============================================================================

interface FieldGroupProps {
  form: FormState;
  setField: SetField;
}

// Η ετικέτα και η σύνδεσή της ζουν στο `FormField` (id μέσω `useId`) — δεν ξεχνιούνται (ADR-598 G11).
function QuoteHeaderFields({ form, setField }: FieldGroupProps) {
  const { t } = useTranslation('quotes');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label={t('quotes.project')}>
        {(id) => <POProjectSelector id={id} value={form.projectId} onSelect={(pid) => setField('projectId', pid)} />}
      </FormField>
      <FormField label={t('quotes.vendor')}>
        {(id) => <POSupplierSelector id={id} value={form.vendorContactId} onSelect={(vid) => setField('vendorContactId', vid)} />}
      </FormField>
      <FormField label={t('quotes.trade')}>
        {(id) => <TradeSelector id={id} value={form.trade} onChange={(code) => setField('trade', code)} />}
      </FormField>
      <FormField label={t('quotes.validUntil')}>
        {(id) => <Input id={id} type="date" value={form.validUntil} onChange={(e) => setField('validUntil', e.target.value)} />}
      </FormField>
    </div>
  );
}

function QuoteTermsFields({ form, setField }: FieldGroupProps) {
  const { t } = useTranslation('quotes');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label={t('quotes.paymentTerms')}>
        {(id) => <Input id={id} value={form.paymentTerms} onChange={(e) => setField('paymentTerms', e.target.value)} />}
      </FormField>
      <FormField label={t('quotes.deliveryTerms')}>
        {(id) => <Input id={id} value={form.deliveryTerms} onChange={(e) => setField('deliveryTerms', e.target.value)} />}
      </FormField>
      <FormField label={t('quotes.notes')} className="col-span-full">
        {(id) => <Textarea id={id} rows={2} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />}
      </FormField>
    </div>
  );
}

// ============================================================================
// LINES + DISCARD
// ============================================================================

interface QuoteLinesProps {
  lines: QuoteLine[];
  suggestedAtoeCodes: readonly string[];
  onAdd: () => void;
  onUpdate: LineRowProps['onUpdate'];
  onRemove: LineRowProps['onRemove'];
}

function QuoteLines({ lines, suggestedAtoeCodes, onAdd, onUpdate, onRemove }: QuoteLinesProps) {
  const { t } = useTranslation('quotes');
  const totals = computeQuoteTotals(lines);
  const columns = [
    { key: 'description', label: t('quotes.lineDescription') },
    { key: 'categoryCode', label: t('quotes.categoryCode') },
    { key: 'quantity', label: t('quotes.quantity') },
    { key: 'unit', label: t('quotes.unit') },
    { key: 'unitPrice', label: t('quotes.unitPrice') },
    { key: 'vatRate', label: t('quotes.vatRate') },
    { key: 'lineTotal', label: t('quotes.lineTotal'), align: 'right' as const },
  ];

  return (
    <LineItemsSection
      title={t('quotes.lines')}
      columns={columns}
      actionsColumnLabel={t('quotes.lineActions')}
      hasLines={lines.length > 0}
      actions={(
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t('quotes.actions.addLine')}
        </Button>
      )}
      footer={lines.length > 0 && (
        <p className="mt-2 flex justify-end gap-4 text-sm">
          <span className="text-muted-foreground">{t('quotes.subtotal')}: {totals.subtotal.toFixed(2)}</span>
          <span className="text-muted-foreground">{t('quotes.vatAmount')}: {totals.vatAmount.toFixed(2)}</span>
          <span className="font-semibold">{t('quotes.total')}: {totals.total.toFixed(2)} €</span>
        </p>
      )}
    >
      {lines.map((line, i) => (
        <LineRow key={line.id} line={line} index={i} suggestedAtoeCodes={suggestedAtoeCodes} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </LineItemsSection>
  );
}

interface DiscardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}

function DiscardChangesDialog({ open, onOpenChange, onDiscard }: DiscardDialogProps) {
  const { t } = useTranslation('quotes');
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('rfqs.unsaved.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('rfqs.unsaved.body')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('rfqs.unsaved.keep')}</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>{t('rfqs.unsaved.discard')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ============================================================================
// STATE
// ============================================================================

function useQuoteFormState(rfqId: string | undefined) {
  const { registerDirty, clearDirty } = useDirtyForm();
  const [form, setForm] = useState<FormState>({
    projectId: '', vendorContactId: '', trade: '', rfqId: rfqId ?? '',
    validUntil: '', paymentTerms: '', deliveryTerms: '', notes: '', lines: [],
  });
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (hasInteracted) registerDirty(DIRTY_FORM_KEY);
    else clearDirty(DIRTY_FORM_KEY);
  }, [hasInteracted, registerDirty, clearDirty]);
  useEffect(() => () => clearDirty(DIRTY_FORM_KEY), [clearDirty]);

  const edit = useCallback((next: (prev: FormState) => FormState) => {
    setHasInteracted(true);
    setForm(next);
  }, []);
  const setField = useCallback<SetField>((key, val) => edit((prev) => ({ ...prev, [key]: val })), [edit]);

  const atoeCodesForTrade = form.trade ? getAtoeCodesForTrade(form.trade) : [];
  const addLine = () => {
    const line: QuoteLine = { id: generateOptimisticId(), ...EMPTY_LINE, categoryCode: atoeCodesForTrade[0] ?? null };
    edit((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  };
  const removeLine = (index: number) =>
    edit((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  const updateLine: LineRowProps['onUpdate'] = (index, field, value) =>
    edit((prev) => ({ ...prev, lines: prev.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));

  return {
    form, hasInteracted, setField, atoeCodesForTrade, addLine, removeLine, updateLine,
    clearDirty: () => clearDirty(DIRTY_FORM_KEY),
  };
}

function toCreateQuoteDTO(form: FormState, trade: TradeCode): CreateQuoteDTO {
  return {
    projectId: form.projectId,
    vendorContactId: form.vendorContactId,
    trade,
    source: 'manual',
    rfqId: form.rfqId || null,
    lines: form.lines,
    validUntil: form.validUntil || null,
    paymentTerms: form.paymentTerms || null,
    deliveryTerms: form.deliveryTerms || null,
    notes: form.notes || null,
  };
}

/** POST `/api/quotes` — μέσω των SSoT `fetchJson` (μήνυμα του server, όχι ωμό σώμα) + `useFormSubmission`. */
function useQuoteSubmission(form: FormState, clearDirty: () => void, onSuccess?: (id: string) => void) {
  const { t } = useTranslation('quotes');
  const { trade } = form;
  const canSubmit = Boolean(form.projectId && form.vendorContactId && trade);
  const submission = useFormSubmission({
    canSubmit,
    submit: async () => {
      if (!trade) throw new Error(t('quotes.errors.createFailed'));
      const json = await fetchJson<{ data: { id: string } }>('/api/quotes', jsonRequest('POST', toCreateQuoteDTO(form, trade)));
      return json.data.id;
    },
    onSuccess: (id) => { clearDirty(); onSuccess?.(id); },
    errorFallback: t('quotes.errors.createFailed'),
  });
  return { canSubmit, ...submission };
}

// ============================================================================
// FORM
// ============================================================================

interface QuoteFormProps {
  rfqId?: string;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function QuoteForm({ rfqId, onSuccess, onCancel }: QuoteFormProps) {
  const { t } = useTranslation('quotes');
  const formId = useId();
  const state = useQuoteFormState(rfqId);
  const { form } = state;
  const [discardOpen, setDiscardOpen] = useState(false);

  const { canSubmit, submitting, error, handleSubmit } = useQuoteSubmission(form, () => state.clearDirty(), onSuccess);

  const handleCancel = () => {
    if (!state.hasInteracted) { onCancel?.(); return; }
    setDiscardOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('quotes.create')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <QuoteHeaderFields form={form} setField={state.setField} />
          <QuoteLines
            lines={form.lines}
            suggestedAtoeCodes={state.atoeCodesForTrade}
            onAdd={state.addLine}
            onUpdate={state.updateLine}
            onRemove={state.removeLine}
          />
          <QuoteTermsFields form={form} setField={state.setField} />
        </form>
        <FormActions
          formId={formId}
          submitLabel={t('quotes.submit')}
          pendingLabel={t('quotes.submitting')}
          cancelLabel={t('quotes.cancel')}
          onCancel={onCancel ? handleCancel : undefined}
          submitting={submitting}
          submitDisabled={!canSubmit}
          error={error}
          submitIcon={Save}
          cancelIcon={X}
        />
      </CardContent>
      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={() => { state.clearDirty(); onCancel?.(); }}
      />
    </Card>
  );
}
