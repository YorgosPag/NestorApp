/**
 * BIM Opening — Type Schema (ADR-363 §5.4, Phase 2).
 *
 * Concrete `OpeningParams` + `OpeningGeometry` + `OpeningEntity` αντικαθιστούν
 * το Phase 0 stub (`BimParamsStub`/`BimGeometryStub`) στο `types/entities.ts`.
 *
 * Port από `C:/genarc/src/types/opening.types.ts` με:
 *   - μετατροπή μονάδων m → mm (Nestor convention, ίδιο με wall ADR-363 §5.3)
 *   - 5 kinds (door / window / sliding-door / french-door / fixed)
 *   - host-wall relation μέσω `wallId` foreign key (μονόδρομη, ADR-363 §5.4)
 *
 * SSoT:
 *   - `OpeningParams.offsetFromStart + width` οριοθετούν το cutout κατά μήκος
 *     του host wall axis. Snap 50mm increment (ADR-363 §11 Q2).
 *   - `OpeningGeometry` cache από `computeOpeningGeometry()` — re-derivable από
 *     `params + hostWall` σε corruption.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.4
 */

import type {
  BimEntity,
  Point3D,
  Polyline3D,
  Polygon3D,
  BoundingBox3D,
} from './bim-base';
import type { IfcEntityMixin } from './ifc-entity-mixin';

// ─── Sub-type discriminator (ADR-363 §5.4) ───────────────────────────────────

/** Opening kind discriminator. 5 industry-standard κουφώματα. */
export type OpeningKind =
  | 'door'
  | 'window'
  | 'sliding-door'
  | 'french-door'
  | 'fixed';

/** Door swing handing — left/right hinge orientation. */
export type OpeningHanding = 'left' | 'right';

/** Door swing direction relative to host wall outer face. */
export type OpeningSwing = 'inward' | 'outward';

// ─── Parameters (user-editable, SSoT for geometry derivation) ────────────────

/**
 * Opening parameters. All linear measurements in mm (Nestor convention).
 *
 * Foreign key: `wallId` MUST reference an existing wall on the same floorplan.
 * Constraint enforcement is client-side (validator) + server-side rules — soft
 * orphan policy (ADR-363 §5.4): wall deletion does NOT cascade openings; user
 * is prompted "Διαγραφή και των N κουφωμάτων;".
 *
 * Positioning along host wall:
 *   - `offsetFromStart` (mm) is measured along the wall axis from `wall.start`.
 *   - `offsetFromStart + width ≤ wall.length` (validator hard error otherwise).
 *
 * Optional fields:
 *   - `frameWidth` — κάσα width (mm). Default 50mm για doors / windows.
 *   - `handing` / `openDirection` — applicable only to door / french-door.
 *   - `glazingPanes` — number of glass panes (1 single / 2 double / 3 triple).
 *   - `material` — material library ID (Phase 6+).
 */
export interface OpeningParams {
  readonly kind: OpeningKind;
  /** Foreign key — host wall id (required). */
  readonly wallId: string;
  /** mm. Offset along host wall axis from `wall.start`. */
  readonly offsetFromStart: number;
  /** mm. Opening width along wall axis. */
  readonly width: number;
  /** mm. Opening vertical opening (sill to head). */
  readonly height: number;
  /** mm. Sill height above floor (0 για doors, ~900 για windows). */
  readonly sillHeight: number;
  /** mm. Κάσα width — default 50mm when undefined. */
  readonly frameWidth?: number;
  /** Door swing hinge side. Door-only — undefined για window/fixed. */
  readonly handing?: OpeningHanding;
  /** Door swing direction. Door / french-door only. */
  readonly openDirection?: OpeningSwing;
  /** Material library ID (Phase 6+). */
  readonly material?: string;
  /** Glazing panes — 1 single / 2 double / 3 triple. Window / french-door / fixed. */
  readonly glazingPanes?: 1 | 2 | 3;
  /**
   * ADR-376 Phase A — Instance Mark (ταμπελάκι). Auto-allocated on placement
   * via `OpeningMarkService` with per-kind prefix + floor-prefix hundreds
   * (e.g. `Θ.101`, `Π.001`, `ΣΥ.205`). User override-able. Undefined for
   * legacy openings; lazy-allocated on first render (migration script).
   */
  readonly mark?: string;
  /**
   * ADR-376 Phase A — Per-opening tag visibility override.
   * `undefined` → defaults to layer `__system_opening_tags__` visibility.
   * `false` → tag hidden even when the layer is ON.
   */
  readonly tagVisible?: boolean;
  /**
   * ADR-376 Phase C — Custom tag position offset (mm) from the auto-centroid.
   * Phase A leaves this `undefined`; reserved για draggable tag implementation.
   */
  readonly tagOffset?: { readonly dx: number; readonly dy: number };
}

