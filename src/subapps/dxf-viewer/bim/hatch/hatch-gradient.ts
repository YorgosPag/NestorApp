/**
 * Hatch Gradient SSoT (ADR-507 Φ5).
 *
 * Ορίζει το `HatchGradient` model + το mapping gradient → color stops, ΜΙΑ φορά,
 * ώστε να το μοιράζονται ο canvas renderer (`HatchRenderer.fillGradient`) και
 * οποιοσδήποτε μελλοντικός consumer (export preview, legend). Το DXF I/O (group
 * codes 450-470) ζει στον reader/writer — εδώ ζει η semantic γεωμετρία του gradient.
 *
 * Leaf module: μηδέν runtime import από `types/entities` (το `HatchGradient` το
 * καταναλώνει το entity, όχι το ανάποδο → μηδέν κύκλος).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md §2.3
 * @see AutoCAD DXF Reference: HATCH gradient data (codes 450/452/460/461/462/470)
 */

// 🏢 Color-Conversion SSoT (ADR-573): tint = blend-toward-white via canonical `mixHex`.
// color-math is pure (zero cycle) — leaf-safe.
import { mixHex } from '../../config/color-math';
import { clamp01 } from '../../utils/scalar-math';

/**
 * Τύπος gradient (DXF group 470, lowercase). LINEAR/CYLINDER → γραμμικό· οι
 * SPHERICAL/HEMISPHERICAL/CURVED → ακτινικό. Οι `inv*` αντιστρέφουν τη σειρά χρωμάτων.
 */
export type HatchGradientType =
  | 'linear'
  | 'cylinder'
  | 'invcylinder'
  | 'spherical'
  | 'invspherical'
  | 'hemispherical'
  | 'curved';

const GRADIENT_TYPES: ReadonlySet<string> = new Set<HatchGradientType>([
  'linear', 'cylinder', 'invcylinder', 'spherical', 'invspherical', 'hemispherical', 'curved',
]);

/** Ένα gradient γέμισμα γραμμοσκίασης (DXF 450-470). Γωνία σε **μοίρες** (όπως patternAngle). */
export interface HatchGradient {
  /** Τύπος (DXF 470). */
  readonly type: HatchGradientType;
  /** Πρώτο χρώμα (hex `#RRGGBB`). */
  readonly color1: string;
  /** Δεύτερο χρώμα (hex) — two-color. Απών → single-color (tint shading). */
  readonly color2?: string;
  /** Single-color flag (DXF 452=1). */
  readonly singleColor?: boolean;
  /** Tint 0..1 (DXF 462) — single-color shading προς λευκό. */
  readonly tint?: number;
  /** Γωνία περιστροφής σε μοίρες (DXF 460 = radians· εδώ degrees). */
  readonly angleDeg?: number;
  /** Μετατόπιση/centered 0..1 (DXF 461). */
  readonly shift?: number;
}

/** Ένα color stop για CanvasGradient (offset 0..1 → hex χρώμα). */
export interface GradientColorStop {
  readonly offset: number;
  readonly color: string;
}

/** Normalize DXF 470 string → `HatchGradientType` (lowercase, fallback `'linear'`). */
export function normalizeGradientType(name: string | undefined): HatchGradientType {
  const lower = (name ?? '').trim().toLowerCase();
  return GRADIENT_TYPES.has(lower) ? (lower as HatchGradientType) : 'linear';
}

/** True όταν ο τύπος αποδίδεται με ακτινικό (radial) gradient, αλλιώς γραμμικό. */
export function isRadialGradientType(type: HatchGradientType): boolean {
  return type === 'spherical' || type === 'invspherical'
    || type === 'hemispherical' || type === 'curved';
}

/**
 * Κανονικοποιεί το shift (DXF 461) στο [0,1]. shift=0 → centered (συμμετρικό)·
 * shift→1 → η διαβάθμιση «γλιστράει» κατά τον άξονά της (AutoCAD «not centered»),
 * ώστε το πρώτο χρώμα να κυριαρχεί. Καταναλώνεται από τον renderer για να
 * μετατοπίσει τη γεωμετρία του gradient (όχι τα stops → μηδέν degenerate offset).
 */
export function normalizeGradientShift(shift: number | undefined): number {
  return clamp01(shift ?? 0);
}

/**
 * Blend χρώματος προς λευκό κατά `1 - tint` (single-color shading, AutoCAD-style:
 * tint=1 → πλήρες χρώμα, tint=0 → λευκό). Μη-έγκυρο hex → επιστρέφει το input.
 */
export function applyTint(hex: string, tint: number): string {
  // Guard preserves the original contract: only 6-digit hex is tinted; anything else
  // (3-digit, rgba, invalid) is returned verbatim — no case change.
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const t = clamp01(tint);
  // blend hex → white by (1 - t): tint=1 → full colour, tint=0 → white. Uppercase to
  // preserve this module's historical output format.
  return mixHex(hex, '#ffffff', 1 - t).toUpperCase();
}

/**
 * **SSoT gradient → color stops.** Παράγει τα CanvasGradient stops ανάλογα με τον
 * τύπο. Symmetric (cylinder/hemispherical) → 3 stops (c1→c2→c1)· inverted → ανάποδη
 * σειρά· single-color → c1 → tinted(c1). Καταναλώνεται από τον renderer (linear ή
 * radial gradient ανάλογα με `isRadialGradientType`).
 */
export function resolveGradientStops(g: HatchGradient): GradientColorStop[] {
  const c1 = g.color1;
  const c2 = g.singleColor || !g.color2 ? applyTint(c1, g.tint ?? 0) : g.color2;
  switch (g.type) {
    case 'cylinder':
    case 'hemispherical':
      return [{ offset: 0, color: c1 }, { offset: 0.5, color: c2 }, { offset: 1, color: c1 }];
    case 'invcylinder':
      return [{ offset: 0, color: c2 }, { offset: 0.5, color: c1 }, { offset: 1, color: c2 }];
    case 'invspherical':
      return [{ offset: 0, color: c2 }, { offset: 1, color: c1 }];
    default: // linear, spherical, curved
      return [{ offset: 0, color: c1 }, { offset: 1, color: c2 }];
  }
}
