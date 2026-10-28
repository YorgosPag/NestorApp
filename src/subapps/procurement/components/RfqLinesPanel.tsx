'use client';

/**
 * Γραμμές ενός RFQ: πίνακας + φόρμα νέας γραμμής.
 *
 * ADR-598 «(θ)» — προσθήκη: `<form>` + SSoT `useFormSubmission`/`FormActions` (πριν: `onClick` έξω
 * από φόρμα, ωμό `'Error'` (N.11), και το κουμπί έγραφε «Δημιουργία RFQ» αντί για «Προσθήκη
 * Γραμμής»)· ποσότητα με το SSoT `NumericField` (ADR-706, όχι `type="number"`). Διαγραφή:
 * `useInFlightAction` ανά γραμμή, ορατό σφάλμα (πριν: αθόρυβη αποτυχία) και κουμπί με όνομα
 * (πριν: μόνο εικονίδιο).
 *
 * ADR-923 §5.11 «3γ» 4β — μονάδα: `UomSelect` του ΕΝΟΣ μητρώου, **χωρίς** «Άλλο» (SAP/Oracle: μονάδα μόνο από το
 * μητρώο)· η προεπιλογή έρχεται από την ειδικότητα (`defaultUomForTrade`) μέχρι να διαλέξει άνθρωπος.
 */

import { useCallback, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericField } from '@/components/ui/numeric-field';
import { UomSelect } from '@/components/shared/UomSelect';
import { FormActions } from '@/components/ui/form/FormActions';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { useInFlightAction } from '@/hooks/useInFlightAction';
import { getErrorMessage } from '@/lib/error-utils';
import { TradeSelector } from './TradeSelector';
import { defaultUomForTrade, getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { DEFAULT_UOM } from '@/lib/uom/uom-registry';
import { useUomLabel } from '@/hooks/useUomLabel';
import type { RfqLine, CreateRfqLineDTO } from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { SetupLockState } from '@/subapps/procurement/utils/rfq-lock-state';
import type { RFQ } from '@/subapps/procurement/types/rfq';
import { RfqResponseLockControl } from './RfqResponseLockControl';

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
  /** ADR-327 §8.5 Β — το RFQ για τη ρύθμιση κλειδώματος απάντησης· ο γονέας κρατά το ενημερωμένο (`onRfqSaved`). */
  rfq?: RFQ | null;
  onRfqSaved?: (rfq: RFQ) => void;
}

interface NewLineState {
  description: string;
  trade: TradeCode;
  /** ADR-706: number model, 0 = "not entered" (rendered blank, sent as `null`). */
  quantity: number;
  /** Κωδικός του μητρώου μονάδων — μόνο από τη λίστα, ποτέ ελεύθερο κείμενο (ADR-923 §5.11 «3γ» 4β). */
  unit: string;
  /** Η μονάδα ακολουθεί την ειδικότητα μέχρι να τη διαλέξει άνθρωπος — τότε δεν αντικαθίσταται σιωπηλά. */
  unitFromTrade: boolean;
}

const EMPTY_TRADE: TradeCode = 'concrete';

const EMPTY_LINE: NewLineState = {
  description: '',
  trade: EMPTY_TRADE,
  quantity: 0,
  unit: defaultUomForTrade(EMPTY_TRADE) ?? DEFAULT_UOM,
  unitFromTrade: true,
};

/** Αλλαγή ειδικότητας: η μονάδα της ειδικότητας, εκτός αν ο άνθρωπος έχει ήδη διαλέξει. */
function withTrade(line: NewLineState, trade: TradeCode): NewLineState {
  return line.unitFromTrade ? { ...line, trade, unit: defaultUomForTrade(trade) ?? DEFAULT_UOM } : { ...line, trade };
}

function toLineDto(line: NewLineState): CreateRfqLineDTO {
  return {
    source: 'ad_hoc',
    description: line.description.trim(),
    trade: line.trade,
    categoryCode: getAtoeCodesForTrade(line.trade)[0] ?? null,
    quantity: line.quantity > 0 ? line.quantity : null,
    unit: line.unit || null,
  };
}

// ============================================================================
// TABLE (διαγραφή ανά γραμμή)
// ============================================================================

function RfqLineRow({ line, locked, onDelete, t }: { line: RfqLine; locked: boolean; onDelete: (id: string) => Promise<void>; t: Translate }) {
  const { isRunning, run } = useInFlightAction();
  const uomLabel = useUomLabel();
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
      <td className="py-1.5 pr-2 text-muted-foreground">{t(`trades.${line.trade}`)}</td>
      <td className="py-1.5 pr-2 text-muted-foreground">{line.quantity ?? '—'}</td>
      <td className="py-1.5 pr-2 text-muted-foreground">{line.unit ? uomLabel(line.unit) : '—'}</td>
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
  const setTrade = useCallback((trade: TradeCode) => setLine((p) => withTrade(p, trade)), []);
  const canSubmit = line.description.trim() !== '';

  const submission = useFormSubmission({
    canSubmit,
    submit: () => onAdd(toLineDto(line)),
    onSuccess: () => { setLine(EMPTY_LINE); onDone(); },
    errorFallback: t('rfqs.errors.addLineFailed'),
  });

  return { line, update, setTrade, canSubmit, submission };
}

function UnitField({ line, update, t }: { line: NewLineState; update: (p: Partial<NewLineState>) => void; t: Translate }) {
  return (
    <UomSelect
      value={line.unit}
      onValueChange={(unit) => update({ unit, unitFromTrade: false })}
      units={PROCUREMENT_UNIT_OPTIONS}
      ariaLabel={t('rfqs.lineUnit')}
      compact
    />
  );
}

function NewLineForm({ onAdd, onClose, t }: { onAdd: RfqLinesPanelProps['onAdd']; onClose: () => void; t: Translate }) {
  const { line, update, setTrade, canSubmit, submission } = useNewLineForm(onAdd, onClose, t);
  const formId = `${useId()}-form`;
  return (
    <section className="space-y-2 rounded-md border p-3">
      {/* Χωρίς ορατές ετικέτες: κάθε πεδίο ονομάζεται με το κείμενο της στήλης του (ADR-598 G11). */}
      <form id={formId} onSubmit={submission.handleSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Input aria-label={t('rfqs.lineDescription')} placeholder={t('rfqs.lineDescription')} value={line.description} onChange={(e) => update({ description: e.target.value })} className="sm:col-span-2" />
        <TradeSelector aria-label={t('rfqs.lineTrade')} value={line.trade} onChange={setTrade} />
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

export function RfqLinesPanel({ lines, loading, onAdd, onDelete, lockState = 'unlocked', rfq, onRfqSaved }: RfqLinesPanelProps) {
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
      {rfq && onRfqSaved && <RfqResponseLockControl rfq={rfq} disabled={locked} onSaved={onRfqSaved} />}
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
