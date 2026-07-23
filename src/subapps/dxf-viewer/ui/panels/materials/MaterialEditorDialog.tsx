'use client';

/**
 * ADR-363 Phase 6.5.B — Dialog για δημιουργία / επεξεργασία BIM υλικού.
 * Radix Dialog (ADR-001). System materials (builtin=true) read-only.
 *
 * Container only: owns form state + save/upload lifecycle. The presentational
 * form sub-sections live in `./MaterialEditorSections.tsx` (file-size SSoT).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useCompanyId } from '@/hooks/useCompanyId';
import {
  uploadMaterialThumbnail,
  validateMaterialThumbnailFile,
  MaterialThumbnailUploadError,
  type MaterialThumbnailUploadErrorCode,
} from '../../../bim/services/bim-material-thumbnail-upload.service';
import {
  RequiredSection,
  AppearancePreviewSection,
  AppearanceColorSection,
  DimensionsSection,
  MetadataSection,
  ThumbnailSection,
  type FormState,
} from './MaterialEditorSections';
import { PbrTexturesSection } from './MaterialPbrTexturesSection';
import { getCategoryMaterialDef } from '../../../bim/materials/material-catalog-defs';
import { trueColorToHex } from '../../../utils/dxf-true-color';
import {
  useMaterialPbrTextureUpload,
  type StagedPbrMaps,
  type SetMapUrl,
} from './hooks/useMaterialPbrTextureUpload';
import type { BimMaterialTextureMapName } from '@/services/upload/utils/storage-path';
import type {
  BimMaterial,
  BimMaterialAppearance,
  BimMaterialCategory,
  PbrMaterialTextures,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';

/** Staged PBR maps + tile size, handed to the panel for post-create upload. */
export interface PendingPbrUpload {
  readonly maps: StagedPbrMaps;
  readonly tileSizeM: number;
}

export interface MaterialEditorDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: BimMaterial;
  projectId?: string;
  onSave: (
    input: SaveBimMaterialInput | UpdateBimMaterialPatch,
    mode: 'create' | 'edit',
    /** Staged appearance image (create mode) — uploaded by the panel post-save. */
    pendingThumbnail?: File | null,
    /** Staged 3D PBR maps (create mode) — uploaded by the panel post-save. */
    pendingPbr?: PendingPbrUpload | null,
  ) => Promise<void>;
  onCancel: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * ADR-687 Φ1 — the appearance form seed: the material's OWN appearance when it has
 * one, else the flat def of its category (so a legacy material opens showing its
 * real category colour, and saving it — override === category — is a no-op visually,
 * zero regression). Values are strings (form convention).
 */
function appearanceSeed(
  category: BimMaterialCategory,
  appearance: BimMaterialAppearance | null | undefined,
): {
  baseColorHex: string;
  metalness: string;
  roughness: string;
  emissiveHex: string;
  emissiveIntensity: string;
  emissiveCustom: boolean;
  opacity: string;
} {
  if (appearance) {
    return {
      baseColorHex: appearance.baseColorHex,
      metalness: String(appearance.metalness),
      roughness: String(appearance.roughness),
      // ADR-687 Φ4 — emissive colour defaults to the BASE colour (Revit/C4D-intuitive: raising
      // just the intensity makes the surface glow IN ITS OWN colour, like a lit LED panel — a
      // black default would make the intensity slider a silent no-op). Intensity 0 = off.
      emissiveHex: appearance.emissiveHex ?? appearance.baseColorHex,
      emissiveIntensity: String(appearance.emissiveIntensity ?? 0),
      // Customised only if a distinct emissive colour was persisted (else it live-tracks the base).
      emissiveCustom: appearance.emissiveHex != null && appearance.emissiveHex !== appearance.baseColorHex,
      opacity: String(appearance.opacity ?? 1),
    };
  }
  const def = getCategoryMaterialDef(category);
  const baseColorHex = trueColorToHex(def.color).toLowerCase();
  return {
    baseColorHex,
    metalness: String(def.metalness),
    roughness: String(def.roughness),
    // Emissive colour = base (off by intensity 0), tracking the base until customised;
    // opacity from the category def (e.g. glass 0.35).
    emissiveHex: baseColorHex,
    emissiveIntensity: '0',
    emissiveCustom: false,
    opacity: String(def.opacity ?? 1),
  };
}

