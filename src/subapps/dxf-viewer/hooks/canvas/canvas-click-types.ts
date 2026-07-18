/**
 * 🏢 ENTERPRISE: Canvas Click Handler Types
 *
 * @description All type definitions for the useCanvasClickHandler hook
 * and its extracted sub-modules (guide-click-handlers, entity-pick-handlers).
 *
 * EXTRACTED FROM: useCanvasClickHandler.ts — SRP split (ADR N.7.1)
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-189: Construction Guide System
 */

import type { MutableRefObject } from 'react';

import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { OverlayEditorMode, Overlay } from '../../overlays/types';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import type { SelectedGrip } from '../grips/unified-grip-types';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { CreateGuideCommand, DeleteGuideCommand, CreateDiagonalGuideCommand } from '../../systems/guides/commands';
import type { AddConstructionPointCommand, DeleteConstructionPointCommand } from '../../systems/guides/construction-point-commands';
import type {
  ArcPickableEntity,
  LinePickableEntity,
  DrawingHandlersLike,
  SpecialToolLike,
  AngleEntityToolLike,
  DxfGripInteractionLike,
  StairToolLike,
  WallToolLike,
  SlabToolLike,
  ColumnToolLike,
  BeamToolLike,
  BeamBetweenMembersToolLike,
  FoundationToolLike,
  MepFixtureToolLike,
  MepSegmentToolLike,
  ElectricalPanelToolLike,
  MepManifoldToolLike,
  MepRadiatorToolLike,
  MepBoilerToolLike,
  FurnitureToolLike,
  BlockLibraryToolLike,
  TitleBlockToolLike,
  EntouragePlacementToolLike,
  FloorplanSymbolToolLike,
  RailingToolLike,
  SlabOpeningToolLike,
  OpeningToolLike,
  LevelManagerLike,
} from './canvas-click-tool-types';

// Re-export supporting & tool types so existing import sites stay unchanged.
export * from './canvas-click-tool-types';

// ============================================================================
// HOOK PARAMS & RETURN
// ============================================================================

export interface UseCanvasClickHandlerParams {
  // ── Viewport / Transform ─────────────────────────────────────────────
  viewportReady: boolean;
  viewport: { width: number; height: number };
  transform: ViewTransform;

