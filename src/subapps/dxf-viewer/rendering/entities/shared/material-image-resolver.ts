/**
 * SSoT — material image resolver (ADR-643 Φ2 + Φ4): `assetId → src (URL)`.
 *
 * ΕΝΑ σημείο που μεταφράζει το `HatchImageFill.assetId` σε πηγή εικόνας, με σειρά
 * προτεραιότητας (Φ4 πρόσθεσε το user-asset σκέλος ΠΡΙΝ τον catalog):
 *   1. **User upload** — `bmat_*` id με ανεβασμένη εικόνα → το `thumbnailUrl` του
 *      από τον always-on `user-material-image-store` (sync, μηδέν Firestore στο
 *      render path). Big-player μοντέλο (Revit/C4D/Figma: μία shared library).
 *   2. **Builtin catalog** — `matimg-*` id → `PbrTextureSlug` → ADR-413
 *      `resolveTextureUrl` (public `/textures/...` Ή Firebase storage, in-flight de-dup).
 *   3. **Άγνωστο** → `null`, ώστε ο caller (`HatchImageCache`) να κάνει fallback
 *      στο raw `assetId` (backward-compatible με Φ1 dev-mode).
 *
 * Η ίδια texture library τρέφει και το 2D swatch (`material-thumbnail-resolver`)
 * και το 3D render appearance → big-player SSoT (μία library, αναφορά από 2D + 3D).
 *
 * @see ./user-material-image-store.ts — user uploads (assetId → thumbnailUrl), Φ4
 * @see ../../../data/material-image-catalog.ts — builtin catalog (assetId → slug)
 * @see ../../../bim-3d/materials/texture-source.ts — resolveTextureUrl (slug → URL)
 * @see ./hatch-image-cache.ts — ο consumer (decode + live cache)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4
 */

import { getMaterialImage } from '../../../data/material-image-catalog';
import { resolveTextureUrl } from '../../../bim-3d/materials/texture-source';
import { getUserMaterialImageUrl } from './user-material-image-store';

/**
 * URL της εικόνας υλικού για ένα `assetId`: user upload → builtin catalog →
 * `null` (→ ο caller χρησιμοποιεί το raw assetId ως src).
 */
export function resolveMaterialImageSrc(assetId: string): Promise<string | null> {
  const userUrl = getUserMaterialImageUrl(assetId);
  if (userUrl) return Promise.resolve(userUrl);
  const def = getMaterialImage(assetId);
  if (!def) return Promise.resolve(null);
  return resolveTextureUrl(def.textureSlug, 'albedo');
}
