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
 * ADR-615 — `wallId` is now OPTIONAL: absent ⇒ the opening is **self-hosted**
 * (free-standing, no BIM wall) and `selfHost` MUST be set instead. Exactly
 * one of `wallId` / `selfHost` is set — see `isSelfHostedOpening()`.
 *
 * Positioning along host wall:
 *   - `offsetFromStart` (mm) is measured along the wall axis from `wall.start`.
 *   - `offsetFromStart + width ≤ wall.length` (validator hard error otherwise).
 *   - Self-hosted: `offsetFromStart` is always 0 (the host IS the opening).
 *
 * Optional fields:
 *   - `frameWidth` — κάσα width (mm). Default 50mm για doors / windows.
 *   - `handing` / `openDirection` — applicable only to door / french-door.
 *   - `glazingPanes` — number of glass panes (1 single / 2 double / 3 triple).
 *   - `material` — material library ID (Phase 6+).
 */

/**
 * ADR-615 — Free-standing host synthesis parameters. Present iff `wallId` is
 * absent on `OpeningParams` (discriminator). Feeds `selfOpeningHost()` to
 * synthesize a straight 2-vertex `OpeningHost` axis so the opening geometry
 * engine can run without a BIM wall.
 */
export interface OpeningSelfHost {
  /** mm world coords — centre of the opening (self-host axis midpoint). */
  readonly anchor: Point3D;
  /** rad — axis orientation, typically snapped to the underlying DXF line. */
  readonly rotationRad: number;
  /** mm — "wall thickness" the free-standing symbol shows. */
  readonly hostThicknessMm: number;
}

/**
 * Per-part material assignment for an opening — the Revit/ArchiCAD «family
 * surfaces» model: the frame (κάσα), leaf (φύλλο), glazing (υαλοστάσιο) and
 * hardware (χειρολαβή/μηχανισμός) each carry their OWN material, never inherited
 * from the host wall (ADR-669 §6.1 element boundary). Each field is a material
 * library id resolved by `getMaterial3D` — a catalog key (`mat-*`) or a custom
 * user-library id (`bmat_*`). Undefined part ⇒ the resolver falls back to that
 * part's default (frame/leaf = wood, glass = glass, hardware = metal) — identical
 * to the pre-ADR pipeline (zero regression). Mirrors {@link StairMaterials}.
 *
 * Lives on BOTH the family Type ({@link OpeningTypeParams.materials}) and the
 * instance ({@link OpeningParams.materials}): the Type owns the appearance, the
 * instance overrides it («type default, instance override»). Resolved via
 * `resolveOpeningMaterial()`.
 */
export interface OpeningMaterials {
  /** Frame (κάσα) surface material id. Default `mat-wood`. */
  readonly frame?: string;
  /** Leaf (φύλλο) surface material id. Default `mat-wood`. */
  readonly leaf?: string;
  /** Glazing (υαλοστάσιο) surface material id. Glazed kinds. Default `mat-glass`. */
  readonly glass?: string;
  /** Hardware (χειρολαβή/μηχανισμός) surface material id. Default `mat-metal`. */
  readonly hardware?: string;
}

/**
 * ADR-673 — Vertical placement of a door's bottom frame member (κατώφλι/threshold)
 * relative to the Finished Floor Level (FFL, the opening datum Y=0):
 *  - `'none'`      → profile BOTTOM rests on the finished floor (visible low step-over).
 *  - `'flush-top'` → profile TOP flush with the finished floor/tiles (buried in the
 *                    screed → ομαλή μετάβαση εσωτερικό↔εξώστη, χωρίς σκαλί).
 *  - `'on-slab'`   → profile BOTTOM rests on the structural slab top / γκρο μπετό
 *                    (FFL − `Floor.finishThickness`; reuses the storey finish SSoT).
 *  - `'custom'`    → profile BOTTOM sunk `thresholdEmbedMm` below FFL (manual depth).
 */
export type OpeningThresholdEmbed = 'none' | 'flush-top' | 'on-slab' | 'custom';