// ─── Geometry cache (derivable from params + host wall; SSoT = params) ──────

/**
 * Computed geometry. Returned by `computeOpeningGeometry(params, hostWall)`
 * — never mutated by consumers. `area` / `perimeter` in metres (BOQ-ready);
 * `position` / `outline` / `bbox` in mm.
 *
 * `hingeArc` populated only για door / french-door kinds — used by the
 * renderer to draw the swing indicator arc. Window / sliding / fixed → undefined.
 */
export interface OpeningGeometry {
  /** mm. Cutout center on host wall axis (world coords). */
  readonly position: Point3D;
  /** rad. Host wall axis direction. */
  readonly rotation: number;
  /** mm. Cutout rectangle outline (4 vertices, world coords). */
  readonly outline: Polygon3D;
  /** mm. Door swing arc — present only για door / french-door. */
  readonly hingeArc?: Polyline3D;
  /**
   * mm. Door hinge anchor (pivot point) — present only για door / french-door.
   * Used by OpeningRenderer to draw the **leaf line** (door panel σε 90°-open)
   * from `hingeAnchor` → `hingeArc.points[HINGE_ARC_SUBDIVISIONS]`. Industry
   * convention (AutoCAD / Revit): door plan = swing arc (dashed) + leaf line (solid).
   */
  readonly hingeAnchor?: Point3D;
  /**
   * mm. Second hinge anchor — present only για french-door (dual-leaf).
   * Pairs με the second arc segment (points[HINGE_ARC_SUBDIVISIONS+1]) για
   * the second leaf line.
   */
  readonly hingeAnchor2?: Point3D;
  readonly bbox: BoundingBox3D;
  /** m². Opening face area (width × height in mm → m²). */
  readonly area: number;
  /** m. Perimeter για frame BOQ feed (2 × (width + height) / 1000). */
  readonly perimeter: number;
}

// ─── Entity (BIM generic instantiation) ─────────────────────────────────────

/**
 * Opening BIM entity. Extends `BimEntity` (ADR-363 §5.1) με
 * `kind: OpeningKind` (discriminator για variant-specific rendering).
 *
 * `params.wallId` ορίζει τη host-wall σχέση. Bidirectional consistency is
 * maintained client-side by the persistence layer (Wall.hostedOpeningIds
 * mirror updated optimistically on opening create/delete).
 */
export interface OpeningEntity
  extends BimEntity<OpeningKind, OpeningParams, OpeningGeometry>,
    IfcEntityMixin {
  readonly type: 'opening';
  /** IfcDoor: door/sliding-door/french-door. IfcWindow: window/fixed. */
  readonly ifcType: 'IfcDoor' | 'IfcWindow';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Default frame width (κάσα) when omitted (mm). */
export const DEFAULT_FRAME_WIDTH_MM = 50;

/** Snap increment for opening offset placement (mm). ADR-363 §11 Q2. */
export const OPENING_SNAP_INCREMENT_MM = 50;

/** Minimum allowable opening width (mm). Below this the opening is invalid. */
export const MIN_OPENING_WIDTH_MM = 200;

/** Minimum allowable opening height (mm). */
export const MIN_OPENING_HEIGHT_MM = 200;

/**
 * Per-kind default `width × height × sillHeight` (mm). Source: ADR-363 §5.4
 * + §5.9 seed presets (door-standard 90×210, window-standard 120×140 sill 90,
 * sliding-door 180×220, fixed-glass 200×220). French-door 140×210 sill 0.
 */
export interface OpeningKindDefaults {
  readonly width: number;
  readonly height: number;
  readonly sillHeight: number;
}

export const OPENING_KIND_DEFAULTS: Readonly<Record<OpeningKind, OpeningKindDefaults>> = {
  'door':         { width: 900,  height: 2100, sillHeight: 0   },
  'window':       { width: 1200, height: 1400, sillHeight: 900 },
  'sliding-door': { width: 1800, height: 2200, sillHeight: 0   },
  'french-door':  { width: 1400, height: 2100, sillHeight: 0   },
  'fixed':        { width: 2000, height: 2200, sillHeight: 0   },
};

/** True when the kind has a hinged swing (door / french-door). */
export function isHingedKind(kind: OpeningKind): boolean {
  return kind === 'door' || kind === 'french-door';
}

/** True when the kind is glazed (window / french-door / fixed). */
export function isGlazedKind(kind: OpeningKind): boolean {
  return kind === 'window' || kind === 'french-door' || kind === 'fixed';
}
