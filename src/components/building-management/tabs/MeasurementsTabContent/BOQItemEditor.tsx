/**
 * BOQItemEditor — Dialog form for creating/editing BOQ items
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQItemEditor
 * @see ADR-175 §4.4.3 (SCREEN 2)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import type {
  BOQItem,
  BOQItemStatus,
  BOQMeasurementUnit,
  CreateBOQItemInput,
  UpdateBOQItemInput,
} from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import { getAllowedUnits, getDefaultWasteFactor } from '@/config/boq-categories';
import { computeGrossQuantity } from '@/services/measurements';

// ============================================================================
// TYPES
// ============================================================================

interface BOQItemEditorProps {
  open: boolean;
  onClose: () => void;
  item: BOQItem | null; // null = create mode
  buildingId: string;
  projectId: string;
  categories: readonly MasterBOQCategory[];
  onSave: (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => Promise<void>;
}

// All available measurement units for display
const ALL_UNITS: BOQMeasurementUnit[] = [
  'm', 'm2', 'm3', 'kg', 'ton', 'pcs', 'lt', 'set', 'hr', 'day', 'lump',
];

// Allowed status transitions (for status selector)
const ALLOWED_TRANSITIONS: Record<BOQItemStatus, BOQItemStatus[]> = {
  draft: ['submitted'],
  submitted: ['approved', 'draft'],
  approved: ['certified', 'submitted'],
  certified: ['locked', 'approved'],
  locked: [],
};

// ============================================================================
// FORM STATE
// ============================================================================

interface EditorFormState {
  categoryCode: string;
  title: string;
  description: string;
  scope: 'building' | 'unit';
  linkedUnitId: string;
  unit: BOQMeasurementUnit;
  estimatedQuantity: string;
  wasteFactor: string;
  actualQuantity: string;
  materialUnitCost: string;
  laborUnitCost: string;
  equipmentUnitCost: string;
  linkedPhaseId: string;
  notes: string;
  status: BOQItemStatus;
}

function createInitialState(item: BOQItem | null, defaultCategory: string): EditorFormState {
  if (item) {
    return {
      categoryCode: item.categoryCode,
      title: item.title,
      description: item.description ?? '',
      scope: item.scope,
      linkedUnitId: item.linkedUnitId ?? '',
      unit: item.unit,
      estimatedQuantity: String(item.estimatedQuantity),
      wasteFactor: String(item.wasteFactor * 100),
      actualQuantity: item.actualQuantity !== null ? String(item.actualQuantity) : '',
      materialUnitCost: String(item.materialUnitCost),
      laborUnitCost: String(item.laborUnitCost),
      equipmentUnitCost: String(item.equipmentUnitCost),
      linkedPhaseId: item.linkedPhaseId ?? '',
      notes: item.notes ?? '',
      status: item.status,
    };
  }

  return {
    categoryCode: defaultCategory,
    title: '',
    description: '',
    scope: 'building',
    linkedUnitId: '',
    unit: 'm2',
    estimatedQuantity: '0',
    wasteFactor: String(getDefaultWasteFactor(defaultCategory) * 100),
    actualQuantity: '',
    materialUnitCost: '0',
    laborUnitCost: '0',
    equipmentUnitCost: '0',
    linkedPhaseId: '',
    notes: '',
    status: 'draft',
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BOQItemEditor({
  open,
  onClose,
  item,
  buildingId,
  projectId,
  categories,
  onSave,
}: BOQItemEditorProps) {
  const { t } = useTranslation('building');
  const isEdit = item !== null;

  const [form, setForm] = useState<EditorFormState>(() =>
    createInitialState(item, categories[0]?.code ?? 'OIK-1')
  );
  const [saving, setSaving] = useState(false);

  // Reset form when item changes
  useEffect(() => {
    if (open) {
      setForm(createInitialState(item, categories[0]?.code ?? 'OIK-1'));
    }
  }, [open, item, categories]);

  // Computed values
  const numericEstimated = parseFloat(form.estimatedQuantity) || 0;
  const numericWaste = (parseFloat(form.wasteFactor) || 0) / 100;
  const grossQuantity = computeGrossQuantity(numericEstimated, numericWaste);

  const materialCost = parseFloat(form.materialUnitCost) || 0;
  const laborCost = parseFloat(form.laborUnitCost) || 0;
  const equipmentCost = parseFloat(form.equipmentUnitCost) || 0;
  const totalUnitCost = materialCost + laborCost + equipmentCost;
  const totalCost = grossQuantity * totalUnitCost;

  // Allowed units for selected category
  const allowedUnits = useMemo(() => {
    const catUnits = getAllowedUnits(form.categoryCode);
    return catUnits.length > 0 ? catUnits : ALL_UNITS;
  }, [form.categoryCode]);

  // Available status transitions
  const availableStatuses = useMemo<BOQItemStatus[]>(() => {
    if (!isEdit) return [];
    return [form.status, ...ALLOWED_TRANSITIONS[form.status]];
  }, [isEdit, form.status]);

  // Field updater
  const updateField = useCallback(
    <K extends keyof EditorFormState>(key: K, value: EditorFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Handle category change — update waste factor default + reset unit if needed
  const handleCategoryChange = useCallback(
    (code: string) => {
      const defaultWaste = getDefaultWasteFactor(code) * 100;
      const catUnits = getAllowedUnits(code);
      const currentUnitValid = catUnits.includes(form.unit);

      setForm((prev) => ({
        ...prev,
        categoryCode: code,
        wasteFactor: String(defaultWaste),
        unit: currentUnitValid ? prev.unit : (catUnits[0] ?? 'm2'),
      }));
    },
    [form.unit]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!form.title.trim()) return;
    setSaving(true);

    try {
      if (isEdit) {
        const updateData: UpdateBOQItemInput = {
          title: form.title.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          estimatedQuantity: numericEstimated,
          wasteFactor: numericWaste,
          actualQuantity: form.actualQuantity ? parseFloat(form.actualQuantity) : null,
          materialUnitCost: materialCost,
          laborUnitCost: laborCost,
          equipmentUnitCost: equipmentCost,
          linkedPhaseId: form.linkedPhaseId || null,
          notes: form.notes.trim() || null,
        };
        await onSave(updateData, false);
      } else {
        const createData: CreateBOQItemInput = {
          projectId,
          buildingId,
          scope: form.scope,
          linkedUnitId: form.scope === 'unit' ? form.linkedUnitId || null : null,
          categoryCode: form.categoryCode,
          title: form.title.trim(),
          description: form.description.trim() || null,
          unit: form.unit,
          estimatedQuantity: numericEstimated,
          wasteFactor: numericWaste,
          materialUnitCost: materialCost,
          laborUnitCost: laborCost,
          equipmentUnitCost: equipmentCost,
          linkedPhaseId: form.linkedPhaseId || null,
          notes: form.notes.trim() || null,
        };
        await onSave(createData, true);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [
    form, isEdit, numericEstimated, numericWaste, materialCost,
    laborCost, equipmentCost, projectId, buildingId, onSave, onClose,
  ]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t('tabs.measurements.editor.editTitle')
              : t('tabs.measurements.editor.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? item?.title : t('tabs.measurements.editor.sections.basic')}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
          className="space-y-6"
        >
          {/* Section: Basic Info */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              {t('tabs.measurements.editor.sections.basic')}
            </legend>

            {/* Category */}
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.category')}</Label>
              <Select
                value={form.categoryCode}
                onValueChange={handleCategoryChange}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      {cat.code} — {cat.nameEL}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            {/* Title */}
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.title')} *</Label>
              <Input
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder={t('tabs.measurements.editor.fields.titlePlaceholder')}
                required
              />
            </section>

            {/* Description */}
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.specifications')}</Label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={t('tabs.measurements.editor.fields.specificationsPlaceholder')}
                rows={3}
                className={cn(
                  'flex w-full rounded-md border border-input bg-background px-3 py-2',
                  'text-sm ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                  'resize-none'
                )}
              />
            </section>
          </fieldset>

          {/* Section: Scope (only for create) */}
          {!isEdit && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold text-muted-foreground">
                {t('tabs.measurements.editor.sections.scope')}
              </legend>
              <section className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="building"
                    checked={form.scope === 'building'}
                    onChange={() => updateField('scope', 'building')}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('tabs.measurements.editor.fields.scopeBuilding')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="unit"
                    checked={form.scope === 'unit'}
                    onChange={() => updateField('scope', 'unit')}
                    className="accent-primary"
                  />
                  <span className="text-sm">{t('tabs.measurements.editor.fields.scopeUnit')}</span>
                </label>
              </section>
            </fieldset>
          )}

          {/* Section: Quantities */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              {t('tabs.measurements.editor.sections.quantities')}
            </legend>
            <section className="grid grid-cols-2 gap-4">
              {/* Measurement Unit */}
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.measurementUnit')}</Label>
                <Select
                  value={form.unit}
                  onValueChange={(v) => updateField('unit', v as BOQMeasurementUnit)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedUnits.map((u) => (
                      <SelectItem key={u} value={u}>
                        {t(`tabs.measurements.units.${u}`)} ({u})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </article>

              {/* Estimated Quantity */}
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.estimatedQuantity')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedQuantity}
                  onChange={(e) => updateField('estimatedQuantity', e.target.value)}
                />
              </article>

              {/* Waste Factor */}
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.wasteFactor')}</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.wasteFactor}
                  onChange={(e) => updateField('wasteFactor', e.target.value)}
                />
              </article>

              {/* Gross Quantity (computed, readonly) */}
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.grossQuantity')}</Label>
                <Input
                  type="text"
                  value={formatNumber(grossQuantity, { maximumFractionDigits: 2 })}
                  disabled
                  className="bg-muted tabular-nums"
                />
              </article>

              {/* Actual Quantity (only in edit mode) */}
              {isEdit && (
                <article className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>{t('tabs.measurements.editor.fields.actualQuantity')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.actualQuantity}
                    onChange={(e) => updateField('actualQuantity', e.target.value)}
                    placeholder="—"
                  />
                </article>
              )}
            </section>
          </fieldset>

          {/* Section: Cost per Unit */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              {t('tabs.measurements.editor.sections.costs')}
            </legend>
            <section className="grid grid-cols-3 gap-4">
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.materialUnitCost')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.materialUnitCost}
                  onChange={(e) => updateField('materialUnitCost', e.target.value)}
                />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.laborUnitCost')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.laborUnitCost}
                  onChange={(e) => updateField('laborUnitCost', e.target.value)}
                />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.equipmentUnitCost')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.equipmentUnitCost}
                  onChange={(e) => updateField('equipmentUnitCost', e.target.value)}
                />
              </article>
            </section>
          </fieldset>

          {/* Section: Computed Totals */}
          <fieldset className="space-y-2 rounded-lg bg-muted/50 p-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              {t('tabs.measurements.editor.sections.totals')}
            </legend>
            <p className="text-sm text-muted-foreground">
              {t('tabs.measurements.editor.fields.materialUnitCost')}: {formatCurrency(materialCost * grossQuantity)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('tabs.measurements.editor.fields.laborUnitCost')}: {formatCurrency(laborCost * grossQuantity)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('tabs.measurements.editor.fields.equipmentUnitCost')}: {formatCurrency(equipmentCost * grossQuantity)}
            </p>
            <p className="text-base font-semibold tabular-nums">
              {t('tabs.measurements.summary.total')}: {formatCurrency(totalCost)}
            </p>
          </fieldset>

          {/* Section: Links & Notes */}
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-muted-foreground">
              {t('tabs.measurements.editor.sections.link')}
            </legend>
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.notes')}</Label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder={t('tabs.measurements.editor.fields.notesPlaceholder')}
                rows={2}
                className={cn(
                  'flex w-full rounded-md border border-input bg-background px-3 py-2',
                  'text-sm ring-offset-background placeholder:text-muted-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'focus-visible:ring-offset-2 resize-none'
                )}
              />
            </section>

            {/* Status (edit only) */}
            {isEdit && availableStatuses.length > 1 && (
              <section className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.statusLabel')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => updateField('status', v as BOQItemStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`tabs.measurements.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            )}
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('tabs.measurements.editor.cancel')}
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !form.title.trim()}>
            {saving ? t('tabs.measurements.editor.saving') : t('tabs.measurements.editor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
