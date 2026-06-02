/**
 * BIM Railing — Type Schema (ADR-407, Φ1 vertical slice).
 *
 * Standalone **path-based** railing entity (Revit System Family / `IfcRailing`).
 * The opening slice ships a **straight standalone sketch path** with posts +
 * balusters + a single top rail, but the `RailingType` is the **full Revit-grade
 * model** (3 orthogonal sub-systems: Rail Structure[] + Baluster Placement +
 * Top/Handrail, plus Infill) so later phases (intermediate rails, handrail
 * separation, infill panels, hosting) extend it without a schema break.
 *
 * Architecture (ADR-407): **PATH ⊥ TYPE**. The path (where it goes) is fully
 * independent of the Type (how it is assembled). The geometry is **derived** by
 * the pure SSoT engine `computeRailingGeometry(params, host?)` — we persist the
 * recipe (`RailingParams`), never the solid.
 *
 * Pattern mirrors `mep-fixture-types.ts` / `column-types.ts`: kind + params +
 * geometry cache + validation. All scalar geometry stored in **mm** (BIM
 * convention, §5.0). Path xy lives in **canvas units** (same space as the user
 * click) — identical to `computeMepFixtureGeometry`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type {
  BimEntity,
  BoundingBox3D,
  Point3D,
} from './bim-base';
import type { SceneUnits } from '../../utils/scene-units';
import type { IfcEntityMixin } from './ifc-entity-mixin';

// ─── Sub-type discriminator (ADR-407) ────────────────────────────────────────

/**
 * Railing kind discriminator (= `BimCategory` 'railing'). The opening slice
 * ships `'railing'`; the IFC `PredefinedType` (handrail/guardrail/balustrade)
 * lives on the `RailingType`, not here (a Type can be re-pointed without a new
 * EntityType).
 */
export type RailingKind = 'railing';

/** IfcRailing PredefinedType (IFC4). */
export type RailingPredefinedType = 'handrail' | 'guardrail' | 'balustrade';

/** Member cross-section profile (rail / post / baluster). Round → height = diameter. */
export interface RailProfile {
  readonly shape: 'round' | 'rectangular';
  /** mm. Round → diameter. Rectangular → width (perpendicular to path). */
  readonly widthMm: number;
  /** mm. Rectangular → depth (along path). Round → equals diameter. */
  readonly heightMm: number;
}

// ─── PATH ⊥ TYPE: the path source ────────────────────────────────────────────

/** A railing path = flat polyline in canvas-unit xy (z carried per-vertex, mm). */
export type RailingPath = readonly Point3D[];

/**
 * Source of the railing path. Φ1 ships `'sketch'`; `'hosted'` (Φ2-Φ3) resolves
 * the path from a stair walkline / slab edge via `RailingHostContext`.
 */
export type RailingPathSource =
  | { readonly kind: 'sketch'; readonly path: RailingPath }
  | {
      readonly kind: 'hosted';
      readonly hostId: string;
      readonly hostType: 'stair' | 'slab-edge' | 'ramp';
      readonly side?: 'inner' | 'outer';
    };

// ─── RailingType: 3 orthogonal sub-systems (Revit) ───────────────────────────

/** 1) Rail Structure — one horizontal rail (top or intermediate). */
export interface RailStructureRail {
  readonly id: string;
  /** mm. Height of the rail centreline above the path datum. */
  readonly heightMm: number;
  /** mm. Lateral offset from the path centreline (+ = left of travel). */
  readonly lateralOffsetMm: number;
  readonly profile: RailProfile;
  readonly material?: string;
}

/** 2) Baluster Placement — vertical pattern + posts + per-tread (stair). */
export interface BalusterPlacement {
  readonly pattern: {
    readonly profile: RailProfile;
    /** mm. MAXIMUM clear gap — validated ≤100mm ("10cm ball rule"). */
    readonly spacingMm: number;
    readonly justification: 'start' | 'center' | 'end';
    readonly material?: string;
  };
  readonly posts: {
    readonly enabled: boolean;
    readonly profile: RailProfile;
    readonly atStart: boolean;
    readonly atCorners: boolean;
    readonly atEnd: boolean;
    /** mm. Optional intermediate posts (Φ4+). */
    readonly spacingMm?: number;
    readonly material?: string;
  };
  /** Stair-only (Revit "Baluster Per Tread") — Φ2 hosting. */
  readonly perTread?: { readonly count: 1 | 2 };
}

