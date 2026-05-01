/**
 * BOQItemEditor — Slide-over drawer for creating/editing BOQ items (ADR-329)
 *
 * Wrapped in Radix Sheet (right-side drawer, 1200px). Entity-style header:
 * Ruler icon + title + Cancel/Save actions. 2-column body: left = Basic info
 * + Scope + Cost Allocation + Notes; right = Quantities + Costs + Totals.
 * Footer: optional Reopen-to-Draft (left) + running total (right).
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQItemEditor
 * @see ADR-175 §4.4.3, ADR-329 §3.0 (drawer), §3.1 (5 scopes), §3.1.1 (cost allocation)
 */

'use client';

import { useMemo } from 'react';
import { Ruler, Package, Wrench, Truck, Calculator } from 'lucide-react';
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet';
import { EntityDetailsHeader, createEntityAction } from '@/core/entity-headers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BOQItem, BOQItemStatus, BOQMeasurementUnit } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import type { CreateBOQItemInput, UpdateBOQItemInput } from '@/types/boq';
import { usePropertiesByBuilding } from '@/components/properties/shared/usePropertiesByBuilding';
import '@/lib/design-system';

import { useBOQEditorState } from './useBOQEditorState';
import { BOQEditorScopeSection } from './BOQEditorScopeSection';
import { BOQEditorCostAllocationSection } from './BOQEditorCostAllocationSection';
import { resolveTargetProperties } from './boq-target-properties';

export { type EditorFormState } from './useBOQEditorState';

