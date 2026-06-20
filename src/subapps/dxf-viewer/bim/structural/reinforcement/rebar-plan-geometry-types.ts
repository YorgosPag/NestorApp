/**
 * ADR-505 (finish/rebar export) — Shared 2Δ rebar PLAN GEOMETRY contract (SSoT).
 *
 * Η γεωμετρία οπλισμού σε **κάτοψη** εκφρασμένη ως καθαρά δεδομένα (world/canvas
 * coords), ΧΩΡΙΣ `CanvasRenderingContext2D`. Πρώην ζούσε inline μέσα στους 2Δ
 * `draw*Rebar2D` helpers (μία διάσχιση layout → ctx)· εξήχθη ώστε **μία πηγή**
 * γεωμετρίας να τροφοδοτεί ΔΥΟ consumers:
 *   - τους 2Δ canvas renderers (map world→screen + ctx stroke),
 *   - τον DXF export collector (map → DXF primitives line/lwpolyline/circle).
 *
 * Pure: μόνο τύπος `Point2D` — ZERO ctx/three/store/Firestore. ΕΝΑΣ SSoT για όλα
 * τα δομικά μέλη (κολώνα / δοκάρι / πέδιλο / πλάκα).
 *
 * @see ./column-rebar-plan-geometry.ts · ./linear-member-rebar-plan-geometry.ts
 * @see ./footing-rebar-plan-geometry.ts · ./slab-rebar-plan-geometry.ts
 */

import type { Point2D } from '../../../rendering/types/Types';

/**
 * Μια πολυγραμμή οπλισμού στην κάτοψη (world coords): συνδετήρας, γάντζος, διαμήκης
 * ράβδος-γραμμή, ή σχάρα-γραμμή. `diameterMm` → πάχος γραμμής (2Δ) / πληροφορία (DXF).
 */
export interface RebarPlanPath {
  /** Σημεία σε world/canvas units (≥2). */
  readonly points: readonly Point2D[];
  /** Κλειστή διαδρομή (συνδετήρας/περίγραμμα) ή ανοιχτή (διαμήκης/σχάρα/γάντζος). */
  readonly closed: boolean;
  /** Διάμετρος ράβδου/συνδετήρα (mm) — line width source. */
  readonly diameterMm: number;
  /** ADR-476 — άνω σχάρα πλάκας ζωγραφίζεται διακεκομμένη (Revit «top mark»). */
  readonly dashed?: boolean;
}

/** Μια διαμήκης ράβδος κολώνας σε κάτοψη = γεμάτη κουκκίδα (η διατομή ΕΙΝΑΙ η κάτοψη). */
export interface RebarPlanDot {
  /** Κέντρο ράβδου σε world/canvas units. */
  readonly center: Point2D;
  /** Διάμετρος ράβδου (mm) → ακτίνα κουκκίδας / DXF circle. */
  readonly diameterMm: number;
}

/** Πλήρης γεωμετρία οπλισμού ενός μέλους στην κάτοψη (paths + dots). */
export interface RebarPlanGeometry {
  readonly paths: readonly RebarPlanPath[];
  readonly dots: readonly RebarPlanDot[];
}

/** Κενή γεωμετρία (no-op helper για τους extractors). */
export const EMPTY_REBAR_PLAN_GEOMETRY: RebarPlanGeometry = { paths: [], dots: [] };

// ─── 3Δ rebar segments (ADR-505 finish/rebar phase D — DXF 3D export) ──────────

/**
 * Ένα σημείο 3Δ οπλισμού: plan `x,y` σε **scene/canvas units** (ΟΧΙ μέτρα — ίδιος χώρος
 * με το DXF body export) + `zMm` = **ύψος σχετικό με τη βάση του μέλους** (z=0 στο
 * επίπεδο footprint· το DXF body είναι pseudo-3D: footprint στο z=0, extrude προς τα πάνω).
 * Οι δύο consumers κάνουν διαφορετικό mapping: 3Δ viewer → three.js μέτρα + baseY +
 * AXIS_FLIP· DXF → x,y×coordinateScale, z=zMm×mmScale.
 */
export interface RebarPoint3D {
  readonly x: number;
  readonly y: number;
  readonly zMm: number;
}

/** Ένα 3Δ τμήμα ράβδου/συνδετήρα (a→b). */
export interface RebarSeg3D {
  readonly a: RebarPoint3D;
  readonly b: RebarPoint3D;
}
