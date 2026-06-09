/**
 * ADR-435 — Coordination / Clash Detection · core types (Slice 0).
 *
 * The clash engine is decoupled from the scene `Entity` union: every BIM entity
 * is first normalised into a unit-consistent {@link ClashEntity} (all geometry in
 * **metres**, the only sane common space — cached `geometry.bbox` mixes canvas-unit
 * XY with metre Z, and point equipment stores z=0; see `entity-world-aabb.ts`).
 *
 * Output is a transient, read-only {@link ClashReport} (Revit/Navisworks "Clash
 * Detective" model) — never persisted, mirror of the auto-design proposal stores.
 *
 * @see ./entity-world-aabb.ts  — Entity → ClashEntity normaliser (SSoT)
 * @see ./detect-clashes.ts     — orchestrator
 * @see docs/centralized-systems/reference/adrs/ADR-435-clash-detection.md
 */

/** A 3D point/vector in metres (Three.js-style, but plan-space agnostic). */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Axis-aligned bounding box, metres, min/max corner representation. */
export interface Aabb3 {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** A linear MEP run approximated as a capsule (centreline a→b, outer radius). */
export interface ClashCapsule {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly radiusM: number;
}

/**
 * The entity kinds the clash engine understands. A subset of `BimElementType`
 * (the kinds that carry a meaningful 3D solid). Structural = beam/column/wall/slab.
 */
export type ClashEntityKind =
  | 'mep-segment'
  | 'mep-fitting'
  | 'beam'
  | 'column'
  | 'wall'
  | 'slab'
  | 'mep-fixture'
  | 'mep-radiator'
  | 'mep-boiler'
  | 'mep-water-heater';

/** Hard = solids interpenetrate. Clearance = legal gap violated (soft clash). */
export type ClashType = 'hard' | 'clearance';

/** Triage colour: structural penetration = high, MEP↔MEP = medium, clearance = low. */
export type ClashSeverity = 'high' | 'medium' | 'low';

/**
 * Normalised, unit-consistent clash candidate. Built once per entity by
 * `entityWorldAABB`, then fed to broad + narrow phase. All coordinates in metres.
 */
export interface ClashEntity {
  readonly id: string;
  readonly kind: ClashEntityKind;
  /** World AABB (metres) — broad-phase primitive. */
  readonly aabb: Aabb3;
  /** Present for linear MEP segments — enables exact capsule narrow-phase. */
  readonly capsule?: ClashCapsule;
  /** Plumbing/MEP classification (e.g. `'sanitary-drainage'`) for clearance rules. */
  readonly discipline?: string;
  /** MepSystem ids this entity belongs to (member or source) — legit-connection filter. */
  readonly systemIds: readonly string[];
}

/** A single detected clash between two entities. Transient. */
export interface Clash {
  readonly id: string;
  readonly aId: string;
  readonly bId: string;
  readonly aKind: ClashEntityKind;
  readonly bKind: ClashEntityKind;
  readonly type: ClashType;
  readonly severity: ClashSeverity;
  /** Representative clash location, world metres. */
  readonly point: Vec3;
  /**
   * Signed separation in mm at the clash: **negative** = penetration depth
   * (hard), **positive** = remaining gap below the required clearance.
   */
  readonly separationMm: number;
  /** Id of the {@link ClashRule} that fired. */
  readonly ruleId: string;
}

/**
 * Pluggable clash criterion — mirror of the pluggable demand/sizing standards in
 * the auto-design registry. A hard rule fires on solid overlap; a clearance rule
 * fires when the gap is below `clearanceMm`. Kept out of the engine so regulation
 * thresholds (gas↔services, drainage↔potable …) live in data, not control flow.
 */
export interface ClashRule {
  readonly id: string;
  readonly type: ClashType;
  /** Required minimum gap in mm — only for `type: 'clearance'`. */
  readonly clearanceMm?: number;
  readonly severity: ClashSeverity;
  /** Does this rule govern this unordered pair? */
  applies(a: ClashEntity, b: ClashEntity): boolean;
}

/** Transient, read-only result of one detection run. */
export interface ClashReport {
  readonly clashes: readonly Clash[];
  /** How many entities were normalised + scanned (no silent caps — surfaced in UI). */
  readonly scannedEntities: number;
  /** Candidate pairs after broad-phase (before narrow-phase / filtering). */
  readonly candidatePairs: number;
  /** Pairs that actually reached narrow-phase (after legit-connection filtering). */
  readonly testedPairs: number;
}