  // ── Tools ─────────────────────────────────────────────────────────────
  activeTool: string;
  overlayMode: OverlayEditorMode;
  circleTTT: SpecialToolLike;
  // ADR-060 — «κάθετη γραμμή» έγινε drawing tool· δεν περνά πλέον ως entity-pick SpecialToolLike.
  lineParallel: SpecialToolLike;
  angleEntityMeasurement: AngleEntityToolLike;
  dxfGripInteraction: DxfGripInteractionLike;
  /** ADR-358 Phase 5a — Stair tool click pipeline. */
  stairTool?: StairToolLike;
  /** ADR-619 — «Σκάλα από περιοχή» polygon-sketch click pipeline (same shape as stair). */
  stairRegionTool?: StairToolLike;
  /** ADR-363 Phase 1B — Wall tool click pipeline. */
  wallTool?: WallToolLike;
  /** ADR-363 Phase 3 — Slab tool click pipeline. */
  slabTool?: SlabToolLike;
  /** ADR-417 — Roof tool click pipeline (footprint polygon; same shape as slab). */
  roofTool?: SlabToolLike;
  /** ADR-419 — Floor-finish tool click pipeline (covering polygon; same shape as slab). */
  floorFinishTool?: SlabToolLike;
  /** ADR-511 — Wall-covering tool click pipeline (pick τοίχου+παρειάς → 2-click span). */
  wallCoveringTool?: SlabToolLike;
  /** ADR-363 Phase 4 — Column tool click pipeline. */
  columnTool?: ColumnToolLike;
  /** ADR-436 Slice 1 — Foundation pad tool click pipeline. */
  foundationTool?: FoundationToolLike;
  /** ADR-363 Phase 5 — Beam tool click pipeline. */
  beamTool?: BeamToolLike;
  /** ADR-569 — «Δοκάρι ανάμεσα σε μέλη» click pipeline. */
  beamBetweenMembersTool?: BeamBetweenMembersToolLike;
  /** ADR-406 — MEP fixture tool click pipeline. */
  mepFixtureTool?: MepFixtureToolLike;
  /** ADR-408 Φ3 — Electrical panel tool click pipeline. */
  electricalPanelTool?: ElectricalPanelToolLike;
  /** ADR-408 Φ12 — Plumbing manifold tool click pipeline. */
  mepManifoldTool?: MepManifoldToolLike;
  /** ADR-408 Εύρος Β — Heating radiator tool click pipeline. */
  mepRadiatorTool?: MepRadiatorToolLike;
  /** ADR-408 Εύρος Β #2 — Heating boiler tool click pipeline. */
  mepBoilerTool?: MepBoilerToolLike;
  /** ADR-408 DHW — Domestic water heater tool click pipeline. */
  mepWaterHeaterTool?: MepBoilerToolLike;
  /** ADR-408 Εύρος Β #3 — Underfloor heating loop tool click pipeline (footprint polygon; same shape as slab). */
  mepUnderfloorTool?: SlabToolLike;
  /** ADR-422 — Thermal-space tool click pipeline (Revit «Place Space» click-in-region). */
  thermalSpaceTool?: SlabToolLike;
  /** ADR-638 Στάδιο 2b — Bathroom auto-arrange tool click pipeline (hover→click region-pick). */
  bathroomAutoArrangeTool?: SlabToolLike;
  /** ADR-437 — Space-separator tool click pipeline (2-click line). */
  spaceSeparatorTool?: SlabToolLike;
  /** ADR-408 Φ8 — MEP segment (duct/pipe) tool click pipeline. */
  mepSegmentTool?: MepSegmentToolLike;
  /** ADR-408 Φ15 — MEP riser (vertical drain stack) tool click pipeline (1-click). */
  mepRiserTool?: { readonly isActive: boolean; onCanvasClick(point: Readonly<Point2D>): boolean };
  /** ADR-410 — Furniture tool click pipeline (single-click placement). */
  furnitureTool?: FurnitureToolLike;
  /** Block Library M1 — block re-placement tool click pipeline (single-click). */
  blockLibraryTool?: BlockLibraryToolLike;
  /** ADR-651 Φάση Β — title-block tool click pipeline (single-click placement). */
  titleBlockTool?: TitleBlockToolLike;
  /** ADR-654 M7 Φάση Γ — furniture-plan (entourage) tool click pipeline (single-click placement). */
  furniturePlanTool?: EntouragePlacementToolLike;
  /** ADR-654 M6 — people-plan (entourage) tool click pipeline (single-click placement). */
  peoplePlanTool?: EntouragePlacementToolLike;
  /** ADR-654 M6 — vehicles-plan (entourage) tool click pipeline (single-click placement). */
  vehiclesPlanTool?: EntouragePlacementToolLike;
  /** ADR-654 M7 — plants-plan (entourage) tool click pipeline (single-click placement). */
  plantsPlanTool?: EntouragePlacementToolLike;
  /** ADR-415 — Floorplan-symbol tool click pipeline (single-click placement). */
  floorplanSymbolTool?: FloorplanSymbolToolLike;
  /** ADR-407 — Railing tool click pipeline (2-click straight guardrail). */
  railingTool?: RailingToolLike;
  /** ADR-363 Phase 3.7 — Slab-opening tool click pipeline. */
  slabOpeningTool?: SlabOpeningToolLike;
  /** ADR-363 Phase 2 — Opening tool click pipeline. */
  openingTool?: OpeningToolLike;
  /** ADR-615 — Free-standing (self-hosted) opening tool click pipeline (single-click). */
  selfOpeningTool?: OpeningToolLike;

