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
 * @see ADR-337 §4.4 (sub-category dropdown)
 */

'use client';

import { useMemo } from 'react';
import { Ruler } from 'lucide-react';
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
import { formatCurrency } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BOQItem } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import type { CreateBOQItemInput, UpdateBOQItemInput } from '@/types/boq';
import { subCategoriesFor } from '@/config/boq-subcategories';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { usePropertiesByBuilding } from '@/components/properties/shared/usePropertiesByBuilding';
import '@/lib/design-system';

import { useBOQEditorState } from './useBOQEditorState';
import { BOQEditorScopeSection } from './BOQEditorScopeSection';
import { BOQEditorCostAllocationSection } from './BOQEditorCostAllocationSection';
import { resolveTargetProperties } from './boq-target-properties';
import {
  QuantitiesFieldset,
  CostsFieldset,
  TotalsFieldset,
  NotesAndStatusFieldset,
  type FieldsetCommon,
} from './BOQEditorFieldsets';

export { type EditorFormState } from './useBOQEditorState';

interface BOQItemEditorProps {
  open: boolean;
  onClose: () => void;
  item: BOQItem | null;
  buildingId: string;
  projectId: string;
  categories: readonly MasterBOQCategory[];
  onSave: (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => Promise<void>;
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
        <SheetTitle className="sr-only">
          {isEdit ? t('tabs.measurements.editor.editTitle') : t('tabs.measurements.editor.createTitle')}
        </SheetTitle>

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
// BASIC INFO FIELDSET
// ============================================================================

interface BasicInfoProps extends FieldsetCommon {
  form: ReturnType<typeof useBOQEditorState>['form'];
  isEdit: boolean;
  categories: readonly MasterBOQCategory[];
  onCategoryChange: (code: string) => void;
  onUpdateField: ReturnType<typeof useBOQEditorState>['updateField'];
}

function BasicInfoFieldset({ form, isEdit, categories, onCategoryChange, onUpdateField, colors, t }: BasicInfoProps) {
  const subCategories = subCategoriesFor(form.categoryCode);

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

      {subCategories.length > 0 && (
        <section className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Label>{t('tabs.measurements.editor.fields.subCategory')}</Label>
            <InfoTooltip content={t('tabs.measurements.editor.tooltips.subCategory')} />
          </div>
          <Select
            value={form.subCategoryCode || SELECT_CLEAR_VALUE}
            onValueChange={(v) => onUpdateField('subCategoryCode', v === SELECT_CLEAR_VALUE ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('tabs.measurements.editor.fields.subCategoryPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SELECT_CLEAR_VALUE}>— {t('tabs.measurements.editor.fields.subCategoryNone')} —</SelectItem>
              {subCategories.map((sc) => (
                <SelectItem key={sc.code} value={sc.code}>{sc.nameEL}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}

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
