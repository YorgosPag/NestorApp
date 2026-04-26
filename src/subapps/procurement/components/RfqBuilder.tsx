'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { POProjectSelector } from '@/components/procurement/POEntitySelectors';
import { getAtoeCodesForTrade } from '@/subapps/procurement/data/trades';
import { ATOE_MASTER_CATEGORIES } from '@/config/boq-categories';
import type { RfqLine, CreateRfqDTO, AwardMode, ReminderTemplate } from '@/subapps/procurement/types/rfq';
import type { TradeCode } from '@/subapps/procurement/types/trade';

// ============================================================================
// TYPES
// ============================================================================

interface FormState {
  projectId: string;
  title: string;
  description: string;
  deadlineDate: string;
  awardMode: AwardMode;
  reminderTemplate: ReminderTemplate;
  lines: RfqLine[];
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

// ============================================================================
// LINE ROW
// ============================================================================

interface RfqLineRowProps {
  line: RfqLine;
  index: number;
  onUpdate: (i: number, field: keyof RfqLine, v: RfqLine[keyof RfqLine]) => void;
  onRemove: (i: number) => void;
}

function RfqLineRow({ line, index, onUpdate, onRemove }: RfqLineRowProps) {
  const { t } = useTranslation('quotes');

  const suggestedCodes = getAtoeCodesForTrade(line.trade as TradeCode);
  const remainingCodes = ATOE_MASTER_CATEGORIES
    .map((c) => c.code)
    .filter((c) => !suggestedCodes.includes(c));

  const handleTradeChange = (code: TradeCode) => {
    onUpdate(index, 'trade', code);
    const codes = getAtoeCodesForTrade(code);
    if (codes.length > 0) onUpdate(index, 'categoryCode', codes[0]);
  };

  return (
    <tr className="border-b text-sm">
      <td className="py-1 pr-2">
        <Input
          value={line.description}
          onChange={(e) => onUpdate(index, 'description', e.target.value)}
          placeholder={t('rfqs.lineDescription')}
          className="h-8 text-sm"
        />
      </td>
      <td className="py-1 pr-2 w-40">
        <TradeSelector
          value={line.trade ?? ''}
          onChange={handleTradeChange}
          className="h-8"
        />
      </td>
      <td className="py-1 pr-2 w-28">
        <Select
          value={line.categoryCode ?? ''}
          onValueChange={(v) => onUpdate(index, 'categoryCode', v || null)}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t('rfqs.categoryCodePlaceholder')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('rfqs.noCategoryCode')}</SelectItem>
            {suggestedCodes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
            {suggestedCodes.length > 0 && remainingCodes.length > 0 && <SelectSeparator />}
            {remainingCodes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="py-1 pr-2 w-20">
        <Input
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
          value={line.unit ?? ''}
          onChange={(e) => onUpdate(index, 'unit', e.target.value || null)}
          className="h-8 text-sm"
          placeholder={t('rfqs.unitPlaceholder')}
        />
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

interface RfqBuilderProps {
  initialState?: RfqBuilderInitialState;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

export function RfqBuilder({ initialState, onSuccess, onCancel }: RfqBuilderProps) {
  const { t } = useTranslation('quotes');
  const [form, setForm] = useState<FormState>({
    projectId: initialState?.projectId ?? '',
    title: initialState?.title ?? '',
    description: initialState?.description ?? '',
    deadlineDate: initialState?.deadlineDate ?? '',
    awardMode: initialState?.awardMode ?? 'whole_package',
    reminderTemplate: initialState?.reminderTemplate ?? 'standard',
    lines: initialState?.lines ?? [],
    invitedVendorIds: initialState?.invitedVendorIds ?? [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  }, []);

  const addLine = () => {
    const id = `rfql_${Date.now()}`;
    const defaultTrade: TradeCode = 'concrete';
    const defaultCategoryCode = getAtoeCodesForTrade(defaultTrade)[0] ?? null;
    const line: RfqLine = {
      id,
      description: '',
      trade: defaultTrade,
      categoryCode: defaultCategoryCode,
      quantity: null,
      unit: null,
      notes: null,
    };
    setForm((prev) => ({ ...prev, lines: [...prev.lines, line] }));
  };

  const removeLine = (i: number) =>
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, idx) => idx !== i) }));

  const updateLine = (i: number, field: keyof RfqLine, v: RfqLine[keyof RfqLine]) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[i] = { ...lines[i], [field]: v };
      return { ...prev, lines };
    });
  };

  const isValid = form.projectId && form.title.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    setError(null);
    try {
      const dto: CreateRfqDTO = {
        projectId: form.projectId,
        title: form.title,
        description: form.description || null,
        deadlineDate: form.deadlineDate || null,
        awardMode: form.awardMode,
        reminderTemplate: form.reminderTemplate,
        lines: form.lines,
        invitedVendorIds: form.invitedVendorIds.length > 0 ? form.invitedVendorIds : undefined,
      };
      const res = await fetch('/api/rfqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      onSuccess?.(json.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('rfqs.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('rfqs.create')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('rfqs.project')}</Label>
            <POProjectSelector
              value={form.projectId}
              onSelect={(id) => setField('projectId', id)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('rfqs.titleField')}</Label>
            <Input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('rfqs.deadline')}</Label>
            <Input
              type="date"
              value={form.deadlineDate}
              onChange={(e) => setField('deadlineDate', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('rfqs.awardMode')}</Label>
            <Select value={form.awardMode} onValueChange={(v) => setField('awardMode', v as AwardMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whole_package">{t('rfqs.awardModes.whole_package')}</SelectItem>
                <SelectItem value="cherry_pick">{t('rfqs.awardModes.cherry_pick')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t('rfqs.reminderTemplate')}</Label>
            <Select value={form.reminderTemplate} onValueChange={(v) => setField('reminderTemplate', v as ReminderTemplate)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aggressive">{t('rfqs.reminderTemplates.aggressive')}</SelectItem>
                <SelectItem value="standard">{t('rfqs.reminderTemplates.standard')}</SelectItem>
                <SelectItem value="soft">{t('rfqs.reminderTemplates.soft')}</SelectItem>
                <SelectItem value="off">{t('rfqs.reminderTemplates.off')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-full space-y-1.5">
            <Label>{t('rfqs.description')}</Label>
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <Label>{t('rfqs.lines')}</Label>
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('rfqs.addLine')}
            </Button>
          </div>
          {form.lines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineDescription')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineTrade')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineCategoryCode')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineQuantity')}</th>
                    <th className="pb-1 pr-2 text-left font-normal">{t('rfqs.lineUnit')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((line, i) => (
                    <RfqLineRow key={line.id} line={line} index={i} onUpdate={updateLine} onRemove={removeLine} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              <X className="mr-1 h-4 w-4" />
              {t('rfqs.cancel')}
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            <Save className="mr-1 h-4 w-4" />
            {t('rfqs.submit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
