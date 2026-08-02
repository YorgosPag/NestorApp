/**
 * DXF BITMAP CACHE — ANCHORED RASTER GEOMETRY (ADR-726 Φ3 / ADR-040 Phase XXII.B part 2)
 *
 * Pure geometry + policy for serving the cached entity raster at a transform that
 * DIFFERS from the one it was rasterised at ("anchor"). No DOM, no stores, no time.
 *
 * WHY THIS EXISTS (measured 2026-07-29, ADR-726 §6 Φ3):
 * `transform.scale/offsetX/offsetY` used to live INSIDE the bitmap cache key, so every
 * pan/zoom frame was a guaranteed MISS → a full 2.996-entity offscreen rebuild. Measured
 * cost: `frame:dxf-canvas` **min 32,7ms** — a FLOOR on every single frame, 98,3% of the
 * frame budget, ~12 FPS.
 *
 * THE FIX: the transform leaves the key. Both transforms are pure scale+translation
 * (no rotation), so the raster→screen map is exactly `screen = k·raster + b`, i.e. ONE
 * `drawImage(src, dx,dy,dw,dh)` with `k = sC/sA`.
 *
 * 🔴 **`b` IS MEASURED, NOT DERIVED — AND THAT IS THE WHOLE POINT.**
 * The first version of this module re-wrote the world→screen formula by hand, copying it
 * from a comment in `dxf-viewport-culling` that says `screen.y = world.y·scale + offsetY`.
 * The REAL convention (`CoordinateTransforms.worldToScreen`) is
 * `screenY = (viewport.height − top) − world.y·scale − **offsetY**` — Y inverted, offsetY
 * SUBTRACTED, and margins in both axes. Result: the raster panned the WRONG WAY vertically,
 * the live selection overlay separated from its own baked copy («a second ball»), and the
 * coverage test failed every frame so the rebuild never actually stopped. **The unit test
 * did not catch it: it had copied the same wrong formula into its own assertion.**
 *
 * So `b` is now obtained by asking the SSoT where ONE probe world point lands — once inside
 * the raster (anchor transform + overscanned viewport) and once on the live canvas. One
 * point plus `k` determines the map completely. Margins, Y-inversion and any FUTURE change
 * to the convention are inherited automatically, because nothing here restates them.
 *
 * Prior art: Google Maps / Figma / every software renderer — *project the raster during
 * the gesture, re-rasterise at rest*. Zero GPU (the target machine has none).
 *
 * ⚠️ ADR-040 cardinal rule #3 still holds: this REMOVES inputs from the cache key, it
 * never adds any. Hover/selection/grip state must stay out.
 *
 * @module canvas-v2/dxf-canvas/dxf-bitmap-cache-anchor
 * @see canvas-v2/dxf-canvas/dxf-bitmap-cache — the sole consumer
 * @see ADR-040 §Phase XXII.B — «CSS-transform live-zoom + idle re-raster (Figma pattern)»
 * @see ADR-726 §6 Φ3 — the measurement that identified the cache as the sole cost
 */

import { DXF_TIMING } from '../../config/dxf-timing';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';

/** The scale/offset triple a raster was rasterised at (rotation is never used here). */
export type AnchorTransform = Pick<ViewTransform, 'scale' | 'offsetX' | 'offsetY'>;

/**
 * The same world point seen twice: where the offscreen pass put it INSIDE the raster, and
 * where it belongs on the visible canvas right now. Both in CSS px, both produced by
 * `CoordinateTransforms.worldToScreen` — never by re-derived algebra.
 */
export interface AnchoredProbe {
  /** Position inside the raster, in the raster's own CSS coordinates. */
  raster: Point2D;
  /** Position on the visible canvas for the live transform, in CSS px. */
  screen: Point2D;
}

/**
 * The world point used to measure the offset. Any point works — the map is affine and `k`
 * is known independently — so the origin is chosen for readability. Exported so tests probe
 * with exactly the same point the cache does.
 */
export const ANCHOR_PROBE_WORLD_POINT: Point2D = { x: 0, y: 0 };