  // ── ADR-188: Rotation tool ────────────────────────────────────────────
  /** Whether the rotation tool is active and collecting input */
  rotationIsActive?: boolean;
  /** Click handler for rotation state machine */
  handleRotationClick?: (worldPoint: Point2D) => void;

  // ── ADR-049: Move tool (2-click AutoCAD-style) ────────────────────────
  /** Whether the move tool is active and collecting base/destination point */
  moveIsActive?: boolean;
  /** Click handler for move state machine */
  handleMoveClick?: (worldPoint: Point2D) => void;

  // ── Mirror tool (2-click axis definition) ─────────────────────────────
  /** Whether the mirror tool is collecting axis points */
  mirrorIsActive?: boolean;
  /** Click handler for mirror state machine */
  handleMirrorClick?: (worldPoint: Point2D) => void;

  // ── ADR-348: Scale tool ────────────────────────────────────────────────
  /** Whether the scale tool is active and collecting base point / reference points */
  scaleIsActive?: boolean;
  /** Click handler for scale state machine */
  handleScaleClick?: (worldPoint: Point2D) => void;

  // ── ADR-349: Stretch tool ──────────────────────────────────────────────
  /** Whether the stretch / mstretch tool is active and collecting base point / displacement */
  stretchIsActive?: boolean;
  /** Click handler for stretch state machine */
  handleStretchClick?: (worldPoint: Point2D) => void;

  // ── ADR-350: Trim tool ─────────────────────────────────────────────────
  /** Whether the trim tool is in `picking` / `selectingEdges` phase */
  trimIsActive?: boolean;
  /** Click handler for trim state machine (shiftKey = inverse EXTEND, Q9) */
  handleTrimClick?: (worldPoint: Point2D, shiftKey: boolean) => void;

  // ── ADR-510 Φ4d: Offset tool ───────────────────────────────────────────
  /** Whether the offset tool is active (picking-source / picking-side) */
  offsetIsActive?: boolean;
  /** Click handler for the offset state machine (pick source, then side) */
  handleOffsetClick?: (worldPoint: Point2D) => void;
  /** Whether the fillet tool is active (picking-first / picking-second / polyline) */
  filletIsActive?: boolean;
  /** Click handler for the fillet state machine (pick line 1, then line 2 / polyline) */
  handleFilletClick?: (worldPoint: Point2D) => void;
  /** Whether the chamfer tool is active (picking-first / picking-second / polyline) */
  chamferIsActive?: boolean;
  /** Click handler for the chamfer state machine (pick line 1, then line 2 / polyline) */
  handleChamferClick?: (worldPoint: Point2D) => void;

  // ── ADR-353: Extend tool ───────────────────────────────────────────────
  /** Whether the extend tool is in `picking` / `selectingEdges` phase */
  extendIsActive?: boolean;
  /** Click handler for extend state machine (shiftKey = inverse TRIM, Q4) */
  handleExtendClick?: (worldPoint: Point2D, shiftKey: boolean) => void;

  // ── ADR-363 Phase 5.6: Wall Split tool ────────────────────────────────
  /** Whether the wall-split tool is active (continuous pick loop, ESC to exit). */
  wallSplitIsActive?: boolean;
  /** Click handler for wall-split state machine. */
  handleWallSplitClick?: (worldPoint: Point2D) => void;

  // ── ADR-401 Phase E.1: Wall Attach Top/Base tool ──────────────────────
  /** Whether the wall-attach pick-host tool is active (one pick → act, ESC to exit). */
  wallAttachIsActive?: boolean;
  /** Click handler — picks the structural host (beam/slab) under the cursor. */
  handleWallAttachClick?: (worldPoint: Point2D) => void;

