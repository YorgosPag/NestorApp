import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import { GHOST_DEFAULTS } from '../../rendering/ghost';
// ADR-559 — AutoCAD GRIPOBJLIMIT: suppress ALL visible grips when the selection holds more
// objects than the limit. Read at render time (event-time getter, no subscription).
import { isGripObjLimitExceeded } from '../../hooks/grips/grip-obj-limit';
import { gripStyleStore } from '../../stores/GripStyleStore';
import type { DxfScene, DxfEntityUnion, DxfLine, DxfRenderOptions } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms'; import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { EntityRendererComposite } from '../../rendering/core/EntityRendererComposite';
import { Canvas2DContext } from '../../rendering/adapters/canvas2d/Canvas2DContext';
import type { EntityModel, RenderOptions } from '../../rendering/types/Types';
import type { Entity, SceneLayer } from '../../types/entities';
import { viewportToWorldBBox, isEntityInViewport } from './dxf-viewport-culling';
// ADR-510 Φ2 — canvas linetype dash: metric pattern (mm) → setLineDash px (zoom + LTSCALE aware).
import { dashMmToScreenPx } from '../../rendering/linetype-dash-resolver';
// ADR-375 — «DXF Σχέδιο» row lineweight override: mm → screen px (ISO catalog SSoT).
import { lineweightToPx } from '../../config/lineweight-iso-catalog';
// ADR-510 Φ2H — effective LTSCALE = per-scene base × user knob; scene base set once/frame.
import { getEffectiveLinetypeScale, setActiveSceneLinetypeScale } from '../../stores/LinetypeScaleStore';
import { resolveEntityBimCategory } from '../../bim/visibility/resolve-entity-bim-category';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// ADR-639 Στάδιο 5 — GPU line-layer suppression flags (event-time getters, ADR-040 rule 2).
import { isWebglLineLayerActive, getWebglOwnedEntityIds } from '../webgl-lines/webgl-line-layer-store';
// ADR-640 arc-fix — type-gated "already drawn by the line layer?" predicates. Container members
// (block/group/array) share ONE id, so the per-entity skip must gate by TYPE, never a shared id
// alone — else a non-line member (arc/circle/text) is suppressed by a batched line sibling.
import { isDrawnByBatchedLineLayer, isDrawnByWebglLineLayer } from '../webgl-lines/line-layer-draw-suppression';
// ADR-639 Στάδιο 5 — shared layer/isolate/cut-plane skip predicate (SSoT; was the private
// `isEntityLayerSkipped` method, extracted so the WebGL buffer builder asks the same question).
import { isEntityLayerSkipped as isEntityLayerSkippedShared } from './dxf-entity-layer-skip';
// Per-frame index builders (extracted Boy-Scout file-size split, 2026-05-19).
import { buildDimensionLookup, buildSlabOpeningsBySlab, buildOpeningsByWall, buildWallsById, buildColumnFootprints, computeSceneDimensionSpan } from './dxf-renderer-frame-builders';
// ADR-550 / ADR-358 §G7 — entity render-style SSoT (shared with the WYSIWYG preview path).
import { resolveEntityRenderStyle, type ResolvedRenderStyle } from './dxf-renderer-style-resolve';
// ADR-642 Φ2-B — genuine complex linetypes (embedded text) opt out of the solid LINE batch.
import { isSimpleExpressible } from '../../config/complex-linetype-adapters';
import { drawFoundationReinforcement2D } from './dxf-foundation-reinforcement-overlay'; import { drawSlabReinforcement2D } from './dxf-slab-reinforcement-overlay';
// Scene-level structural overlay passes (Boy-Scout file-size split, 2026-06-17 —
// mirror του foundation overlay· ADR-449 σοβάς + ADR-456/471 οπλισμός μελών κολώνα+δοκάρι).
import { drawMemberReinforcement2D, drawStructuralFinishSkin2D } from './dxf-renderer-structural-overlays';
// DxfEntityUnion → Entity mapper (extracted file-size split, 2026-05-25).
import { buildEntityModelFromDxf } from './dxf-renderer-entity-model';

