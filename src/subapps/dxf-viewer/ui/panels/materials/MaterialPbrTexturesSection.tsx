'use client';

/**
 * ADR-413 §2D Phase 3 — «Υφές 3D (PBR)» form section for `MaterialEditorDialog`.
 *
 * Revit «Appearance asset → Image» per-map slots: albedo (required) + normal +
 * roughness + ao, each an upload slot with preview/remove, plus a `tileSizeM`
 * («Sample Size») input. Uploaded maps RENDER on walls in the 3D viewport via the
 * user-material registry — not just a 2D swatch.
 *
 * Presentational only; the upload lifecycle lives in `useMaterialPbrTextureUpload`.
 *
 * @see ./hooks/useMaterialPbrTextureUpload.ts
 * @see ./MaterialEditorDialog.tsx — the container
 */

import React, { useState, useEffect } from 'react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { BimMaterialTextureMapName } from '@/services/upload/utils/storage-path';
import { PBR_MAPS, type StagedPbrMaps } from './hooks/useMaterialPbrTextureUpload';

interface PbrMapSlotProps {
  map: BimMaterialTextureMapName;
  url: string;
  stagedFile: File | undefined;
  busy: boolean;
  onSelect: (map: BimMaterialTextureMapName, file: File) => void;
  onRemove: (map: BimMaterialTextureMapName) => void;
  colors: ReturnType<typeof useSemanticColors>;
  t: (k: string) => string;
}

function PbrMapSlot({ map, url, stagedFile, busy, onSelect, onRemove, colors, t }: PbrMapSlotProps) {
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // Object URL for the staged (create-mode) file, revoked on change/unmount.
  useEffect(() => {
    if (!stagedFile) { setPendingPreview(null); return; }
    const objectUrl = URL.createObjectURL(stagedFile);
    setPendingPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [stagedFile]);

  const previewUrl = pendingPreview ?? (url || null);
  const required = map === 'albedo';

  return (
    <article className="flex items-center gap-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={`h-10 w-10 shrink-0 rounded-sm border ${colors.border.default} object-cover`}
        />
      ) : (
        <span
          aria-hidden="true"
          className={`h-10 w-10 shrink-0 rounded-sm border border-dashed ${colors.border.default} ${colors.bg.secondary}`}
        />
      )}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className={`text-xs ${colors.text.primary}`}>
          {t(`textures3d.maps.${map}`)}
          {required && <span className={colors.text.muted}> *</span>}
        </span>
        <div className="flex items-center gap-2">
          <label className={`text-[11px] cursor-pointer px-2 py-0.5 rounded border ${colors.border.default} ${colors.bg.secondary} ${colors.text.primary} hover:${colors.bg.hover} transition-colors w-fit`}>
            {busy ? t('textures3d.uploading') : t('textures3d.upload')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onSelect(map, file);
                e.target.value = '';
              }}
            />
          </label>
          {previewUrl && (
            <button
              type="button"
              onClick={() => onRemove(map)}
              disabled={busy}
              className={`text-[10px] ${colors.text.muted} hover:text-destructive transition-colors`}
            >
              {t('textures3d.remove')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export interface PbrTexturesSectionProps {
  getUrl: (map: BimMaterialTextureMapName) => string;
  staged: StagedPbrMaps;
  busyMap: BimMaterialTextureMapName | null;
  error: string | null;
  tileSizeM: string;
  mode: 'create' | 'edit';
  onSelect: (map: BimMaterialTextureMapName, file: File) => void;
  onRemove: (map: BimMaterialTextureMapName) => void;
  onTileSizeChange: (value: string) => void;
  inputClass: string;
  labelClass: string;
  colors: ReturnType<typeof useSemanticColors>;
  t: (k: string) => string;
}

export function PbrTexturesSection({
  getUrl, staged, busyMap, error, tileSizeM, mode,
  onSelect, onRemove, onTileSizeChange, inputClass, labelClass, colors, t,
}: PbrTexturesSectionProps) {
  const hasStaged = Object.keys(staged).length > 0;
  return (
    <section className="flex flex-col gap-2">
      <span className={labelClass}>{t('textures3d.label')}</span>
      <p className={`text-[10px] ${colors.text.muted} px-0.5`}>{t('textures3d.hint')}</p>

      <div className="flex flex-col gap-2">
        {PBR_MAPS.map((map) => (
          <PbrMapSlot
            key={map}
            map={map}
            url={getUrl(map)}
            stagedFile={staged[map]}
            busy={busyMap === map}
            onSelect={onSelect}
            onRemove={onRemove}
            colors={colors}
            t={t}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1 max-w-[12rem]">
        <span className={labelClass}>{t('textures3d.tileSize')}</span>
        <input
          type="number"
          min={0.05}
          step={0.1}
          className={inputClass}
          value={tileSizeM}
          onChange={(e) => onTileSizeChange(e.target.value)}
        />
      </label>

      {mode === 'create' && hasStaged && (
        <p className={`text-[10px] ${colors.text.muted} px-0.5`}>{t('textures3d.createFirstHint')}</p>
      )}
      {error && <p role="alert" className="text-[10px] text-destructive px-0.5">{error}</p>}
    </section>
  );
}
