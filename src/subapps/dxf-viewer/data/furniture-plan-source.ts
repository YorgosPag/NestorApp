/**
 * ADR-654 — Furniture plan (entourage) asset source.
 *
 * Το ΜΟΝΟ module που ξέρει ΠΟΥ ζουν φυσικά τα raster sprites των επίπλων κάτοψης.
 * Ο μηχανισμός (public ↔ storage switch + in-flight de-dup) είναι ο ΚΟΙΝΟΣ
 * `createAssetSourceResolver` — εδώ ορίζεται μόνο η ταυτότητα αυτής της βιβλιοθήκης:
 * roots, path convention (`<id>.webp` / `<id>.thumb.webp`) και env flag.
 *
 *   - 'public'  → `public/furniture-2d/<id>.webp` (dev — καμία δικτύωση)
 *   - 'storage' → Firebase Storage `furniture-2d-library/<id>.webp` (production)
 *
 * Τα sprites παράγονται από το `scripts/build-furniture-plan-assets.js` και ΔΕΝ
 * μπαίνουν στο git (ίδια σύμβαση με το `public/textures/*.jpg` του ADR-413).
 *
 * @see ../systems/assets/create-asset-source-resolver.ts — ο κοινός μηχανισμός
 * @see ./furniture-plan-catalog.ts — ids + κατηγορίες + aspect
 * @see docs/centralized-systems/reference/adrs/ADR-654-furniture-plan-entourage.md
 */

import {
  createAssetSourceResolver,
  type AssetSourceMode,
} from '../systems/assets/create-asset-source-resolver';

/** Πού σερβίρονται τα sprites των επίπλων. */
export type FurniturePlanSourceMode = AssetSourceMode;

/** Ποια εκδοχή του asset: πλήρες sprite (καμβάς) ή thumbnail (παλέτα). */
export type FurniturePlanAssetVariant = 'full' | 'thumb';

/** Root folder στο Firebase Storage (storage mode). */
export const FURNITURE_PLAN_LIBRARY_ROOT = 'furniture-2d-library';

/** Public-served root για τα bundled sprites (public mode). */
export const FURNITURE_PLAN_PUBLIC_ROOT = '/furniture-2d';

const _envMode = process.env.NEXT_PUBLIC_FURNITURE_PLAN_SOURCE as
  | FurniturePlanSourceMode
  | undefined;

const resolver = createAssetSourceResolver({
  publicRoot: FURNITURE_PLAN_PUBLIC_ROOT,
  storageRoot: FURNITURE_PLAN_LIBRARY_ROOT,
  initialMode: _envMode ?? (process.env.NODE_ENV === 'production' ? 'storage' : 'public'),
});

/** Αλλάζει το source mode για ΟΛΕΣ τις επόμενες αναλύσεις. */
export function setFurniturePlanSourceMode(mode: FurniturePlanSourceMode): void {
  resolver.setMode(mode);
}

/** Τρέχον source mode (read-only accessor). */
export function getFurniturePlanSourceMode(): FurniturePlanSourceMode {
  return resolver.getMode();
}

/** Relative object path για ένα sprite (κοινό και στα δύο modes). */
function spritePath(id: string, variant: FurniturePlanAssetVariant): string {
  return variant === 'thumb' ? `${id}.thumb.webp` : `${id}.webp`;
}

/**
 * Κατεβατό URL για ένα sprite. `null` όταν δεν αναλύεται (storage error) ⇒ ο καλών
 * κάνει graceful degrade (κενή κάρτα) αντί να σκάσει.
 */
export function resolveFurniturePlanUrl(
  id: string,
  variant: FurniturePlanAssetVariant = 'full',
): Promise<string | null> {
  return resolver.resolveUrl(spritePath(id, variant));
}
