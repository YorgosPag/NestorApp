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
 * Blend χρώματος προς λευκό κατά `1 - tint` (single-color shading, AutoCAD-style:
 * tint=1 → πλήρες χρώμα, tint=0 → λευκό). Μη-έγκυρο hex → επιστρέφει το input.
 */
export function applyTint(hex: string, tint: number): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const t = Math.min(1, Math.max(0, tint));
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff; const g = (n >> 8) & 0xff; const b = n & 0xff;
  const mix = (c: number): number => Math.round(c * t + 255 * (1 - t));
  return `#${((mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).padStart(6, '0').toUpperCase()}`;
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