/** 3) Top Rail / Handrail — continuous top members (Revit sub-types, Φ4). */
export interface ContinuousRail {
  readonly enabled: boolean;
  readonly profile: RailProfile;
  /** mm. Height of the member centreline above the path datum. */
  readonly heightMm: number;
  readonly extension: {
    /** mm. ADA top extension (305mm). Φ4. */
    readonly topMm?: number;
    readonly bottom?: 'one-tread' | number;
    readonly returnToWall?: boolean;
  };
  readonly material?: string;
}

/** Infill (glass / mesh / solid) → IfcPlate (Φ5). */
export interface RailingInfill {
  readonly kind: 'none' | 'glass' | 'mesh' | 'solid';
  readonly thicknessMm?: number;
  readonly material?: string;
}

/** The full reusable named Type (Revit Railing Type). */
export interface RailingType {
  readonly id: string;
  readonly name: string;
  readonly predefinedType: RailingPredefinedType;
  /** Intermediate horizontal rails (top rail lives in `topRail`). */
  readonly railStructure: readonly RailStructureRail[];
  readonly balusterPlacement: BalusterPlacement;
  readonly topRail: ContinuousRail;
  readonly handrail: ContinuousRail;
  readonly infill: RailingInfill;
}

// ─── Parameters (user-editable SSoT) ─────────────────────────────────────────

export interface RailingParams {
  /** The reusable Type (full inline copy in Φ1; named-type lookup arrives Φ6). */
  readonly type: RailingType;
  readonly pathSource: RailingPathSource;
  /** mm. Overall guardrail height (1000–1100 validated). */
  readonly totalHeightMm: number;
  /** mm. Path datum elevation above the storey FFL (FFL-relative, like stair basePoint.z). */
  readonly baseElevationMm: number;
  /**
   * DXF canvas coordinate unit. Stored so the engine can convert mm scalars
   * (spacing/profiles) → canvas units for along-path placement. Defaults `'mm'`.
   */
  readonly sceneUnits?: SceneUnits;
  /** FK → Floor.id (storey reference). Semantic alias for entity-level floorId. */
  readonly storeyId?: string;
}

// ─── Host context (Φ2-Φ3 hosting; reserved, unused in the sketch slice) ──────

/**
 * Resolved host geometry handed to the engine for `pathSource.kind === 'hosted'`.
 * Φ1 never builds this (sketch only); reserved so hosting is non-breaking.
 */
export interface RailingHostContext {
  readonly hostId: string;
  readonly hostType: 'stair' | 'slab-edge' | 'ramp';
  /** Path that already follows the host steps/slope (canvas-unit xy, mm z). */
  readonly resolvedPath: RailingPath;
  /** Run rise/length for sloped balusters (Φ2). */
  readonly slopeRatio?: number;
  /** Per-tread anchor points for "Baluster Per Tread" (Φ2). */
  readonly perTreadAnchors?: readonly Point3D[];
}

// ─── Geometry cache (derived; SSoT = params + engine) ────────────────────────

/** A vertical member (post or baluster) — a prism from `baseZmm` up `heightMm`. */
export interface RailMemberSolid {
  readonly role: 'post' | 'baluster';
  /** Insertion point on the path (canvas-unit xy; z = base elevation, mm). */
  readonly basePoint: Point3D;
  /** mm. Vertical height of the member. */
  readonly heightMm: number;
  /** Degrees CCW — plan rotation aligning a rectangular profile to the path. */
  readonly rotationDeg: number;
  readonly profile: RailProfile;
  readonly material?: string;
}

/** A continuous horizontal member (top rail / handrail / intermediate). */
export interface RailSweep {
  readonly role: 'top-rail' | 'handrail' | 'intermediate';
  /** Polyline of the member centreline (canvas-unit xy; z = member elevation, mm). */
  readonly path: RailingPath;
  readonly profile: RailProfile;
  readonly material?: string;
}

/** An infill panel (glass / mesh / solid) → IfcPlate. Φ5. */
export interface RailPanel {
  readonly kind: 'glass' | 'mesh' | 'solid';
  /** Closed outline of the panel face (canvas-unit xy; z = mm). */
  readonly outline: readonly Point3D[];
  readonly thicknessMm: number;
  readonly material?: string;
}

