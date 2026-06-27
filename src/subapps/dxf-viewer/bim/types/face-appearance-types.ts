/**
 * face-appearance-types — ADR-539 (Cinema 4D «Polygon Mode»: per-face appearance).
 *
 * SSoT για το «βάψιμο/ντύσιμο μεμονωμένης όψης» (Revit «Paint on face» / Cinema 4D
 * polygon material) ΟΛΩΝ των δομικών solids. Καθαρά cosmetic override: ζει στο
 * `BimEntity` base (δίπλα στο `styleOverride`), ΔΕΝ συμμετέχει στο geometry
 * derivation από τα `params` — άρα μηδέν διπλότυπα ανά kind, μηδέν επίδραση στο
 * derive της γεωμετρίας.
 *
 * Το `FaceKey` ακολουθεί το ντετερμινιστικό edge ordering του `buildFacedPrism`
 * (`bim-3d/converters/bim-three-faced-prism.ts`): materialIndex 0 = `bottom`,
 * 1 = `top`, 2+i = `side:i` όπου `i` = ακμή i του canonical outline.
 *
 * @see bim-3d/converters/bim-three-faced-prism.ts — face-key ↔ materialIndex SSoT
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

/**
 * Ντετερμινιστικό κλειδί όψης, κοινό για όλα τα solids.
 *   - `top` / `bottom` — οι δύο οριζόντιες παρειές (caps).
 *   - `side:${i}` — η i-οστή περιμετρική πλευρά (edge ordering του `buildFacedPrism`).
 *   - `hole:${h}:${k}` — το k-οστό τοίχωμα του h-οστού ανοίγματος (slab opening, Φ2).
 *   - `sub:${i}:${string}` — per-«νερό» roof sub-solid (Φ3· δηλωμένο τώρα για σταθερό SSoT).
 */
export type FaceKey =
  | 'top'
  | 'bottom'
  | `side:${number}`
  | `hole:${number}:${number}`
  | `sub:${number}:${string}`;

/**
 * Η εμφάνιση μιας όψης: είτε υλικό από κατάλογο (`materialId`) είτε σκέτο χρώμα
 * (`colorHex`). Και τα δύο optional — άδειο = επιστροφή στο base material της entity.
 * `materialId` έχει προτεραιότητα στην επίλυση χρώματος (δες `resolveFaceMaterial`).
 */
export interface FaceAppearance {
  /** Catalog material id (π.χ. wall-covering `paint-red`). Optional. */
  readonly materialId?: string;
  /** CSS hex (π.χ. `#C0392B`) για σκέτο χρώμα. Optional. */
  readonly colorHex?: string;
}

/**
 * Map όψη → εμφάνιση. Όψεις που λείπουν = κανένα override (legacy single-material
 * render, byte-for-byte). Κλειδί = `FaceKey` (string at runtime, Firestore-safe).
 */
export type FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>;
