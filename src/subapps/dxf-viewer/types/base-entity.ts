/**
 * BaseEntity + EntityType extracted from entities.ts to break circular import:
 *   entities.ts → bim/types/wall-types.ts → bim/types/bim-base.ts → entities.ts
 *
 * bim-base.ts now imports BaseEntity from here instead of entities.ts.
 * entities.ts re-exports from here for backward compat.
 *
 * ADR-363 Phase 1 fix — 2026-05-18.
 */

import type { Point2D } from '../rendering/types/Types';
import type { LineweightMm } from './scene-types';
import type { Discipline } from '../bim/discipline/bim-discipline';

export interface PreviewGripPoint {
  position: Point2D;
  type: 'start' | 'end' | 'cursor' | 'vertex' | 'close';
  color?: string;
}

export type EntityType =
  | 'line'
  | 'polyline'
  | 'lwpolyline'
  | 'circle'
  | 'arc'
  | 'ellipse'
  | 'text'
  | 'mtext'
  | 'spline'
  | 'rectangle'
  | 'rect'
  | 'point'
  | 'dimension'
  | 'block'
  | 'angle-measurement'
  | 'leader'
  | 'hatch'
  | 'xline'
  | 'ray'
  | 'array'
  | 'stair'
  | 'center-mark'
  | 'centerline'
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'
  | 'column'
  | 'beam'
  // ADR-406 — point-based MEP fixture (light fixture first; generic over kind).
  | 'mep-fixture'
  // ADR-408 Φ3 — point-based electrical panel (circuit source, IfcElectricDistributionBoard).
  | 'electrical-panel'
  // ADR-408 Φ12 — point-based plumbing manifold (pipe-network source, IfcPipeFitting).
  | 'mep-manifold'
  // ADR-407 — standalone path-based railing (IfcRailing).
  | 'railing'
  // ADR-410 — mesh-based CC0 furniture (chair first; generic over kind).
  | 'furniture'
  // ADR-408 Φ8 — unified linear MEP segment (duct + pipe; domain-discriminated).
  | 'mep-segment'
  // ADR-408 Φ11 — auto pipe fitting (point-based junction element; IfcPipeFitting).
  | 'mep-fitting'
  // ADR-415 — pure-vector 2D floorplan symbol (category-driven; WC/sanitary first).
  | 'floorplan-symbol'
  // ADR-417 — parametric pitched roof (footprint + per-edge slopes; IfcRoof).
  | 'roof'
  // ADR-408 Εύρος Β — point-based hydronic radiator (heating terminal, IfcSpaceHeater).
  | 'mep-radiator'
  // ADR-408 Eyros B #2 — point-based hydronic boiler (heating source, IfcBoiler).
  | 'mep-boiler'
  // ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING).
  | 'floor-finish';

export interface BaseEntity {
  id: string;
  name?: string;
  type: EntityType;
  /** ADR-358 Phase 9E-6e: stable layer identifier `lyr_<UUID-v4>`. Required on all entities. */
  layerId: string;
  color?: string;
  selected?: boolean;
  preview?: boolean;
  measurement?: boolean;
  isOverlayPreview?: boolean;
  showPreviewGrips?: boolean;
  previewGripPoints?: Point2D[] | PreviewGripPoint[];
  visible?: boolean;
  locked?: boolean;
  metadata?: Record<string, unknown>;

  /**
   * ADR-405 — per-instance Discipline override (Firestore-persisted). Absent ⇒
   * discipline is type-derived via `DISCIPLINE_BY_CATEGORY` (BIM-native default).
   * Mirrors Revit's per-element discipline reassignment. Non-destructive: every
   * existing entity resolves to the correct discipline without migration.
   */
  discipline?: Discipline;

  lineweight?: number;
  opacity?: number;
  lineType?: 'solid' | 'dashed' | 'dotted' | 'dashdot';
  dashScale?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dashOffset?: number;

  breakAtCenter?: boolean;
  showEdgeDistances?: boolean;

  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  colorAci?: number;
  colorTrueColor?: number | null;
  linetypeName?: string;
  lineweightMm?: LineweightMm;
  transparency?: number;
}
