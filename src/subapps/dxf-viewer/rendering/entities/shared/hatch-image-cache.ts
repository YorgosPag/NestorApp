/**
 * SSoT — hatch image cache (ADR-643 Φ1).
 *
 * Live, fire-and-forget cache decoded εικόνων υλικού για το `fillType:'image'` hatch.
 * Ο (synchronous) `HatchRenderer.render()` καλεί `resolve(assetId)`:
 *   - cache hit  → επιστρέφει τη decoded εικόνα (ή `null` αν loading/error)·
 *   - πρώτο miss → επιστρέφει `null` ΚΑΙ ξεκινά async decode που, όταν τελειώσει,
 *     σκανδαλίζει redraw μέσω του `onLoad` callback.
 *
 * ADR-040: ο renderer ΔΕΝ subscribe-άρει σε store· το asset load «σπρώχνει» ένα
 * dirty-frame (`markAllCanvasDirty`) — ΠΟΤΕ blocking, ΠΟΤΕ per-frame reload.
 *
 * Φ2: το `assetId` περνά από τον `material-image-resolver` (builtin catalog →
 * texture URL, ADR-413). Άγνωστο id → fallback στο raw `assetId` ως src
 * (backward-compatible με Φ1 dev-mode / Φ4 user uploads).
 *
 * Φ4: όταν αλλάζει ο `user-material-image-store` (π.χ. reopened doc: το hatch
 * ζωγραφίστηκε ΠΡΙΝ φορτώσει η βιβλιοθήκη → cache-άρισε `error`), ένα lazy
 * version-check στο `resolve()` πετά τα `error` entries ώστε να ξανα-resolve-άρουν
 * με το πλέον γνωστό URL — leak-free (μηδέν per-cache subscription).
 *
 * @see ./material-image-resolver.ts — assetId → src (ADR-643 Φ2/Φ4)
 * @see ./user-material-image-store.ts — user uploads + version gate (Φ4)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import { resolveMaterialImageSrc } from './material-image-resolver';
import { getUserMaterialImageVersion } from './user-material-image-store';

type ImageState = 'loading' | 'ready' | 'error';

interface CacheEntry {
  img: CanvasImageSource | null;
  state: ImageState;
}

export class HatchImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  /** Τελευταία γνωστή έκδοση του user-image store (Φ4 lazy error-retry gate). */
  private lastStoreVersion = getUserMaterialImageVersion();

  /**
   * @param onLoad καλείται μετά από κάθε επιτυχή async decode (→ invalidate/redraw).
   * @param resolveSrc `assetId → src (URL)`· default = builtin catalog resolver (Φ2).
   *   Injectable για testability· `null` επιστροφή → fallback στο raw assetId.
   */
  constructor(
    private readonly onLoad: () => void,
    private readonly resolveSrc: (assetId: string) => Promise<string | null> = resolveMaterialImageSrc,
  ) {}

  /**
   * Decoded εικόνα για το `assetId`, ή `null` όταν δεν είναι ακόμη έτοιμη (πρώτο miss
   * → ξεκινά async decode). Idempotent: κλήσεις κατά το loading δεν ξαναφορτώνουν.
   */
  resolve(assetId: string): CanvasImageSource | null {
    this.retryStaleErrors();
    const hit = this.entries.get(assetId);
    if (hit) return hit.img;
    this.entries.set(assetId, { img: null, state: 'loading' });
    void this.load(assetId);
    return null;
  }

  /**
   * Φ4: αν άλλαξε ο user-image store από το τελευταίο frame, πέτα τα `error`
   * entries ώστε ένα πλέον-γνωστό URL (π.χ. μετά τη φόρτωση της βιβλιοθήκης) να
   * ξανα-resolve-άρει στο επόμενο `resolve()`. Cheap: ένας ακέραιος έλεγχος/frame.
   */
  private retryStaleErrors(): void {
    const v = getUserMaterialImageVersion();
    if (v === this.lastStoreVersion) return;
    this.lastStoreVersion = v;
    for (const [id, entry] of this.entries) {
      if (entry.state === 'error') this.entries.delete(id);
    }
  }

  private async load(assetId: string): Promise<void> {
    const img = new Image();
    img.decoding = 'async';
    // Φ2: builtin catalog id → texture URL· άγνωστο id → raw assetId (Φ1/Φ4 fallback).
    img.src = (await this.resolveSrc(assetId)) ?? assetId;
    try {
      await img.decode();
      this.entries.set(assetId, { img, state: 'ready' });
      this.onLoad();
    } catch {
      this.entries.set(assetId, { img: null, state: 'error' });
    }
  }
}
