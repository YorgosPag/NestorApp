/**
 * BOQItemEditor — Dialog form for creating/editing BOQ items
 *
 * @module components/building-management/tabs/MeasurementsTabContent/BOQItemEditor
 * @see ADR-175 §4.4.3 (SCREEN 2)
 */

'use client';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BOQItem, BOQItemStatus, BOQMeasurementUnit } from '@/types/boq';
import type { MasterBOQCategory } from '@/config/boq-categories';
import type { CreateBOQItemInput, UpdateBOQItemInput } from '@/types/boq';
import '@/lib/design-system';

// 🏢 ENTERPRISE: Extracted state hook
import { useBOQEditorState } from './useBOQEditorState';

// Re-exports
export { type EditorFormState } from './useBOQEditorState';

interface BOQItemEditorProps {
  open: boolean;
  onClose: () => void;
  item: BOQItem | null;
  buildingId: string;
  projectId: string;
  categories: readonly MasterBOQCategory[];
  onSave: (data: CreateBOQItemInput | UpdateBOQItemInput, isNew: boolean) => Promise<void>;
}

export function BOQItemEditor({ open, onClose, item, buildingId, projectId, categories, onSave }: BOQItemEditorProps) {
  const { t } = useTranslation('building');
  const colors = useSemanticColors();

  const {
    form, saving, isEdit,
    grossQuantity, materialCost, laborCost, equipmentCost, totalCost,
    allowedUnits, availableStatuses,
    updateField, handleCategoryChange, handleSave,
  } = useBOQEditorState({ open, item, categories, buildingId, projectId, onSave, onClose });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('tabs.measurements.editor.editTitle') : t('tabs.measurements.editor.createTitle')}</DialogTitle>
          <DialogDescription>{isEdit ? item?.title : t('tabs.measurements.editor.sections.basic')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }} className="space-y-2">
          {/* Basic Info */}
          <fieldset className="space-y-2">
            <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.basic')}</legend>
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.category')}</Label>
              <Select value={form.categoryCode} onValueChange={handleCategoryChange} disabled={isEdit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => <SelectItem key={cat.code} value={cat.code}>{cat.code} — {cat.nameEL}</SelectItem>)}
                </SelectContent>
              </Select>
            </section>
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.title')} *</Label>
              <Input value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder={t('tabs.measurements.editor.fields.titlePlaceholder')} required />
            </section>
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.specifications')}</Label>
              <Textarea size="sm" value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder={t('tabs.measurements.editor.fields.specificationsPlaceholder')} rows={3} className="resize-none" />
            </section>
          </fieldset>

          {/* Scope (create only) */}
          {!isEdit && (
            <fieldset className="space-y-2">
              <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.scope')}</legend>
              <section className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" value="building" checked={form.scope === 'building'} onChange={() => updateField('scope', 'building')} className="accent-primary" />
                  <span className="text-sm">{t('tabs.measurements.editor.fields.scopeBuilding')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="scope" value="property" checked={form.scope === 'property'} onChange={() => updateField('scope', 'property')} className="accent-primary" />
                  <span className="text-sm">{t('tabs.measurements.editor.fields.scopeUnit')}</span>
                </label>
              </section>
            </fieldset>
          )}

          {/* Quantities */}
          <fieldset className="space-y-2">
            <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.quantities')}</legend>
            <section className="grid grid-cols-2 gap-2">
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.measurementUnit')}</Label>
                <Select value={form.unit} onValueChange={(v) => updateField('unit', v as BOQMeasurementUnit)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{allowedUnits.map((u) => <SelectItem key={u} value={u}>{t(`tabs.measurements.units.${u}`)} ({u})</SelectItem>)}</SelectContent>
                </Select>
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.estimatedQuantity')}</Label>
                <Input type="number" min="0" step="0.01" value={form.estimatedQuantity} onChange={(e) => updateField('estimatedQuantity', e.target.value)} />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.wasteFactor')}</Label>
                <Input type="number" min="0" max="100" step="1" value={form.wasteFactor} onChange={(e) => updateField('wasteFactor', e.target.value)} />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.grossQuantity')}</Label>
                <Input type="text" value={formatNumber(grossQuantity, { maximumFractionDigits: 2 })} disabled className="bg-muted tabular-nums" />
              </article>
              {isEdit && (
                <article className="space-y-1.5 col-span-2 sm:col-span-1">
                  <Label>{t('tabs.measurements.editor.fields.actualQuantity')}</Label>
                  <Input type="number" min="0" step="0.01" value={form.actualQuantity} onChange={(e) => updateField('actualQuantity', e.target.value)} placeholder="—" />
                </article>
              )}
            </section>
          </fieldset>

          {/* Costs */}
          <fieldset className="space-y-2">
            <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.costs')}</legend>
            <section className="grid grid-cols-3 gap-2">
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.materialUnitCost')}</Label>
                <Input type="number" min="0" step="0.01" value={form.materialUnitCost} onChange={(e) => updateField('materialUnitCost', e.target.value)} />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.laborUnitCost')}</Label>
                <Input type="number" min="0" step="0.01" value={form.laborUnitCost} onChange={(e) => updateField('laborUnitCost', e.target.value)} />
              </article>
              <article className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.equipmentUnitCost')}</Label>
                <Input type="number" min="0" step="0.01" value={form.equipmentUnitCost} onChange={(e) => updateField('equipmentUnitCost', e.target.value)} />
              </article>
            </section>
          </fieldset>

          {/* Totals */}
          <fieldset className="space-y-2 rounded-lg bg-muted/50 p-2">
            <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.totals')}</legend>
            <p className={cn("text-sm", colors.text.muted)}>{t('tabs.measurements.editor.fields.materialUnitCost')}: {formatCurrency(materialCost * grossQuantity)}</p>
            <p className={cn("text-sm", colors.text.muted)}>{t('tabs.measurements.editor.fields.laborUnitCost')}: {formatCurrency(laborCost * grossQuantity)}</p>
            <p className={cn("text-sm", colors.text.muted)}>{t('tabs.measurements.editor.fields.equipmentUnitCost')}: {formatCurrency(equipmentCost * grossQuantity)}</p>
            <p className="text-base font-semibold tabular-nums">{t('tabs.measurements.summary.total')}: {formatCurrency(totalCost)}</p>
          </fieldset>

          {/* Notes + Status */}
          <fieldset className="space-y-2">
            <legend className={cn("text-sm font-semibold", colors.text.muted)}>{t('tabs.measurements.editor.sections.link')}</legend>
            <section className="space-y-1.5">
              <Label>{t('tabs.measurements.editor.fields.notes')}</Label>
              <Textarea size="sm" value={form.notes} onChange={(e) => updateField('notes', e.target.value)} placeholder={t('tabs.measurements.editor.fields.notesPlaceholder')} rows={2} className="resize-none" />
            </section>
            {isEdit && availableStatuses.length > 1 && (
              <section className="space-y-1.5">
                <Label>{t('tabs.measurements.editor.fields.statusLabel')}</Label>
                <Select value={form.status} onValueChange={(v) => updateField('status', v as BOQItemStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{availableStatuses.map((s) => <SelectItem key={s} value={s}>{t(`tabs.measurements.status.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              </section>
            )}
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('tabs.measurements.editor.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving || !form.title.trim()}>{saving ? t('tabs.measurements.editor.saving') : t('tabs.measurements.editor.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
