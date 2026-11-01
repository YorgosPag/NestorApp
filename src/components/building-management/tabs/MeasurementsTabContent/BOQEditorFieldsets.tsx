/**
 * BOQEditorFieldsets — Quantities, Costs, Totals, NotesAndStatus fieldsets
 *
 * Extracted from BOQItemEditor.tsx (SRP split — ADR-337 sub-category expansion
 * pushed BOQItemEditor.tsx past the 500-line limit).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQEditorFieldsets
 * @see BOQItemEditor.tsx, ADR-175, ADR-337
 */

'use client';

import { Package, Wrench, Truck, Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { UomSelect } from '@/components/shared/UomSelect';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BOQItem, BOQItemStatus, BOQMeasurementUnit, BoqSupplierPriceSource } from '@/types/boq';
import { BOQ_COST_ACCENTS } from './boq-cost-accents';
import { BOQPriceSourceField } from './BOQPriceSourceField';
import type { EditorFormState } from './useBOQEditorState';
import '@/lib/design-system';

// ============================================================================
// SHARED INTERFACE
// ============================================================================

export interface FieldsetCommon {
  colors: ReturnType<typeof useSemanticColors>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

// ============================================================================
// QUANTITIES FIELDSET
// ============================================================================

interface QuantitiesProps extends FieldsetCommon {
  form: EditorFormState;
  isEdit: boolean;
  allowedUnits: BOQMeasurementUnit[];
  grossQuantity: number;
  onUpdateField: <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => void;
}

export function QuantitiesFieldset({ form, isEdit, allowedUnits, grossQuantity, onUpdateField, colors, t }: QuantitiesProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>
        {t('tabs.measurements.editor.sections.quantities')}
      </legend>
      <section className="grid grid-cols-2 gap-2">
        <article className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.measurementUnit')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.measurementUnit')} />
          </div>
          <UomSelect value={form.unit} onValueChange={(v) => onUpdateField('unit', v as BOQMeasurementUnit)} units={allowedUnits} />
        </article>
        <article className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.estimatedQuantity')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.estimatedQuantity')} />
          </div>
          <Input
            type="number" min="0" step="0.01"
            value={form.estimatedQuantity}
            onChange={(e) => onUpdateField('estimatedQuantity', e.target.value)}
          />
        </article>
        <article className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.wasteFactor')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.wasteFactor')} />
          </div>
          <Input
            type="number" min="0" max="100" step="1"
            value={form.wasteFactor}
            onChange={(e) => onUpdateField('wasteFactor', e.target.value)}
          />
        </article>
        <article className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.grossQuantity')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.grossQuantity')} />
          </div>
          <Input
            type="text"
            value={formatNumber(grossQuantity, { maximumFractionDigits: 2 })}
            disabled
            className="bg-muted tabular-nums"
          />
        </article>
        {isEdit && (
          <article className="space-y-1.5 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-1">
              <Label>{t('tabs.measurements.editor.fields.actualQuantity')}</Label>
              <InfoTooltip content={t('tabs.measurements.editor.tooltips.actualQuantity')} />
            </div>
            <Input
              type="number" min="0" step="0.01"
              value={form.actualQuantity}
              onChange={(e) => onUpdateField('actualQuantity', e.target.value)}
              placeholder="—"
            />
          </article>
        )}
      </section>
    </fieldset>
  );
}

// ============================================================================
// COSTS FIELDSET
// ============================================================================

interface CostsProps extends FieldsetCommon {
  form: EditorFormState;
  item: BOQItem | null;
  onUpdateField: <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => void;
  onSupplierApplied: (source: BoqSupplierPriceSource) => void;
}