  // ── ADR-633 Sub-phase 1b-ii: Stair Add-Turn tool ──────────────────────
  /** Whether the stair add-turn pick tool is active (click parieta → angle → commit). */
  stairAddTurnIsActive?: boolean;
  /** Click handler — hit-tests the parieta of the selected stair under the cursor. */
  handleStairAddTurnClick?: (worldPoint: Point2D) => void;

  // ── ADR-566: Wall Merge tool ──────────────────────────────────────────
  /** Whether the wall-merge tool is active (continuous pick loop, ESC to exit). */
  wallMergeIsActive?: boolean;
  /** Click handler for the wall-merge state machine (pick wall 1 → wall 2). */
  handleWallMergeClick?: (worldPoint: Point2D) => void;

  // ── ADR-568: Wall gap-bridge + auto-opening tool ──────────────────────────
  /** Whether the wall-gap-opening tool is active (continuous pick loop, ESC to exit). */
  wallGapOpeningIsActive?: boolean;
  /** Click handler for the gap-opening state machine (pick wall 1 → wall 2). */
  handleWallGapOpeningClick?: (worldPoint: Point2D) => void;

  // ── ADR-363 R1: BIM Copy tool ──────────────────────────────────────────
  /** Whether the copy tool is active (base-point + continuous target picks). */
  copyIsActive?: boolean;
  /** Click handler for copy FSM (base point or target point). */
  handleCopyClick?: (worldPoint: Point2D) => void;

  // ── ADR-353 Phase B: Polar Array tool ──────────────────────────────────
  /** Whether the polar Array tool is awaiting the centre-pick click */
  arrayPolarIsActive?: boolean;
  /** Click handler for the polar centre-pick state machine */
  handleArrayPolarClick?: (worldPoint: Point2D) => void;
  /**
   * ADR-353 §B2 — Centre re-pick from the contextual ribbon. Returns true
   * if the click was consumed (an array is in `pickingCenterArrayId` mode
   * and the new centre was applied via UpdateArrayParamsCommand).
   */
  handleArrayPolarCenterRepick?: (worldPoint: Point2D) => boolean;

  // ── ADR-353 Phase C: Path Array tool ───────────────────────────────────
  /** Whether the path Array tool is awaiting the path-entity pick click */
  arrayPathIsActive?: boolean;
  /** Click handler for the path-entity pick state machine (worldPoint unused — uses HoverStore) */
  handleArrayPathClick?: () => void;
  /**
   * ADR-353 §C3 — Path-entity re-pick from the contextual ribbon. Returns true
   * if the click was consumed (an array is in `pickingPathArrayId` mode and the
   * hovered entity was a valid curve type).
   */
  handleArrayPathEntityRepick?: () => boolean;

  // ── Level / Scene ─────────────────────────────────────────────────────
  levelManager: LevelManagerLike;

  // ── Overlay drawing ───────────────────────────────────────────────────
  draftPolygon: Array<[number, number]>;
  setDraftPolygon: React.Dispatch<React.SetStateAction<Array<[number, number]>>>;
  isSavingPolygon: boolean;
  setIsSavingPolygon: (val: boolean) => void;
  // 🚀 PERF (2026-05-09): isNearFirstPoint REMOVED — computed inline at click
  // time inside the handler using `worldPoint` + `transform.scale`.
  finishDrawingWithPolygonRef: MutableRefObject<(polygon: Array<[number, number]>) => Promise<boolean>>;

  // ── Refs (mutable, avoids stale closures) ─────────────────────────────
  drawingHandlersRef: MutableRefObject<DrawingHandlersLike | null>;
  entitySelectedOnMouseDownRef: MutableRefObject<boolean>;

  // ── Selection / Grips ─────────────────────────────────────────────────
  universalSelection: UniversalSelectionHook;
  hoveredVertexInfo: unknown;
  hoveredEdgeInfo: unknown;
  selectedGrip: SelectedGrip | null;
  selectedGrips: SelectedGrip[];
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  justFinishedDragRef: MutableRefObject<boolean>;
  draggingOverlayBody: unknown;
  // 🔴 SSoT (2026-05-24): setSelectedEntityIds REMOVED — use universalSelection.replaceEntitySelection directly

