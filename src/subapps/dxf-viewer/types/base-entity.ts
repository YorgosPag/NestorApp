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
  // ADR-575 — composite GROUP «Ομαδοποίηση» (in-place container of member entities).
  | 'group'
  | 'stair'
  | 'center-mark'
  | 'centerline'
  | 'wall'
  | 'opening'
  | 'slab'
  | 'slab-opening'
  | 'column'
  | 'beam'
  // ADR-436 — structural foundation (pad/strip/tie-beam, IfcFooting).
  | 'foundation'
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
  // ADR-408 DHW — point-based domestic hot water heater (DHW source, IfcUnitaryEquipment).
  | 'mep-water-heater'
  // ADR-408 Eyros B #3 — area-based radiant floor heating loop (IfcSpaceHeater).
  | 'mep-underfloor'
  // ADR-419 — thin polygon floor covering per room (IfcCovering FLOORING).
  | 'floor-finish'
  // ADR-511 — wall finish per room/face (IfcCovering CLADDING/INTERIOR).
  | 'wall-covering'
  // ADR-422 — analytical thermal space / θερμικός χώρος (IfcSpace).
  | 'thermal-space'
  // ADR-437 — space separator / γραμμή διαχωρισμού χώρου (IfcVirtualElement).
  | 'space-separator'
  // ADR-583 — non-BIM drawing annotation symbol (North arrow / scale bar / section mark).
  | 'annotation-symbol'
  // ADR-583 Φ2 — non-BIM graphic scale-bar (dedicated sibling of dimension/center-mark).
  | 'scale-bar'
  // ADR-612 — non-BIM opening info tag (πινακίδα ανοίγματος: 3 editable numeric cells).
  | 'opening-info-tag'
  // ADR-651 Φάση Ε — non-BIM raster image (εικόνα σε ορθογώνιο πλαίσιο).
  | 'image';

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
   * ADR-608 — grouping provenance. When an annotation symbol / scale-bar is
   * decomposed into neutral primitives (`neutral-primitive-factory.ts`), every
   * child primitive inherits the SOURCE entity id here so backends that support
   * grouping can re-assemble the symbol as ONE selectable unit: Tekton `<taglist>`
   * (one shared tag per symbol) and DXF anonymous BLOCK/INSERT. Absent ⇒ the
   * primitive is standalone (no group). SSoT: the source annotation entity id.
   */
  groupId?: string;

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
  /**
   * ADR-510 Φ2 — render-time resolved linetype pattern in mm (positive = dash,
   * negative = gap, 0 = dot, empty/absent = solid). Produced by the style
   * cascade (`ResolvedStyle.linetype.pattern`), consumed at stroke time by
   * `rendering/linetype-dash-resolver.ts` → `ctx.setLineDash`. Zoom-aware,
   * unlike `lineweight` (zoom-independent LWT).
   */
  dashMm?: ReadonlyArray<number>;
  /**
   * ADR-510 Φ2 — per-object linetype scale (AutoCAD CELTSCALE, DXF group 48).
   * Multiplies the dash pattern on top of global LTSCALE + zoom at stroke time.
   * Default 1. Canonical per-object scale; the legacy `dashScale` (settings/px
   * path) is being folded into this via the alias bridge (ADR-510 Φ2D).
   */
  ltscale?: number;
  dashScale?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dashOffset?: number;

  breakAtCenter?: boolean;
  showEdgeDistances?: boolean;

  /**
   * ADR-650 M3 — non-destructive «fitted curve» DISPLAY of a polyline, the
   * AutoCAD spline-fit-polyline / Civil 3D Surface-Style «Contour Smoothing»
   * model. When true, a (lw)polyline is STROKED as a Catmull-Rom curve through
   * its vertices instead of straight chords; `vertices` (the control points) are
   * NEVER mutated, so hit-test, grips, DXF export and any legal/Κτηματολόγιο
   * output keep the EXACT surveyed geometry. Absent/false ⇒ exact chords (the
   * default, and what topographic contours use for legal deliverables).
   * Applied only to polyline/lwpolyline at stroke time; ignored elsewhere.
   */
  smoothDisplay?: boolean;

  /**
   * ADR-570 Φ1 — ByStyle pointer to a named `LineStyle`
   * (`systems/line-styles/line-style-registry`). Absent ⇒ ByLayer / per-object
   * override (backward-compatible; no migration needed). Firestore `?? null`,
   * NEVER explicit `undefined`. Resolution: per-object override → ByStyle → ByLayer.
   */
  lineStyleId?: string;

  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  colorAci?: number;
  colorTrueColor?: number | null;
  linetypeName?: string;
  lineweightMm?: LineweightMm;
  transparency?: number;
}
