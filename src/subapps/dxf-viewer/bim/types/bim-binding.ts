/**
 * BIM Binding (ADR-369 §9 Q5) — Phase A1
 *
 * Revit-style hybrid binding για vertical extents Wall + Column.
 *   - baseBinding : πώς συνδέεται η βάση με τον όροφο
 *   - topBinding  : πώς συνδέεται η κορυφή με τον επόμενο όροφο / unconnected
 *
 * Semantic των `baseOffset` / `topOffset` (mm) εξαρτάται από το mode:
 *   - 'storey-floor'   → offset από FFL του όροφου (Floor.elevation)
 *   - 'storey-ceiling' → offset από το επόμενο storey reference plane
 *   - 'absolute'       → absolute world z
 *   - 'unconnected'    → αγνοεί offset, χρησιμοποιεί `unconnectedHeight`
 *   - 'attached'       → (ADR-401) top: η κορυφή ακολουθεί συσχετιστικά την κάτω
 *                        παρειά δομικών στοιχείων (`attachTopToIds`, lower-envelope).
 *                        base: η βάση «κάθεται» πάνω στην άνω παρειά θεμελίου/
 *                        δοκαριού (`attachBaseToIds`, upper-envelope). Το ύψος
 *                        υπολογίζεται ζωντανά από `resolveWallTopProfile` /
 *                        `resolveWallBaseProfile`, ΔΕΝ αποθηκεύεται ως scalar.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §2.1
 */

import { z } from 'zod';

// ─── Wall binding unions ─────────────────────────────────────────────────────

export type WallBaseBinding = 'storey-floor' | 'absolute' | 'attached';
export type WallTopBinding = 'storey-ceiling' | 'absolute' | 'unconnected' | 'attached';

export const WALL_BASE_BINDING_VALUES: readonly WallBaseBinding[] = [
  'storey-floor',
  'absolute',
  'attached',
] as const;

export const WALL_TOP_BINDING_VALUES: readonly WallTopBinding[] = [
  'storey-ceiling',
  'absolute',
  'unconnected',
  'attached',
] as const;

export const DEFAULT_WALL_BASE_BINDING: WallBaseBinding = 'storey-floor';
export const DEFAULT_WALL_TOP_BINDING: WallTopBinding = 'storey-ceiling';

// ─── Column binding (mirror Wall — distinct aliases for self-documenting types) ──

export type ColumnBaseBinding = WallBaseBinding;
export type ColumnTopBinding = WallTopBinding;

export const COLUMN_BASE_BINDING_VALUES: readonly ColumnBaseBinding[] = WALL_BASE_BINDING_VALUES;
export const COLUMN_TOP_BINDING_VALUES: readonly ColumnTopBinding[] = WALL_TOP_BINDING_VALUES;

export const DEFAULT_COLUMN_BASE_BINDING: ColumnBaseBinding = 'storey-floor';
export const DEFAULT_COLUMN_TOP_BINDING: ColumnTopBinding = 'storey-ceiling';

// ─── Stair binding (ADR-401 Phase G — mirror Wall/Column, stair-honest defaults) ──
//
// Η σκάλα μοιράζεται το ΙΔΙΟ union (full SSoT) με τοίχο/κολώνα, αλλά τα defaults
// της διαφέρουν semantically:
//   - base 'storey-floor' → η βάση στο FFL ορόφου + `offsetFromStorey` (ΗΔΗ
//     υπάρχουσα σύμβαση σκάλας, ADR-369).
//   - top 'unconnected'   → το ύψος της σκάλας οδηγείται από τα σκαλοπάτια
//     (`rise × stepCount = totalRise`), ΟΧΙ από ταβάνι ορόφου. Revit «Desired
//     number of risers». Το 'attached' (ADR-401) κάνει την κορυφή να ακολουθεί
//     τη δομική παρειά host με ακέραια σκαλοπάτια (whole-step snap).

export type StairBaseBinding = WallBaseBinding;
export type StairTopBinding = WallTopBinding;

export const STAIR_BASE_BINDING_VALUES: readonly StairBaseBinding[] = WALL_BASE_BINDING_VALUES;
export const STAIR_TOP_BINDING_VALUES: readonly StairTopBinding[] = WALL_TOP_BINDING_VALUES;

export const DEFAULT_STAIR_BASE_BINDING: StairBaseBinding = 'storey-floor';
export const DEFAULT_STAIR_TOP_BINDING: StairTopBinding = 'unconnected';

// ─── Zod schemas (strict) ────────────────────────────────────────────────────

export const WallBaseBindingSchema = z.enum(['storey-floor', 'absolute', 'attached']);
export const WallTopBindingSchema = z.enum(['storey-ceiling', 'absolute', 'unconnected', 'attached']);

export const ColumnBaseBindingSchema = WallBaseBindingSchema;
export const ColumnTopBindingSchema = WallTopBindingSchema;

export const StairBaseBindingSchema = WallBaseBindingSchema;
export const StairTopBindingSchema = WallTopBindingSchema;
