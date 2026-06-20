/**
 * Background-adaptive entity color — pure SSoT (ADR-509).
 *
 * AutoCAD model-space pattern: ο 2D καμβάς είναι σκούρος (default `#000000`), οπότε χρώματα
 * οντοτήτων «σχεδόν μαύρα» (π.χ. εξωτ. τοίχος `#2b2f36`) εξαφανίζονται. Αυτό το SSoT εγγυάται
 * **ελάχιστο contrast** κάθε χρώματος ενάντια στο **ζωντανό background του 2D καμβά**: αν το
 * χρώμα έχει ήδη επαρκές contrast → επιστρέφεται **αυτούσιο** (κορεσμένα beam/column μένουν)·
 * αλλιώς αναμειγνύεται **ελάχιστα** προς το αντίθετο άκρο (άσπρο σε σκούρο φόντο, μαύρο σε
 * ανοιχτό) ώσπου να φτάσει το κατώφλι — διατηρώντας τον χρωματικό χαρακτήρα όσο γίνεται.
 *
 * **Render-time, 2D-canvas-specific** (ΟΧΙ μέσα στον κοινό `resolveSubcategoryStyle`, που τον
 * μοιράζονται 3D edges + print με ΑΛΛΟ background). Reuse `color-math` (μηδέν duplicate math) +
 * `resolveDxfCanvasBackgroundHex` (live bg SSoT). Memoized (τα χρώματα είναι λίγα → cache hit).
 *
 * @see ./color-math.ts — contrastRatio / mixHex / parseHex / srgbRelativeLuminance
 * @see ./color-config.ts — resolveDxfCanvasBackgroundHex (live 2D canvas bg)
 * @see docs/centralized-systems/reference/adrs/ADR-509-adaptive-entity-color.md
 */

import {
  compositeOverHex,
  contrastRatio,
  mixHex,
  parseColor,
  parseHex,
  rgbaString,
  rgbToHex,
  srgbRelativeLuminance,
  type RgbaColor,
} from './color-math';
import { resolveDxfCanvasBackgroundHex } from './color-config';

/**
 * Ελάχιστο WCAG contrast ratio οντότητας↔φόντου. 3.0 = WCAG AA «graphical objects»: αρκετά
 * ορατό χωρίς να ξεπλένει υπερβολικά τα κορεσμένα χρώματα (red `#FF0000`/blue `#0000FF` ≥ 3.0
 * → μένουν αυτούσια)· near-black `#2b2f36` (≈1.6) → προσαρμόζεται.
 */
export const MIN_ENTITY_CONTRAST = 3.0;

/**
 * Προσαρμόζει `colorHex` ώστε να έχει ≥ `minContrast` με το `bgHex`. Αυτούσιο αν ήδη επαρκεί.
 * Αλλιώς binary-search ελάχιστης ανάμειξης προς άσπρο/μαύρο (ανάλογα φωτεινότητα φόντου).
 */
export function adaptColorToBackground(
  colorHex: string,
  bgHex: string,
  minContrast: number = MIN_ENTITY_CONTRAST,
): string {
  const c = parseHex(colorHex);
  const bg = parseHex(bgHex);
  if (!c || !bg) return colorHex;
  if (contrastRatio(colorHex, bgHex) >= minContrast) return colorHex;

  // Στόχος ανάμειξης = το αντίθετο άκρο φωτεινότητας του φόντου (max-contrast endpoint).
  const target = srgbRelativeLuminance(bg) < 0.5 ? '#ffffff' : '#000000';
  // Mid-gray φόντο: ακόμη κι ο στόχος δεν φτάνει το κατώφλι → καλύτερη δυνατή προσέγγιση.
  if (contrastRatio(target, bgHex) < minContrast) return target;

  // Μονότονη αύξηση contrast καθώς το `t` πάει προς τον στόχο → binary-search ελάχιστου `t`.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (contrastRatio(mixHex(colorHex, target, mid), bgHex) >= minContrast) hi = mid;
    else lo = mid;
  }
  return mixHex(colorHex, target, hi);
}

const _cache = new Map<string, string>();

/**
 * Προσαρμόζει ένα χρώμα οντότητας στο **ζωντανό** 2D canvas background. Memoized ανά
 * `χρώμα|φόντο`. Καλείται από τους 2D renderers ΑΚΡΙΒΩΣ πριν το `ctx.strokeStyle`/`fillStyle`.
 */