export interface OpeningParams {
  readonly kind: OpeningKind;
  /** Foreign key — host wall id. ADR-615: absent ⇒ self-hosted (see `selfHost`). */
  readonly wallId?: string;
  /**
   * ADR-615 — Free-standing host synthesis params. Present ⇔ `wallId` is
   * absent (discriminator, see `isSelfHostedOpening()`). Synthesizes a
   * straight 2-vertex axis (via `selfOpeningHost()`) so the opening does not
   * require a BIM wall — used when placing a κούφωμα directly on imported
   * DXF lines.
   */
  readonly selfHost?: OpeningSelfHost;
  /** mm. Offset along host wall axis from `wall.start`. */
  readonly offsetFromStart: number;
  /** mm. Opening width along wall axis. */
  readonly width: number;
  /** mm. Opening vertical opening (sill to head). */
  readonly height: number;
  /** mm. Sill height above floor (0 για doors, ~900 για windows). */
  readonly sillHeight: number;
  /**
   * @deprecated ADR-611 — use `frameProfileId` + `resolveOpeningFrameProfile`.
   * mm. Legacy κάσα width (square cross-section). Kept for zero-regression: a
   * legacy opening with no `frameProfileId` resolves faceWidth = depth = this.
   */
  readonly frameWidth?: number;
  /**
   * ADR-611 — FK → `FRAME_PROFILE_CATALOG` entry id (e.g. 'ALUMIL-M9660-frame'),
   * or the `CATALOG_CUSTOM_SENTINEL` when the user hand-edits a dimension. The
   * frame member cross-section (faceWidth × depth, mm) is CONSTANT vs the opening
   * width/height. Resolved via `resolveOpeningFrameProfile()`. Absent on legacy
   * openings → falls back to `frameWidth` / catalog default (zero regression).
   */
  readonly frameProfileId?: string;
  /**
   * ADR-611 — per-instance overrides of the resolved frame profile fields. Set
   * alongside `frameProfileId = CATALOG_CUSTOM_SENTINEL` when a dimension is
   * hand-edited. Win LAST over any catalog dims in `resolveOpeningFrameProfile`.
   */
  readonly frameProfileOverrides?: {
    /** mm across the opening FACE (visible κάσα width). */
    readonly faceWidth?: number;
    /** mm through the wall thickness (INDEPENDENT of wall.thickness). */
    readonly depth?: number;
    readonly manufacturer?: string;
    readonly series?: string;
  };
  /** Door swing hinge side. Door-only — undefined για window/fixed. */
  readonly handing?: OpeningHanding;
  /** Door swing direction. Door / french-door only. */
  readonly openDirection?: OpeningSwing;
  /**
   * @deprecated Legacy single material library id (whole opening). Superseded by
   * per-part `materials` (ADR — editable per-opening surfaces). Kept as a
   * frame+leaf base layer in `resolveOpeningMaterial` for zero regression.
   */
  readonly material?: string;
  /**
   * Per-part surface materials (κάσα/φύλλο/υαλοστάσιο/χειρολαβή) — Revit family
   * surfaces. Instance override of the family Type's `materials`; each part
   * folds independently (LAST wins) in `resolveOpeningMaterial`. Undefined part
   * ⇒ default → zero regression. @see OpeningMaterials
   */
  readonly materials?: OpeningMaterials;
  /** Glazing panes — 1 single / 2 double / 3 triple. Window / french-door / fixed. */
  readonly glazingPanes?: 1 | 2 | 3;
  /**
   * ADR-422 L1 — **Instance override** συντελεστή θερμοπερατότητας `Ug` (W/m²K)
   * για τον υπολογισμό θερμικού φορτίου. Absent ⇒ resolve από τον τύπο/υαλοπίνακες
   * μέσω `resolveOpeningUValue` (`glazing-u-catalog`). Revit «instance override».
   */
  readonly ugWperM2K?: number;
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
  /**
   * ADR-673 — Render the bottom frame member (κατώφλι) for a DOOR opening. Windows
   * draw their bottom bar via the `sillHeight > 0` sill path instead, so this only
   * governs door kinds (`!isWindowKind`). Absent ⇒ resolved default per kind via
   * `resolveOpeningThreshold` — auto-`true` for EVERY door kind (Giorgio 2026-07-17).
   * Explicit `false` toggles the κατώφλι off for a specific opening.
   */
  readonly hasThreshold?: boolean;
  /**
   * ADR-673 — Vertical placement of the κατώφλι profile (see {@link OpeningThresholdEmbed}).
   * Absent ⇒ `'none'` (profile sits on the finished floor). Set `'flush-top'`/`'on-slab'`
   * to bury the profile so aluminium door thresholds transition smoothly to the tiles.
   */
  readonly thresholdEmbed?: OpeningThresholdEmbed;
  /**
   * ADR-673 — mm. Sink depth of the κατώφλι profile BOTTOM below FFL, used ONLY when
   * `thresholdEmbed === 'custom'`. Non-negative; 0 ≡ `'none'`.
   */
  readonly thresholdEmbedMm?: number;
}

/**
 * ADR-615 — Type-guard SSoT discriminating self-hosted vs wall-hosted
 * openings. Exactly one of `wallId` / `selfHost` is expected to be set;
 * this returns `true` only for the well-formed self-hosted shape (no
 * `wallId`, `selfHost` present).
 */
