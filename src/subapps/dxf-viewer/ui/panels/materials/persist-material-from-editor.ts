/**
 * persistMaterialFromEditor — SSoT save+upload orchestration for the Material
 * Editor dialog (ADR-687 Φ1). Extracted from `MaterialsLibraryPanel` so BOTH the
 * left «Υλικά» library panel AND the 3D «＋ Νέο Υλικό» bar drive the exact same
 * create→upload-assets→patch flow (zero sibling clone — N.18 / ADR-584).
 *
 * Create is a Revit-grade seamless flow: create the doc first (enterprise id) →
 * upload the staged appearance thumbnail + 3D PBR maps keyed by the new id → patch
 * their URLs. Race-safe: an upload failure leaves the material saved (retry from
 * edit); the lifecycle owner (the caller) holds the service + new id.
 *
 * @see ./MaterialEditorDialog.tsx — the dialog that stages the payload + assets
 * @see docs/centralized-systems/reference/adrs/ADR-687-material-editor-visual-appearance.md
 */

import { uploadMaterialThumbnail } from '../../../bim/services/bim-material-thumbnail-upload.service';
import { uploadPendingPbrMaps } from './hooks/useMaterialPbrTextureUpload';
import type { PendingPbrUpload } from './MaterialEditorDialog';
import type {
  BimMaterial,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';

/** The library operations the persist flow needs — supplied by `useMaterialLibrary`. */
export interface MaterialEditorSaveDeps {
  readonly companyId: string | undefined;
  readonly save: (input: SaveBimMaterialInput) => Promise<BimMaterial>;
  readonly update: (id: string, patch: UpdateBimMaterialPatch) => Promise<void>;
}

export async function persistMaterialFromEditor(
  deps: MaterialEditorSaveDeps,
  payload: SaveBimMaterialInput | UpdateBimMaterialPatch,
  mode: 'create' | 'edit',
  editTargetId: string | undefined,
  pendingThumbnail?: File | null,
  pendingPbr?: PendingPbrUpload | null,
): Promise<void> {
  const { companyId, save, update } = deps;

  if (mode === 'create') {
    const saved = await save(payload as SaveBimMaterialInput);
    if (pendingThumbnail && companyId) {
      try {
        const { downloadUrl } = await uploadMaterialThumbnail({
          file: pendingThumbnail, companyId, materialId: saved.id,
        });
        await update(saved.id, { thumbnailUrl: downloadUrl });
      } catch {
        // Graceful degradation — material saved without thumbnail; retry in edit.
      }
    }
    if (pendingPbr && companyId && Object.keys(pendingPbr.maps).length > 0) {
      try {
        const pbrTextures = await uploadPendingPbrMaps(
          pendingPbr.maps, companyId, saved.id, pendingPbr.tileSizeM,
        );
        if (pbrTextures) await update(saved.id, { pbrTextures });
      } catch {
        // Graceful degradation — material saved without 3D textures; retry in edit.
      }
    }
    return;
  }

  if (editTargetId) {
    await update(editTargetId, payload as UpdateBimMaterialPatch);
  }
}
