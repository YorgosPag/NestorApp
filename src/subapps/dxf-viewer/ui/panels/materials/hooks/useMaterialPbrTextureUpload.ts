'use client';

/**
 * ADR-413 §2D Phase 3 — staged/immediate upload lifecycle for the 4 PBR texture
 * maps (albedo/normal/roughness/ao) of a material's appearance.
 *
 * Mirrors the Phase-2 thumbnail flow but for FOUR channels:
 *   - edit mode → upload immediately (materialId exists) and set the form URL;
 *   - create mode → STAGE the files; the panel uploads them post-save (once the
 *     new materialId exists) via `uploadPendingPbrMaps`.
 *
 * Extracted into a hook so `MaterialEditorDialog` stays ≤500 lines (Google SRP).
 *
 * @see ../../../../bim/services/bim-material-texture-upload.service.ts
 * @see ../MaterialPbrTexturesSection.tsx — the presentational section
 */

import { useState, useCallback } from 'react';
import {
  uploadMaterialTextureMap,
  validateMaterialTextureFile,
  MaterialTextureUploadError,
  type MaterialTextureUploadErrorCode,
} from '../../../../bim/services/bim-material-texture-upload.service';
import type { BimMaterialTextureMapName } from '@/services/upload/utils/storage-path';
import type { PbrMaterialTextures } from '../../../../bim/types/bim-material-types';

/** Ordered list of PBR map channels rendered in the section. */
export const PBR_MAPS: readonly BimMaterialTextureMapName[] = ['albedo', 'normal', 'roughness', 'ao'];

/** Staged (create-mode) files keyed by map channel. */
export type StagedPbrMaps = Partial<Record<BimMaterialTextureMapName, File>>;

/** Form-side URL setter: maps a channel → its `<map>Url` form field. */
export type SetMapUrl = (map: BimMaterialTextureMapName, url: string) => void;

function textureErrorKey(err: unknown): string {
  const code: MaterialTextureUploadErrorCode | 'uploadFailed' =
    err instanceof MaterialTextureUploadError ? err.code : 'uploadFailed';
  switch (code) {
    case 'format': return 'textures3d.errors.format';
    case 'size': return 'textures3d.errors.size';
    default: return 'textures3d.errors.uploadFailed';
  }
}

export interface UseMaterialPbrTextureUploadArgs {
  readonly mode: 'create' | 'edit';
  readonly materialId: string | undefined;
  readonly companyId: string | undefined;
  readonly setMapUrl: SetMapUrl;
  readonly t: (k: string) => string;
}

export interface UseMaterialPbrTextureUploadResult {
  readonly staged: StagedPbrMaps;
  readonly busyMap: BimMaterialTextureMapName | null;
  readonly error: string | null;
  readonly onSelect: (map: BimMaterialTextureMapName, file: File) => void;
  readonly onRemove: (map: BimMaterialTextureMapName) => void;
  readonly reset: () => void;
}

export function useMaterialPbrTextureUpload({
  mode,
  materialId,
  companyId,
  setMapUrl,
  t,
}: UseMaterialPbrTextureUploadArgs): UseMaterialPbrTextureUploadResult {
  const [staged, setStaged] = useState<StagedPbrMaps>({});
  const [busyMap, setBusyMap] = useState<BimMaterialTextureMapName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSelect = useCallback(
    async (map: BimMaterialTextureMapName, file: File) => {
      setError(null);
      try {
        validateMaterialTextureFile(file);
      } catch (e) {
        setError(t(textureErrorKey(e)));
        return;
      }
      if (mode === 'edit' && materialId && companyId) {
        setBusyMap(map);
        try {
          const { downloadUrl } = await uploadMaterialTextureMap({ file, companyId, materialId, map });
          setMapUrl(map, downloadUrl);
          setStaged((prev) => dropKey(prev, map));
        } catch (e) {
          setError(t(textureErrorKey(e)));
        } finally {
          setBusyMap(null);
        }
      } else {
        setStaged((prev) => ({ ...prev, [map]: file }));
      }
    },
    [mode, materialId, companyId, setMapUrl, t],
  );

  const onRemove = useCallback(
    (map: BimMaterialTextureMapName) => {
      setMapUrl(map, '');
      setStaged((prev) => dropKey(prev, map));
      setError(null);
    },
    [setMapUrl],
  );

  const reset = useCallback(() => {
    setStaged({});
    setBusyMap(null);
    setError(null);
  }, []);

  return { staged, busyMap, error, onSelect, onRemove, reset };
}

function dropKey(maps: StagedPbrMaps, map: BimMaterialTextureMapName): StagedPbrMaps {
  const next = { ...maps };
  delete next[map];
  return next;
}

/**
 * Upload the staged (create-mode) maps once the new materialId exists, returning
 * a Firestore-ready `PbrMaterialTextures` (or null if no albedo was staged).
 * Called by the panel right after the material doc is created.
 */
export async function uploadPendingPbrMaps(
  staged: StagedPbrMaps,
  companyId: string,
  materialId: string,
  tileSizeM: number,
): Promise<PbrMaterialTextures | null> {
  const urls: Record<BimMaterialTextureMapName, string | null> = {
    albedo: null, normal: null, roughness: null, ao: null,
  };
  for (const map of PBR_MAPS) {
    const file = staged[map];
    if (!file) continue;
    const { downloadUrl } = await uploadMaterialTextureMap({ file, companyId, materialId, map });
    urls[map] = downloadUrl;
  }
  if (!urls.albedo) return null; // albedo is mandatory for a textured material
  return {
    albedoUrl: urls.albedo,
    normalUrl: urls.normal,
    roughnessUrl: urls.roughness,
    aoUrl: urls.ao,
    tileSizeM: tileSizeM > 0 ? tileSizeM : 1,
    // ADR-678 Βήμα 3 — χειροκίνητο editor upload: καμία content-hash dedup (ο χρήστης
    // ονομάζει/επιλέγει ρητά το υλικό). Το auto import round-trip γεμίζει το hash.
    albedoHash: null,
  };
}
