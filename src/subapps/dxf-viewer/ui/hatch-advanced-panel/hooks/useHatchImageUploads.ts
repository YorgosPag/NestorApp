'use client';

/**
 * ADR-643 Φ4 — hook που τροφοδοτεί τον `MaterialImagePicker` με τα user uploads
 * και εκθέτει `upload(file)`.
 *
 * SSoT reuse: διαβάζει companyId/userId από το ίδιο auth context με τον
 * `UserMaterialRegistryHost` (`useCompanyId` / `useAuth`) και τη λίστα υλικών από
 * τον υπάρχοντα `useMaterialLibrary` — τα uploads = τα `bim_materials` docs με
 * ανεβασμένο `thumbnailUrl`. Το `upload()` καλεί τον thin
 * `uploadHatchImageMaterial` (validate → save → upload → patch → register).
 *
 * Τα σφάλματα επιστρέφονται ως i18n key suffix (`format`/`size`/`failed`/`notReady`)
 * κάτω από `hatchImageFill.upload.errors` — μηδέν hardcoded string (N.11).
 *
 * @see ../../panels/materials/hooks/useMaterialLibrary.ts — η reused live subscription
 * @see ../../../bim/services/hatch-image-upload.service.ts — ο thin orchestrator
 */

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useMaterialLibrary } from '../../panels/materials/hooks/useMaterialLibrary';
import { uploadHatchImageMaterial } from '../../../bim/services/hatch-image-upload.service';
import { deleteHatchImageMaterial } from '../../../bim/services/hatch-image-delete.service';
import { MaterialThumbnailUploadError } from '../../../bim/services/bim-material-thumbnail-upload.service';

export interface HatchImageUploadEntry {
  readonly assetId: string;
  readonly url: string;
  readonly label: string;
}

export interface UseHatchImageUploadsResult {
  /** User-uploaded image materials (library docs carrying a `thumbnailUrl`). */
  readonly uploads: readonly HatchImageUploadEntry[];
  /** Uploads a file; returns the new `assetId` (to select) or `null` on failure. */
  readonly upload: (file: File) => Promise<string | null>;
  readonly uploading: boolean;
  /** Removes a user upload (Firestore doc + Storage); returns `true` on success. */
  readonly remove: (assetId: string) => Promise<boolean>;
  /** assetId currently being removed (drives per-swatch loading), or `null`. */
  readonly removingId: string | null;
  /** i18n key suffix under `hatchImageFill.upload.errors`, or `null`. */
  readonly errorKey: string | null;
}

/** Map an upload failure to its `hatchImageFill.upload.errors` key suffix. */
function errorCodeToKey(err: unknown): string {
  if (err instanceof MaterialThumbnailUploadError && (err.code === 'format' || err.code === 'size')) {
    return err.code;
  }
  return 'failed';
}

export function useHatchImageUploads(projectId?: string): UseHatchImageUploadsResult {
  const { t } = useTranslation('dxf-viewer-shell');
  const { user } = useAuth();
  const companyId = useCompanyId()?.companyId;
  const userId = user?.uid;
  const { materials } = useMaterialLibrary({ companyId, userId, projectId });
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const uploads = useMemo<readonly HatchImageUploadEntry[]>(
    () =>
      materials
        .filter((m) => !!m.thumbnailUrl && !m.builtin)
        .map((m) => ({ assetId: m.id, url: m.thumbnailUrl as string, label: m.nameEl || m.nameEn })),
    [materials],
  );

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!companyId || !userId) {
        setErrorKey('notReady');
        return null;
      }
      setUploading(true);
      setErrorKey(null);
      try {
        const { assetId } = await uploadHatchImageMaterial({
          file,
          companyId,
          userId,
          projectId,
          fallbackName: t('hatchImageFill.upload.defaultName'),
        });
        return assetId;
      } catch (err) {
        setErrorKey(errorCodeToKey(err));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [companyId, userId, projectId, t],
  );

  const remove = useCallback(
    async (assetId: string): Promise<boolean> => {
      if (!companyId || !userId) {
        setErrorKey('notReady');
        return false;
      }
      const entry = uploads.find((u) => u.assetId === assetId);
      setRemovingId(assetId);
      setErrorKey(null);
      try {
        await deleteHatchImageMaterial({
          assetId,
          companyId,
          userId,
          projectId,
          thumbnailUrl: entry?.url,
        });
        return true;
      } catch {
        setErrorKey('deleteFailed');
        return false;
      } finally {
        setRemovingId(null);
      }
    },
    [companyId, userId, projectId, uploads],
  );

  return { uploads, upload, uploading, remove, removingId, errorKey };
}