interface BOQItemEditorProps {
  open: boolean;
  onClose: () => void;
  item: BOQItem | null;
  buildingId: string;
  projectId: string;
  categories: readonly MasterBOQCategory[];
  onSave: (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => Promise<void>;
  /** Optional: when provided, "Reopen to Draft" button shown for non-draft, non-locked items. */
  onReopenToDraft?: (id: string) => Promise<void>;
}

export function BOQItemEditor({
  open, onClose, item, buildingId, projectId, categories, onSave, onReopenToDraft,
}: BOQItemEditorProps) {
  const { t } = useTranslation([
    'building', 'building-address', 'building-filters', 'building-storage',
    'building-tabs', 'building-timeline',
  ]);
  const colors = useSemanticColors();

  const {
    form, saving, isEdit, scopeLocked,
    grossQuantity, materialCost, laborCost, equipmentCost, totalCost,
    allowedUnits, availableStatuses, scopeValidation, customAllocationsValid,
    updateField, handleScopeChange, handleCategoryChange, handleSave,
  } = useBOQEditorState({ open, item, categories, buildingId, projectId, onSave, onClose });

  const { properties } = usePropertiesByBuilding(buildingId, { enabled: open });

  const targetProperties = useMemo(
    () => resolveTargetProperties(
      form.scope, form.linkedFloorId, form.linkedUnitId, form.linkedUnitIds, properties,
    ),
    [form.scope, form.linkedFloorId, form.linkedUnitId, form.linkedUnitIds, properties],
  );

  const showReopen = isEdit
    && onReopenToDraft != null
    && form.status !== 'draft'
    && form.status !== 'locked';

  const handleReopen = async () => {
    if (!item || !onReopenToDraft) return;
    await onReopenToDraft(item.id);
  };

  const saveDisabled = saving
    || !form.title.trim()
    || !scopeValidation.valid
    || !customAllocationsValid;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[1200px] bg-[hsl(var(--showcase-bg))] text-[hsl(var(--showcase-fg))] border-l-[hsl(var(--showcase-border))] [--background:var(--showcase-input-bg)] [--input:var(--showcase-input-bg)] [--border:var(--showcase-border)] [--muted:var(--showcase-surface)] [--muted-foreground:var(--showcase-muted-fg)] [--card:var(--showcase-surface)] [--card-foreground:var(--showcase-fg)] [--foreground:var(--showcase-fg)] [--popover:var(--showcase-input-bg)] [--popover-foreground:var(--showcase-fg)] [--accent:var(--showcase-surface)] [--accent-foreground:var(--showcase-fg)] [&>button]:hidden"
      >
        {/* Radix accessibility title (sr-only — EntityDetailsHeader renders the visible title) */}
        <SheetTitle className="sr-only">
          {isEdit ? t('tabs.measurements.editor.editTitle') : t('tabs.measurements.editor.createTitle')}
        </SheetTitle>

        {/* Entity-style header — identical to BuildingDetailsHeader (SSOT: EntityDetailsHeader) */}
        <EntityDetailsHeader
          icon={Ruler}
          title={isEdit ? t('tabs.measurements.editor.editTitle') : t('tabs.measurements.editor.createTitle')}
          subtitle={isEdit ? (item?.title ?? '') : t('tabs.measurements.editor.sections.basic')}
          actions={[
            { ...createEntityAction('cancel', t('tabs.measurements.editor.cancel'), onClose), disabled: saving },
            {
              ...createEntityAction(
                'save',
                saving ? t('tabs.measurements.editor.saving') : t('tabs.measurements.editor.save'),
                () => { void handleSave(); },
              ),
              disabled: saveDisabled,
            },
          ]}
          variant="detailed"
          className="rounded-none border-b border-[hsl(var(--showcase-border))]"
        />

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <article className="flex flex-col gap-4">
              <BasicInfoFieldset
                form={form}
                isEdit={isEdit}
                categories={categories}
                onCategoryChange={handleCategoryChange}
                onUpdateField={updateField}
                colors={colors}
                t={t}
              />

              <BOQEditorScopeSection
                buildingId={buildingId}
                scope={form.scope}
                linkedFloorId={form.linkedFloorId}
                linkedUnitId={form.linkedUnitId}
                linkedUnitIds={form.linkedUnitIds}
                scopeLocked={scopeLocked}
                onScopeChange={handleScopeChange}
                onLinkedFloorIdChange={(id) => updateField('linkedFloorId', id)}
                onLinkedUnitIdChange={(id) => updateField('linkedUnitId', id)}
                onLinkedUnitIdsChange={(ids) => updateField('linkedUnitIds', ids)}
              />

              <BOQEditorCostAllocationSection
                scope={form.scope}
                method={form.costAllocationMethod}
                customAllocations={form.customAllocations}
                targetProperties={targetProperties}
                scopeLocked={scopeLocked}
                onMethodChange={(m) => updateField('costAllocationMethod', m)}
                onCustomAllocationsChange={(next) => updateField('customAllocations', next)}
              />
            </article>

            <article className="flex flex-col gap-4">
              <QuantitiesFieldset
                form={form}
                isEdit={isEdit}
                allowedUnits={allowedUnits}
                grossQuantity={grossQuantity}
                onUpdateField={updateField}
                colors={colors}
                t={t}
              />

              <CostsFieldset
                form={form}
                onUpdateField={updateField}
                colors={colors}
                t={t}
              />

              <TotalsFieldset
                grossQuantity={grossQuantity}
                materialCost={materialCost}
                laborCost={laborCost}
                equipmentCost={equipmentCost}
                totalCost={totalCost}
                colors={colors}
                t={t}
              />

              <NotesAndStatusFieldset
                form={form}
                isEdit={isEdit}
                availableStatuses={availableStatuses}
                onUpdateField={updateField}
                colors={colors}
                t={t}
              />
            </article>
          </section>
        </form>

        <footer className="flex items-center justify-between gap-2 border-t border-[hsl(var(--showcase-border))] bg-[hsl(var(--showcase-bg))] px-6 py-3">
          <section>
            {showReopen && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => void handleReopen()}
              >
                {t('tabs.measurements.scope.scopeLock.reopenButton')}
              </Button>
            )}
          </section>
          <p className="text-sm font-semibold tabular-nums">
            {t('tabs.measurements.summary.total')}: {formatCurrency(totalCost)}
          </p>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// SUB-FIELDSETS
// ============================================================================

