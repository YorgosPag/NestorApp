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
 * ADR-653 Φ8: το cache είναι keyed στο **variant key** (`imageFillVariantKey`), όχι
 * σκέτο `assetId` — ώστε δύο χρωματικές εκδοχές του ίδιου υλικού (καφέ vs άσπρη/μαύρη
 * σκακιέρα) να έχουν ξεχωριστά slots. Ο duotone επαναχρωματισμός εφαρμόζεται **μία φορά
 * μετά το decode** (offscreen canvas) — ΠΟΤΕ per-frame (ADR-040). Ο `ImageRenderer`
 * (ADR-651) περνά σκέτο `string` → key=assetId, μηδέν tint → αμετάβλητη συμπεριφορά.
 *
 * @see ./material-image-resolver.ts — assetId → src (ADR-643 Φ2/Φ4)
 * @see ./user-material-image-store.ts — user uploads + version gate (Φ4)
 * @see ./hatch-image-variant-key.ts — variant key SSoT (ADR-653 Φ8)
 * @see ./hatch-image-tint.ts — duotone pass (ADR-653 Φ8)
 * @see docs/centralized-systems/reference/adrs/ADR-643-hatch-image-fill.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-651 Φάση Ε — reused (ΟΧΙ κλωνοποιημένη, N.18) από το `ImageRenderer` για το standalone
 * `ImageEntity` (identity `resolveSrc`: το `url` ΕΙΝΑΙ ήδη το src). Ο προαιρετικός
 * `crossOrigin` (3ο param) θέτει `img.crossOrigin` ΠΡΙΝ το `img.src` ώστε ένα remote asset
 * να ΜΗΝ «μολύνει» (taint) τον καμβά — αλλιώς σπάει το `toDataURL` της raster εκτύπωσης
 * (PrintHost). Default `undefined` ⇒ μηδέν αλλαγή συμπεριφοράς για το υπάρχον hatch fill.
 */

import type { HatchImageTint, HatchProceduralParams } from '../../../types/entities';
import { resolveMaterialImageSrc } from './material-image-resolver';
import { getUserMaterialImageVersion } from './user-material-image-store';
import { applyDuotoneTint } from './hatch-image-tint';
import { renderProceduralTile } from './procedural-tile-render';

type ImageState = 'loading' | 'ready' | 'error';

interface CacheEntry {
  img: CanvasImageSource | null;
  state: ImageState;
}

/**
 * ADR-653 — περιγραφή ανάλυσης: `key` = variant key (SSoT, το κλειδί του cache), `assetId`
 * = πηγή src, `tint` = προαιρετικός duotone (Φ8). `procedural` (Φ9) → το tile ΖΩΓΡΑΦΙΖΕΤΑΙ
 * σύγχρονα (μηδέν δίκτυο/decode)· χρειάζεται και τις διαστάσεις tile (mm) για τον αρμό. Ο
 * `ImageRenderer` (ADR-651) περνά σκέτο `string` → key=assetId, μηδέν tint/procedural.
 */
export interface ImageResolveSpec {
  readonly key: string;
  readonly assetId: string;
  readonly tint?: HatchImageTint;
  readonly procedural?: HatchProceduralParams;
  readonly tileWidthMm?: number;
  readonly tileHeightMm?: number;
}

export class HatchImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  /** Τελευταία γνωστή έκδοση του user-image store (Φ4 lazy error-retry gate). */
  private lastStoreVersion = getUserMaterialImageVersion();

  /**
   * @param onLoad καλείται μετά από κάθε επιτυχή async decode (→ invalidate/redraw).
   * @param resolveSrc `assetId → src (URL)`· default = builtin catalog resolver (Φ2).
   *   Injectable για testability· `null` επιστροφή → fallback στο raw assetId.
   * @param crossOrigin ADR-651 Φάση Ε — τίθεται στο `img.crossOrigin` ΠΡΙΝ το `img.src`.
   *   Default `undefined` ⇒ καμία αλλαγή συμπεριφοράς (υπάρχον hatch fill path).
   */
  constructor(
    private readonly onLoad: () => void,
    private readonly resolveSrc: (assetId: string) => Promise<string | null> = resolveMaterialImageSrc,
    private readonly crossOrigin?: 'anonymous',
  ) {}

  /**
   * Decoded (και προαιρετικά tinted) εικόνα για ένα spec, ή `null` όταν δεν είναι ακόμη
   * έτοιμη (πρώτο miss → ξεκινά async decode). Idempotent: κλήσεις κατά το loading δεν
   * ξαναφορτώνουν. Δέχεται σκέτο `string` (legacy `ImageRenderer` → key=assetId, μηδέν tint)
   * ή `ImageResolveSpec` (ADR-653 Φ8 — variant key + optional tint).
   */
  resolve(spec: string | ImageResolveSpec): CanvasImageSource | null {
    const key = typeof spec === 'string' ? spec : spec.key;
    this.retryStaleErrors();
    const hit = this.entries.get(key);
    if (hit) return hit.img;
    // ADR-653 Φ9 — procedural: ζωγράφισε το tile ΣΥΓΧΡΟΝΑ (μηδέν δίκτυο/decode) → επέστρεψε
    // αμέσως (χωρίς loading flash· ο caller έχει έτοιμο pattern στο ίδιο frame).
    if (typeof spec !== 'string' && spec.procedural) {
      const canvas = renderProceduralTile(spec.procedural, spec.tileWidthMm ?? 1, spec.tileHeightMm ?? 1);
      this.entries.set(key, { img: canvas, state: canvas ? 'ready' : 'error' });
      return canvas;
    }
    this.entries.set(key, { img: null, state: 'loading' });
    void this.load(key, spec);
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

  private async load(key: string, spec: string | ImageResolveSpec): Promise<void> {
    const assetId = typeof spec === 'string' ? spec : spec.assetId;
    const tint = typeof spec === 'string' ? undefined : spec.tint;
    const img = new Image();
    img.decoding = 'async';
    // ADR-651 Φάση Ε — CORS mode ΠΡΙΝ το src (αλλιώς το browser αγνοεί μεταγενέστερη αλλαγή).
    if (this.crossOrigin) img.crossOrigin = this.crossOrigin;
    // Φ2: builtin catalog id → texture URL· άγνωστο id → raw assetId (Φ1/Φ4 fallback).
    img.src = (await this.resolveSrc(assetId)) ?? assetId;
    try {
      await img.decode();
      // ADR-653 Φ8 — duotone επαναχρωματισμός ΜΙΑ φορά μετά το decode (offscreen canvas)·
      // αποτυχία (invalid hex / taint) → ανέγγιχτη εικόνα (graceful).
      const final = tint ? applyDuotoneTint(img, tint) ?? img : img;
      this.entries.set(key, { img: final, state: 'ready' });
      this.onLoad();
    } catch {
      this.entries.set(key, { img: null, state: 'error' });
    }
  }
}
