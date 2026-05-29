/**
 * BIM Drawing Mode — Base Types
 * ADR-363: Generic Parametric Building Element pattern (§5.1)
 *
 * Pattern mirrors ADR-358 StairEntity: kind + params + geometry cache + validation.
 * All geometry stored in mm (same as stair §5.0).
 * Point3D has optional z for 3D-readiness (G11).
 */

import type { Timestamp } from 'firebase/firestore';
import type { BaseEntity } from '../../types/base-entity';
import type { BimElementStyleOverride } from '../../config/bim-object-styles';

// ─── 3D Geometry primitives ───────────────────────────────────────────────────

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z?: number; // mm, optional — 3D-readiness G11
}

export interface Polyline3D {
  readonly points: readonly Point3D[];
  readonly closed?: boolean;
}

export interface Polygon3D {
  readonly vertices: readonly Point3D[];
  // Vertices form a closed polygon (last point connects to first)
}

export interface BoundingBox3D {
  readonly min: Point3D;
  readonly max: Point3D;
}

// ─── BIM Element taxonomy ────────────────────────────────────────────────────

/** Discriminator for the 6 BIM entity types (ADR-363 §5.2) */
export type BimElementType = 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam';

/**
 * Union of all BIM sub-type discriminators (one per element type).
 * Narrowed to specific kind union at the concrete entity interface level.
 *
 * NOTE: Does NOT include stair kinds — stair uses its own StairKind union.
 * BimEntity<TKind> uses `TKind extends string` (not this) so stair can extend BimEntity too.
 */
export type BimElementKind =
  | 'straight' | 'curved' | 'polyline'           // wall kinds
  | 'door' | 'window' | 'sliding-door' | 'french-door' | 'fixed' // opening kinds
  | 'floor' | 'ceiling' | 'roof' | 'ground' | 'foundation'       // slab kinds
  | 'shaft' | 'well' | 'duct' | 'chimney'         // slab-opening kinds
  | 'rectangular' | 'circular' | 'L-shape' | 'T-shape'           // column kinds
  | 'cantilever';                                  // beam additional kind

// ─── ΑΤΟΕ category codes (ADR-175 §3.3) ─────────────────────────────────────

export type AtoeCategoryCode =
  | 'ΟΙΚ-1' | 'ΟΙΚ-2' | 'ΟΙΚ-3' | 'ΟΙΚ-4' | 'ΟΙΚ-5'
  | 'ΟΙΚ-6' | 'ΟΙΚ-7' | 'ΟΙΚ-8' | 'ΟΙΚ-9' | 'ΟΙΚ-10'
  | 'ΟΙΚ-11' | 'ΟΙΚ-12';

// ─── Building-code validation result ─────────────────────────────────────────

export interface BimValidation {
  readonly hasCodeViolations: boolean;
  /** i18n keys for violations (empty when no violations) */
  readonly violationKeys: readonly string[];
  readonly lastValidatedAt: Timestamp | null;
}

// ─── Multi-user soft lock (ADR-358 G24 pattern) ───────────────────────────────

/** Minimal lock shape — all BIM entities satisfy this. Concrete types can extend it. */
export interface BimLock {
  readonly userId: string;
}

/** Full soft lock for Phase 1+ BIM entities (Wall/Slab/Column/Beam/Opening). */
export interface SoftLock extends BimLock {
  readonly displayName: string;
  readonly lockedAt: Timestamp;
}

// ─── Generic BIM Entity base (§5.1) ──────────────────────────────────────────

/**
 * Generic parametric building element.
 * TKind narrows to the element's sub-type union (e.g. WallKind, StairKind).
 * TParams holds user-editable parameters.
 * TGeometry holds computed geometry cache (re-derivable from params on corruption).
 *
 * Constraint: TKind extends string (not BimElementKind) so that StairKind can also use this generic.
 *
 * ADR-395 §4.6 (G5): no `qto` field — BIM quantities are geometry-derived at
 * read time (BOQ bridge + Schedule combined preset via `deriveAtoeQuantity`).
 */
export interface BimEntity<TKind extends string, TParams, TGeometry>
  extends BaseEntity {
  readonly kind: TKind;
  readonly params: TParams;
  /** Computed geometry cache. Source of truth = params. */
  readonly geometry: TGeometry;
  readonly validation: BimValidation;
  /** Display-only multi-user lock (never blocks writes) */
  readonly editingBy?: BimLock;
  /** Per-element style override (ADR-375 Phase C.5). Persisted in Firestore entity doc. */
  readonly styleOverride?: BimElementStyleOverride;
  // Firestore tenant fields (present on persisted entities)
  readonly companyId?: string;
  readonly projectId?: string;
  readonly buildingId?: string;
  readonly floorplanId?: string;
  readonly floorId?: string;
  readonly createdAt?: Timestamp | null;
  readonly updatedAt?: Timestamp | null;
  readonly createdBy?: string;
  readonly updatedBy?: string;
}

// ─── Params union helper (used by BimTypePickerDialog) ───────────────────────

/** Placeholder type for BimPreset generic param. Concrete types narrow this. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BimParams<_TKind> = Record<string, any>;

// ─── Default factory helpers ──────────────────────────────────────────────────

export function makeBimValidation(): BimValidation {
  return {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: null,
  };
}

