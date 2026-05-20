'use client';

/**
 * ADR-363 Phase 6.5.B — Dialog για δημιουργία / επεξεργασία BIM υλικού.
 * Radix Dialog (ADR-001). System materials (builtin=true) read-only.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type {
  BimMaterial,
  BimMaterialCategory,
  BimMaterialFireRating,
  BimMaterialScope,
  BimMaterialUnit,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormState {
  nameEl: string;
  nameEn: string;
  category: BimMaterialCategory;
  density: string;
  defaultThickness: string;
  fireRating: BimMaterialFireRating;
  atoeCategory: string;
  atoeArticle: string;
  defaultUnitCost: string;
  defaultUnit: BimMaterialUnit;
  brand: string;
  brandModel: string;
  notes: string;
  scope: Exclude<BimMaterialScope, 'system'>;
}

export interface MaterialEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: BimMaterial;
  projectId?: string;
  onSave: (
    input: SaveBimMaterialInput | UpdateBimMaterialPatch,
    mode: 'create' | 'edit',
  ) => Promise<void>;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES: BimMaterialCategory[] = [
  'plaster', 'masonry', 'concrete', 'insulation', 'flooring',
  'window-frame', 'door-frame', 'paint', 'roofing', 'waterproofing', 'other',
];
const FIRE_RATINGS: BimMaterialFireRating[] = ['none', 'EI30', 'EI60', 'EI90', 'EI120'];
const UNITS: BimMaterialUnit[] = ['m', 'm2', 'm3', 'kg', 'pcs'];

function buildInitialState(initial: BimMaterial | undefined, projectId?: string): FormState {
  if (initial) {
    return {
      nameEl: initial.nameEl,
      nameEn: initial.nameEn,
      category: initial.category,
      density: initial.density != null ? String(initial.density) : '',
      defaultThickness: initial.defaultThickness != null ? String(initial.defaultThickness) : '',
      fireRating: initial.fireRating,
      atoeCategory: initial.atoeCategory,
      atoeArticle: initial.atoeArticle ?? '',
      defaultUnitCost: initial.defaultUnitCost != null ? String(initial.defaultUnitCost) : '',
      defaultUnit: initial.defaultUnit,
      brand: initial.brand ?? '',
      brandModel: initial.brandModel ?? '',
      notes: initial.notes ?? '',
      scope: initial.scope === 'system' ? 'company' : initial.scope,
    };
  }
  return {
    nameEl: '', nameEn: '', category: 'concrete', density: '',
    defaultThickness: '', fireRating: 'none', atoeCategory: '',
    atoeArticle: '', defaultUnitCost: '', defaultUnit: 'm2',
    brand: '', brandModel: '', notes: '',
    scope: projectId ? 'project' : 'company',
  };
}

function validate(form: FormState, t: (k: string) => string): string | null {
  if (!form.nameEl.trim() || !form.nameEn.trim()) return t('validation.nameRequired');
  if (!form.atoeCategory.trim()) return t('validation.atoeCategoryRequired');
  if (form.density && (isNaN(Number(form.density)) || Number(form.density) <= 0)) {
    return t('validation.densityPositive');
  }
  return null;
}

function toNumber(s: string): number | undefined {
  const n = parseFloat(s);
  return isNaN(n) ? undefined : n;
}

function buildSaveInput(form: FormState): SaveBimMaterialInput {
  return {
    scope: form.scope,
    nameEl: form.nameEl.trim(),
    nameEn: form.nameEn.trim(),
    category: form.category,
    atoeCategory: form.atoeCategory.trim(),
    defaultUnit: form.defaultUnit,
    fireRating: form.fireRating,
    ...(form.density ? { density: toNumber(form.density) } : {}),
    ...(form.defaultThickness ? { defaultThickness: toNumber(form.defaultThickness) } : {}),
    ...(form.atoeArticle.trim() ? { atoeArticle: form.atoeArticle.trim() } : {}),
    ...(form.defaultUnitCost ? { defaultUnitCost: toNumber(form.defaultUnitCost) } : {}),
    ...(form.brand.trim() ? { brand: form.brand.trim() } : {}),
    ...(form.brandModel.trim() ? { brandModel: form.brandModel.trim() } : {}),
    ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
  };
}

function buildUpdatePatch(form: FormState): UpdateBimMaterialPatch {
  return {
    nameEl: form.nameEl.trim(),
    nameEn: form.nameEn.trim(),
    category: form.category,
    atoeCategory: form.atoeCategory.trim(),
    defaultUnit: form.defaultUnit,
    fireRating: form.fireRating,
    density: toNumber(form.density),
    defaultThickness: toNumber(form.defaultThickness),
    atoeArticle: form.atoeArticle.trim() || undefined,
    defaultUnitCost: toNumber(form.defaultUnitCost),
    brand: form.brand.trim() || undefined,
    brandModel: form.brandModel.trim() || undefined,
    notes: form.notes.trim() || undefined,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MaterialEditorDialog({
  open, mode, initial, projectId, onSave, onCancel,
}: MaterialEditorDialogProps) {
  const { t } = useTranslation('bim-materials');
  const colors = useSemanticColors();
  const isBuiltin = initial?.builtin === true;

  const [form, setForm] = useState<FormState>(() => buildInitialState(initial, projectId));
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Reset form whenever dialog opens with new data.
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initial, projectId));
      setFieldError(null);
    }
  }, [open, initial, projectId]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
  }, []);

  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) onCancel();
  }, [onCancel]);

  const handleSubmit = useCallback(async () => {
    const err = validate(form, t);
    if (err) { setFieldError(err); return; }
    setSaving(true);
    try {
      const payload = mode === 'create' ? buildSaveInput(form) : buildUpdatePatch(form);
      await onSave(payload, mode);
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, mode, onSave, t]);

  const inputClass = `w-full text-xs px-2 py-1.5 rounded ${colors.border.default} border ${colors.bg.primary} ${colors.text.primary} focus:outline-none focus:ring-1 focus:ring-ring`;
  const labelClass = `text-xs font-medium ${colors.text.muted}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {mode === 'create' ? t('form.createTitle') : t('form.editTitle')}
          </DialogTitle>
        </DialogHeader>

        {isBuiltin && (
          <aside className={`text-xs ${colors.text.muted} italic px-1`}>
            {t('readOnlyHint')}
          </aside>
        )}

        <fieldset disabled={isBuiltin || saving} className="flex flex-col gap-3 border-0 p-0 m-0">
          <RequiredSection
            form={form} setField={setField}
            projectId={projectId} mode={mode}
            inputClass={inputClass} labelClass={labelClass} t={t}
          />
          <DimensionsSection form={form} setField={setField} inputClass={inputClass} labelClass={labelClass} t={t} />
          <MetadataSection form={form} setField={setField} inputClass={inputClass} labelClass={labelClass} t={t} />
        </fieldset>

        {fieldError && (
          <p role="alert" className="text-xs text-destructive px-1">{fieldError}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            {t('form.cancel')}
          </Button>
          {!isBuiltin && (
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? t('form.saving') : t('form.save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-sections ─────────────────────────────────────────────────────────────

interface SectionProps {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  inputClass: string;
  labelClass: string;
  t: (k: string) => string;
}

function RequiredSection({
  form, setField, projectId, mode, inputClass, labelClass, t,
}: SectionProps & { projectId?: string; mode: 'create' | 'edit' }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.nameEl')}</span>
          <input className={inputClass} value={form.nameEl} onChange={(e) => setField('nameEl', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.nameEn')}</span>
          <input className={inputClass} value={form.nameEn} onChange={(e) => setField('nameEn', e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.category')}</span>
          <Select value={form.category} onValueChange={(v) => setField('category', v as BimMaterialCategory)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{t(`categories.${c}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.defaultUnit')}</span>
          <Select value={form.defaultUnit} onValueChange={(v) => setField('defaultUnit', v as BimMaterialUnit)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>{t(`units.${u}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('form.atoeCategory')}</span>
        <input className={inputClass} value={form.atoeCategory} onChange={(e) => setField('atoeCategory', e.target.value)} />
      </label>
      {mode === 'create' && projectId && (
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.scope')}</span>
          <Select value={form.scope} onValueChange={(v) => setField('scope', v as Exclude<BimMaterialScope, 'system'>)}>
            <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="company">{t('scopes.company')}</SelectItem>
              <SelectItem value="project">{t('scopes.project')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}
    </section>
  );
}

function DimensionsSection({ form, setField, inputClass, labelClass, t }: SectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.density')}</span>
          <input type="number" min={0} className={inputClass} value={form.density} onChange={(e) => setField('density', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.defaultThickness')}</span>
          <input type="number" min={0} className={inputClass} value={form.defaultThickness} onChange={(e) => setField('defaultThickness', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.defaultUnitCost')}</span>
          <input type="number" min={0} className={inputClass} value={form.defaultUnitCost} onChange={(e) => setField('defaultUnitCost', e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('form.fireRating')}</span>
        <Select value={form.fireRating} onValueChange={(v) => setField('fireRating', v as BimMaterialFireRating)}>
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIRE_RATINGS.map((fr) => (
              <SelectItem key={fr} value={fr}>{t(`fireRatings.${fr}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </section>
  );
}

function MetadataSection({ form, setField, inputClass, labelClass, t }: SectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.atoeArticle')}</span>
          <input className={inputClass} value={form.atoeArticle} onChange={(e) => setField('atoeArticle', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('form.brand')}</span>
          <input className={inputClass} value={form.brand} onChange={(e) => setField('brand', e.target.value)} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('form.brandModel')}</span>
        <input className={inputClass} value={form.brandModel} onChange={(e) => setField('brandModel', e.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>{t('form.notes')}</span>
        <textarea rows={2} className={`${inputClass} resize-none`} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
      </label>
    </section>
  );
}