export class DxfRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private entityComposite: EntityRendererComposite; // ✅ ΝΕΟ: Centralized rendering
  private renderContext: Canvas2DContext; // ✅ ΝΕΟ: Backend abstraction
  // O(1) selection lookup — rebuilt before each render pass to avoid O(n²) Array.includes
  private _selectionSet: Set<string> = new Set();
  // ADR-559 — AutoCAD GRIPOBJLIMIT: true for this frame when the selection-object count
  // exceeds the limit ⇒ no grips drawn for ANY selected entity (objects stay selected).
  private _gripsSuppressedByObjLimit = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for DXF canvas');
    this.ctx = ctx;

    // ✅ ΝΕΟ: Initialize unified rendering system
    this.renderContext = new Canvas2DContext(canvas);
    this.entityComposite = new EntityRendererComposite(ctx);
  }

  /**
   * Set grip interaction state (hovered/active grip) for AutoCAD-style visual feedback.
   * Delegates to EntityRendererComposite → BaseEntityRenderer pipeline.
   */
  setGripInteractionState(state: { hovered?: { entityId: string; gripIndex: number }; active?: { entityId: string; gripIndex: number }; armedKeys?: ReadonlySet<string> }): void {
    this.entityComposite.setGripInteractionState(state);
  }

  /**
   * Κύρια render method
   * ✅ ΕΝΗΜΕΡΩΜΕΝΟ: Χρησιμοποιεί composite για entity rendering
   */
  render(
    scene: DxfScene | null,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions = {
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds: []
    }
  ): void {
    // 🚀 PERF (ADR-040, 2026-05-11): getBounds (cached) instead of refreshBounds.
    // CSS-space dimensions: prefer live getBoundingClientRect (main canvas in DOM);
    // fall back to the caller-supplied viewport for off-screen canvases (bitmap cache)
    // where getBoundingClientRect returns 0×0 — a 0×0 clearRect is a no-op and causes
    // ghost-trail artifacts as accumulated frames are never erased.
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const cssW = canvasRect.width || viewport.width;
    const cssH = canvasRect.height || viewport.height;
    const actualViewport: Viewport = { width: cssW, height: cssH };
    // Clear canvas using exact same CSS-space dimensions as rendering viewport.
    // DPR ctx.setTransform is active → clearRect in CSS coords = full physical clear.
    this.ctx.clearRect(0, 0, cssW, cssH);
    // 🏢 Origin marker now rendered by GridRenderer (consolidated — no duplication)
    if (!scene || !scene.entities.length) return;
    this.ctx.save();
    // ✅ ΝΕΟ: Update composite settings
    this.entityComposite.setTransform(transform);
    // ADR-362 Phase C1 — build the per-frame DimensionLookup map once and
    // forward it to the dimension leaf. Cheap O(n) scene scan; only dim
    // entities land in the map (typically <100 per scene).
    this.entityComposite.setDimensionLookup(buildDimensionLookup(scene.entities));
    this.entityComposite.setSlabOpeningsBySlab(buildSlabOpeningsBySlab(scene.entities));
    // ADR-363 Phase 2 (deferred pipeline) — feed per-frame opening→wall index so
    // WallRenderer can punch boolean cutouts through wall fills.
    this.entityComposite.setOpeningsByWall(buildOpeningsByWall(scene.entities));
    // ADR-511 — feed per-frame wall index so WallCoveringRenderer resolves its host
    // wall and computes the live face strip (covering never stores a render polygon).
    this.entityComposite.setWallsById(buildWallsById(scene.entities));
    // ADR-509 §axis-clip — feed per-frame column footprints so WallRenderer clips its
    // dashed axis at column faces (location line stops at the body, not through it).
    this.entityComposite.setColumnFootprints(buildColumnFootprints(scene.entities));
    // ADR-449 Slice X2 μέρος Β — ο σοβάς (2Δ finished outline) σχεδιάζεται πλέον ως
    // ΕΝΑ scene-level pass (`drawStructuralFinishSkin2D`, πριν το `ctx.restore()`), από την
    // ΙΔΙΑ merged-silhouette SSoT με το 3Δ — αντικαθιστά το παλιό per-element injection στους
    // Column/BeamRenderer. Master toggle «Σοβατισμένη όψη» = view-level gate μέσα στο pass.
    // ADR-362 Round 5 — propagate active scene units so dim text + arrows scale
    // correctly in non-mm DXFs (e.g. meters). Default `'mm'` keeps legacy parity.
    this.entityComposite.setDimensionSceneUnits(scene.units ?? 'mm');
    // ADR-362 — publish this scene's longest span (scene units) so the dimension renderer
    // can clamp a mismatched imported DIMSCALE (the "giant dimension cross").
    this.entityComposite.setDimensionSceneSpan(computeSceneDimensionSpan(scene.bounds));
    // ADR-510 Φ2H — publish this scene's base LTSCALE (auto-fit / file $LTSCALE) as the
    // per-frame ambient every dash-stroke site reads via getEffectiveLinetypeScale().
    setActiveSceneLinetypeScale(scene.linetypeScale);

    // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): bitmap cache passes skipInteractive=true
    // to render entities in pure normal-state. Interactive overlays are drawn separately.
    const effectiveOptions: DxfRenderOptions = options.skipInteractive
      ? {
          showGrid: options.showGrid,
          showLayerNames: options.showLayerNames,
          wireframeMode: options.wireframeMode,
          selectedEntityIds: [],
          hoveredEntityId: null,
          gripInteractionState: undefined,
        }
      : options;
    // 🏢 GRIP EDITING: Update grip interaction state for visual feedback (always set, even when empty)
    const gripOpts = effectiveOptions.gripInteractionState;
    this.setGripInteractionState(gripOpts ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip, armedKeys: gripOpts.armedKeys } : {});
    // Rebuild selection Set for O(1) lookups in renderEntityUnified
    this._selectionSet = new Set(effectiveOptions.selectedEntityIds);
    // ADR-559 — AutoCAD GRIPOBJLIMIT: decide ONCE per frame whether the selection is too
    // large to draw grips for (Ctrl+A on a big drawing). Read the live limit at frame time.
    this._gripsSuppressedByObjLimit = isGripObjLimitExceeded(this._selectionSet.size, gripStyleStore.get().gripObjLimit);
    // ADR-040 Phase IX: viewport culling — skip entities whose bbox does not
    // intersect the screen-space viewport. Computed once per frame.
    const worldViewport = viewportToWorldBBox(transform, actualViewport);

    // ADR-661 — SINGLE array-order render pass (DRAWORDER SSoT). Entities paint in `scene.entities`
    // order (last index = topmost, AutoCAD DRAWORDER / «Send to Back» — ADR-661). Consecutive solid
    // LINE entities are accumulated into a style-keyed «run» (a Map of per-style batches) and stroked
    // in ONE pass when a non-batchable entity breaks the run — so ADR-040 Phase X line batching is
    // preserved WITHIN each run while global z-order is honoured for lines too. This replaces the old
    // «all lines first (batch) → renderMatching for everything else» form, which forced EVERY line
    // under EVERY non-line regardless of array position (the DRAWORDER violation ADR-661 fixes).
    //
    // Two entity classes stay position-independent BY DESIGN (not array-order):
    //   • slab-opening — deferred to a final sub-pass (ADR-363 §11.Q3): a slab's `destination-out`
    //     punch erases already-painted opening artwork if the slab draws AFTER the opening (openings
    //     can precede their host slab in a Firestore snapshot merge — incident 2026-05-25).
    //   • topo contours — no longer a special background pass: they are seated at the BACK of the
    //     array at generation time (ADR-650 M10d / regenerate-topo `[...fresh, ...kept]`), so array
    //     order alone now puts the κάτοψη on top. Removing the pass is the whole point of ADR-661.
    type LineBatch = { starts: Point2D[]; ends: Point2D[]; lw: number; alpha: number; dashMm: ReadonlyArray<number>; celtscale: number };
    // ADR-639 Στάδιο 5 — event-time read (once/frame, never stale): when the GPU line layer is live,
    // the ids in `webglOwnedIds` are drawn by it, so their Canvas2D stroke is suppressed below.
    const webglLineActive = isWebglLineLayerActive();
    const webglOwnedIds = webglLineActive ? getWebglOwnedEntityIds() : null;
    const batchedIds = new Set<string>();
    // ADR-363 §11.Q3 — slab-openings collected here, drawn LAST (after every slab).
    const deferredSlabOpenings: DxfEntityUnion[] = [];
    // The current consecutive-line run (null = no open run). Flushed on any run-breaking entity.
    let run: Map<string, LineBatch> | null = null;

    const flushRun = (): void => {
      if (!run) return;
      for (const [key, batch] of run) {
        const color = key.split('\0')[0];
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = batch.lw;
        // ADR-510 Φ2 — metric dash → screen px (zoom × LTSCALE × CELTSCALE); [] for solid.
        this.ctx.setLineDash(dashMmToScreenPx(batch.dashMm, transform.scale, getEffectiveLinetypeScale(), batch.celtscale));
        this.ctx.globalAlpha = batch.alpha;
        this.ctx.lineCap = 'butt';
        this.ctx.beginPath();
        for (let i = 0; i < batch.starts.length; i++) {
          this.ctx.moveTo(batch.starts[i].x, batch.starts[i].y);
          this.ctx.lineTo(batch.ends[i].x, batch.ends[i].y);
        }
        this.ctx.stroke();
        this.ctx.restore();
      }
      run = null;
    };

    // Per-entity draw with all skip gates (mirror of the former `renderMatching` body).
    const drawInOrder = (entity: DxfEntityUnion): void => {
      if (!entity.visible) return;
      if (!isEntityInViewport(entity, worldViewport)) return;
      // ADR-358 §5.6.bis Phase 10 — frozen/invisible/isolate/cut-plane skip.
      if (this.isEntityLayerSkipped(entity, effectiveOptions.layersById)) return;
      // ADR-640 arc-fix — TYPE-gated: only a batched LINE is suppressed; a non-line container
      // member sharing the id (block/group/array) must still draw.
      if (isDrawnByBatchedLineLayer(entity, batchedIds)) return;
      // ADR-639 Στάδιο 5 — GPU owns this normal-state line/polyline: skip its Canvas2D draw,
      // EXCEPT when selected/hovered (the highlight overlay must paint over the GPU line — rule 3).
      if (isDrawnByWebglLineLayer(entity, webglOwnedIds)
          && !this._selectionSet.has(entity.id)
          && effectiveOptions.hoveredEntityId !== entity.id) return;
      this.renderEntityUnified(entity, transform, actualViewport, effectiveOptions);
    };

    for (const entity of scene.entities) {
      // ADR-363 §11.Q3 — never draw a slab-opening in array position; defer to the final sub-pass.
      // Do NOT flush the run: the opening paints nothing here, so surrounding lines may still batch.
      if (entity.type === 'slab-opening') { deferredSlabOpenings.push(entity); continue; }

      // Eligible solid LINE → extend the current run (ADR-040 Phase X batching, preserved per-run).
      const entry = entity.type === 'line'
        ? this.tryLineBatchEntry(entity, effectiveOptions, worldViewport, transform, actualViewport, webglOwnedIds)
        : null;
      if (entry) {
        if (!run) run = new Map<string, LineBatch>();
        let batch = run.get(entry.key);
        if (!batch) { batch = { starts: [], ends: [], lw: entry.lw, alpha: entry.alpha, dashMm: entry.dashMm, celtscale: entry.celtscale }; run.set(entry.key, batch); }
        batch.starts.push(entry.start);
        batch.ends.push(entry.end);
        batchedIds.add(entity.id);
        continue;
      }

      // ADR-639 Στάδιο 5 — a GPU-owned line that is NOT selected/hovered is drawn by the GPU: suppress
      // its Canvas2D draw WITHOUT breaking the run (it paints nothing here). `batchedIds` also gates the
      // per-entity pass (preserved dual meaning: «already handled», not literally «in a stroke batch»).
      if (entity.type === 'line' && webglOwnedIds && webglOwnedIds.has(entity.id)
          && !this._selectionSet.has(entity.id) && effectiveOptions.hoveredEntityId !== entity.id) {
        batchedIds.add(entity.id);
        continue;
      }

      // Any other entity (non-line, or a line excluded from batching — selected/hovered/measurement/
      // non-solid/complex-linetype) breaks the run: flush accumulated lines, then draw in array order.
      flushRun();
      drawInOrder(entity);
    }
    flushRun();

    // ADR-363 §11.Q3 — slab-openings ΠΑΝΩ από τα slabs (dashed outline + kind-fill survive the punch).
    for (const entity of deferredSlabOpenings) drawInOrder(entity);
    // ADR-449 Slice X2 μέρος Β — ΕΝΑ scene-level pass για τον ΕΝΙΑΙΟ σοβά (mirror του 3Δ
    // `syncStructuralFinishSkin`): μετά τα entities, ζωγραφίζει το merged-silhouette outline
    // από την ΙΔΙΑ SSoT με το 3Δ → ίδιες γωνίες/συμβολές, μηδέν διπλή γραμμή.
    drawStructuralFinishSkin2D(this.ctx, scene.entities, transform, actualViewport);
    // ADR-456/471 — οπλισμός δομικών μελών (κολώνα: διαμήκεις κουκκίδες+στεφάνι· δοκάρι:
    // διαμήκεις γραμμές+εγκάρσιοι συνδετήρες) ως scene-level overlay μέσα στο cached
    // normal-state bitmap (ίδιο pattern με τον σοβά)· gated από `showReinforcement`.
    drawMemberReinforcement2D(this.ctx, scene.entities, transform, actualViewport);
    // ADR-463 — οπλισμός θεμελίωσης (πέδιλο/πεδιλοδοκός/συνδετήρια) ως scene-level overlay,
    // ίδιο pattern/gate με την κολώνα (mirror του drawColumnReinforcement2D).
    drawFoundationReinforcement2D(this.ctx, scene.entities, transform, actualViewport);
    // ADR-476 — οπλισμός πλακών (εδαφόπλακα + αναρτημένη): δι-διευθυντικές σχάρες κάτω
    // (συμπαγείς) + άνω (διακεκομμένες), clip στο outline· ίδιο pattern/gate με το πέδιλο.
    drawSlabReinforcement2D(this.ctx, scene.entities, transform, actualViewport);
    this.ctx.restore();
  }

  /**
   * Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): render a single entity with
   * a forced visual mode. Used as a single-entity overlay drawn on top of the
   * cached bitmap to avoid invalidating the bitmap on every hover/selection/drag tick.
   *
   * Architectural rule: bitmap cache layers MUST contain only normal-state content;
   * interactive state (hover, selection grips, drag preview) is rendered here.
   */
  renderSingleEntity(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport,
    mode: 'hovered' | 'selected',
    interaction: {
      gripInteractionState?: DxfRenderOptions['gripInteractionState'];
      // ADR-358 §G7 Phase 4 — pass-through for ByLayer/ByBlock resolver
      layersById?: Record<string, SceneLayer>;
      // When true, selected entities keep selection highlight but grips are hidden
      // (AutoCAD parity: grips disappear when a command such as Move is active).
      suppressGrips?: boolean;
      // When true, selected entity renders as ghost (alpha × GHOST_DEFAULTS.alpha).
      movePreviewActive?: boolean;
      // When true, selected entity paints ORANGE (armed transform, base point not yet picked).
      armedTransformHighlight?: boolean;
    } = {},
  ): void {
    if (!entity.visible) return;
    // 🚀 PERF (ADR-040, 2026-05-11): getBounds (cached). N+1 layout reflows avoided.
    const canvasRect = canvasBoundsService.getBounds(this.canvas);
    const actualViewport: Viewport = { width: canvasRect.width, height: canvasRect.height };
    this.ctx.save();
    this.entityComposite.setTransform(transform);
    // ADR-049 SSOT (2026-05-12): 'drag-preview' mode removed — dragged entity renders as 'selected'.
    const gripOpts = mode === 'selected' ? interaction.gripInteractionState : undefined;
    this.setGripInteractionState(gripOpts ? { hovered: gripOpts.hoveredGrip, active: gripOpts.activeGrip, armedKeys: gripOpts.armedKeys } : {});
    const syntheticOptions: DxfRenderOptions = {
      showGrid: false, showLayerNames: false, wireframeMode: false,
      selectedEntityIds: mode === 'selected' ? [entity.id] : [],
      hoveredEntityId: mode === 'hovered' ? entity.id : null,
      gripInteractionState: gripOpts,
      layersById: interaction.layersById,
      suppressGrips: interaction.suppressGrips,
      movePreviewActive: interaction.movePreviewActive,
      armedTransformHighlight: interaction.armedTransformHighlight,
    };
    this._selectionSet = new Set(syntheticOptions.selectedEntityIds);
    // ADR-559 — single-entity overlay path: never exceeds the limit (size ≤ 1), but keep
    // the per-frame flag consistent so renderEntityUnified reads a fresh value.
    this._gripsSuppressedByObjLimit = isGripObjLimitExceeded(this._selectionSet.size, gripStyleStore.get().gripObjLimit);
    this.renderEntityUnified(entity, transform, actualViewport, syntheticOptions);
    this.ctx.restore();
  }

  /**
   * ✅ ΝΕΟ: Unified entity rendering με composite pattern
   * Αντικαθιστά τις 5 διπλογραφικές methods (renderLine, renderCircle, κλπ)
   */
  private renderEntityUnified(
    entity: DxfEntityUnion,
    transform: ViewTransform,
    viewport: Viewport,
    options: DxfRenderOptions
  ): void {
    const isSelected = this._selectionSet.has(entity.id);
    const isHovered = options.hoveredEntityId === entity.id;

    // ADR-049 SSOT (2026-05-12): grip-drag ghost is rendered on PreviewCanvas
    // by useGripGhostPreview, identical to the Move tool. The main canvas
    // always paints entities at their CURRENT scene-state position — no more
    // applyDragPreview mutation, no per-frame globalAlpha tweak.
    // ADR-358 §5.6.bis Phase 10 — single resolveStyleForRender call (shared with toEntityModel).
    const resolved = this.resolveStyleForRender(entity, options.layersById);
    const entityModel: EntityModel = this.toEntityModel(entity, isSelected, resolved);

    // ADR-559 — AutoCAD GRIPOBJLIMIT: hide grips for ALL selected entities once the
    // selection-object count exceeds the limit (entity stays selected, only grips are skipped).
    // ADR-637 §hover-grips (Giorgio 2026-07-11): grips εμφανίζονται ΚΑΙ σε hover (όχι μόνο
    // selection). Στο mode='selected' το synthetic hoveredEntityId=null → isHovered=false →
    // μηδενική επίδραση στο selection path. Το call site (dxf-canvas-renderer hover pass)
    // ελέγχει το πότε μέσω `suppressGrips` (όχι grips όταν τρέχει εργαλείο / ήδη επιλεγμένη).
    const gripsVisible = (isSelected || isHovered) && !options.suppressGrips && !this._gripsSuppressedByObjLimit;
    // ADR-049 inverted ghost: dim the dragged original to GHOST_DEFAULTS.alpha (its solid moving
    // copy lives on PreviewCanvas). ADR-637 Φ4-D EXCEPTION (Giorgio 2026-07-11): a STAIR grip drag
    // re-flows the stair IN PLACE (basePoint fixed — a rest landing slides, treads redistribute),
    // so the dimmed original sits UNDER its own live re-flow ghost and its OLD steps bleed through
    // the orange outline ghost («τα σκαλοπάτια φαίνονται από κάτω»). Hide it fully (alpha 0) so only
    // the clean orange re-flow ghost shows — exactly like the committed stair on release. Every
    // other kind keeps the 0.45 dim (its ghost moves AWAY → the dimmed origin is a useful reference).
    const ghostMult = options.movePreviewActive && isSelected
      ? (entity.type === 'stair' ? 0 : GHOST_DEFAULTS.alpha)
      : 1.0;
    const renderOptions: RenderOptions = {
      phase: isSelected ? 'selected' : isHovered ? 'highlighted' : 'normal',
      transform,
      viewport,
      showGrips: gripsVisible,
      grips: gripsVisible,
      hovered: isHovered,
      selected: isSelected,
      alpha: (entity.visible ? 1.0 : 0.3) * resolved.alpha * ghostMult,
      // Giorgio 2026-07-21 — armed transform selection paints ORANGE (PhaseManager reads
      // this + `selected` to pick the armed-selected phase). Cleared once the ghost begins.
      armedTransformHighlight: options.armedTransformHighlight,
    };

    this.entityComposite.render(entityModel, renderOptions);
  }

  // ADR-358 §G7 Phase 4 — accepts either a pre-resolved style (perf path used
  // by renderEntityUnified) or a layersById map (legacy / renderSingleEntity).
  // The entity-type → Entity switch lives in dxf-renderer-entity-model.ts.
  private toEntityModel(
    entity: DxfEntityUnion,
    isSelected: boolean,
    resolvedOrLayersById: ResolvedRenderStyle | Record<string, SceneLayer> | undefined,
  ): Entity {
    const isPreResolved =
      typeof resolvedOrLayersById === 'object' &&
      resolvedOrLayersById !== null &&
      'colorHex' in resolvedOrLayersById;
    // ADR-642 Φ2-B — use the `ResolvedRenderStyle` SSoT type (was a duplicated inline shape)
    // so the resolved `complex` def flows through to `buildEntityModelFromDxf` unchanged.
    const resolved = isPreResolved
      ? (resolvedOrLayersById as ResolvedRenderStyle)
      : this.resolveStyleForRender(entity, resolvedOrLayersById as Record<string, SceneLayer> | undefined);
    return buildEntityModelFromDxf(entity, isSelected, resolved);
  }
  // Per-frame index builders extracted to ./dxf-renderer-frame-builders.ts.
  /**
   * ADR-358 §G7 — ByLayer/ByBlock style resolution. Delegates to the SSoT
   * `resolveEntityRenderStyle` (extracted to `dxf-renderer-style-resolve.ts`)
   * so the committed canvas and the live WYSIWYG preview resolve style through
   * ONE function and cannot diverge. Isolate-alpha + print policy live there too.
   */
  private resolveStyleForRender(
    entity: DxfEntityUnion,
    layersById?: Record<string, SceneLayer>,
  ): ResolvedRenderStyle {
    const style = resolveEntityRenderStyle(entity, layersById);
    // ADR-375 — «DXF Σχέδιο» row overrides (colour + lineweight) for every raw DXF
    // entity (null category). null colour / 0 mm ⇒ keep the entity's own value.
    // Applied ONLY on the interactive canvas path (this method) — print / WYSIWYG
    // resolve through resolveEntityRenderStyle directly and stay untouched.
    const dxf = useBimRenderSettingsStore.getState().dxfImport;
    const hasColorOverride = dxf.projectionColor !== null;
    const hasWeightOverride = dxf.projectionLineweightMm > 0;
    if ((hasColorOverride || hasWeightOverride) && resolveEntityBimCategory(entity) === null) {
      return {
        ...style,
        colorHex: hasColorOverride ? dxf.projectionColor as string : style.colorHex,
        lineWidthPx: hasWeightOverride
          ? Math.max(1, lineweightToPx(dxf.projectionLineweightMm))
          : style.lineWidthPx,
      };
    }
    return style;
  }

  /**
   * ADR-661 — line batch eligibility (mirror of the former inline batch scan). Returns the batch
   * entry (style key + screen-space endpoints + stroke params) for a solid LINE that may join a
   * consecutive-line run, or `null` when the line is NOT batchable and must fall through to the
   * per-entity draw (selected / hovered / measurement / non-solid / genuine complex linetype).
   *
   * WebGL-owned lines are intentionally NOT handled here (caller suppresses them without breaking the
   * run). The gates + key composition are byte-for-byte the pre-ADR-661 logic: ADR-510 Φ2 dash+CELTSCALE
   * in the key, ADR-642 complex-linetype exclusion, ADR-358 layer skip, ADR-040 Phase IX viewport cull.
   */
  private tryLineBatchEntry(
    entity: DxfLine,
    options: DxfRenderOptions,
    worldViewport: ReturnType<typeof viewportToWorldBBox>,
    transform: ViewTransform,
    viewport: Viewport,
    webglOwnedIds: ReadonlySet<string> | null,
  ): { key: string; start: Point2D; end: Point2D; lw: number; alpha: number; dashMm: ReadonlyArray<number>; celtscale: number } | null {
    if (!entity.visible) return null;
    if (!isEntityInViewport(entity, worldViewport)) return null;
    if (this.isEntityLayerSkipped(entity, options.layersById)) return null;
    if (this._selectionSet.has(entity.id)) return null;
    if (options.hoveredEntityId === entity.id) return null;
    const meta = entity as typeof entity & { measurement?: boolean; lineType?: string };
    if (meta.measurement) return null;
    if (meta.lineType && meta.lineType !== 'solid') return null;
    // WebGL-owned lines are suppressed by the caller (drawn by the GPU), never batched here.
    if (webglOwnedIds && webglOwnedIds.has(entity.id)) return null;
    const resolved = this.resolveStyleForRender(entity, options.layersById);
    // ADR-642 Φ2-B — a genuine complex linetype (embedded `──GAS──` text) cannot be a single batched
    // `setLineDash` stroke; exclude it (and do NOT mark it batched) so LineRenderer draws the text.
    if (resolved.complex && !isSimpleExpressible(resolved.complex)) return null;
    // ADR-510 Φ2 — CELTSCALE (per-object, DXF grp 48) + dash signature in the key so entities with
    // the same colour/width but different linetype/ltscale never merge into one path.
    const celtscale = (entity as { ltscale?: number }).ltscale ?? 1;
    const dashKey = resolved.dashMm.length > 0 ? `${resolved.dashMm.join(',')}@${celtscale}` : '';
    return {
      key: `${resolved.colorHex}\0${resolved.lineWidthPx}\0${resolved.alpha.toFixed(3)}\0${dashKey}`,
      start: CoordinateTransforms.worldToScreen(entity.start, transform, viewport),
      end: CoordinateTransforms.worldToScreen(entity.end, transform, viewport),
      lw: resolved.lineWidthPx,
      alpha: resolved.alpha,
      dashMm: resolved.dashMm,
      celtscale,
    };
  }

  /**
   * ADR-358 §5.6.bis Phase 10 — return true when the entity is hidden by a cut-plane,
   * the imported-DXF master toggle, an isolate FREEZE, or a frozen/invisible layer.
   * Called per entity in both render loops.
   *
   * ADR-639 Στάδιο 5 — the body now lives in the shared `dxf-entity-layer-skip` SSoT so
   * the WebGL line-layer buffer builder asks the EXACT same question (a divergence would
   * leave a frozen/isolated line drawn by one layer and suppressed by the other). This
   * stays a thin instance method so the two call sites above keep the `this.` form.
   */
  private isEntityLayerSkipped(
    entity: DxfEntityUnion,
    layersById?: Record<string, SceneLayer>,
  ): boolean {
    return isEntityLayerSkippedShared(entity, layersById);
  }
}
