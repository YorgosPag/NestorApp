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

import { contrastRatio, mixHex, parseHex, srgbRelativeLuminance } from './color-math';
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

/** Test hook — καθαρίζει το memo cache (π.χ. όταν αλλάζει το background στο test). */
export function _clearAdaptiveColorCache(): void {
  _cache.clear();
}