interface FieldsetCommon {
  colors: ReturnType<typeof useSemanticColors>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

interface BasicInfoProps extends FieldsetCommon {
  form: ReturnType<typeof useBOQEditorState>['form'];
  isEdit: boolean;
  categories: readonly MasterBOQCategory[];
  onCategoryChange: (code: string) => void;
  onUpdateField: ReturnType<typeof useBOQEditorState>['updateField'];
}

function BasicInfoFieldset({ form, isEdit, categories, onCategoryChange, onUpdateField, colors, t }: BasicInfoProps) {
  return (
    <fieldset className="space-y-2">
      <legend className={cn('text-sm font-semibold', colors.text.muted)}>
        {t('tabs.measurements.editor.sections.basic')}
      </legend>
      <section className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label>{t('tabs.measurements.editor.fields.category')}</Label>
          <InfoTooltip content={t('tabs.measurements.editor.tooltips.category')} />
        </div>
        <Select value={form.categoryCode} onValueChange={onCategoryChange} disabled={isEdit}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.code} value={cat.code}>{cat.code} — {cat.nameEL}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>
      <section className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label>{t('tabs.measurements.editor.fields.title')} *</Label>
          <InfoTooltip content={t('tabs.measurements.editor.tooltips.title')} />
        </div>
        <Input
          value={form.title}
          onChange={(e) => onUpdateField('title', e.target.value)}
          placeholder={t('tabs.measurements.editor.fields.titlePlaceholder')}
          required
        />
      </section>
      <section className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label>{t('tabs.measurements.editor.fields.specifications')}</Label>
          <InfoTooltip content={t('tabs.measurements.editor.tooltips.specifications')} />
        </div>
        <Textarea
          size="sm"
          value={form.description}
          onChange={(e) => onUpdateField('description', e.target.value)}
          placeholder={t('tabs.measurements.editor.fields.specificationsPlaceholder')}
          rows={3}
          className="resize-none"
        />
      </section>
    </fieldset>
  );
}

interface QuantitiesProps extends FieldsetCommon {
  form: ReturnType<typeof useBOQEditorState>['form'];
  isEdit: boolean;
  allowedUnits: BOQMeasurementUnit[];
  grossQuantity: number;
  onUpdateField: ReturnType<typeof useBOQEditorState>['updateField'];
}

function QuantitiesFieldset({ form, isEdit, allowedUnits, grossQuantity, onUpdateField, colors, t }: QuantitiesProps) {
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
          <Select value={form.unit} onValueChange={(v) => onUpdateField('unit', v as BOQMeasurementUnit)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {allowedUnits.map((u) => (
                <SelectItem key={u} value={u}>{t(`tabs.measurements.units.${u}`)} ({u})</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

interface CostsProps extends FieldsetCommon {
  form: ReturnType<typeof useBOQEditorState>['form'];
  onUpdateField: ReturnType<typeof useBOQEditorState>['updateField'];
}

function CostsFieldset({ form, onUpdateField, colors, t }: CostsProps) {
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
    </fieldset>
  );
}

interface TotalsProps extends FieldsetCommon {
  grossQuantity: number;
  materialCost: number;
  laborCost: number;
  equipmentCost: number;
  totalCost: number;
}

function TotalsFieldset({ grossQuantity, materialCost, laborCost, equipmentCost, totalCost, colors, t }: TotalsProps) {
  return (
    <section className="rounded-lg bg-muted/50 p-3 space-y-2">
      <div className="flex items-center gap-1">
        <p className={cn('text-sm font-semibold', colors.text.muted)}>{t('tabs.measurements.editor.sections.totals')}</p>
        <InfoTooltip content={t('tabs.measurements.editor.tooltips.totals')} />
      </div>
      {/* accent colors match BOQSummaryCards SSOT — design-system/enforce-semantic-colors intentional */}
      <ul className="space-y-1.5">
        <li className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.materialUnitCost')}</span>
          <span className="text-sm font-semibold tabular-nums text-blue-600 dark:text-blue-400">{formatCurrency(materialCost * grossQuantity)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.laborUnitCost')}</span>
          <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(laborCost * grossQuantity)}</span>
        </li>
        <li className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className={cn('text-sm flex-1', colors.text.muted)}>{t('tabs.measurements.editor.fields.equipmentUnitCost')}</span>
          <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(equipmentCost * grossQuantity)}</span>
        </li>
      </ul>
      <div className="flex items-center gap-2 border-t border-border/50 pt-2">
        <Calculator className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-semibold flex-1">{t('tabs.measurements.summary.total')}</span>
        <span className="text-base font-bold tabular-nums text-purple-600 dark:text-purple-400">{formatCurrency(totalCost)}</span>
      </div>
    </section>
  );
}

interface NotesAndStatusProps extends FieldsetCommon {
  form: ReturnType<typeof useBOQEditorState>['form'];
  isEdit: boolean;
  availableStatuses: BOQItemStatus[];
  onUpdateField: ReturnType<typeof useBOQEditorState>['updateField'];
}

function NotesAndStatusFieldset({ form, isEdit, availableStatuses, onUpdateField, colors, t }: NotesAndStatusProps) {
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