  // ── Overlay handlers ──────────────────────────────────────────────────
  currentOverlays: Overlay[];
  handleOverlayClick: (overlayId: string, point: Point2D) => void;

  // ── ADR-189: Construction guide handlers ────────────────────────────
  guideAddGuide?: (axis: GridAxis, offset: number) => CreateGuideCommand;
  guideRemoveGuide?: (guideId: string) => DeleteGuideCommand;
  guides?: readonly Guide[];
  /** ADR-040: getter reads from GuideStore at click time — prevents stale snapshot when CanvasSection skips re-render during guide drag */
  getGuides?: () => readonly Guide[];
  /** Currently selected reference guide for parallel creation (null = step 1) */
  parallelRefGuideId?: string | null;
  /**
   * Το κλικ κοντά σε οδηγό τον ορίζει ως αναφορά και ανοίγει την πληκτρολόγηση
   * απόστασης. Η πλευρά ΔΕΝ περνά από εδώ — προκύπτει από τη θέση του κέρσορα
   * τη στιγμή του Enter (βλ. `guide-parallel-side.ts`).
   *
   * `anchor` = η ΠΡΟΒΟΛΗ του κλικ πάνω στη γραμμή του οδηγού
   * (`projectPointOntoGuide`) — το σημείο εκκίνησης της δυναμικής διακεκομμένης
   * προς τον κέρσορα (ADR-189 §3.13). Παγώνει εδώ· η πλευρά όχι.
   */
  onParallelRefSelected?: (refGuideId: string, anchor: Point2D) => void;
  /**
   * ΔΕΥΤΕΡΟ ΚΛΙΚ = COMMIT (ADR-189 §3.13). Όσο υπάρχει `parallelRefGuideId`, το
   * επόμενο κλικ στον καμβά τοποθετεί τον παράλληλο οδηγό — ισότιμη διαδρομή με
   * το Enter, ΟΧΙ αντικατάστασή του (και τα δύο μένουν ενεργά).
   *
   * Περνά ΩΜΟ `worldPoint`: ο περιορισμός (ΟΡΘΟ κάθετα στον οδηγό + βήμα F9) και
   * η απόσταση/πλευρά υπολογίζονται στον workflow handler μέσω του ΕΝΟΣ SSoT
   * `resolveParallelCursor` — το ίδιο που ζωγραφίζει τη διακεκομμένη. Ο click
   * handler μένει λεπτός δρομολογητής: μηδέν γεωμετρία εκεί.
   */
  onParallelDistanceCommitted?: (refGuideId: string, worldPoint: Point2D) => void;

  // ── ADR-189 §3.3: Diagonal guide 3-click workflow ────────────────────
  guideAddDiagonalGuide?: (startPoint: Point2D, endPoint: Point2D) => CreateDiagonalGuideCommand;
  /** Current step of the diagonal workflow (0=start, 1=direction, 2=end) */
  diagonalStep?: 0 | 1 | 2;
  /** Start point (set after step 0) */
  diagonalStartPoint?: Point2D | null;
  /** Direction point (set after step 1) */
  diagonalDirectionPoint?: Point2D | null;
  /** Step 0 callback: set the start point */
  onDiagonalStartSet?: (point: Point2D) => void;
  /** Step 1 callback: set the direction point */
  onDiagonalDirectionSet?: (point: Point2D) => void;
  /** Step 2 callback: set the end point + create guide + reset */
  onDiagonalComplete?: () => void;

