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
import { FormActions } from '@/components/ui/form/FormActions';
import { FormField } from '@/components/ui/form/FormComponents';
import { ListPlus, Plus, Save, X } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';
import { generateOptimisticId } from '@/services/enterprise-id.service';
import { TradeSelector } from './TradeSelector';
import { LineRow, type LineRowProps } from './QuoteFormLineRow';
import { LineItemsSection } from './LineItemsSection';
import { QuoteRfqBindingReview } from './QuoteRfqBindingReview';
import { draftLinesForUnansweredRfqLines, rfqBindingErrorKey } from '../utils/rfq-line-binding';
import { useRfqLines } from '../hooks/useRfqLines';
import { toPublicRfqLine } from '../types/rfq-line';
import { POProjectSelector, POSupplierSelector } from '@/components/procurement/POEntitySelectors';
import { computeQuoteTotals } from '@/subapps/procurement/types/quote';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import type { QuoteLine, CreateQuoteDTO } from '@/subapps/procurement/types/quote';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';

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
  unit: DEFAULT_UOM,
  unitPrice: 0,
  vatRate: 24,
  lineTotal: 0,
  notes: null,
};

/** Κλειδί του μητρώου «μη αποθηκευμένων αλλαγών» (`DirtyFormProvider`) — ΟΧΙ `id` του DOM. */
const DIRTY_FORM_KEY = 'quote-form';

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
  /** Πόσες γραμμές του αιτήματος δεν έχουν ακόμη απάντηση — `0` κρύβει το «Γραμμές από το αίτημα». */
  unansweredRfqLines: number;
  onAddFromRfq: () => void;
  onAdd: () => void;
  onUpdate: LineRowProps['onUpdate'];
  onRemove: LineRowProps['onRemove'];
}

function QuoteLines({ lines, suggestedAtoeCodes, unansweredRfqLines, onAddFromRfq, onAdd, onUpdate, onRemove }: QuoteLinesProps) {
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
        <span className="flex flex-wrap gap-2">
          {unansweredRfqLines > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={onAddFromRfq}>
              <ListPlus className="mr-1 h-3.5 w-3.5" aria-hidden />
              {t('quotes.binding.fromRfq', { count: unansweredRfqLines })}
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('quotes.actions.addLine')}
          </Button>
        </span>
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

type EditForm = (next: (prev: FormState) => FormState) => void;

/** Οι πράξεις γραμμών — μέσα σε RFQ και η «φόρμα από το αίτημα» (ADR-327 §8.5.4, `draftLinesForUnansweredRfqLines`). */
function useQuoteFormLines(form: FormState, edit: EditForm) {
  const atoeCodesForTrade = form.trade ? getAtoeCodesForTrade(form.trade) : [];
  const { lines: rfqRecords } = useRfqLines(form.rfqId);
  const draftFromRfq = draftLinesForUnansweredRfqLines(rfqRecords.map(toPublicRfqLine), form.lines);
  const addLine = () => {
    // Μέσα σε RFQ ο κωδικός ΔΕΝ μαντεύεται: θα γινόταν «τεκμήριο» δεσίματος (`inferRfqLineId`) σε λάθος γραμμή.
    const categoryCode = form.rfqId ? null : atoeCodesForTrade[0] ?? null;
    const line: QuoteLine = { id: generateOptimisticId(), ...EMPTY_LINE, categoryCode };
    edit((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  };
  const addFromRfq = () => edit((prev) => ({
    ...prev,
    lines: [
      ...prev.lines,
      ...draftLinesForUnansweredRfqLines(rfqRecords.map(toPublicRfqLine), prev.lines)
        .map((draft) => ({ id: generateOptimisticId(), ...EMPTY_LINE, ...draft })),
    ],
  }));
  const removeLine = (index: number) =>
    edit((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  const updateLine: LineRowProps['onUpdate'] = (index, field, value) =>
    edit((prev) => ({ ...prev, lines: prev.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));
  const setLines = (lines: QuoteLine[]) => edit((prev) => ({ ...prev, lines }));

  return {
    atoeCodesForTrade, addLine, removeLine, updateLine, setLines, addFromRfq,
    unansweredRfqLines: draftFromRfq.length,
  };
}

/** Μέσα σε RFQ η προσφορά ΑΝΗΚΕΙ σε αυτό: έργο + ειδικότητα (`rfqLeadTrade`, ο κανόνας της πύλης) προσυμπληρώνονται (ADR-327 §8.5.4). */
type QuoteFormContext = Pick<QuoteFormProps, 'rfqId' | 'projectId' | 'trade'>;

function useQuoteFormState({ rfqId, projectId, trade }: QuoteFormContext) {
  const { registerDirty, clearDirty } = useDirtyForm();
  const [form, setForm] = useState<FormState>({
    projectId: projectId ?? '', vendorContactId: '', trade: trade ?? '', rfqId: rfqId ?? '',
    validUntil: '', paymentTerms: '', deliveryTerms: '', notes: '', lines: [],
  });
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (hasInteracted) registerDirty(DIRTY_FORM_KEY);
    else clearDirty(DIRTY_FORM_KEY);
  }, [hasInteracted, registerDirty, clearDirty]);
  useEffect(() => () => clearDirty(DIRTY_FORM_KEY), [clearDirty]);
  // Το RFQ μπορεί να φτάσει ΜΕΤΑ το άνοιγμα της φόρμας (μετρημένο ζωντανά 2026-10-28: κενό «Έργο»). Υιοθετείται τότε —
  // μόνο σε κενό πεδίο, ποτέ πάνω σε επιλογή ανθρώπου, και χωρίς να γίνει η φόρμα «αλλαγμένη».
  useEffect(() => {
    setForm((prev) => ({ ...prev, projectId: prev.projectId || projectId || '', trade: prev.trade || trade || '' }));
  }, [projectId, trade]);

  const edit = useCallback((next: (prev: FormState) => FormState) => {
    setHasInteracted(true);
    setForm(next);
  }, []);
  const setField = useCallback<SetField>((key, val) => edit((prev) => ({ ...prev, [key]: val })), [edit]);

  const lineOps = useQuoteFormLines(form, edit);

  return {
    form, hasInteracted, setField, ...lineOps,
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
      try {
        const json = await fetchJson<{ data: { id: string } }>('/api/quotes', jsonRequest('POST', toCreateQuoteDTO(form, trade)));
        return json.data.id;
      } catch (caught) {
        const bindingKey = rfqBindingErrorKey(caught); // ADR-327 §8.5.4 — `binding:<code>` → μήνυμα για άνθρωπο
        throw bindingKey ? new Error(t(bindingKey)) : caught;
      }
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
  projectId?: string;
  trade?: TradeCode;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function QuoteForm({ rfqId, projectId, trade, onSuccess, onCancel }: QuoteFormProps) {
  const { t } = useTranslation('quotes');
  const formId = useId();
  const state = useQuoteFormState({ rfqId, projectId, trade });
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
            unansweredRfqLines={state.unansweredRfqLines}
            onAddFromRfq={state.addFromRfq}
            onAdd={state.addLine}
            onUpdate={state.updateLine}
            onRemove={state.removeLine}
          />
          {/* ADR-327 §8.5.4 — η ΙΔΙΑ αντιστοίχιση με τον έλεγχο σάρωσης: η χειροκίνητη προσφορά δένεται ρητά στο RFQ. */}
          {form.rfqId && (
            <QuoteRfqBindingReview
              rfqId={form.rfqId}
              lines={form.lines}
              onChange={state.setLines}
              saveActionLabel={t('quotes.submit')}
            />
          )}
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
