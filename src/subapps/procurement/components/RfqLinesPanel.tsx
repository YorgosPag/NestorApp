'use client';

/**
 * Γραμμές ενός RFQ: πίνακας + φόρμα νέας γραμμής.
 *
 * ADR-598 «(θ)» — προσθήκη: `<form>` + SSoT `useFormSubmission`/`FormActions` (πριν: `onClick` έξω
 * από φόρμα, ωμό `'Error'` (N.11), και το κουμπί έγραφε «Δημιουργία RFQ» αντί για «Προσθήκη
 * Γραμμής»)· ποσότητα με το SSoT `NumericField` (ADR-706, όχι `type="number"`). Διαγραφή:
 * `useInFlightAction` ανά γραμμή, ορατό σφάλμα (πριν: αθόρυβη αποτυχία) και κουμπί με όνομα
 * (πριν: μόνο εικονίδιο).
 */

import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormActions } from '@/components/ui/form/FormActions';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useInFlightAction } from '@/hooks/useInFlightAction';
import { getErrorMessage } from '@/lib/error-utils';
import { TradeSelector } from './TradeSelector';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import { UNITS, OTHER_UNIT } from '@/subapps/procurement/utils/units';
import type { RfqLine, CreateRfqLineDTO } from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { SetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';

// ============================================================================
// TYPES
// ============================================================================

interface RfqLinesPanelProps {
  rfqId: string;
  lines: RfqLine[];
  loading: boolean;
  onAdd: (dto: CreateRfqLineDTO) => Promise<RfqLine>;
  onDelete: (lineId: string) => Promise<void>;
  lockState?: SetupLockState;
}

interface NewLineState {
  description: string;
  trade: TradeCode;
  /** ADR-706: number model, 0 = "not entered" (rendered blank, sent as `null`). */
  quantity: number;
  unit: string;
  customUnit: boolean;
}

const EMPTY_LINE: NewLineState = {
  description: '',
  trade: 'concrete',
  quantity: 0,
  unit: UNITS[0],
  customUnit: false,
};

function toLineDto(line: NewLineState): CreateRfqLineDTO {
  return {
    source: 'ad_hoc',
    description: line.description.trim(),
    trade: line.trade,
    categoryCode: getAtoeCodesForTrade(line.trade)[0] ?? null,
    quantity: line.quantity > 0 ? line.quantity : null,
    unit: line.customUnit ? line.unit.trim() || null : line.unit || null,
  };
}

// ============================================================================
// TABLE (διαγραφή ανά γραμμή)
// ============================================================================

function RfqLineRow({ line, locked, onDelete, t }: { line: RfqLine; locked: boolean; onDelete: (id: string) => Promise<void>; t: Translate }) {
  const { isRunning, run } = useInFlightAction();
  const remove = useCallback(async () => {
    try {
      await run(() => onDelete(line.id));
    } catch (caught) {
      toast.error(getErrorMessage(caught, t('rfqs.errors.deleteLineFailed')));
    }
  }, [run, onDelete, line.id, t]);

  return (
    <tr className="border-b">
      <td className="py-1.5 pr-2">{line.description}</td>
      <td className="py-1.5 pr-2 text-muted-foreground">{line.trade}</td>
      <td className="py-1.5 pr-2 text-muted-foreground">{line.quantity ?? '—'}</td>
      <td className="py-1.5 pr-2 text-muted-foreground">{line.unit ?? '—'}</td>
      <td className="py-1.5">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={t('rfqs.deleteLine', { description: line.description })}
          aria-busy={isRunning}
          disabled={isRunning || locked}
          onClick={remove}
        >
          {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />}
        </Button>
      </td>
    </tr>
  );
}

function RfqLinesTable({ lines, locked, onDelete, t }: { lines: RfqLine[]; locked: boolean; onDelete: (id: string) => Promise<void>; t: Translate }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineDescription')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineTrade')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineQuantity')}</th>
            <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineUnit')}</th>
            <th><span className="sr-only">{t('rfqs.lineActions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => <RfqLineRow key={line.id} line={line} locked={locked} onDelete={onDelete} t={t} />)}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// NEW LINE FORM
// ============================================================================

function useNewLineForm(onAdd: RfqLinesPanelProps['onAdd'], onDone: () => void, t: Translate) {
  const [line, setLine] = useState<NewLineState>(EMPTY_LINE);
  const update = useCallback((patch: Partial<NewLineState>) => setLine((p) => ({ ...p, ...patch })), []);
  const canSubmit = line.description.trim() !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: () => onAdd(toLineDto(line)),
    onSuccess: () => { setLine(EMPTY_LINE); onDone(); },
    errorFallback: t('rfqs.errors.addLineFailed'),
  });

  return { line, update, canSubmit, submission };
}

function UnitField({ line, update, t }: { line: NewLineState; update: (p: Partial<NewLineState>) => void; t: Translate }) {
  return (
    <div className="flex flex-col gap-1">
      <Select
        value={line.customUnit ? OTHER_UNIT : line.unit}
        onValueChange={(val) => update(val === OTHER_UNIT ? { customUnit: true, unit: '' } : { customUnit: false, unit: val })}
      >
        <SelectTrigger aria-label={t('rfqs.lineUnit')} className="h-9 w-24 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={OTHER_UNIT}>{t('rfqs.lineEdit.unitOption.other')}</SelectItem>
        </SelectContent>
      </Select>
      {line.customUnit && (
        <Input
          aria-label={t('rfqs.lineUnit')}
          placeholder={t('rfqs.lineEdit.unitOption.otherPlaceholder')}
          value={line.unit}
          onChange={(e) => update({ unit: e.target.value })}
          className="h-7 w-24 text-xs"
        />
      )}
    </div>
  );
}

function NewLineForm({ onAdd, onClose, t }: { onAdd: RfqLinesPanelProps['onAdd']; onClose: () => void; t: Translate }) {
  const { line, update, canSubmit, submission } = useNewLineForm(onAdd, onClose, t);
  const formId = `${useId()}-form`;
  return (
    <section className="space-y-2 rounded-md border p-3">
      {/* Χωρίς ορατές ετικέτες: κάθε πεδίο ονομάζεται με το κείμενο της στήλης του (ADR-598 G11). */}
      <form id={formId} onSubmit={submission.handleSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Input aria-label={t('rfqs.lineDescription')} placeholder={t('rfqs.lineDescription')} value={line.description} onChange={(e) => update({ description: e.target.value })} className="sm:col-span-2" />
        <TradeSelector aria-label={t('rfqs.lineTrade')} value={line.trade} onChange={(trade) => update({ trade })} />
        <div className="flex gap-2">
          <NumericField
            aria-label={t('rfqs.lineQuantity')}
            placeholder={t('rfqs.lineQuantity')}
            value={line.quantity}
            onValueChange={(quantity) => update({ quantity })}
            blankValue={0}
            min={0}
            className="w-20"
          />
          <UnitField line={line} update={update} t={t} />
        </div>
      </form>
      <FormActions
        formId={formId}
        submitLabel={t('rfqs.addLine')}
        pendingLabel={t('rfqs.addingLine')}
        cancelLabel={t('rfqs.cancel')}
        onCancel={onClose}
        submitting={submission.submitting}
        submitDisabled={!canSubmit}
        error={submission.error}
      />
    </section>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RfqLinesPanel({ lines, loading, onAdd, onDelete, lockState = 'unlocked' }: RfqLinesPanelProps) {
  const locked = lockState !== 'unlocked';
  const { t } = useTranslation('quotes');
  const [showForm, setShowForm] = useState(false);

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rfqs.loading')}
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {lines.length === 0 && !showForm && <p className="text-sm text-muted-foreground">{t('rfqs.linesEmpty')}</p>}
      {lines.length > 0 && <RfqLinesTable lines={lines} locked={locked} onDelete={onDelete} t={t} />}
      {showForm && <NewLineForm onAdd={onAdd} onClose={() => setShowForm(false)} t={t} />}
      {!showForm && (
        <Button size="sm" variant="outline" disabled={locked} onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          {t('rfqs.addLine')}
        </Button>
      )}
    </section>
  );
}
