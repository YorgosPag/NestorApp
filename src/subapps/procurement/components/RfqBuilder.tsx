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
import { generateTempId } from '@/services/enterprise-id.service';
import { TradeSelector } from './TradeSelector';
import { BoqLinePicker } from './BoqLinePicker';
import { VendorPickerSection } from './VendorPickerSection';
import { AtoeCategoryCodeSelect } from './AtoeCategoryCodeSelect';
import { LineItemsSection, type LineItemColumn } from './LineItemsSection';
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { getAtoeCodesForTrade, getTradeCodeForAtoeCategory } from '@/subapps/procurement/data/trades';
import type { RfqLine, CreateRfqDTO, AwardMode, ReminderTemplate } from '@/subapps/procurement/types/rfq';
import type { CreateRfqLineDTO } from '@/subapps/procurement/types/rfq-line';
import type { TradeCode } from '@/subapps/procurement/types/trade';
import type { BOQItem } from '@/types/boq/boq';
import { useSourcingEvent } from '@/subapps/procurement/hooks/useSourcingEvent';

// ============================================================================
// TYPES
// ============================================================================

type FormLine = RfqLine & { source: 'boq' | 'ad_hoc'; boqItemId?: string | null };

interface FormState {
  projectId: string;
  title: string;
  description: string;
  deadlineDate: string;
  awardMode: AwardMode;
  reminderTemplate: ReminderTemplate;
  lines: FormLine[];
  invitedVendorIds: string[];
}

export interface RfqBuilderInitialState {
  projectId?: string;
  title?: string;
  description?: string;
  deadlineDate?: string;
  awardMode?: AwardMode;
  reminderTemplate?: ReminderTemplate;
  lines?: RfqLine[];
  invitedVendorIds?: string[];
}

type SetField = <K extends keyof FormState>(key: K, val: FormState[K]) => void;
type BoqPick = Pick<BOQItem, 'id' | 'title' | 'categoryCode' | 'estimatedQuantity' | 'unit' | 'description'>;

// ============================================================================
// LINE ROW
// ============================================================================

interface RfqLineRowProps {
  line: FormLine;
  index: number;
  onUpdate: (i: number, field: keyof RfqLine, v: RfqLine[keyof RfqLine]) => void;
  onRemove: (i: number) => void;
}

function RfqLineRow({ line, index, onUpdate, onRemove }: RfqLineRowProps) {
  const { t } = useTranslation('quotes');

  const handleTradeChange = (code: TradeCode) => {
    onUpdate(index, 'trade', code);
    const codes = getAtoeCodesForTrade(code);
    if (codes.length > 0) onUpdate(index, 'categoryCode', codes[0]);
  };

  // Κάθε κελί ονομάζεται με το κείμενο της κεφαλίδας του (WCAG 2.5.3, ADR-598 G11).
  return (
    <tr className="border-b text-sm">
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
      <td className="py-1 pr-2 w-20">
        <Input
          aria-label={t('rfqs.lineQuantity')}
          type="number"
          value={line.quantity ?? ''}
          onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || null)}
          className="h-8 text-sm"
          min={0}
          placeholder="—"
        />
      </td>
      <td className="py-1 pr-2 w-20">
        <Input
          aria-label={t('rfqs.lineUnit')}
          value={line.unit ?? ''}
          onChange={(e) => onUpdate(index, 'unit', e.target.value || null)}
          className="h-8 text-sm"
          placeholder={t('rfqs.unitPlaceholder')}
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

/** Τα κλειδιά γραμμών εδώ είναι ΠΡΟΣΩΡΙΝΑ (κλειδιά React) — τις γραμμές τις γράφει ο server με `generateRfqLineId`. */
function newAdHocLine(): FormLine {
  const trade: TradeCode = 'concrete';
  return {
    id: generateTempId(), description: '', trade, categoryCode: getAtoeCodesForTrade(trade)[0] ?? null,
    quantity: null, unit: null, notes: null, source: 'ad_hoc',
  };
}

function boqItemToLine(item: BoqPick): FormLine {
  return {
    id: generateTempId(),
    description: item.title,
    trade: getTradeCodeForAtoeCategory(item.categoryCode) ?? 'materials_general',
    categoryCode: item.categoryCode,
    quantity: item.estimatedQuantity,
    unit: item.unit as string,
    notes: item.description ?? null,
    source: 'boq',
    boqItemId: item.id,
  };
}

function useRfqFormState(initialState?: RfqBuilderInitialState) {
  const [form, setForm] = useState<FormState>(() => ({
    projectId: initialState?.projectId ?? '',
    title: initialState?.title ?? '',
    description: initialState?.description ?? '',
    deadlineDate: initialState?.deadlineDate ?? '',
    awardMode: initialState?.awardMode ?? 'whole_package',
    reminderTemplate: initialState?.reminderTemplate ?? 'standard',
    lines: initialState?.lines?.map((l) => ({ ...l, source: 'ad_hoc' as const })) ?? [],
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

function toCreateRfqDTO(form: FormState, sourcingEventId: string | undefined): CreateRfqDTO {
  const boqItemIds = form.lines.filter((l) => l.source === 'boq' && l.boqItemId).map((l) => l.boqItemId as string);
  const adHocLines: CreateRfqLineDTO[] = form.lines
    .filter((l) => l.source === 'ad_hoc')
    .map((l) => ({
      source: 'ad_hoc' as const,
      description: l.description,
      trade: l.trade as TradeCode,
      categoryCode: l.categoryCode ?? null,
      quantity: l.quantity ?? null,
      unit: l.unit ?? null,
      notes: l.notes ?? null,
    }));
  return {
    projectId: form.projectId,
    title: form.title,
    description: form.description || null,
    deadlineDate: form.deadlineDate || null,
    awardMode: form.awardMode,
    reminderTemplate: form.reminderTemplate,
    lines: [],
    boqItemIds: boqItemIds.length > 0 ? boqItemIds : undefined,
    adHocLines: adHocLines.length > 0 ? adHocLines : undefined,
    ...(sourcingEventId ? { sourcingEventId } : {}),
    invitedVendorIds: form.invitedVendorIds.length > 0 ? form.invitedVendorIds : undefined,
  };
}

/** Πακέτο πολλών ειδικοτήτων (αν ζητήθηκε) → POST `/api/rfqs`, μέσω `fetchJson` + `useFormSubmission`. */
function useRfqSubmission(form: FormState, packageTitle: string | null, onSuccess?: (id: string) => void) {
  const { t } = useTranslation('quotes');
  const { create: createSourcingEvent } = useSourcingEvent();
  const canSubmit = Boolean(form.projectId && form.title.trim());
  const submission = useFormSubmission({
    canSubmit,
    submit: async () => {
      const sourcingEventId = packageTitle
        ? (await createSourcingEvent({ projectId: form.projectId, title: packageTitle })).id
        : undefined;
      const json = await fetchJson<{ data: { id: string } }>('/api/rfqs', jsonRequest('POST', toCreateRfqDTO(form, sourcingEventId)));
      return json.data.id;
    },
    onSuccess,
    errorFallback: t('rfqs.errors.createFailed'),
  });
  return { canSubmit, ...submission };
}

// ============================================================================
// FORM
// ============================================================================

interface RfqBuilderProps {
  initialState?: RfqBuilderInitialState;
  onSuccess?: (id: string) => void;
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
