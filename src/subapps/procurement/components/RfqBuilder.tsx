'use client';

import { useState, useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormActions } from '@/components/ui/form/FormActions';
import { FormField } from '@/components/ui/form/FormComponents';
import { Plus, Trash2, Save, X, ListFilter } from 'lucide-react';
import { useTranslation, type Translate } from '@/i18n/hooks/useTranslation';
import { useFormSubmission } from '@/hooks/useFormSubmission';
import { fetchJson, jsonRequest } from '@/lib/api/fetch-json';
import { explainProcurementError } from '@/components/procurement/explain-procurement-error';
import { TradeSelector } from './TradeSelector';
import { BoqLinePicker } from './BoqLinePicker';
import { VendorPickerSection } from './VendorPickerSection';
import { AtoeCategoryCodeSelect } from './AtoeCategoryCodeSelect';
import { LineItemsSection, type LineItemColumn } from './LineItemsSection';
import { UomSelect } from '@/components/shared/UomSelect';
import { PROCUREMENT_UNIT_OPTIONS } from '@/config/procurement-units';
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import type { RfqLine, RfqDraftLine, AwardMode, ReminderTemplate } from '@/subapps/procurement/types/rfq';
import type { RfqCatalogDraft, RfqCatalogSupplierSent } from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import { useSourcingEvent } from '@/subapps/procurement/hooks/useSourcingEvent';
import {
  boqItemToLine, catalogDraftToLine, catalogLinesComplete, newAdHocLine, toCreateRfqDTO, toFormLine,
  type BoqPick, type FormLine, type FormState,
} from './rfq-builder-lines';
import { rfqCreateRefusalMessages } from './rfq-create-refusal-messages';

// ============================================================================
// TYPES
// ============================================================================

export interface RfqBuilderInitialState {
  projectId?: string;
  title?: string;
  description?: string;
  deadlineDate?: string;
  awardMode?: AwardMode;
  reminderTemplate?: ReminderTemplate;
  lines?: RfqDraftLine[];
  /** ADR-923 §5.13 Τ6 — τα SKU του `?catalog=`, κριμένα από τον διακομιστή (`/api/rfqs/from-catalog`). */
  catalogDrafts?: readonly RfqCatalogDraft[];
  invitedVendorIds?: string[];
}

/**
 * Η επιτυχία της δημιουργίας: το id **και** οι προμηθευτές καταλόγου που προσκλήθηκαν (ADR-923 §5.13 Τ6). Το επόμενο βήμα το
 * αποφασίζει ό,τι στάλθηκε, όχι το πρόχειρο: ο χρήστης μπορεί να έσβησε τη γραμμή καταλόγου πριν στείλει.
 */
export type RfqBuilderSuccess = (id: string, catalogSuppliers: readonly RfqCatalogSupplierSent[]) => void;

interface RfqCreatedResponse {
  readonly data: { readonly id: string };
  readonly catalogSuppliers?: readonly RfqCatalogSupplierSent[];
}

type SetField = <K extends keyof FormState>(key: K, val: FormState[K]) => void;

// ============================================================================
// LINE ROW
// ============================================================================

interface RfqLineRowProps {
  line: FormLine;
  index: number;
  onUpdate: (i: number, field: keyof RfqLine, v: RfqLine[keyof RfqLine]) => void;
  onRemove: (i: number) => void;
}

