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
import { applyDuotoneTint, toGrayscaleImage } from './hatch-image-tint';
import { renderProceduralTile } from './procedural-tile-render';
import { createExternalStore } from '../../../stores/createExternalStore';

type ImageState = 'loading' | 'ready' | 'error';

// ─── Asset-ready signal (ADR-654) ─────────────────────────────────────────────
//
// ADR-040 Φάση D: το entity layer σερβίρεται από τον `DxfBitmapCache`, που ξαναχτίζει
// ΜΟΝΟ όταν αλλάξει το cache key (scene ref / transform / viewport / DPR / settings).
// Μια εικόνα που φτάνει ασύγχρονα ΔΕΝ αλλάζει τίποτα από αυτά: το `markAllCanvasDirty`
// του `onLoad` προκαλεί μεν frame, αλλά ο cache είναι HIT → γίνεται blit το ΠΑΛΙΟ bitmap
// (με το placeholder) → το sprite «θέλει ανανέωση» για να φανεί. Το decode είναι
// one-time event (ακριβώς όπως τα CAD fonts, ADR-530) → ένα version bump + ένα
// `bitmapCache.invalidate()` στον subscriber είναι ADR-040-συμβατό (ΟΧΙ per-frame).
//
// SSoT: ΕΝΑ σήμα για ΚΑΘΕ decoded εικόνα — hatch image-fill ΚΑΙ standalone ImageEntity.
const imageAssetReadyStore = createExternalStore<number>(0);

/** Καλείται μετά από κάθε επιτυχές decode — «μια εικόνα προσγειώθηκε». */
function bumpImageAssetReady(): void {
  imageAssetReadyStore.set(imageAssetReadyStore.get() + 1);
}

/** Subscribe στο «μια εικόνα προσγειώθηκε» σήμα (→ invalidate bitmap cache + redraw). */
export function subscribeImageAssetReady(listener: () => void): () => void {
  return imageAssetReadyStore.subscribe(listener);
}

/** Μονοτονικός μετρητής — αυξάνει σε κάθε νέα decoded εικόνα. */
export function getImageAssetReadyVersion(): number {
  return imageAssetReadyStore.get();
}

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
  /**
   * ADR-909 Β2.6 — η εικόνα ζητείται **σε κλίμακα του γκρι** (print pass `monochrome`/`grayscale`). Το
   * `key` οφείλει να τη διακρίνει από την έγχρωμη (βλ. `shared-image-caches`): είναι άλλη εικόνα.
   */
  readonly grayscale?: boolean;
}

/**
 * Η εικόνα όπως **ζητήθηκε**: γκρι όταν το spec το θέλει. `null` ⇒ η μετατροπή απέτυχε (taint) — ο caller
 * τη μετρά ως **αποτυχία**, ποτέ ως «δώσε την έγχρωμη» (διαρροή χρώματος σε ασπρόμαυρη εκτύπωση).
 */
function inRequestedTone(img: CanvasImageSource, spec: string | ImageResolveSpec): CanvasImageSource | null {
  return typeof spec !== 'string' && spec.grayscale ? toGrayscaleImage(img) : img;
}

export class HatchImageCache {
  private readonly entries = new Map<string, CacheEntry>();
  /** Φορτώσεις σε εξέλιξη — ό,τι περιμένει το {@link preload} (ADR-909 Β2.6). */
  private readonly pending = new Map<string, Promise<void>>();
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
      const tile = renderProceduralTile(spec.procedural, spec.tileWidthMm ?? 1, spec.tileHeightMm ?? 1);
      const canvas = tile ? inRequestedTone(tile, spec) : null;
      this.entries.set(key, { img: canvas, state: canvas ? 'ready' : 'error' });
      return canvas;
    }
    this.entries.set(key, { img: null, state: 'loading' });
    // Η ανάλυση του src (`resolveSrc`) τρέχει ΕΞΩ από το try του `load` — αν πετάξει, η εγγραφή δεν
    // επιτρέπεται να μείνει αιώνια `loading`: γίνεται `error`, και το `preload` απαντά `false`.
    const loading = this.load(key, spec)
      .catch(() => { this.entries.set(key, { img: null, state: 'error' }); })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, loading);
    return null;
  }

  /**
   * **Φέρε την εικόνα ΠΡΙΝ τη χρειαστεί ένας σύγχρονος αποδότης** (ADR-909 Β2.6) — `true` όταν είναι έτοιμη.
   *
   * 🔴 Μετρημένο ζωντανά (2026-10-09): η λήψη εκτός οθόνης ζωγραφίζει **μία φορά, σύγχρονα**. Το `resolve()`
   * ξεκινούσε τη φόρτωση και επέστρεφε `null`· η εικόνα έφτανε 30–55 ms **μετά** το τελευταίο pixel, και
   * στη θέση της έμενε επίπεδο γκρι — σε PDF και σε δημόσια κάτοψη, χωρίς καμία ένδειξη. Το «έλα ξανά στο
   * επόμενο frame» δεν υπάρχει εκεί: όποιος ζωγραφίζει μία φορά **περιμένει πρώτα εδώ**.
   *
   * Μια παλιά αποτυχία **ξαναδοκιμάζεται**: ο άνθρωπος ζητά νέα εικόνα, και το δίκτυο μπορεί να γύρισε.
   */
  async preload(spec: string | ImageResolveSpec): Promise<boolean> {
    const key = typeof spec === 'string' ? spec : spec.key;
    if (this.entries.get(key)?.state === 'error') this.entries.delete(key);
    this.resolve(spec);
    await this.pending.get(key);
    return this.isReady(key);
  }

  /** Είναι αυτή η εικόνα **έτοιμη να ζωγραφιστεί** τώρα, σύγχρονα; */
  isReady(key: string): boolean {
    return this.entries.get(key)?.state === 'ready';
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
      const tinted = tint ? applyDuotoneTint(img, tint) ?? img : img;
      const final = inRequestedTone(tinted, spec);
      if (final === null) {
        this.entries.set(key, { img: null, state: 'error' });
        return;
      }
      this.entries.set(key, { img: final, state: 'ready' });
      this.onLoad();
      // ADR-654 — το `onLoad` (markAllCanvasDirty) ζητά ΝΕΟ frame· αυτό εδώ ακυρώνει το
      // (stale) bitmap του entity layer, αλλιώς το frame ξανα-blit-άρει το placeholder.
      bumpImageAssetReady();
    } catch {
      this.entries.set(key, { img: null, state: 'error' });
    }
  }
}
