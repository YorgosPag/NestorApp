/**
 * DXF CANVAS RENDERER HOOK
 * Extracted from DxfCanvas.tsx for SRP (ADR-065)
 *
 * Contains: renderScene callback, UnifiedFrameScheduler registration,
 * dirty-flag management for RAF loop.
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { DxfRenderer } from './DxfRenderer';
import type { DxfScene, DxfRenderOptions, DxfEntityUnion } from './dxf-types';
import { DxfBitmapCache } from './dxf-bitmap-cache';
import { isBimRegionOrPerimeterTool } from '../../systems/tools/region-tool-ids';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import type { RulerRenderer } from '../../rendering/ui/ruler/RulerRenderer';
import { createUIRenderContext } from '../../rendering/ui/core/UIRenderContext';
import type { GuideRenderer } from '../../systems/guides/guide-renderer';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { SelectionRenderer } from '../layer-canvas/selection/SelectionRenderer';
import type { GridSettings, RulerSettings } from '../layer-canvas/layer-types';
import { getCursorSettings } from '../../systems/cursor/config';
import { serviceRegistry } from '../../services';
import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
// ADR-455 — 2D section-line overlay for the vertical X/Y cuts.
import { renderAxisCutLines } from '../../systems/axis-cut/axis-cut-line-renderer';
import { perfStart, perfEnd } from '../../debug/perf-line-profile';
import { LassoStore, computeLassoMode } from '../../systems/cursor/LassoStore';
// File-size SRP split (N.7.1) — bitmap-cache dirty/invalidate store subscriptions live in a
// dedicated lifecycle hook (isolate / LayerStore / fonts / LWDISPLAY / background / BIM settings).
import { useDxfCanvasCacheInvalidation } from './useDxfCanvasCacheInvalidation';

const logger = createModuleLogger('DxfCanvasRenderer');

// ── Types ────────────────────────────────────────────────────────────

interface SelectionState {
  isSelecting: boolean;
  selectionStart: Point2D | null;
  selectionCurrent: Point2D | null;
}

interface RendererRefs {
  rendererRef: React.MutableRefObject<DxfRenderer | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  gridRendererRef: React.MutableRefObject<GridRenderer | null>;
  rulerRendererRef: React.MutableRefObject<RulerRenderer | null>;
  guideRendererRef: React.MutableRefObject<GuideRenderer | null>;
  selectionRendererRef: React.MutableRefObject<SelectionRenderer | null>;
  transformRef: React.MutableRefObject<ViewTransform>;
  resolvedViewportRef: React.MutableRefObject<Viewport>;
  selectionStateRef: React.MutableRefObject<SelectionState>;
  activeToolRef: React.MutableRefObject<string | undefined>;
  // Guide refs
  guidesRef: React.MutableRefObject<readonly Guide[] | undefined>;
  guidesVisibleRef: React.MutableRefObject<boolean>;
  showGuideDimensionsRef: React.MutableRefObject<boolean>;
  highlightedGuideIdRef: React.MutableRefObject<string | null | undefined>;
  selectedGuideIdsRef: React.MutableRefObject<ReadonlySet<string> | undefined>;
  ghostGuideRef: React.MutableRefObject<{ axis: GridAxis; offset: number } | null | undefined>;
  ghostDiagonalGuideRef: React.MutableRefObject<{ start: Point2D; end: Point2D } | null | undefined>;
  constructionPointsRef: React.MutableRefObject<readonly ConstructionPoint[] | undefined>;
  highlightedPointIdRef: React.MutableRefObject<string | null | undefined>;
  ghostSegmentLineRef: React.MutableRefObject<{ start: Point2D; end: Point2D } | null | undefined>;
}

export interface DxfCanvasRendererParams {
  scene: DxfScene | null;
  renderOptions: DxfRenderOptions;
  gridSettings?: GridSettings;
  rulerSettings?: RulerSettings;
  viewport: Viewport;
  refs: RendererRefs;
  // Dependencies for dirty tracking
  transform: ViewTransform;
  guides?: readonly Guide[];
  guidesVisible: boolean;
  showGuideDimensions: boolean;
  ghostGuide?: { axis: GridAxis; offset: number } | null;
  ghostDiagonalGuide?: { start: Point2D; end: Point2D } | null;
  highlightedGuideId?: string | null;
  constructionPoints?: readonly ConstructionPoint[];
  highlightedPointId?: string | null;
  ghostSegmentLine?: { start: Point2D; end: Point2D } | null;
  // 🚀 PERF (2026-05-10): selection state removed — read from selectionStateRef
  // directly in RAF via refs.selectionStateRef. Imperative subscription in
  // DxfCanvas updates the ref + isDirtyRef without triggering React re-renders.
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useDxfCanvasRenderer(params: DxfCanvasRendererParams) {
  const {
    scene, viewport, refs,
    transform, guides, guidesVisible, showGuideDimensions,
    ghostGuide, ghostDiagonalGuide, highlightedGuideId,
    constructionPoints, highlightedPointId, ghostSegmentLine,
    renderOptions, gridSettings, rulerSettings,
  } = params;

  const isDirtyRef = useRef(true);
  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): hybrid bitmap cache for entities
  const bitmapCacheRef = useRef<DxfBitmapCache | null>(null);

  // O(1) entity lookup — rebuilt only when scene changes, not every frame
  const entityMap = useMemo<Map<string, DxfEntityUnion>>(() => {
    if (!scene) return new Map();
    return new Map(scene.entities.map((e) => [e.id, e]));
  }, [scene]);

  // ADR-575 §selection/hover semantics — converted members grouped by their GROUP
  // container id. Every expanded member carries `group.id`, so `entityMap` keeps only
  // ONE arbitrary member per group; the interactive overlay uses THIS 1→N map instead
  // to paint the WHOLE group on hover/selection. Built only for ids the live scene
  // flagged as groups (`renderOptions.groupIds`) → a member the user "entered" (own id,
  // not in any group set) still resolves individually via `entityMap`. Rebuilt only
  // when the scene or the group set changes (not per frame).
  const groupIds = renderOptions.groupIds;
  const membersByGroupId = useMemo<Map<string, DxfEntityUnion[]>>(() => {
    const map = new Map<string, DxfEntityUnion[]>();
    if (!scene || !groupIds || groupIds.size === 0) return map;
    for (const e of scene.entities) {
      if (!groupIds.has(e.id)) continue;
      const bucket = map.get(e.id);
      if (bucket) bucket.push(e);
      else map.set(e.id, [e]);
    }
    return map;
  }, [scene, groupIds]);

  // 🚀 PERF (ADR-040, 2026-05-11 Phase XII): single paramsRef holds ALL volatile
  // per-frame state (scene, entityMap, renderOptions, grid, ruler), synced
  // render-by-render. Mirrors Phase XI pattern in layer-canvas-hooks.ts.
  // → renderScene useCallback deps = [refs] only → STABLE identity
  // → registerRenderCallback effect runs ONCE per mount (was ~13Hz before)
  const paramsRef = useRef({ scene, entityMap, membersByGroupId, renderOptions, gridSettings, rulerSettings });
  paramsRef.current = { scene, entityMap, membersByGroupId, renderOptions, gridSettings, rulerSettings };

  const renderScene = useCallback(() => {
    const renderer = refs.rendererRef.current;
    const currentViewport = refs.resolvedViewportRef.current;
    if (!renderer || !currentViewport.width || !currentViewport.height) return;
    const _perfPaintStart = perfStart();

    const currentTransform = getImmediateTransform();
    const ctx = refs.canvasRef.current?.getContext('2d') ?? null;
    const uiTransform = ctx ? {
      scale: currentTransform.scale,
      offsetX: currentTransform.offsetX,
      offsetY: currentTransform.offsetY,
      rotation: 0,
    } : null;

    // 🚀 PERF (ADR-040 Phase XII): read latest volatile params from single ref
    const {
      scene: curScene,
      entityMap: curEntityMap,
      membersByGroupId: curMembersByGroupId,
      renderOptions: curRenderOptions,
      gridSettings: curGrid,
      rulerSettings: curRuler,
    } = paramsRef.current;

    try {
      const hitTesting = serviceRegistry.get('hit-testing');
      hitTesting.updateScene(curScene);

      // ADR-358 §G7 Phase 5 — bridge SceneModel.layers into renderer via DxfScene.layersById.
      // Absent → renderer falls back to per-entity literal values (Phase 1-4 baseline).
      const curLayersById = curScene?.layersById;

      // 🚀 PERF (ADR-040 Phase D wiring, 2026-06-11): the normal-state entity layer
      // is served from the hybrid bitmap cache instead of a full N-entity redraw
      // every dirty frame. THE FPS-0 / 1793ms-freeze cause: each hover/selection
      // change marked the layer dirty → renderer.render() re-painted ALL 188–4200
      // entities. The cache rebuilds ONLY when scene/transform/viewport/annotation/
      // BIM-settings/wireframe/layer-name change; on a static transform a hover is
      // a cache HIT → one blit (1 drawImage) + the single hovered/selected overlay.
      // Isolate + LayerStore mutations invalidate it imperatively (see subscriptions
      // below). Interactive overlays stay OUTSIDE the cache — ADR-040 cardinal rule #3.
      // The cache rebuild mirrors render(skipInteractive:true) verbatim (which itself
      // drops layersById), so the blitted pixels are identical to the pre-cache path.
      const bitmapCache = bitmapCacheRef.current;
      const cacheInputs = {
        showGrid: curRenderOptions.showGrid,
        showLayerNames: curRenderOptions.showLayerNames,
        wireframeMode: curRenderOptions.wireframeMode,
      };
      if (bitmapCache && ctx) {
        if (bitmapCache.isDirty(curScene, currentTransform, currentViewport, cacheInputs)) {
          bitmapCache.rebuild(curScene, currentTransform, currentViewport, cacheInputs);
        }
        bitmapCache.blit(ctx, currentViewport);
      } else {
        // Fallback before the cache effect mounts (or no 2D ctx): direct redraw.
        renderer.render(curScene, currentTransform, currentViewport, {
          ...curRenderOptions,
          skipInteractive: true,
          layersById: curLayersById,
        });
      }

      // 1b: Single-entity interactive overlays (O(1) via entityMap)
      if (curScene) {
        // ADR-575 §selection/hover semantics — a hovered GROUP id highlights the WHOLE
        // group: every expanded member shares `group.id`, so `entityMap` would surface
        // ONE arbitrary member (the pre-ADR-575 «stray member glows» bug). When the id is
        // a group we paint EACH of its members as 'hovered' (whole-group cyan); otherwise
        // the plain O(1) single-entity path (incl. a member the user "entered" — own id).
        // ADR-637 §hover-grips (Giorgio 2026-07-11) — τα grips εμφανίζονται ΚΑΙ σε hover
        // (όχι μόνο selection). Υπολογίζουμε `gripsAllowed` + `selectedSet` ΕΔΩ, πάνω από το
        // hover pass, ώστε να τα διαβάζει: (α) κανένα grip όταν τρέχει command (Move κ.λπ.),
        // (β) κανένα διπλό grip όταν η hovered οντότητα είναι ήδη επιλεγμένη (τα δίνει το
        // selection pass). Overlay-only → μηδέν κόστος bitmap (ADR-040 cardinal rule #3).
        const activeTool = refs.activeToolRef.current;
        const gripsAllowed =
          !activeTool ||
          activeTool === 'select' ||
          activeTool === 'layering' ||
          activeTool === 'wall-on-entity' ||
          isBimRegionOrPerimeterTool(activeTool);
        const selectedSet = new Set(curRenderOptions.selectedEntityIds);

        const hoveredId = curRenderOptions.hoveredEntityId;
        if (hoveredId) {
          const hoveredMembers = curMembersByGroupId.get(hoveredId);
          if (hoveredMembers) {
            // Whole-group hover: cyan glow μόνο — το group έχει δικό του gizmo (όπως στο
            // selection group branch), οπότε suppressGrips στα members.
            for (const ent of hoveredMembers) {
              renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'hovered', {
                gripInteractionState: curRenderOptions.gripInteractionState,
                layersById: curLayersById,
                suppressGrips: true,
              });
            }
          } else {
            const ent = curEntityMap.get(hoveredId);
            if (ent) {
              renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'hovered', {
                gripInteractionState: curRenderOptions.gripInteractionState,
                layersById: curLayersById,
                suppressGrips: !gripsAllowed || selectedSet.has(hoveredId),
              });
            }
          }
        }

        // ADR-049 SSOT: dragging entity stays painted at its ORIGINAL position
        // here (rendered as 'selected'). The translucent ghost at the drag
        // delta is drawn on the dedicated PreviewCanvas overlay by
        // GripDragPreviewMount → useGripGhostPreview, identical to the Move
        // tool path. No drag-preview branch lives in this renderer anymore.
        //
        // AutoCAD parity: grips are only visible in selection mode (no active command).
        // When a tool like Move is active, grips disappear — the tool has its own UX.
        // ADR-363 Phase 1J / ADR-419 — 'wall-on-entity' shows grips on the picked source; the
        // region/perimeter tools show grips on the accumulated 4-line picks. `activeTool` +
        // `gripsAllowed` are computed once above the hover pass (shared by both passes).
        for (const selId of curRenderOptions.selectedEntityIds) {
          // ADR-575 §selection/hover semantics — a selected GROUP renders as ONE unit:
          // paint ALL its members as 'selected' with grips SUPPRESSED (the whole-group
          // gizmo — move cross + rotation handle — owns the handles, emitted separately by
          // the grip registry). Pre-ADR-575 the shared `group.id` surfaced ONE stray member
          // with per-member grips, mis-reading as «one member selected» + letting it drag
          // alone. A non-group id (incl. an "entered" member's own id) keeps the O(1) path.
          const selMembers = curMembersByGroupId.get(selId);
          if (selMembers) {
            for (const ent of selMembers) {
              renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'selected', {
                gripInteractionState: curRenderOptions.gripInteractionState,
                layersById: curLayersById,
                suppressGrips: true,
                movePreviewActive:
                  curRenderOptions.movePreviewActive ||
                  (selId === curRenderOptions.gripDraggedEntityId && !curRenderOptions.gripDragIsCopy),
              });
            }
            continue;
          }
          const ent = curEntityMap.get(selId);
          if (ent) {
            renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'selected', {
              gripInteractionState: curRenderOptions.gripInteractionState,
              layersById: curLayersById,
              suppressGrips: !gripsAllowed,
              // ADR-049 inverted ghost: dim the original at its origin when this entity is
              // the one being move-previewed. The 2-click Move tool dims ALL selected
              // (movePreviewActive); a grip drag dims ONLY the single grabbed entity
              // (gripDraggedEntityId) — its solid moving copy lives on PreviewCanvas.
              // ADR-561 EXT — but a rotate-COPY keeps the source as a permanent original, so
              // it stays SOLID (not dimmed); only the rotating clone ghost shows the move.
              movePreviewActive:
                curRenderOptions.movePreviewActive ||
                (selId === curRenderOptions.gripDraggedEntityId && !curRenderOptions.gripDragIsCopy),
            });
          }
        }
      }

      // 2: Grid — rendered on the LOWER LayerCanvas (beneath the κάτοψη), NOT here.
      // The DxfCanvas (z=10) sits above the κάτοψη's LayerCanvas (z=0), so a grid
      // drawn here would always be on top. See ADR-040 "Grid is a background"
      // (2026-06-05) + LayerRenderer background-grid pass.

      // 2.5: Guides
      if (ctx && refs.guideRendererRef.current && refs.guidesVisibleRef.current) {
        const currentGuides = refs.guidesRef.current;
        if (currentGuides && currentGuides.length > 0) {
          refs.guideRendererRef.current.renderGuides(
            ctx, currentGuides, currentTransform, currentViewport,
            refs.highlightedGuideIdRef.current, refs.selectedGuideIdsRef.current,
          );
        }
        const currentGhost = refs.ghostGuideRef.current;
        if (currentGhost) {
          refs.guideRendererRef.current.renderGhostGuide(ctx, currentGhost.axis, currentGhost.offset, currentTransform, currentViewport);
        }
        const currentGhostDiagonal = refs.ghostDiagonalGuideRef.current;
        if (currentGhostDiagonal) {
          refs.guideRendererRef.current.renderGhostDiagonalGuide(ctx, currentGhostDiagonal.start, currentGhostDiagonal.end, currentTransform, currentViewport);
        }
        const currentGhostSegment = refs.ghostSegmentLineRef.current;
        if (currentGhostSegment) {
          refs.guideRendererRef.current.renderGhostDiagonalGuide(ctx, currentGhostSegment.start, currentGhostSegment.end, currentTransform, currentViewport);
        }
      }

      // 2.6: Construction points
      if (ctx && refs.guideRendererRef.current) {
        const currentCPs = refs.constructionPointsRef.current;
        if (currentCPs && currentCPs.length > 0) {
          refs.guideRendererRef.current.renderConstructionPoints(
            ctx, currentCPs, currentTransform, currentViewport, refs.highlightedPointIdRef.current ?? undefined,
          );
        }
      }

      // 2.7: ADR-455 — vertical X/Y section lines + direction arrows (above entities,
      // below rulers). Reads the cut SSoT internally; no-op when both cuts are off.
      if (ctx) {
        renderAxisCutLines(ctx, currentTransform, currentViewport);
      }

      // 3: Rulers
      if (ctx && uiTransform && refs.rulerRendererRef.current && curRuler?.enabled) {
        const context = createUIRenderContext(ctx, currentViewport, uiTransform);
        refs.rulerRendererRef.current.render(context, currentViewport, curRuler as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
      }

      // 3.5: Guide overlays (bubbles + dimensions)
      if (ctx && refs.guideRendererRef.current && refs.guidesVisibleRef.current) {
        const currentGuides = refs.guidesRef.current;
        if (currentGuides && currentGuides.length > 0) {
          refs.guideRendererRef.current.renderGuideBubbles(ctx, currentGuides, currentTransform, currentViewport);
          if (refs.showGuideDimensionsRef.current && currentGuides.length >= 2) {
            refs.guideRendererRef.current.renderGuideDimensions(ctx, currentGuides, currentTransform, currentViewport);
          }
        }
      }

      // 4: Selection box + lasso polygon
      const selState = refs.selectionStateRef.current;
      const currentActiveTool = refs.activeToolRef.current;
      const curSettings = getCursorSettings();

      if (refs.selectionRendererRef.current && currentActiveTool !== 'pan') {
        if (selState.isSelecting && selState.selectionStart && selState.selectionCurrent) {
          const selectionBox = {
            startPoint: selState.selectionStart,
            endPoint: selState.selectionCurrent,
            type: (selState.selectionCurrent.x > selState.selectionStart.x) ? 'window' : 'crossing',
          } as const;
          refs.selectionRendererRef.current.renderSelection(selectionBox, currentViewport, curSettings.selection);
        }

        const lassoSnap = LassoStore.getSnapshot();
        if (lassoSnap.isLasso && lassoSnap.lassoPath.length >= 2) {
          refs.selectionRendererRef.current.renderLasso(
            lassoSnap.lassoPath,
            computeLassoMode(lassoSnap.lassoPath),
            curSettings.selection,
          );
        }
      }
    } catch (error) {
      logger.error('Failed to render DXF scene', { error });
    }
    perfEnd('DxfCanvasRenderer.renderScene', _perfPaintStart);
  }, [refs]);

  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): bitmap cache lifecycle
  useEffect(() => {
    bitmapCacheRef.current = new DxfBitmapCache();
    return () => {
      bitmapCacheRef.current?.dispose();
      bitmapCacheRef.current = null;
    };
  }, []);

  // Register with UnifiedFrameScheduler (ADR-119)
  // 🚀 PERF (ADR-040 Phase XII): deps reduced to [renderScene, refs] (both
  // stable). Viewport/renderer guards moved INSIDE callback (read from refs
  // at frame time). Effect runs ONCE per mount, killing the 7.8% unsubscribe
  // residual observed in Phase XI profiler.
  useEffect(() => {
    const unsubscribe = registerRenderCallback(
      'dxf-canvas',
      'DXF Entity Renderer',
      RENDER_PRIORITIES.NORMAL,
      () => {
        const vp = refs.resolvedViewportRef.current;
        if (!refs.rendererRef.current || !vp.width || !vp.height) return;
        renderScene();
        isDirtyRef.current = false;
      },
      () => isDirtyRef.current,
    );
    return unsubscribe;
  }, [renderScene, refs]);

  // Mark dirty when dependencies change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [scene, transform, viewport, renderOptions, gridSettings, rulerSettings, guides, guidesVisible, showGuideDimensions, ghostGuide, ghostDiagonalGuide, highlightedGuideId, constructionPoints, highlightedPointId, ghostSegmentLine]);

  // File-size SRP split (N.7.1) — the bitmap-cache dirty/invalidate store subscriptions
  // (isolate / LayerStore / BIM settings / fonts / LWDISPLAY / background) live in a
  // dedicated lifecycle hook. Behaviour is identical; the hot renderScene path is untouched.
  useDxfCanvasCacheInvalidation(bitmapCacheRef, isDirtyRef);

  // Selection dirty-marking handled by DxfCanvas imperative SelectionStore
  // subscription — no useEffect dep array needed here.

  return { isDirtyRef };
}