/**
 * Computed railing geometry. Returned by `computeRailingGeometry(params, host?)`
 * — NEVER mutated by consumers. `lengthM` (running length) drives the BOQ feed.
 */
export interface RailingGeometry {
  /** Path after host-follow (Φ1 sketch = the input path at `baseElevationMm`). */
  readonly resolvedPath: RailingPath;
  readonly posts: readonly RailMemberSolid[];
  readonly balusters: readonly RailMemberSolid[];
  /** Top + intermediate + handrail continuous members. */
  readonly rails: readonly RailSweep[];
  /** Infill panels (empty until Φ5). */
  readonly panels: readonly RailPanel[];
  readonly bbox: BoundingBox3D;
  /** m. Running length of the path (BOQ primary quantity). */
  readonly lengthM: number;
}

// ─── Entity (BIM generic instantiation) ──────────────────────────────────────

/**
 * Railing BIM entity. `type` is the dispatch key `'railing'`; the V/G category
 * is the same string `'railing'` → discipline `'architectural'` (ADR-405).
 */
export interface RailingEntity
  extends BimEntity<RailingKind, RailingParams, RailingGeometry>,
    IfcEntityMixin {
  readonly type: 'railing';
  /** IFC4 class — always `IfcRailing` (PredefinedType lives on the Type). */
  readonly ifcType: 'IfcRailing';
}

// ─── Defaults & constants ────────────────────────────────────────────────────

/** Default overall guardrail height (mm) — Eurocode/IBC minimum. */
export const DEFAULT_RAILING_TOTAL_HEIGHT_MM = 1000;

/** Maximum clear baluster spacing (mm) — "10cm ball rule" (Eurocode/IBC). */
export const MAX_BALUSTER_SPACING_MM = 100;

/** Default baluster clear spacing (mm). */
export const DEFAULT_BALUSTER_SPACING_MM = 100;

/** Minimum member dimension (mm) — below this is a degenerate profile. */
export const MIN_RAILING_DIMENSION_MM = 5;

/** Default round baluster diameter (mm). */
export const DEFAULT_BALUSTER_DIAMETER_MM = 16;

/** Default square post side (mm). */
export const DEFAULT_POST_SIZE_MM = 40;

/** Default round top-rail diameter (mm). */
export const DEFAULT_TOP_RAIL_DIAMETER_MM = 50;

const ROUND_BALUSTER_PROFILE: RailProfile = {
  shape: 'round',
  widthMm: DEFAULT_BALUSTER_DIAMETER_MM,
  heightMm: DEFAULT_BALUSTER_DIAMETER_MM,
};

const SQUARE_POST_PROFILE: RailProfile = {
  shape: 'rectangular',
  widthMm: DEFAULT_POST_SIZE_MM,
  heightMm: DEFAULT_POST_SIZE_MM,
};

const ROUND_TOP_RAIL_PROFILE: RailProfile = {
  shape: 'round',
  widthMm: DEFAULT_TOP_RAIL_DIAMETER_MM,
  heightMm: DEFAULT_TOP_RAIL_DIAMETER_MM,
};

/**
 * The single built-in Railing Type for Φ1 — a metal guardrail with corner/end
 * posts, a centred top rail at the overall height, and round balusters at the
 * 10cm-ball-rule spacing. Handrail-separation, intermediate rails and infill are
 * disabled here and arrive in later phases (the schema already supports them).
 */
export const DEFAULT_RAILING_TYPE: RailingType = {
  id: 'railing-type-default',
  name: 'Guardrail 1000 — Round Balusters',
  predefinedType: 'guardrail',
  railStructure: [],
  balusterPlacement: {
    pattern: {
      profile: ROUND_BALUSTER_PROFILE,
      spacingMm: DEFAULT_BALUSTER_SPACING_MM,
      justification: 'center',
    },
    posts: {
      enabled: true,
      profile: SQUARE_POST_PROFILE,
      atStart: true,
      atCorners: true,
      atEnd: true,
    },
  },
  topRail: {
    enabled: true,
    profile: ROUND_TOP_RAIL_PROFILE,
    heightMm: DEFAULT_RAILING_TOTAL_HEIGHT_MM,
    extension: {},
  },
  handrail: {
    enabled: false,
    profile: ROUND_TOP_RAIL_PROFILE,
    heightMm: 900,
    extension: {},
  },
  infill: { kind: 'none' },
};