  // ── ADR-189 §3.7-3.16: Construction snap point tools ──────────────────
  /** Add a single construction point */
  cpAddPoint?: (point: Point2D, label?: string | null) => AddConstructionPointCommand;
  /** Delete a construction point by ID */
  cpDeletePoint?: (pointId: string) => DeleteConstructionPointCommand;
  /** Find nearest construction point to a world position */
  cpFindNearest?: (worldPoint: Point2D, maxDistance: number) => ConstructionPoint | null;
  /** Current step for segments tool (0=start, 1=end) */
  segmentsStep?: 0 | 1;
  /** Start point for segments tool (set after step 0) */
  segmentsStartPoint?: Point2D | null;
  /** Step 0 callback: set segments start point */
  onSegmentsStartSet?: (point: Point2D) => void;
  /** Step 1 callback: end point set → triggers dialog */
  onSegmentsComplete?: (start: Point2D, end: Point2D) => void;
  /** Current step for distance tool (0=start, 1=end) */
  distanceStep?: 0 | 1;
  /** Start point for distance tool (set after step 0) */
  distanceStartPoint?: Point2D | null;
  /** Step 0 callback: set distance start point */
  onDistanceStartSet?: (point: Point2D) => void;
  /** Step 1 callback: end point set → triggers dialog */
  onDistanceComplete?: (start: Point2D, end: Point2D) => void;

  // ── ADR-189 §3.9, §3.10, §3.12: Arc guide entity picking ────────────
  /** §3.9 callback: user picked an arc/circle → triggers segment dialog */
  onArcSegmentsPicked?: (entity: ArcPickableEntity) => void;
  /** §3.10 callback: user picked an arc/circle → triggers distance dialog */
  onArcDistancePicked?: (entity: ArcPickableEntity) => void;
  /** §3.12 arc-line intersect: current step (0=pick line, 1=pick arc) */
  arcLineStep?: 0 | 1;
  /** §3.12 callback: user picked a line entity (step 0) */
  onArcLineLinePicked?: (entity: LinePickableEntity) => void;
  /** §3.12 callback: user picked an arc/circle entity (step 1) */
  onArcLineArcPicked?: (entity: ArcPickableEntity) => void;

  // ── ADR-189 §3.11: Circle-Circle intersection entity picking ──────────
  /** §3.11 circle-circle intersect: current step (0=pick first, 1=pick second) */
  circleIntersectStep?: 0 | 1;
  /** §3.11 callback: user picked the first arc/circle entity (step 0) */
  onCircleIntersectFirstPicked?: (entity: ArcPickableEntity) => void;
  /** §3.11 callback: user picked the second arc/circle entity (step 1) */
  onCircleIntersectSecondPicked?: (entity: ArcPickableEntity) => void;

  // ── Two-step perpendicular guide placement ──────────────────────────
  /** Selected reference guide for perpendicular (null = step 0: select guide) */
  perpRefGuideId?: string | null;
  /** Step 0 callback: user clicked near a guide → select as perpendicular reference */
  onPerpRefSelected?: (guideId: string) => void;
  /** Step 1 callback: perpendicular placed → reset */
  onPerpPlaced?: () => void;

  // ── Guide rect-center tool ─────────────────────────────────────────
  /** Callback: place construction point at center of enclosing guide rectangle */
  onRectCenterPlace?: (center: Point2D) => void;

  // ── Guide line-midpoint + circle-center tools ─────────────────────
  /** Callback: place construction point at midpoint of a line entity */
  onLineMidpointPlace?: (midpoint: Point2D) => void;
  /** Callback: place construction point at center of a circle/arc entity */
  onCircleCenterPlace?: (center: Point2D) => void;

  // ── ADR-189 B2: Grid generation tool ──────────────────────────────
  /** Callback: user clicked grid origin → opens spacing dialog */
  onGridOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B28: Guide rotation tool ───────────────────────────────
  /** Currently selected reference guide for rotation (null = step 0) */
  rotateRefGuideId?: string | null;
  /** Step 0 callback: user clicked near guide → select as rotation reference */
  onRotateRefSelected?: (guideId: string) => void;
  /** Step 1 callback: user set pivot → opens angle dialog */
  onRotatePivotSet?: (guideId: string, pivot: Point2D) => void;