function buildInitialState(initial: BimMaterial | undefined, projectId?: string): FormState {
  if (initial) {
    const appear = appearanceSeed(initial.category, initial.appearance);
    return {
      nameEl: initial.nameEl,
      nameEn: initial.nameEn,
      category: initial.category,
      baseColorHex: appear.baseColorHex,
      metalness: appear.metalness,
      roughness: appear.roughness,
      emissiveHex: appear.emissiveHex,
      emissiveIntensity: appear.emissiveIntensity,
      emissiveCustom: appear.emissiveCustom,
      opacity: appear.opacity,
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
      thumbnailUrl: initial.thumbnailUrl ?? '',
      albedoUrl: initial.pbrTextures?.albedoUrl ?? '',
      normalUrl: initial.pbrTextures?.normalUrl ?? '',
      roughnessUrl: initial.pbrTextures?.roughnessUrl ?? '',
      aoUrl: initial.pbrTextures?.aoUrl ?? '',
      tileSizeM: initial.pbrTextures ? String(initial.pbrTextures.tileSizeM) : '1',
      scope: initial.scope === 'system' ? 'company' : initial.scope,
    };
  }
  const appear = appearanceSeed('concrete', undefined);
  return {
    nameEl: '', nameEn: '', category: 'concrete', density: '',
    defaultThickness: '', fireRating: 'none', atoeCategory: '',
    atoeArticle: '', defaultUnitCost: '', defaultUnit: 'm2',
    brand: '', brandModel: '', notes: '', thumbnailUrl: '',
    baseColorHex: appear.baseColorHex, metalness: appear.metalness, roughness: appear.roughness,
    emissiveHex: appear.emissiveHex, emissiveIntensity: appear.emissiveIntensity,
    emissiveCustom: appear.emissiveCustom, opacity: appear.opacity,
    albedoUrl: '', normalUrl: '', roughnessUrl: '', aoUrl: '', tileSizeM: '1',
    scope: projectId ? 'project' : 'company',
  };
}

/**
 * ADR-687 Φ1 — build the persisted appearance from the form. Every authored/edited
 * material owns an explicit appearance (big-player: Revit/ArchiCAD/C4D materials
 * always carry appearance). Out-of-range guards mirror `appearanceToDef`.
 */
function buildAppearance(form: FormState): BimMaterialAppearance {
  const m = Number(form.metalness);
  const r = Number(form.roughness);
  const ei = Number(form.emissiveIntensity);
  const op = Number(form.opacity);
  return {
    baseColorHex: form.baseColorHex,
    metalness: isNaN(m) ? 0 : m,
    roughness: isNaN(r) ? 0.5 : r,
    // ADR-687 Φ4 — concrete values only (never undefined → Firestore-safe).
    emissiveHex: form.emissiveHex,
    emissiveIntensity: isNaN(ei) ? 0 : ei,
    opacity: isNaN(op) ? 1 : op,
  };
}

/**
 * Build the Firestore `PbrMaterialTextures` from the form URL fields, or null when
 * no albedo is present (albedo is mandatory — without it there is no textured
 * material). In create mode the URLs are empty (maps are staged) so this returns
 * null; the panel uploads + patches the textures after the doc exists.
 */
function buildPbrTextures(form: FormState): PbrMaterialTextures | null {
  if (!form.albedoUrl) return null;
  const tile = Number(form.tileSizeM);
  return {
    albedoUrl: form.albedoUrl,
    normalUrl: form.normalUrl || null,
    roughnessUrl: form.roughnessUrl || null,
    aoUrl: form.aoUrl || null,
    tileSizeM: tile > 0 ? tile : 1,
  };
}