export function CostsFieldset({ form, item, onUpdateField, onSupplierApplied, colors, t }: CostsProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>
        {t('tabs.measurements.editor.sections.costs')}
      </legend>
      <section className="grid grid-cols-3 gap-2">
        {(['materialUnitCost', 'laborUnitCost', 'equipmentUnitCost'] as const).map((field) => (
          <article key={field} className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label>{t(`tabs.measurements.editor.fields.${field}`)}</Label>
              <InfoTooltip content={t(`tabs.measurements.editor.tooltips.${field}`)} />
            </div>
            <Input
              type="number" min="0" step="0.01"
              value={form[field]}
              onChange={(e) => onUpdateField(field, e.target.value)}
            />
          </article>
        ))}
      </section>
      <BOQPriceSourceField form={form} item={item} onUpdateField={onUpdateField} onSupplierApplied={onSupplierApplied} colors={colors} t={t} />
    </fieldset>
  );
}

// ============================================================================
// TOTALS FIELDSET
// ============================================================================

interface TotalsProps extends FieldsetCommon {
  grossQuantity: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  totalCost: number;
}

export function TotalsFieldset({ grossQuantity, materialCost, laborCost, equipmentCost, totalCost, colors, t }: TotalsProps) {
  return (
    <section className="rounded-lg bg-muted/50 p-3 space-y-2">
      <div className="flex items-center gap-1">
        <p className={cn('text-sm font-semibold', colors.text.muted)}>{t('tabs.measurements.editor.sections.totals')}</p>
        <InfoTooltip content={t('tabs.measurements.editor.tooltips.totals')} />
      </div>
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <Package className={cn('h-3.5 w-3.5 shrink-0', BOQ_COST_ACCENTS.material)} />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.materialUnitCost')}</span>
          <span className={cn('text-sm font-semibold tabular-nums', BOQ_COST_ACCENTS.material)}>{formatCurrency(materialCost * grossQuantity)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Wrench className={cn('h-3.5 w-3.5 shrink-0', BOQ_COST_ACCENTS.labor)} />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.laborUnitCost')}</span>
          <span className={cn('text-sm font-semibold tabular-nums', BOQ_COST_ACCENTS.labor)}>{formatCurrency(laborCost * grossQuantity)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Truck className={cn('h-3.5 w-3.5 shrink-0', BOQ_COST_ACCENTS.equipment)} />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.equipmentUnitCost')}</span>
          <span className={cn('text-sm font-semibold tabular-nums', BOQ_COST_ACCENTS.equipment)}>{formatCurrency(equipmentCost * grossQuantity)}</span>
        </li>
      </ul>
      <div className="flex items-center gap-2 border-t border-border/50 pt-2">
        <Calculator className={cn('h-4 w-4 shrink-0', BOQ_COST_ACCENTS.total)} />
        <span className="text-sm font-semibold flex-1">{t('tabs.measurements.summary.total')}</span>
        <span className={cn('text-base font-bold tabular-nums', BOQ_COST_ACCENTS.total)}>{formatCurrency(totalCost)}</span>
      </div>
    </section>
  );
}

// ============================================================================
// NOTES AND STATUS FIELDSET
// ============================================================================

interface NotesAndStatusProps extends FieldsetCommon {
  form: EditorFormState;
  isEdit: boolean;
  availableStatuses: BOQItemStatus[];
  onUpdateField: <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => void;
}

export function NotesAndStatusFieldset({ form, isEdit, availableStatuses, onUpdateField, colors, t }: NotesAndStatusProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>
        {t('tabs.measurements.editor.sections.link')}
      </legend>
      <section className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label>{t('tabs.measurements.editor.fields.notes')}</Label>
          <InfoTooltip content={t('tabs.measurements.editor.tooltips.notes')} />
        </div>
        <Textarea
          size="sm"
          value={form.notes}
          onChange={(e) => onUpdateField('notes', e.target.value)}
          placeholder={t('tabs.measurements.editor.fields.notesPlaceholder')}
          rows={2}
          className="resize-none"
        />
      </section>
      {isEdit && availableStatuses.length > 1 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.statusLabel')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.status')} />
          </div>
          <Select value={form.status} onValueChange={(v) => onUpdateField('status', v as BOQItemStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableStatuses.map((s) => (
                <SelectItem key={s} value={s}>{t(`tabs.measurements.status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}
    </fieldset>
  );
}