/** Περιγραφή, κλάδος και ΑΤΟΕ μιας επεξεργάσιμης γραμμής (επιμέτρηση ή χειρόγραφη). */
function EditableLineCells({ line, index, onUpdate }: Omit<RfqLineRowProps, 'onRemove'>) {
  const { t } = useTranslation('quotes');
  const handleTradeChange = (code: TradeCode) => {
    onUpdate(index, 'trade', code);
    const codes = getAtoeCodesForTrade(code);
    if (codes.length > 0) onUpdate(index, 'categoryCode', codes[0]);
  };
  return (
    <>
      <td className="py-1 pr-2">
        <Input
          aria-label={t('rfqs.lineDescription')}
          value={line.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder={t('rfqs.lineDescription')}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-1 pr-2 w-40">
        <TradeSelector aria-label={t('rfqs.lineTrade')} value={line.trade ?? ''} onChange={handleTradeChange} className="h-8" />
      </td>
      <td className="py-1 pr-2 w-28">
        <AtoeCategoryCodeSelect
          aria-label={t('rfqs.lineCategoryCode')}
          value={line.categoryCode}
          onChange={(code) => onUpdate(index, 'categoryCode', code)}
          suggestedCodes={getAtoeCodesForTrade(line.trade as TradeCode)}
          placeholder={t('rfqs.categoryCodePlaceholder')}
          noneLabel={t('rfqs.noCategoryCode')}
        />
      </td>
    </>
  );
}

/**
 * Γραμμή καταλόγου (ADR-923 §5.13 Τ6): η περιγραφή είναι του **κριμένου** SKU και δεν αλλάζει εδώ, γιατί ο διακομιστής γράφει
 * τη δική του. Κλάδο και ΑΤΟΕ δεν δηλώνει ο αγοραστής για προϊόν άλλου.
 */
function CatalogLineCells({ line }: { line: FormLine }) {
  const { t } = useTranslation('quotes');
  return (
    <>
      <td className="py-1 pr-2">
        <p className="m-0 text-sm">{line.description}</p>
        <p className="m-0 text-xs text-muted-foreground">
          {t('rfqs.catalogLine.supplier', { supplier: line.catalog?.supplierName ?? '' })}
        </p>
      </td>
      <td colSpan={2} className="py-1 pr-2 text-xs text-muted-foreground">{t('rfqs.catalogLine.source')}</td>
    </>
  );
}

function RfqLineRow({ line, index, onUpdate, onRemove }: RfqLineRowProps) {
  const { t } = useTranslation('quotes');
  const isCatalog = line.source === 'catalog';

  // Κάθε κελί ονομάζεται με το κείμενο της κεφαλίδας του (WCAG 2.5.3, ADR-598 G11).
  return (
    <tr className="border-b text-sm">
      {isCatalog ? <CatalogLineCells line={line} /> : <EditableLineCells line={line} index={index} onUpdate={onUpdate} />}
      <td className="py-1 pr-2 w-20">
        <Input
          aria-label={t('rfqs.lineQuantity')}
          type="number"
          value={line.quantity ?? ''}
          onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || null)}
          className="h-8 text-sm"
          min={0}
          required={isCatalog}
          placeholder="—"
        />
      </td>
      <td className="py-1 pr-2 w-20">
        {/* Μονάδα ΜΟΝΟ από το μητρώο: ελεύθερο κείμενο εδώ γέννησε «m³» δίπλα στο «m3» της BOQ (ADR-327 §8.5.4). */}
        <UomSelect
          value={line.unit ?? ''}
          onValueChange={(unit) => onUpdate(index, 'unit', unit)}
          units={PROCUREMENT_UNIT_OPTIONS}
          ariaLabel={t('rfqs.lineUnit')}
          placeholder={t('rfqs.unitPlaceholder')}
          size="sm"
          compact
        />
      </td>
      <td className="py-1">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => onRemove(index)} aria-label={t('rfqs.removeLine')}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden />
        </Button>
      </td>
    </tr>
  );
}

// ============================================================================
// FIELD GROUPS
// ============================================================================

interface MultiTradeFieldsProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  packageTitle: string;
  onPackageTitleChange: (v: string) => void;
}

// Η ετικέτα και η σύνδεσή της ζουν στο `FormField` (id μέσω `useId`) — δεν ξεχνιούνται (ADR-598 G11).
function MultiTradeFields({ enabled, onEnabledChange, packageTitle, onPackageTitleChange }: MultiTradeFieldsProps) {
  const { t } = useTranslation('quotes');
  return (
    <>
      <label className="flex items-center gap-2 text-sm font-medium">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
        {t('rfqs.multiTrade.toggle')}
      </label>
      {enabled && (
        <FormField label={t('rfqs.multiTrade.packageTitle')}>
          {(id) => (
            <Input
              id={id}
              value={packageTitle}
              onChange={(e) => onPackageTitleChange(e.target.value)}
              placeholder={t('rfqs.multiTrade.packageTitlePlaceholder')}
            />
          )}
        </FormField>
      )}
    </>
  );
}

interface FieldGroupProps {
  form: FormState;
  setField: SetField;
}

function RfqHeaderFields({ form, setField }: FieldGroupProps) {
  const { t } = useTranslation('quotes');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label={t('rfqs.project')}>
        {(id) => <POProjectSelector id={id} value={form.projectId} onSelect={(pid) => setField('projectId', pid)} />}
      </FormField>
      <FormField label={t('rfqs.titleField')}>
        {(id) => <Input id={id} value={form.title} onChange={(e) => setField('title', e.target.value)} />}
      </FormField>
      <FormField label={t('rfqs.deadline')}>
        {(id) => <Input id={id} type="date" value={form.deadlineDate} onChange={(e) => setField('deadlineDate', e.target.value)} />}
      </FormField>
      <RfqPolicyFields form={form} setField={setField} />
      <FormField label={t('rfqs.description')} className="col-span-full">
        {(id) => <Textarea id={id} rows={2} value={form.description} onChange={(e) => setField('description', e.target.value)} />}
      </FormField>
    </div>
  );
}