/** `drawImage` destination rect, in DEVICE (backing-store) pixels. */
export interface AnchoredBlitRect {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Quiet period after the last transform change before the raster is rebuilt at the
 * live transform. Re-rasterising at rest restores exact pixels AND re-centres the
 * overscan margin, which is what gives the NEXT gesture its free budget again.
 */
export const IDLE_RERASTER_MS = DXF_TIMING.gesture.RASTER_IDLE;

/**
 * Overscan margin (CSS px per side). Bigger = fewer forced rebuilds while panning but
 * a more expensive rebuild (more entities survive culling) and more memory.
 * Amortised cost ∝ (W+2M)(H+2M)/M, so the extremes are both bad; this band is the
 * practical middle for viewports between a sidebar-squeezed panel and a 4K canvas.
 */
const OVERSCAN_FRACTION = 0.2;
const OVERSCAN_MIN_PX = 96;
const OVERSCAN_MAX_PX = 256;

/** Sub-device-pixel slack: rounding must never be read as "the raster fell short". */
const COVERAGE_EPSILON_PX = 0.5;

/** Magnification floor on a dpr=1 display — some blur is tolerable for ~120ms. */
const MIN_MAGNIFICATION_BUDGET = 1.25;

/**
 * Πόσο **πάνω από το όριο ηρεμίας** ανέχεται η ΧΕΙΡΟΝΟΜΙΑ (ADR-743 Φ1).
 *
 * Παράγωγο, όχι δεύτερος αριθμός: η χειρονομία και η ηρεμία απαντούν διαφορετικό ερώτημα
 * («πάτωμα ενόσω κινείται» vs «τελειότητα όταν σταματήσει»), αλλά η **μονάδα** είναι η ίδια, άρα
 * η μία τιμή προκύπτει από την άλλη. Αλλαγή στο `MIN_MAGNIFICATION_BUDGET` σέρνει και τις δύο.
 *
 * `2` σε dpr=1 ⇒ ανώτατο `k` = **2,5**, δηλαδή ~**5 εγκοπές** ροδέλας (`WHEEL_ZOOM_PER_NOTCH`
 * = 1,20) πριν επιβληθεί ανακατασκευή. Η ίδια αρχή που εκμεταλλεύεται το dynamic resolution
 * scaling των παιχνιδιών: **η κίνηση μειώνει την αντιληπτή ανάλυση**, άρα το θόλωμα κοστίζει
 * λιγότερο όσο η εικόνα ταξιδεύει από ό,τι όταν στέκεται.
 */
const GESTURE_MAGNIFICATION_SLACK = 2;

/** Overscan margin in CSS px for one side of the viewport. */
export function computeOverscanPx(viewport: Viewport): number {
  const shortSide = Math.min(viewport.width, viewport.height);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return OVERSCAN_MIN_PX;
  const raw = Math.round(shortSide * OVERSCAN_FRACTION);
  return Math.min(OVERSCAN_MAX_PX, Math.max(OVERSCAN_MIN_PX, raw));
}

/**
 * How far the raster may be magnified before it must be rebuilt.
 *
 * The raster holds `dpr` device pixels per CSS pixel, so at magnification `k` its
 * effective resolution is `dpr/k` device px per CSS px. Allowing `k ≤ dpr` keeps the
 * projected raster at or above native CSS resolution — genuinely lossless on a HiDPI
 * screen. On a dpr=1 display any zoom-in degrades, so a small pragmatic budget applies
 * instead (the idle re-raster restores full sharpness ~120ms later).
 */
export function maxMagnification(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return MIN_MAGNIFICATION_BUDGET;
  return Math.max(MIN_MAGNIFICATION_BUDGET, dpr);
}

/** Current scale relative to the anchor. `NaN`/`Infinity` ⇒ the anchor is unusable. */
export function magnification(anchor: AnchorTransform, current: AnchorTransform): number {
  return current.scale / anchor.scale;
}

/**
 * The offscreen render transform: the anchor shifted by the overscan margin, which is what
 * makes raster CSS coordinate (M, M) coincide with visible-canvas coordinate (0, 0).
 *
 * ⚠️ `+overscanPx` on BOTH offsets is correct even though `worldToScreen` SUBTRACTS
 * `offsetY` — the raster viewport is also `2M` taller, and `(H+2M − top) − (oy+M)` is
 * exactly `(H − top) − oy + M`. Verified by the probe, not by this comment.
 */
export function overscannedRenderTransform(anchor: AnchorTransform, overscanPx: number): AnchorTransform {
  return {
    scale: anchor.scale,
    offsetX: anchor.offsetX + overscanPx,
    offsetY: anchor.offsetY + overscanPx,
  };
}

/** The offscreen viewport: the visible one grown by the overscan on every side. */
export function overscannedViewport(viewport: Viewport, overscanPx: number): Viewport {
  return { width: viewport.width + 2 * overscanPx, height: viewport.height + 2 * overscanPx };
}

/**
 * Destination rect that places the anchored raster so its content lands exactly where the
 * live transform says it belongs.
 *
 * `probe` carries the measured correspondence (see `AnchoredProbe`); `rasterDeviceW/H` are
 * the offscreen canvas backing-store dimensions (overscan already included).
 */
export function computeAnchoredBlitRect(
  probe: AnchoredProbe,
  k: number,
  rasterDeviceW: number,
  rasterDeviceH: number,
  dpr: number,
): AnchoredBlitRect {
  // screen = k·raster + b  ⇒  b = screen(probe) − k·raster(probe). One point is enough:
  // the map is affine with a KNOWN scale, so a single correspondence pins the offset.
  const dx = dpr * (probe.screen.x - k * probe.raster.x);
  const dy = dpr * (probe.screen.y - k * probe.raster.y);
  const dw = k * rasterDeviceW;
  const dh = k * rasterDeviceH;
  // Pure pan (k === 1): snap the translation to whole device pixels. A fractional
  // destination forces the browser to resample a 1:1 bitmap and the drawing goes soft
  // for the whole gesture; the ≤0.5 device-px shift is invisible and the idle
  // re-raster lands it exactly. At k ≠ 1 resampling is unavoidable by construction.
  if (k === 1) return { dx: Math.round(dx), dy: Math.round(dy), dw, dh };
  return { dx, dy, dw, dh };
}

/** True when the projected raster fills the whole visible backing store (no holes). */
export function coversViewport(rect: AnchoredBlitRect, physW: number, physH: number): boolean {
  return (
    rect.dx <= COVERAGE_EPSILON_PX &&
    rect.dy <= COVERAGE_EPSILON_PX &&
    rect.dx + rect.dw >= physW - COVERAGE_EPSILON_PX &&
    rect.dy + rect.dh >= physH - COVERAGE_EPSILON_PX
  );
}

/**
 * Is the projection NUMERICALLY VALID at all — finite scale and destination? (ADR-726 Φ3.1)
 *
 * Validity, not quality: a `true` here can still be blurry or hole-y. Split out of
 * `isAnchoredBlitAcceptable` because the two answers serve different callers — during a
 * navigation gesture the cache serves any USABLE projection as-is (gesture-aware
 * acceptance, policy in `DxfBitmapCache.canServe`), while the quality criteria below
 * apply only at rest. `drawImage` silently no-ops on non-finite args, so an unusable
 * projection must always force a rebuild — gesture or not.
 */
export function isAnchoredBlitUsable(rect: AnchoredBlitRect, k: number): boolean {
  if (!Number.isFinite(k) || k <= 0) return false;
  return Number.isFinite(rect.dx) && Number.isFinite(rect.dy);
}

/**
 * Can this projection still be shown — i.e. is it both sharp enough and hole-free?
 * `false` ⇒ the caller must rebuild THIS frame (worst case: the pre-ADR-726 cost, never
 * worse).
 *
 * Note the self-stabilising loop: cheaper frames ⇒ less drift per frame ⇒ fewer
 * rebuilds ⇒ cheaper frames.
 */
export function isAnchoredBlitAcceptable(params: {
  rect: AnchoredBlitRect;
  magnification: number;
  dpr: number;
  physW: number;
  physH: number;
}): boolean {
  const { rect, magnification: k, dpr, physW, physH } = params;
  if (!isAnchoredBlitUsable(rect, k)) return false;
  if (k > maxMagnification(dpr)) return false;
  return coversViewport(rect, physW, physH);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ΤΟ ΠΑΤΩΜΑ ΠΟΙΟΤΗΤΑΣ ΤΗΣ ΧΕΙΡΟΝΟΜΙΑΣ (ADR-743 Φ1)
// ═══════════════════════════════════════════════════════════════════════════════
//
// 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ. Η ADR-726 Φ3.1 σέρβιρε το raster **ΑΝΕΥ ΟΡΩΝ** μέσα σε χειρονομία
// («τα ποιοτικά κριτήρια είναι κριτήρια ΗΡΕΜΙΑΣ»). Σωστό ως προς τον χρόνο καρέ — αλλά άφησε
// το `k` **ΑΦΡΑΓΤΟ**, και το εύρος κλίμακας είναι `1e-4…1e5` (`TRANSFORM_SCALE_LIMITS`). Σε
// παρατεταμένη ριπή ροδέλας το raster μπορούσε να προβληθεί σε **τάξεις μεγέθους** μεγέθυνσης:
// τέσσερα γιγάντια θολά pixels, ή μια κουκκίδα μέσα σε άδειο φόντο. **Κανένα test και καμία
// μέτρηση δεν το κάλυψε** — δεν φαινόταν επειδή ο idle re-raster ξανάχτιζε κάθε 120ms και το
// έκρυβε. Κλείνοντας εκείνη τη διαρροή, το κενό **εκτίθεται**· γι' αυτό κλείνει μαζί της.
//
// 🔑 ΓΙΑΤΙ ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΣΤΟ `k` ΚΑΙ ΟΧΙ ΣΤΗΝ ΚΑΛΥΨΗ — Η ΚΡΙΣΙΜΗ ΕΠΙΛΟΓΗ.
// Στο **καθαρό pan το `k` είναι ταυτοτικά 1**, άρα ένα budget εκφρασμένο στο `k` **δεν μπορεί
// να πυροδοτηθεί ποτέ στο pan**. Αυτό δεν είναι λεπτομέρεια: το pan μετρήθηκε (ADR-743 §6.1)
// με **ΜΗΔΕΝ** ανακατασκευές και **2,07%** JS — είναι compositing-bound. Ένα κριτήριο κάλυψης
// θα του ξαναφόρτωνε ανακατασκευές 110ms που σήμερα δεν έχει, δηλαδή θα «διόρθωνε» το zoom
// σπάζοντας το pan. **Το `k` είναι ακριβώς ό,τι αλλάζει μόνο το zoom.**
//
// ⚠️ ΑΝΑΓΚΑΙΑ, ΟΧΙ ΙΚΑΝΗ — γι' αυτό λέγεται «πάτωμα». Φράζει τη συνεισφορά του **zoom** στις
// τρύπες· τρύπες από **αποκέντρωση λόγω pan** μένουν ανεκτές μέσα στη χειρονομία **ακριβώς όπως
// πριν**, εκ σχεδιασμού (βλ. παραπάνω). Το `coversViewport` παραμένει κριτήριο **ηρεμίας**.

/** Το ανώτατο `k` που ανέχεται μια χειρονομία σε αυτό το dpr (θόλωμα από zoom-in). */
export function maxGestureMagnification(dpr: number): number {
  return GESTURE_MAGNIFICATION_SLACK * maxMagnification(dpr);
}

/**
 * Το κατώτατο `k` κάτω από το οποίο το raster **δεν μπορεί** να καλύψει το viewport — ούτε καν
 * τέλεια κεντραρισμένο (σμίκρυνση από zoom-out).
 *
 * **Παράγωγο της γεωμετρίας του overscan, όχι επιλεγμένος αριθμός:** το raster έχει πλάτος
 * `W + 2M`, οπότε προβεβλημένο σε `k` καλύπτει `k(W + 2M)`. Η στοιχειώδης απαίτηση `k(W+2M) ≥ W`
 * δίνει `k ≥ W/(W+2M)`, και το ίδιο κατά ύψος· κρατάμε το αυστηρότερο. Για 800×600 με M=120
 * (raster 1040×840) ⇒ **0,769**.
 */
export function minGestureMagnification(viewport: Viewport, overscanPx: number): number {
  const rasterW = viewport.width + 2 * overscanPx;
  const rasterH = viewport.height + 2 * overscanPx;
  // Εκφυλισμένος καμβάς: μόνο το 1:1 είναι ασφαλές — κάθε σμίκρυνση αφήνει κενό.
  if (!(rasterW > 0) || !(rasterH > 0)) return 1;
  return Math.max(viewport.width / rasterW, viewport.height / rasterH);
}

/**
 * Μπορεί η προβολή να σερβιριστεί ΩΣ ΕΧΕΙ ενόσω ο χρήστης κινεί την όψη;
 *
 * ⚠️ **Διαφορετικό ερώτημα από το {@link isAnchoredBlitAcceptable}**, όχι χαλαρή εκδοχή του:
 * εκείνο ρωτά «είναι ΤΕΛΕΙΟ;» (κριτήρια ηρεμίας), αυτό ρωτά «είναι ΑΡΚΕΤΑ ΚΑΛΟ ΓΙΑ ΚΙΝΗΣΗ;».
 * Η χειρονομία αναστέλλει την **τελειότητα**, ποτέ την **ποιότητα**.
 */
export function isWithinGestureMagnificationBudget(params: {
  magnification: number;
  dpr: number;
  viewport: Viewport;
  overscanPx: number;
}): boolean {
  const { magnification: k, dpr, viewport, overscanPx } = params;
  if (!Number.isFinite(k) || k <= 0) return false;
  if (k > maxGestureMagnification(dpr)) return false;
  return k >= minGestureMagnification(viewport, overscanPx);
}

/** True when `a` and `b` are the same view (drift check for the idle re-raster). */
export function isSameTransform(a: AnchorTransform, b: AnchorTransform): boolean {
  return a.scale === b.scale && a.offsetX === b.offsetX && a.offsetY === b.offsetY;
}
