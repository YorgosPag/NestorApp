/**
 * ADR-423 / ADR-424 — Stage 0 Semantic Recognition: the agnostic contract (SSoT).
 *
 * Stage 0 turns a loaded DXF/scene into a *meaning model*: classified spaces +
 * typed elements. It is the **single shared foundation** of BOTH frameworks —
 * MEP Auto-Design (ADR-423) and Building Auto-Modeling (ADR-424). Therefore this
 * contract is **discipline-agnostic / authoring-agnostic**: the engine here NEVER
 * imports MEP or structural types. Disciplines plug in `Recognizer`s (and a
 * `SpaceClassifier`) from the outside; the kernel only knows this contract.
 *
 *   MEP terminals/sources         → `recognizers/mep-recognized-types.ts`
 *   structural walls/columns (424) → reserved categories, recognizers land later
 *
 * The recognition model is a **transient read-model** — recomputed from the scene
 * like a geometry cache, NEVER persisted to Firestore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-423-mep-auto-design-framework.md §3
 * @see docs/centralized-systems/reference/adrs/ADR-424-building-auto-modeling-framework.md §3
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { PerimeterShape } from '../../bim/walls/perimeter-polygon-math';

// ─── Recognition tiers (ADR-423 §8 — tiered, ONE contract) ───────────────────

/**
 * How an element was recognized — all tiers feed the SAME contract (no rewrite
 * when later tiers land). Tier 1 (`bim-entity`) is the pilot: our own connectable
 * BIM entities. `dxf-block` (imported plans) + `geometry` (fuzzy/ML) are reserved.
 */
export type RecognitionTier = 'bim-entity' | 'dxf-block' | 'geometry';

// ─── Element categories (MEP active · structural reserved like §2.1 taxonomy) ─

/**
 * The kind of typed thing a recognizer emits. MEP categories are active (ADR-423
 * pilot); the structural/architectural categories are **reserved slots** (ADR-424)
 * — declared now for an SSoT-complete model (mirror of the reserved disciplines in
 * ADR-423 §2.1), wired when ADR-424's element recognizers are built.
 */
export type RecognizedElementCategory =
  // MEP (ADR-423) — active
  | 'mep-terminal'
  | 'mep-source'
  // Structural / architectural (ADR-424) — reserved
  | 'structural-wall'
  | 'structural-column'
  | 'structural-beam'
  | 'structural-slab'
  | 'opening';

// ─── Space classification ─────────────────────────────────────────────────────

/** Semantic room type, inferred from contained elements by a `SpaceClassifier`. */
export type SpaceClassification =
  | 'bathroom'
  | 'wc'
  | 'kitchen'
  | 'utility'
  | 'living'
  | 'bedroom'
  | 'circulation'
  | 'unknown';

// ─── The meaning model ────────────────────────────────────────────────────────

/**
 * A recognized room/space — a closed wall loop promoted to a classified region.
 * Purely geometric + semantic (zero MEP/structural coupling): consumed by MEP
 * (which fixtures are in the bathroom) AND by structural (room → slab boundary).
 * `spaceId` is **deterministic** (geometry-hashed) — no `Date`/random, so the
 * model is stable across recomputes and unit-testable.
 */
export interface RecognizedSpace {
  readonly spaceId: string;
  /** Outer boundary, scene units, CCW normalized (from the ADR-419 engine). */
  readonly polygon: readonly Point2D[];
  /** Inner voids (cores/shafts) entirely inside the boundary, scene units. */
  readonly holes: readonly (readonly Point2D[])[];
  /** m². Net of holes NOT applied here — holes are reported, area is gross. */
  readonly area: number;
  readonly centroid: Point2D;
  readonly shape: PerimeterShape;
  readonly classification: SpaceClassification;
  /** 0..1 — how confident the classifier is (0 ⇒ `'unknown'`). */
  readonly classificationConfidence: number;
  /** `elementId`s bound to this space (smallest-containing-space wins). */
  readonly containedElementIds: readonly string[];
  readonly storeyId: string;
}

/**
 * The agnostic base for any typed element a recognizer finds. Discipline
 * specializations (`RecognizedTerminal`, `RecognizedSource`, future structural)
 * EXTEND this — the kernel only ever sees this shape.
 */
export interface RecognizedElement {
  /** Deterministic, stable id (e.g. `term:<entityId>`). */
  readonly elementId: string;
  readonly category: RecognizedElementCategory;
  /** Representative plan point, scene units (for space-binding). */
  readonly position: Point2D;
  readonly tier: RecognitionTier;
  /** 0..1 — Tier-1 BIM entity = 1 (certain). */
  readonly confidence: number;
  readonly storeyId: string;
  /** Assigned during space-binding — the smallest space that contains it. */
  readonly spaceId?: string;
}

// ─── Recognizer plug-in contract ──────────────────────────────────────────────

/** Read-only view of the scene a recognizer scans (spaces already detected). */
export interface RecognitionContext {
  readonly entities: readonly Entity[];
  readonly storeyId: string;
  readonly sceneUnits: SceneUnits;
  /** Spaces from room detection — recognizers MAY be space-aware. */
  readonly spaces: readonly RecognizedSpace[];
}

/**
 * A pluggable per-discipline recognizer. The engine is GIVEN recognizers (via the
 * registry); it never imports their concrete types. `recognize` is pure — same
 * scene ⇒ same elements (deterministic).
 */
export interface Recognizer<T extends RecognizedElement = RecognizedElement> {
  readonly id: string;
  readonly category: RecognizedElementCategory;
  readonly tier: RecognitionTier;
  recognize(ctx: RecognitionContext): readonly T[];
}

// ─── Engine I/O ───────────────────────────────────────────────────────────────

/** Input to `recognizeScene` — one storey's entities + unit context. */
export interface RecognitionInput {
  readonly entities: readonly Entity[];
  readonly storeyId: string;
  readonly sceneUnits: SceneUnits;
}

/** The full Stage 0 output for one storey. Transient (never persisted). */
export interface RecognitionModel {
  readonly spaces: readonly RecognizedSpace[];
  readonly elements: readonly RecognizedElement[];
  readonly storeyId: string;
}
