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
 * Reserved «base» κλειδί (Cinema 4D base material tag / Revit type material): η εμφάνιση
 * που ισχύει για **ΟΛΕΣ** τις όψεις του solid, ΕΚΤΟΣ όσων έχουν δικό τους per-face override.
 * «Βάψε όλο το στοιχείο» = θέσε `faceAppearance['*']`. Δεν είναι πραγματική όψη — δεν είναι
 * pickable (`faceGroupRange` το αγνοεί), δεν εμφανίζεται στις λαβές· consulted ΜΟΝΟ ως
 * fallback στο `resolveFaceMaterial`. Το `'*'` δεν συγκρούεται με κανένα `FaceKey`
 * (`top`/`bottom`/`side:i`/…) και είναι Firestore-safe.
 *
 * Cascade (όπως Revit «Paint» + type material / Cinema 4D material tags):
 *   resolve(face) = appearance[face]  ??  appearance['*']  ??  base entity material
 */
export const BASE_FACE_KEY = '*';

/**
 * Map όψη → εμφάνιση. Όψεις που λείπουν = κανένα override (πέφτουν στο `'*'` base, αλλιώς
 * legacy single-material render byte-for-byte). Κλειδί = `FaceKey` ή `BASE_FACE_KEY`
 * (string at runtime, Firestore-safe).
 */
export type FaceAppearanceMap = Readonly<Record<string, FaceAppearance>>;

/**
 * SSoT «βάψε ΟΛΟ το στοιχείο» ως πλήρες map (ADR-539). Επιστρέφει map που περιέχει **ΜΟΝΟ** το
 * base `'*'` — άρα, εφαρμοσμένο με replace semantics (`SetEntityFaceAppearanceMapCommand`),
 * καθαρίζει ταυτόχρονα κάθε προϋπάρχον per-face override. Αυτό κάνει το «βάψε όλο» πραγματικά
 * «όλο»: χωρίς αυτό, ένα merge-set του `'*'` άφηνε τα per-face overrides να κερδίζουν στον
 * cascade (`resolveFaceMaterial`: `appearance[face] ?? appearance['*']`) → μία όψη έμενε αβαφή.
 * `value = null` → `{}` (καθάρισε τα πάντα, επιστροφή σε base look — Revit «remove paint»).
 * Κοινό για το file-import (C4D per-object) και το ζωντανό «όλο το στοιχείο» του polygon panel.
 */
export function entireElementFaceMap(value: FaceAppearance | null): FaceAppearanceMap {
  return value ? { [BASE_FACE_KEY]: value } : {};
}