function RfqPolicyFields({ form, setField }: FieldGroupProps) {
  const { t } = useTranslation('quotes');
  return (
    <>
      <FormField label={t('rfqs.awardMode')}>
        {(id) => (
          <Select value={form.awardMode} onValueChange={(v) => setField('awardMode', v as AwardMode)}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whole_package">{t('rfqs.awardModes.whole_package')}</SelectItem>
              <SelectItem value="cherry_pick">{t('rfqs.awardModes.cherry_pick')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField label={t('rfqs.reminderTemplate')}>
        {(id) => (
          <Select value={form.reminderTemplate} onValueChange={(v) => setField('reminderTemplate', v as ReminderTemplate)}>
            <SelectTrigger id={id}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aggressive">{t('rfqs.reminderTemplates.aggressive')}</SelectItem>
              <SelectItem value="standard">{t('rfqs.reminderTemplates.standard')}</SelectItem>
              <SelectItem value="soft">{t('rfqs.reminderTemplates.soft')}</SelectItem>
              <SelectItem value="off">{t('rfqs.reminderTemplates.off')}</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
    </>
  );
}

// ============================================================================
// LINES
// ============================================================================

interface RfqLinesProps {
  lines: FormLine[];
  canPickFromBoq: boolean;
  onOpenBoqPicker: () => void;
  onAdd: () => void;
  onUpdate: RfqLineRowProps['onUpdate'];
  onRemove: RfqLineRowProps['onRemove'];
}


/** Οι κεφαλίδες ΚΑΙ τα ονόματα των κελιών (`aria-label` στο `RfqLineRow`) — τα ίδια κλειδιά. */
function rfqLineColumns(t: Translate): LineItemColumn[] {
  return [
    { key: 'description', label: t('rfqs.lineDescription') },
    { key: 'trade', label: t('rfqs.lineTrade') },
    { key: 'categoryCode', label: t('rfqs.lineCategoryCode') },
    { key: 'quantity', label: t('rfqs.lineQuantity') },
    { key: 'unit', label: t('rfqs.lineUnit') },
  ];
}

function RfqLines({ lines, canPickFromBoq, onOpenBoqPicker, onAdd, onUpdate, onRemove }: RfqLinesProps) {
  const { t } = useTranslation('quotes');
  return (
    <LineItemsSection
      title={t('rfqs.lines')}
      columns={rfqLineColumns(t)}
      actionsColumnLabel={t('rfqs.lineActions')}
      hasLines={lines.length > 0}
      actions={(
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onOpenBoqPicker}
            disabled={!canPickFromBoq}
            title={!canPickFromBoq ? t('rfqs.boqPicker.noProject') : undefined}
          >
            <ListFilter className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('rfqs.boqPicker.button')}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t('rfqs.addLine')}
          </Button>
        </>
      )}
    >
      {lines.map((line, i) => (
        <RfqLineRow key={line.id} line={line} index={i} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </LineItemsSection>
  );
}

// ============================================================================
// STATE + SUBMISSION
// ============================================================================

function initialLines(initialState?: RfqBuilderInitialState): FormLine[] {
  return [...(initialState?.lines ?? []).map(toFormLine), ...(initialState?.catalogDrafts ?? []).map(catalogDraftToLine)];
}

function useRfqFormState(initialState?: RfqBuilderInitialState) {
  const [form, setForm] = useState<FormState>(() => ({
    projectId: initialState?.projectId ?? '',
    title: initialState?.title ?? '',
    description: initialState?.description ?? '',
    deadlineDate: initialState?.deadlineDate ?? '',
    awardMode: initialState?.awardMode ?? 'whole_package',
    reminderTemplate: initialState?.reminderTemplate ?? 'standard',
    lines: initialLines(initialState),
    invitedVendorIds: initialState?.invitedVendorIds ?? [],
  }));

  const setField = useCallback<SetField>((key, val) => setForm((prev) => ({ ...prev, [key]: val })), []);
  const appendLines = useCallback((lines: FormLine[]) => setForm((prev) => ({ ...prev, lines: [...prev.lines, ...lines] })), []);
  const addLine = () => appendLines([newAdHocLine()]);
  const addBoqLines = useCallback((items: BoqPick[]) => appendLines(items.map(boqItemToLine)), [appendLines]);
  const removeLine = (i: number) => setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));
  const updateLine: RfqLineRowProps['onUpdate'] = (i, field, v) =>
    setForm((prev) => ({ ...prev, lines: prev.lines.map((l, idx) => (idx === i ? { ...l, [field]: v } : l)) }));

  return { form, setField, addLine, addBoqLines, removeLine, updateLine };
}

/**
 * Πακέτο πολλών ειδικοτήτων (αν ζητήθηκε) → POST `/api/rfqs`, μέσω `fetchJson` + `useFormSubmission`.
 * Οι αρνήσεις της δημιουργίας (ADR-923 §5.13 Τ4) φτάνουν με τη δική τους πρόταση, μέσω του κοινού `explainProcurementError`.
 */
function useRfqSubmission(form: FormState, packageTitle: string | null, onSuccess?: RfqBuilderSuccess) {
  const { t } = useTranslation('quotes');
  const { create: createSourcingEvent } = useSourcingEvent();
  const canSubmit = Boolean(form.projectId && form.title.trim()) && catalogLinesComplete(form.lines);
  const submission = useFormSubmission({
    canSubmit,
    submit: () => explainProcurementError(async () => {
      const sourcingEventId = packageTitle
        ? (await createSourcingEvent({ projectId: form.projectId, title: packageTitle })).id
        : undefined;
      const json = await fetchJson<RfqCreatedResponse>('/api/rfqs', jsonRequest('POST', toCreateRfqDTO(form, sourcingEventId)));
      return { id: json.data.id, catalogSuppliers: json.catalogSuppliers ?? [] };
    }, rfqCreateRefusalMessages(t)),
    onSuccess: (created) => onSuccess?.(created.id, created.catalogSuppliers),
    errorFallback: t('rfqs.errors.createFailed'),
  });
  return { canSubmit, ...submission };
}

// ============================================================================
// FORM
// ============================================================================

interface RfqBuilderProps {
  initialState?: RfqBuilderInitialState;
  onSuccess?: RfqBuilderSuccess;
  onCancel?: () => void;
}

export function RfqBuilder({ initialState, onSuccess, onCancel }: RfqBuilderProps) {
  const { t } = useTranslation('quotes');
  const formId = useId();
  const { form, setField, addLine, addBoqLines, removeLine, updateLine } = useRfqFormState(initialState);
  const [multiTradeMode, setMultiTradeMode] = useState(false);
  const [sourcingEventTitle, setSourcingEventTitle] = useState('');
  const [boqPickerOpen, setBoqPickerOpen] = useState(false);
  const packageTitle = multiTradeMode && sourcingEventTitle.trim() ? sourcingEventTitle.trim() : null;
  const { canSubmit, submitting, error, handleSubmit } = useRfqSubmission(form, packageTitle, onSuccess);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('rfqs.create')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
          <MultiTradeFields
            enabled={multiTradeMode}
            onEnabledChange={setMultiTradeMode}
            packageTitle={sourcingEventTitle}
            onPackageTitleChange={setSourcingEventTitle}
          />
          <RfqHeaderFields form={form} setField={setField} />
          <RfqLines
            lines={form.lines}
            canPickFromBoq={Boolean(form.projectId)}
            onOpenBoqPicker={() => setBoqPickerOpen(true)}
            onAdd={addLine}
            onUpdate={updateLine}
            onRemove={removeLine}
          />
          {!catalogLinesComplete(form.lines) && (
            <p className="m-0 text-xs text-muted-foreground">{t('rfqs.catalogLine.demandHint')}</p>
          )}
          <VendorPickerSection value={form.invitedVendorIds} onChange={(ids) => setField('invitedVendorIds', ids)} />
        </form>
        <BoqLinePicker open={boqPickerOpen} onOpenChange={setBoqPickerOpen} projectId={form.projectId} onSelect={addBoqLines} />
        <FormActions
          formId={formId}
          submitLabel={t('rfqs.submit')}
          pendingLabel={t('rfqs.submitting')}
          cancelLabel={t('rfqs.cancel')}
          onCancel={onCancel}
          submitting={submitting}
          submitDisabled={!canSubmit}
          error={error}
          submitIcon={Save}
          cancelIcon={X}
        />
      </CardContent>
    </Card>
  );
}
