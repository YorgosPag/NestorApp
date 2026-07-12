/**
 * SSoT — material image resolver (ADR-643 Φ2): `assetId → src (URL)`.
 *
 * ΕΝΑ σημείο που μεταφράζει το `HatchImageFill.assetId` σε πηγή εικόνας. Reuse
 * (μηδέν νέο asset store): ο builtin κατάλογος (`material-image-catalog`) δίνει
 * το `PbrTextureSlug` και ο υπάρχων ADR-413 resolver (`resolveTextureUrl`) το
 * μεταφράζει σε URL — δουλεύει ΚΑΙ σε public mode (`/textures/...`) ΚΑΙ σε storage
 * mode (Firebase), με in-flight de-dup. Η ίδια αλυσίδα που ήδη τρέφει το 2D swatch
 * (`material-thumbnail-resolver`) και το 3D render appearance → big-player SSoT
 * (μία texture library, αναφορά από 2D + 3D).
 *
 * Άγνωστο `assetId` (όχι catalog id) → `null`, ώστε ο caller (`HatchImageCache`)
 * να κάνει fallback στο raw `assetId` (backward-compatible με Φ1 dev-mode· και με
 * τα μελλοντικά Φ4 user uploads που θα φέρνουν δικό τους resolvable src).
 *
 * @see ../../../data/material-image-catalog.ts — builtin catalog (assetId → slug)
 * @see ../../../bim-3d/materials/texture-source.ts — resolveTextureUrl (slug → URL)
 * @see ./hatch-image-cache.ts — ο consumer (decode + live cache)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md §4
 */

import { getMaterialImage } from '../../../data/material-image-catalog';
import { resolveTextureUrl } from '../../../bim-3d/materials/texture-source';

/**
 * URL της εικόνας υλικού για ένα `assetId`, ή `null` όταν το id δεν ανήκει στον
 * builtin κατάλογο (→ ο caller χρησιμοποιεί το raw assetId ως src).
 */
export function resolveMaterialImageSrc(assetId: string): Promise<string | null> {
  const def = getMaterialImage(assetId);
  if (!def) return Promise.resolve(null);
  return resolveTextureUrl(def.textureSlug, 'albedo');
}