export function isSelfHostedOpening(
  params: Pick<OpeningParams, 'wallId' | 'selfHost'>,
): boolean {
  return !params.wallId && !!params.selfHost;
}

/**
 * ADR-615 — the wall-hosted counterpart of `isSelfHostedOpening`, written as a type
 * predicate so callers that genuinely need the host wall (envelope insulation cuts,
 * section intersection) NARROW `params.wallId` to `string` instead of asserting it.
 *
 * Takes the whole opening rather than its params because the narrowing has to land on
 * the entity the caller goes on to use.
 */
export function isWallHostedOpening<T extends { readonly params: Pick<OpeningParams, 'wallId'> }>(
  opening: T,
): opening is T & { readonly params: { readonly wallId: string } } {
  return !!opening.params.wallId;
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
  /**
   * mm. ADR-611 — constant-cross-section frame members (κάσα) in PLAN, world
   * coords. Populated by the geometry phase as TWO jamb rectangles (one at each
   * end of the opening along the wall axis), each a Polygon3D of 4 CCW vertices.
   * Their faceWidth × depth stay CONSTANT regardless of `params.width/height`
   * (Revit swept-profile invariant). Absent → renderer draws no frame members.
   */
  readonly frameOutlines?: readonly Polygon3D[];
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
 * ADR-615 — self-hosted (free-standing) opening «host thickness» bounds (mm).
 * The thickness is the ACROSS dimension the symbol shows (the notional wall the
 * opening sits in). A grip resize clamps it to `[MIN, MAX]` so it can never blow
 * up to an absurd width (Giorgio 2026-07-09: «δεν μπορεί να έχουμε πλάτος ένα
 * μέτρο»). MIN keeps a visible cross-section; MAX caps at a very thick wall.
 */
export const MIN_SELF_HOST_THICKNESS_MM = 50;
export const MAX_SELF_HOST_THICKNESS_MM = 600;

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

/**
 * True for every DOOR kind (anything that is not a window/fixed-glazing family).
 * SSoT for the κατώφλι default (ADR-673): windows draw their bottom bar via the
 * `sillHeight > 0` sill path, so the threshold concept belongs to doors only.
 */
export function isDoorKind(kind: OpeningKind): boolean {
  return !isWindowKind(kind);
}

/** Resolved κατώφλι (threshold) geometry inputs — see {@link resolveOpeningThreshold}. */
export interface ResolvedOpeningThreshold {
  /** Whether to render the bottom frame member at all. */
  readonly render: boolean;
  /**
   * mm — signed offset of the profile BOTTOM relative to FFL (Y=0). `0` sits on the
   * finished floor; negative sinks it into the screed/slab. The caller places a bar
   * of height `profileHeightMm` starting at this offset.
   */
  readonly bottomOffsetMm: number;
}

/**
 * SSoT (ADR-673) — resolves whether an opening shows a bottom frame member (κατώφλι)
 * and where it sits vertically. Pure: the caller supplies `finishThicknessMm` (storey
 * `Floor.finishThickness`, the FFL→structural-slab-top gap) and `profileHeightMm` (the
 * resolved frame face width, i.e. the κατώφλι profile height). Windows / any opening
 * with `sillHeight > 0` return `render:false` here — their bottom bar is the existing
 * sill path, never a door threshold, so the two never double-draw.
 */
export function resolveOpeningThreshold(
  params: Pick<OpeningParams, 'kind' | 'sillHeight' | 'hasThreshold' | 'thresholdEmbed' | 'thresholdEmbedMm'>,
  ctx: { readonly finishThicknessMm: number; readonly profileHeightMm: number },
): ResolvedOpeningThreshold {
  const render = params.sillHeight <= 0
    && (params.hasThreshold ?? isDoorKind(params.kind));
  if (!render) return { render: false, bottomOffsetMm: 0 };
  const bottomOffsetMm = resolveThresholdBottomOffsetMm(params, ctx);
  return { render: true, bottomOffsetMm };
}

function resolveThresholdBottomOffsetMm(
  params: Pick<OpeningParams, 'thresholdEmbed' | 'thresholdEmbedMm'>,
  ctx: { readonly finishThicknessMm: number; readonly profileHeightMm: number },
): number {
  switch (params.thresholdEmbed ?? 'none') {
    case 'none': return 0;
    // TOP flush with FFL ⇒ BOTTOM sunk by the full profile height.
    case 'flush-top': return -Math.max(0, ctx.profileHeightMm);
    // BOTTOM rests on the structural slab top (γκρο μπετό).
    case 'on-slab': return -Math.max(0, ctx.finishThicknessMm);
    case 'custom': return -Math.max(0, params.thresholdEmbedMm ?? 0);
  }
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
