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
import type { EnvelopeLayer } from './thermal-envelope-types';
import type { OpeningOperationType } from './opening-operation-types';
// ADR-421 SLICE C — Family/Type link. Type-only import (TS resolves the
// bim-family-type ↔ opening-types type cycle; no runtime dependency).
import type { OpeningTypeParams } from './bim-family-type';

// ─── Sub-type discriminator (ADR-363 §5.4) ───────────────────────────────────

/**
 * Opening kind discriminator (ADR-363 §5.4· ADR-421 family catalog).
 * Family = κατηγορία γεωμετρίας/operation (Revit Family). Ο μηχανισμός ανοίγματος
 * (IFC) εκφράζεται ρητά μέσω `OpeningParams.operationType` (ADR-421 §A2).
 */
export type OpeningKind =
  // ─── Doors (IfcDoor) ──────────────────────────────────────────────────────
  | 'door'
  | 'double-door'
  | 'sliding-door'
  | 'double-sliding-door'
  | 'pocket-door'
  | 'bifold-door'
  | 'overhead-door'
  | 'revolving-door'
  | 'french-door'
  // ─── Windows (IfcWindow) ──────────────────────────────────────────────────
  | 'window'
  | 'fixed'
  | 'double-hung-window'
  | 'sliding-window'
  | 'awning-window'
  | 'hopper-window'
  | 'tilt-turn-window'
  | 'bay-window';

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
   * ADR-421 §A2 — Ρητός μηχανισμός λειτουργίας (IFC operation). Optional/non-breaking:
   * legacy openings → resolve από `kind` (+`handing`) μέσω `resolveOperationType()`
   * (SSoT `opening-operation-types.ts`). Auto-filled στο factory. Καθορίζει το IFC
   * export fidelity (IfcDoorTypeOperationEnum / IfcWindowPanelOperationEnum).
   */
  readonly operationType?: OpeningOperationType;
  /**
   * ADR-376 Phase A — Instance Mark (ταμπελάκι). Auto-allocated on placement
   * via `OpeningMarkService` with per-kind prefix + floor-prefix hundreds
   * (e.g. `Θ.101`, `Π.001`, `ΣΥ.205`). User override-able. Undefined for
   * legacy openings; lazy-allocated on first render (migration script).
   */
  readonly mark?: string;
  /**
   * ADR-376 Phase B.1 — Manual mark override tracking. Set `true` when the
   * user edits the Mark via the ribbon Mark field; renumber operations
   * (`opening-renumber-service`) skip these instances by default (industry
   * pattern — IMAGINiT / ArchiCAD / Tekla / Bentley / Vectorworks 5/5).
   * Modal opt-in toggle allows wiping manual overrides on demand.
   */
  readonly markIsManual?: boolean;
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
  /**
   * ADR-396 Phase P2 — Reveal insulation (Zone Z4, περβάζια κουφωμάτων).
   * Ένα `EnvelopeLayer` (zone='Z4') που εκφράζει κοινό υλικό + πάχος για τις
   * 4 λωρίδες (αρ./δεξ./πάνω/κάτω) που ντύνουν εσωτερικά το άνοιγμα. Οι
   * γεωμετρικές διαστάσεις των λωρίδων υπολογίζονται από
   * `computeRevealStrips()` (envelope-contribution). Optional/non-breaking·
   * χωριστό πάχος από Z1 (default 0.05m). Set by the P6 auto-apply command.
   */
  readonly revealInsulation?: EnvelopeLayer;
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
  /** mm. ΕΛΕΥΘΕΡΟ cutout rectangle outline (4 vertices, world coords) = το κούφωμα. */
  readonly outline: Polygon3D;
  /**
   * mm. STRUCTURAL cutout outline (ADR-396) — το ελεύθερο `outline` διευρυμένο κατά
   * το πάχος της περιμετρικής μόνωσης (Z4) σε κάθε άκρο κατά τον άξονα. Ορίζει το
   * **δομικό κενό στον τοίχο** (η μόνωση τρώει τον τοίχο, όχι το κούφωμα). Present
   * μόνο όταν `params.revealInsulation` υπάρχει — αλλιώς undefined (consumers → free).
   */
  readonly revealOutline?: Polygon3D;
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
  /**
   * ADR-421 SLICE C (ADR-412) — FK → `BimFamilyType.id`. Absent on legacy/untyped
   * openings (legacy fast-path in `resolveEffectiveOpeningParams` = zero regression).
   * The Type owns `kind`/`width`/`height`/frame/material/glazing/fireRating.
   */
  readonly typeId?: string;
  /**
   * ADR-421 SLICE C (ADR-412) — per-instance overrides of type-level params.
   * Win last over both instance cache and type («overrides win last»).
   */
  readonly typeOverrides?: Partial<OpeningTypeParams>;
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
  // ─── Doors ──────────────────────────────────────────────────────────────
  'door':                 { width: 900,  height: 2100, sillHeight: 0    },
  'double-door':          { width: 1400, height: 2100, sillHeight: 0    },
  'sliding-door':         { width: 1800, height: 2200, sillHeight: 0    },
  'double-sliding-door':  { width: 2400, height: 2200, sillHeight: 0    },
  'pocket-door':          { width: 900,  height: 2100, sillHeight: 0    },
  'bifold-door':          { width: 1800, height: 2100, sillHeight: 0    },
  'overhead-door':        { width: 2400, height: 2200, sillHeight: 0    },
  'revolving-door':       { width: 2000, height: 2200, sillHeight: 0    },
  'french-door':          { width: 1400, height: 2100, sillHeight: 0    },
  // ─── Windows ────────────────────────────────────────────────────────────
  'window':               { width: 1200, height: 1400, sillHeight: 900  },
  'fixed':                { width: 2000, height: 2200, sillHeight: 0    },
  'double-hung-window':   { width: 900,  height: 1500, sillHeight: 900  },
  'sliding-window':       { width: 1500, height: 1200, sillHeight: 900  },
  'awning-window':        { width: 900,  height: 600,  sillHeight: 1800 },
  'hopper-window':        { width: 800,  height: 600,  sillHeight: 300  },
  'tilt-turn-window':     { width: 800,  height: 1300, sillHeight: 900  },
  'bay-window':           { width: 2400, height: 1500, sillHeight: 600  },
};

