'use client';

/**
 * ADR-363 Phase 6.5.B — Form sub-sections for `MaterialEditorDialog`.
 *
 * Extracted from the dialog (Google file-size SSoT, ≤500 lines) so the container
 * keeps the lifecycle/orchestration and these stay pure presentational sections.
 * Includes the `FormState` shape shared by the dialog + its helpers.
 *
 * @see ./MaterialEditorDialog.tsx — the container
 */

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaterialSwatch } from '../../components/shared/MaterialSwatch';
import type {
  BimMaterialCategory,
  BimMaterialFireRating,
  BimMaterialScope,
  BimMaterialUnit,
} from '../../../bim/types/bim-material-types';

// ─── Shared form shape ──────────────────────────────────────────────────────────

export interface FormState {
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
  thumbnailUrl: string;
  // ADR-687 Φ1 — per-material PBR appearance (χρώμα/μεταλλικότητα/τραχύτητα). Stored
  // as strings (form convention); `metalness`/`roughness` are '0'..'1'.
  baseColorHex: string;
  metalness: string;
  roughness: string;
  // ADR-687 Φ4 — αυτοφωτισμός (emissive) + αδιαφάνεια (opacity). `emissiveIntensity`/`opacity`
  // are '0'..'1' strings; `emissiveHex` is '#rrggbb'. `emissiveCustom` (transient, not persisted):
  // false → the emissive colour live-tracks the base colour (glow-in-own-colour default); set true
  // once the user picks a distinct emissive colour, freezing it.
  emissiveHex: string;
  emissiveIntensity: string;
  emissiveCustom: boolean;
  opacity: string;
  // ADR-687 Φ5 — physical (MeshPhysicalMaterial) props. `clearcoat`/`clearcoatRoughness`/
  // `transmission` are '0'..'1'; `ior` is '1'..'2.333'; `thickness` is '0'..'5' (all strings,
  // form convention). Off by default → buildMat stays MeshStandardMaterial.
  clearcoat: string;
  clearcoatRoughness: string;
  transmission: string;
  ior: string;
  thickness: string;
  // ADR-413 §2D Phase 3 — user-uploaded 3D PBR texture maps + physical tile size.
  albedoUrl: string;
  normalUrl: string;
  roughnessUrl: string;
  aoUrl: string;
  tileSizeM: string;
  scope: Exclude<BimMaterialScope, 'system'>;
}

const CATEGORIES: BimMaterialCategory[] = [
  'plaster', 'masonry', 'concrete', 'insulation', 'flooring',
  'window-frame', 'door-frame', 'paint', 'roofing', 'waterproofing', 'other',
];
const FIRE_RATINGS: BimMaterialFireRating[] = ['none', 'EI30', 'EI60', 'EI90', 'EI120'];
const UNITS: BimMaterialUnit[] = ['m', 'm2', 'm3', 'kg', 'pcs'];

/**
 * Το `SelectContent` (ADR-001 Radix) κλειδώνει by-default στο ΑΚΡΙΒΕΣ πλάτος του trigger, οπότε
 * μεγάλες ελληνικές ετικέτες (π.χ. «Μόνωση (Θερμική / Ηχητική)») κόβονταν στις στενές στήλες του
 * grid. Εδώ αφήνουμε το dropdown να μεγαλώνει ΩΣ το περιεχόμενό του (≥ πλάτος trigger). Localized —
 * δεν αλλάζει το enterprise default του Select.
 */
const DROPDOWN_CONTENT = 'w-auto min-w-[var(--radix-select-trigger-width)]';

export interface SectionProps {
  form: FormState;
  setField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  inputClass: string;
  labelClass: string;
  t: (k: string) => string;
}

// ─── Required ─────────────────────────────────────────────────────────────────

export function RequiredSection({
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
            <SelectContent className={DROPDOWN_CONTENT}>
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
            <SelectContent className={DROPDOWN_CONTENT}>
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
            <SelectContent className={DROPDOWN_CONTENT}>
              <SelectItem value="company">{t('scopes.company')}</SelectItem>
              <SelectItem value="project">{t('scopes.project')}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}
    </section>
  );
}

// ─── Dimensions ───────────────────────────────────────────────────────────────

export function DimensionsSection({ form, setField, inputClass, labelClass, t }: SectionProps) {
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
          <SelectContent className={DROPDOWN_CONTENT}>
            {FIRE_RATINGS.map((fr) => (
              <SelectItem key={fr} value={fr}>{t(`fireRatings.${fr}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
    </section>
  );
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export function MetadataSection({ form, setField, inputClass, labelClass, t }: SectionProps) {
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

// ─── Thumbnail (ADR-413 §2D Phase 2) ────────────────────────────────────────────

interface ThumbnailSectionProps {
  form: FormState;
  mode: 'create' | 'edit';
  pendingThumb: File | null;
  busy: boolean;
  error: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  labelClass: string;
  colors: ReturnType<typeof useSemanticColors>;
  t: (k: string) => string;
}

export function ThumbnailSection({
  form, mode, pendingThumb, busy, error, onSelect, onRemove, labelClass, colors, t,
}: ThumbnailSectionProps) {
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // Object URL for the staged (create-mode) file, revoked on change/unmount.
  useEffect(() => {
    if (!pendingThumb) { setPendingPreview(null); return; }
    const url = URL.createObjectURL(pendingThumb);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingThumb]);

  const previewUrl = pendingPreview ?? (form.thumbnailUrl || null);
  const hasImage = Boolean(previewUrl);

  return (
    <section className="flex flex-col gap-1.5">
      <span className={labelClass}>{t('thumbnail.label')}</span>
      <div className="flex items-center gap-2">
        <MaterialSwatch category={form.category} thumbnailUrl={previewUrl} className="h-12 w-12" />
        <div className="flex flex-col gap-1">
          <label className={`text-xs cursor-pointer px-2 py-1 rounded border ${colors.border.default} ${colors.bg.secondary} ${colors.text.primary} hover:${colors.bg.hover} transition-colors w-fit`}>
            {busy ? t('thumbnail.uploading') : t('thumbnail.upload')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSelect(file);
                e.target.value = '';
              }}
            />
          </label>
          {hasImage && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className={`text-[10px] text-left ${colors.text.muted} hover:text-destructive transition-colors w-fit`}
            >
              {t('thumbnail.remove')}
            </button>
          )}
        </div>
      </div>
      {mode === 'create' && pendingThumb && (
        <p className={`text-[10px] ${colors.text.muted} px-0.5`}>{t('thumbnail.createFirstHint')}</p>
      )}
      {error && <p role="alert" className="text-[10px] text-destructive px-0.5">{error}</p>}
    </section>
  );
}