/** Maps an upload-service error to its i18n key under `thumbnail.errors`. */
function thumbnailErrorKey(err: unknown): string {
  const code: MaterialThumbnailUploadErrorCode | 'uploadFailed' =
    err instanceof MaterialThumbnailUploadError ? err.code : 'uploadFailed';
  switch (code) {
    case 'format': return 'thumbnail.errors.format';
    case 'size': return 'thumbnail.errors.size';
    default: return 'thumbnail.errors.uploadFailed';
  }
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
    ...(form.thumbnailUrl ? { thumbnailUrl: form.thumbnailUrl } : {}),
    ...(buildPbrTextures(form) ? { pbrTextures: buildPbrTextures(form)! } : {}),
    // ADR-687 Φ1 — every new material carries an explicit appearance.
    appearance: buildAppearance(form),
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
    // Empty → null removes the uploaded image (back to albedo fallback).
    thumbnailUrl: form.thumbnailUrl || null,
    // Empty albedo → null removes the whole texture set (back to flat by category).
    pbrTextures: buildPbrTextures(form),
    // ADR-687 Φ1 — persist the edited appearance (never undefined → Firestore-safe).
    appearance: buildAppearance(form),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MaterialEditorDialog({
  open, mode, initial, projectId, onSave, onCancel,
}: MaterialEditorDialogProps) {
  const { t } = useTranslation('bim-materials');
  const colors = useSemanticColors();
  const companyId = useCompanyId()?.companyId;
  const isBuiltin = initial?.builtin === true;

  const [form, setForm] = useState<FormState>(() => buildInitialState(initial, projectId));
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  // ADR-413 §2D Phase 2 — staged appearance image (create mode) + busy/error.
  const [pendingThumb, setPendingThumb] = useState<File | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldError(null);
  }, []);

  // ADR-413 §2D Phase 3 — 3D PBR maps (albedo/normal/roughness/ao) upload lifecycle.
  const setMapUrl = useCallback<SetMapUrl>((map: BimMaterialTextureMapName, url: string) => {
    setForm((prev) => ({ ...prev, [`${map}Url`]: url }));
    setFieldError(null);
  }, []);
  const pbr = useMaterialPbrTextureUpload({ mode, materialId: initial?.id, companyId, setMapUrl, t });

  // Reset form whenever dialog opens with new data.
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(initial, projectId));
      setFieldError(null);
      setPendingThumb(null);
      setThumbError(null);
      pbr.reset();
    }
    // pbr.reset is stable (useCallback []); excluded to avoid re-running on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, projectId]);

  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) onCancel();
  }, [onCancel]);

  // Edit mode → upload immediately (materialId exists). Create mode → stage the
  // file; the panel uploads it right after the doc is created (Revit-grade flow).
  const handleSelectThumbnail = useCallback(async (file: File) => {
    setThumbError(null);
    try {
      validateMaterialThumbnailFile(file);
    } catch (e) {
      setThumbError(t(thumbnailErrorKey(e)));
      return;
    }
    if (mode === 'edit' && initial && companyId) {
      setThumbBusy(true);
      try {
        const { downloadUrl } = await uploadMaterialThumbnail({ file, companyId, materialId: initial.id });
        setField('thumbnailUrl', downloadUrl);
        setPendingThumb(null);
      } catch (e) {
        setThumbError(t(thumbnailErrorKey(e)));
      } finally {
        setThumbBusy(false);
      }
    } else {
      setPendingThumb(file);
    }
  }, [mode, initial, companyId, setField, t]);

  const handleRemoveThumbnail = useCallback(() => {
    setField('thumbnailUrl', '');
    setPendingThumb(null);
    setThumbError(null);
  }, [setField]);

  const handleSubmit = useCallback(async () => {
    const err = validate(form, t);
    if (err) { setFieldError(err); return; }
    setSaving(true);
    try {
      const payload = mode === 'create' ? buildSaveInput(form) : buildUpdatePatch(form);
      const pendingPbr: PendingPbrUpload | null =
        Object.keys(pbr.staged).length > 0
          ? { maps: pbr.staged, tileSizeM: Number(form.tileSizeM) > 0 ? Number(form.tileSizeM) : 1 }
          : null;
      await onSave(payload, mode, pendingThumb, pendingPbr);
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form, mode, onSave, pendingThumb, pbr.staged, t]);

  const inputClass = `w-full text-xs px-2 py-1.5 rounded ${colors.border.default} border ${colors.bg.primary} ${colors.text.primary} focus:outline-none focus:ring-1 focus:ring-ring`;
  const labelClass = `text-xs font-medium ${colors.text.muted}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="2xl" className="max-h-[90vh] overflow-y-auto">
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

        {/* ADR-687 Φ1 — ρητό 4-column grid, σειρά Giorgio (2026-07-23): (1) πεδία υλικού · (2) σφαίρα
            + PBR sliders · (3) επιλογέας χρώματος (κάθετος) · (4) υφές 3D + μικρογραφία. grid (ΠΟΤΕ
            δεν σπάει section, σε αντίθεση με CSS columns). */}
        <fieldset
          disabled={isBuiltin || saving}
          className="grid grid-cols-1 gap-x-6 gap-y-4 border-0 p-0 m-0 md:grid-cols-2 lg:grid-cols-4"
        >
          {/* Στήλη 1 — πεδία υλικού */}
          <div className="flex min-w-0 flex-col gap-4">
            <RequiredSection
              form={form} setField={setField}
              projectId={projectId} mode={mode}
              inputClass={inputClass} labelClass={labelClass} t={t}
            />
            <DimensionsSection form={form} setField={setField} inputClass={inputClass} labelClass={labelClass} t={t} />
            <MetadataSection form={form} setField={setField} inputClass={inputClass} labelClass={labelClass} t={t} />
          </div>
          {/* Στήλη 2 — σφαίρα-preview + PBR sliders */}
          <div className="min-w-0">
            <AppearancePreviewSection form={form} setField={setField} labelClass={labelClass} colors={colors} t={t} />
          </div>
          {/* Στήλη 3 — επιλογέας χρώματος */}
          <div className="min-w-0">
            <AppearanceColorSection form={form} setField={setField} labelClass={labelClass} t={t} />
          </div>
          {/* Στήλη 4 — υφές 3D + μικρογραφία */}
          <div className="flex min-w-0 flex-col gap-4">
            <PbrTexturesSection
              getUrl={(map) => form[`${map}Url`]}
              staged={pbr.staged}
              busyMap={pbr.busyMap}
              error={pbr.error}
              tileSizeM={form.tileSizeM}
              mode={mode}
              onSelect={pbr.onSelect}
              onRemove={pbr.onRemove}
              onTileSizeChange={(v) => setField('tileSizeM', v)}
              inputClass={inputClass}
              labelClass={labelClass}
              colors={colors}
              t={t}
            />
            <ThumbnailSection
              form={form}
              mode={mode}
              pendingThumb={pendingThumb}
              busy={thumbBusy}
              error={thumbError}
              onSelect={handleSelectThumbnail}
              onRemove={handleRemoveThumbnail}
              labelClass={labelClass}
              colors={colors}
              t={t}
            />
          </div>
        </fieldset>

        {fieldError && (
          <p role="alert" className="text-xs text-destructive px-1">{fieldError}</p>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            {t('form.cancel')}
          </Button>
          {!isBuiltin && (
            <Button size="sm" onClick={handleSubmit} disabled={saving || thumbBusy}>
              {saving ? t('form.saving') : t('form.save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