/** True when the kind has a hinged swing (door / double-door / french-door). */
export function isHingedKind(kind: OpeningKind): boolean {
  return kind === 'door' || isDoubleLeafKind(kind);
}

/**
 * True when the kind has TWO hinged leaves (double-door / french-door) — both
 * draw a mirrored swing arc + leaf line per jamb. SSoT για dual-leaf geometry
 * (`buildHingeArc`) και dual-leaf 3D mesh (`opening-mesh.ts`).
 */
export function isDoubleLeafKind(kind: OpeningKind): boolean {
  return kind === 'french-door' || kind === 'double-door';
}

/**
 * True when the kind is glazed (transparent panel → 3D glass material + 2D
 * glazing double-line). Covers `french-door` (glazed door) + all window
 * families. SSoT για `opening-mesh` panel material + `OpeningRenderer` glazing.
 */
export function isGlazedKind(kind: OpeningKind): boolean {
  return (
    kind === 'french-door' ||
    isWindowKind(kind)
  );
}

/**
 * True when the kind maps to **IfcWindow** (glazing-only element, no door
 * lining). SSoT για `inferOpeningIfcType` (factory + IFC loader) ώστε τα νέα
 * window families (double-hung / sliding / awning / hopper / tilt-turn / bay)
 * να μην ταξινομούνται λανθασμένα ως IfcDoor. `french-door` είναι IfcDoor.
 */
export function isWindowKind(kind: OpeningKind): boolean {
  return (
    kind === 'window' ||
    kind === 'fixed' ||
    kind === 'double-hung-window' ||
    kind === 'sliding-window' ||
    kind === 'awning-window' ||
    kind === 'hopper-window' ||
    kind === 'tilt-turn-window' ||
    kind === 'bay-window'
  );
}

/**
 * True for the **sliding-door** mechanism family (single rail track in plan,
 * offset/overlapping panel in 3D). Covers single / double-sliding / pocket.
 * Distinct from the sliding *window* families (which render as glazing + arrow).
 */
export function isSlidingKind(kind: OpeningKind): boolean {
  return (
    kind === 'sliding-door' ||
    kind === 'double-sliding-door' ||
    kind === 'pocket-door'
  );
}

/** True for the folding (φυσαρμόνικα / bi-fold) door family — zig-zag plan symbol. */
export function isFoldingKind(kind: OpeningKind): boolean {
  return kind === 'bifold-door';
}

// ─── Plan-view symbol dispatch (SSoT) ────────────────────────────────────────

/**
 * 2D plan-view symbol family ανά kind (Revit symbolic plan). Μοναδικός
 * discriminator που οδηγεί τον `OpeningRenderer` overlay dispatch (μέσω
 * `opening-overlay-drawing.ts`). Exhaustive → ο tsc εγγυάται κάλυψη κάθε kind.
 */
export type OpeningPlanSymbol =
  | 'swing'              // hinge arc + leaf line(s): door / double-door / french-door
  | 'sliding'            // rail track (+ pocket extension): sliding / double-sliding / pocket
  | 'folding'            // zig-zag V panels: bifold
  | 'overhead'           // sectional horizontal lines: overhead garage
  | 'revolving'          // circle + 4-blade cross: revolving
  | 'glazing'            // plain glazing double-line: window / fixed
  | 'glazing-slide-h'    // glazing + horizontal arrow ↔: sliding-window
  | 'glazing-slide-v'    // glazing + vertical arrow ↕: double-hung
  | 'glazing-awning'     // glazing + top hinge mark ▲: awning
  | 'glazing-hopper'     // glazing + bottom hinge mark ▼: hopper
  | 'glazing-tilt-turn'  // glazing + L mark: tilt-turn
  | 'bay';               // projecting polygonal outline: bay

/** Per-kind plan symbol (exhaustive SSoT). */
export const OPENING_PLAN_SYMBOL: Readonly<Record<OpeningKind, OpeningPlanSymbol>> = {
  // ─── Doors ──────────────────────────────────────────────────────────────
  'door':                'swing',
  'double-door':         'swing',
  'french-door':         'swing',
  'sliding-door':        'sliding',
  'double-sliding-door': 'sliding',
  'pocket-door':         'sliding',
  'bifold-door':         'folding',
  'overhead-door':       'overhead',
  'revolving-door':      'revolving',
  // ─── Windows ────────────────────────────────────────────────────────────
  'window':              'glazing',
  'fixed':               'glazing',
  'sliding-window':      'glazing-slide-h',
  'double-hung-window':  'glazing-slide-v',
  'awning-window':       'glazing-awning',
  'hopper-window':       'glazing-hopper',
  'tilt-turn-window':    'glazing-tilt-turn',
  'bay-window':          'bay',
};
