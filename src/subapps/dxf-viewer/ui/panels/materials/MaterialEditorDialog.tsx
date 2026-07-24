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
} from '../../../bim/services/bim-material-thumbnail-upload.service';
import {
  RequiredSection,
  DimensionsSection,
  MetadataSection,
  ThumbnailSection,
} from './MaterialEditorSections';
import { AppearancePreviewSection, AppearanceColorSection } from './MaterialEditorAppearanceSections';
import { PbrTexturesSection } from './MaterialPbrTexturesSection';
import {
  buildInitialState,
  buildSaveInput,
  buildUpdatePatch,
  thumbnailErrorKey,
  validate,
  type MaterialEditorSeed,
} from './material-editor-form-model';
import {
  useMaterialPbrTextureUpload,
  type StagedPbrMaps,
  type SetMapUrl,
} from './hooks/useMaterialPbrTextureUpload';
import type { BimMaterialTextureMapName } from '@/services/upload/utils/storage-path';
import type {
  BimMaterial,
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
  /** ADR-687 Φ8 — create-mode duplicate seed (αγνοείται όταν υπάρχει `initial`). */
  seed?: MaterialEditorSeed;
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

// ─── Component ────────────────────────────────────────────────────────────────

export function MaterialEditorDialog({
  open, mode, initial, seed, projectId, onSave, onCancel,
}: MaterialEditorDialogProps) {
  const { t } = useTranslation('bim-materials');
  const colors = useSemanticColors();
  const companyId = useCompanyId()?.companyId;
  const isBuiltin = initial?.builtin === true;

  const [form, setForm] = useState<FormState>(() => buildInitialState(initial, projectId, seed));
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
      setForm(buildInitialState(initial, projectId, seed));
      setFieldError(null);
      setPendingThumb(null);
      setThumbError(null);
      pbr.reset();
    }
    // pbr.reset is stable (useCallback []); excluded to avoid re-running on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, seed, projectId]);

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