  // ── ADR-189 B30: Rotate all guides tool ──────────────────────────
  /** Step 0 callback: user clicked pivot → opens angle dialog for all guides */
  onRotateAllPivotSet?: (pivot: Point2D) => void;

  // ── ADR-189 B29: Rotate guide group tool ─────────────────────────
  /** Set of currently selected guide IDs for group rotation */
  rotateGroupSelectedIds?: ReadonlySet<string>;
  /** Toggle a guide in/out of the group selection */
  onRotateGroupToggle?: (guideId: string) => void;
  /** Set pivot for group rotation (fires when clicking empty space with ≥1 selected) */
  onRotateGroupPivotSet?: (guideIds: readonly string[], pivot: Point2D) => void;

  // ── ADR-189 B33: Equalize guide spacing tool ──────────────────────
  /** Set of currently selected guide IDs for equalization */
  equalizeSelectedIds?: ReadonlySet<string>;
  /** Toggle a guide in/out of the equalize selection */
  onEqualizeToggle?: (guideId: string) => void;
  /** Apply equalization (fires when clicking empty space with ≥3 same-axis selected) */
  onEqualizeApply?: (guideIds: readonly string[]) => void;

  // ── ADR-189 B31: Polar array tool ──────────────────────
  /** Set center point for polar array (opens PromptDialog for count) */
  onPolarArrayCenterSet?: (center: Point2D) => void;

  // ── ADR-189 B32: Scale grid tool ──────────────────────
  /** Set scale origin point (opens PromptDialog for scale factor) */
  onScaleOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B16: Guide at angle tool ──────────────────
  /** Set origin point for guide-at-angle (opens PromptDialog for angle) */
  onGuideAngleOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B19: Mirror guides tool ──────────────────
  /** Click on X/Y guide → mirror all others across it */
  onMirrorAxisSelected?: (axisGuideId: string) => void;

  // ── ADR-189 B8: Guide from entity tool ────────────────
  /** Callback: entity picked → create guide(s) from it */
  onGuideFromEntity?: (entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE', params: {
    lineStart?: Point2D; lineEnd?: Point2D;
    center?: Point2D; radius?: number;
    clickPoint?: Point2D;
  }) => void;

  // ── ADR-189 B24: Guide offset from entity tool ──────────
  /** Callback: entity picked → prompt offset → create offset guides */
  onGuideOffsetFromEntity?: (entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE', params: {
    lineStart?: Point2D; lineEnd?: Point2D;
    center?: Point2D; radius?: number;
    clickPoint?: Point2D;
  }) => void;

  // ── ADR-189 B14: Guide multi-select tool ──────────────
  /** Toggle guide selection (shift = add to selection) */
  onGuideSelectToggle?: (guideId: string, addToSelection: boolean) => void;
  /** Deselect all guides (click on empty space) */
  onGuideDeselectAll?: () => void;

  // ── ADR-344 Phase 6.E follow-up: Text creation tool ──
  /** Click handler for the 'text' tool — returns true if click was consumed. */
  onTextToolClick?: (worldPoint: Point2D) => boolean;

  // ── ADR-449 PART B Slice C: «Βαφή σοβά» 2D paintbrush ──
  /**
   * Click handler for the 'finish-paint' tool — paints the plaster face under the cursor
   * with the current brush. Returns true if a face was painted (click consumed). Built in
   * CanvasSection (`useFinishPaintClick`) where the full `useLevels()` write path is typed.
   */
  onFinishPaintClick?: (worldPoint: Point2D) => boolean;
}

export interface UseCanvasClickHandlerReturn {
  // ADR-581 — altKey/ctrlKey για το «Αντιγραφή Ιδιοτήτων» πινέλο (σταγονόμετρο/σύριγγα).
  handleCanvasClick: (worldPoint: Point2D, shiftKey?: boolean, altKey?: boolean, ctrlKey?: boolean) => void;
}