export function adaptEntityColorForCanvas(colorHex: string): string {
  const bg = resolveDxfCanvasBackgroundHex();
  const key = `${colorHex}|${bg}`;
  const hit = _cache.get(key);
  if (hit !== undefined) return hit;
  const out = adaptColorToBackground(colorHex, bg);
  _cache.set(key, out);
  return out;
}

// ============================================================================
// FILL TINT (Revit-grade poché) — translucent body fill, background-adaptive
// ============================================================================

/**
 * Ελάχιστο contrast του **composited** σώματος (poché) ενάντια στο φόντο. Πιο χαμηλό
 * από {@link MIN_ENTITY_CONTRAST} (γραμμές 3.0): το γέμισμα είναι background fill — αρκεί
 * να «διαβάζεται» ως ανοιχτό-γκρι, όχι να κυριαρχεί ξεπλένοντας τον χρωματικό χαρακτήρα.
 */
export const MIN_FILL_CONTRAST = 2.0;

/**
 * Ανώτατο alpha κατά το boost. Διατηρεί το **translucent CAD feel** — το σώμα δεν γίνεται
 * ποτέ opaque (οι υποκείμενες DXF γραμμές φαίνονται), απλώς αρκετά αδιαφανές για να ξεχωρίζει.
 */
export const FILL_BOOST_MAX_ALPHA = 0.6;

const _fillCache = new Map<string, string>();

/**
 * Προσαρμόζει ένα **translucent fill tint** (`rgba(...)`/hex) στο **ζωντανό** 2D canvas
 * background. Αν το composited σώμα ήδη φτάνει {@link MIN_FILL_CONTRAST} → αυτούσιο (κρατά
 * translucency + hue). Αλλιώς σπρώχνει base→αντίθετο άκρο φωτεινότητας ΚΑΙ alpha→
 * {@link FILL_BOOST_MAX_ALPHA} ώσπου το composited να γίνει ορατό. Επιστρέφει πάντα `rgba`.
 * Memoized ανά `fill|bg`. Καλείται από τους 2D BIM renderers πριν το `ctx.fillStyle`.
 */
export function adaptFillTintForCanvas(fill: string, bgHex?: string): string {
  const bg = bgHex ?? resolveDxfCanvasBackgroundHex();
  const key = `${fill}|${bg}`;
  const hit = _fillCache.get(key);
  if (hit !== undefined) return hit;
  const out = computeAdaptedFillTint(fill, bg);
  _fillCache.set(key, out);
  return out;
}

/** Pure core του {@link adaptFillTintForCanvas} (χωρίς memo/live-bg). */
function computeAdaptedFillTint(fill: string, bg: string): string {
  const c = parseColor(fill);
  const bgRgb = parseHex(bg);
  if (!c || !bgRgb) return fill;
  if (contrastRatio(compositeOverHex(c, bg), bg) >= MIN_FILL_CONTRAST) return fill;

  // Στόχος = αντίθετο άκρο φωτεινότητας φόντου. `s∈[0,1]` σπρώχνει ΤΑΥΤΟΧΡΟΝΑ base→endpoint
  // και alpha→targetA → contrast μονότονα αυξάνει → binary-search ελάχιστου `s`.
  const endpoint = srgbRelativeLuminance(bgRgb) < 0.5 ? '#ffffff' : '#000000';
  const baseHex = rgbToHex(c);
  const targetA = Math.max(c.a, FILL_BOOST_MAX_ALPHA);
  const tintAt = (s: number): RgbaColor => ({
    ...(parseHex(mixHex(baseHex, endpoint, s)) ?? c),
    a: c.a + (targetA - c.a) * s,
  });
  const meets = (s: number): boolean =>
    contrastRatio(compositeOverHex(tintAt(s), bg), bg) >= MIN_FILL_CONTRAST;

  if (!meets(1)) return rgbaString(tintAt(1));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return rgbaString(tintAt(hi));
}

/** Test hook — καθαρίζει τα memo caches (π.χ. όταν αλλάζει το background στο test). */
export function _clearAdaptiveColorCache(): void {
  _cache.clear();
  _fillCache.clear();
}
