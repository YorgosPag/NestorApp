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
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
// ADR-743 Φ0 — attribution με το ΥΠΑΡΧΟΝ όργανο + το λεξιλόγιο των stages (μηδέν νέο σύστημα).
import { withPerf } from '../../systems/cursor/mouse-handler-perf';
import { DXF_CANVAS_STAGES, RASTER_STAGES, isCeilingProbeActive } from './dxf-canvas-perf-stages';
// ADR-743 Φ0 — hover/selection overlays (ADR-040 cardinal rule #3) σε δικό τους module.
import { paintInteractiveOverlays } from './dxf-canvas-interactive-overlays';
import type { Viewport, Point2D } from '../../rendering/types/Types';
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
  // ADR-040 Phase XXII.B — transformRef ΑΦΑΙΡΕΘΗΚΕ (νεκρό): ο render tick διαβάζει
  // απευθείας getImmediateTransform() (γρ. ~148) — ποτέ δεν διάβαζε το ref.
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
  // Dependencies for dirty tracking.
  // ADR-040 Phase XXII.B — `transform` ΑΦΑΙΡΕΘΗΚΕ: το dirty-on-transform το κάνει το ίδιο
  // το store ('dxf-canvas' στο TRANSFORM_CANVAS_IDS μέσω markSystemsDirty).
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
    guides, guidesVisible, showGuideDimensions,
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
    // 🏢 ADR-040 (2026-07-30) — SIZE-AT-PAINT-TIME. Το backing store συγχρονίζεται με το ΤΡΕΧΟΝ
    // viewport ΜΕΣΑ στο frame, όχι μόνο σε passive effect. Χωρίς αυτό ο RAF tick προλαβαίνει να
    // ζωγραφίσει με το νέο viewport πάνω στο ΑΡΧΙΚΟ 300×150 backing store (default του <canvas>)
    // και το CSS `width/height:100%` το τεντώνει ×5 → ο «γιγάντιος χάρακας» μετά από hard refresh.
    // Idempotent: γράφει canvas.width/height ΜΟΝΟ σε πραγματική αλλαγή (μηδέν wipe/κόστος στο
    // steady state) — ίδιο μοτίβο με το paintOverlayDispatchFrame (ADR-726 Φ2).
    const canvasEl = refs.canvasRef.current;
    const ctx = canvasEl
      ? withPerf(DXF_CANVAS_STAGES.size, () => CanvasUtils.sizeCanvasToViewport(canvasEl, currentViewport))
      : null;
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
      withPerf(DXF_CANVAS_STAGES.hitScene, () => serviceRegistry.get('hit-testing').updateScene(curScene));

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
        // ADR-743 Φ0 — `raster:rebuild` είναι ο συνολικός χρόνος του (σπάνιου) πλήρους
        // re-raster· τα `raster:indices/entities/scene-overlays` μέσα του το επιμερίζουν.
        if (bitmapCache.isDirty(curScene, currentTransform, currentViewport, cacheInputs)) {
          withPerf(RASTER_STAGES.rebuild, () =>
            bitmapCache.rebuild(curScene, currentTransform, currentViewport, cacheInputs));
        }
        // ADR-726 Φ3 — the blit is ANCHORED: it projects the cached raster onto the live
        // transform, so a pan/zoom frame is one drawImage instead of a full rebuild.
        withPerf(RASTER_STAGES.blit, () => bitmapCache.blit(ctx, currentViewport, currentTransform));
      } else {
        // Fallback before the cache effect mounts (or no 2D ctx): direct redraw.
        renderer.render(curScene, currentTransform, currentViewport, {
          ...curRenderOptions,
          skipInteractive: true,
          layersById: curLayersById,
        });
      }

      // 1b: Single-entity interactive overlays (O(1) via entityMap) — ADR-743 Φ0: το pass ζει
      // πλέον σε δικό του module (`dxf-canvas-interactive-overlays`), όπου τεκμηριώνεται ρητά
      // γιατί η διαδραστική κατάσταση ΔΕΝ μπαίνει ποτέ στο cache key (ADR-040 cardinal rule #3).
      if (curScene) {
        withPerf(DXF_CANVAS_STAGES.overlays, () => paintInteractiveOverlays({
          renderer,
          entityMap: curEntityMap,
          membersByGroupId: curMembersByGroupId,
          renderOptions: curRenderOptions,
          layersById: curLayersById,
          transform: currentTransform,
          viewport: currentViewport,
          activeTool: refs.activeToolRef.current,
        }));
      }

      // 2: Grid — rendered on the LOWER LayerCanvas (beneath the κάτοψη), NOT here.
      // The DxfCanvas (z=10) sits above the κάτοψη's LayerCanvas (z=0), so a grid
      // drawn here would always be on top. See ADR-040 "Grid is a background"
      // (2026-06-05) + LayerRenderer background-grid pass.

      // 2.5 + 2.6: Guides, ghost guides και construction points (ADR-743 Φ0: ένα stage —
      // ίδιος renderer, ίδια πύλη ορατότητας, μία ερώτηση «πόσο κοστίζουν οι οδηγοί;»).
      withPerf(DXF_CANVAS_STAGES.guides, () => {
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
        if (ctx && refs.guideRendererRef.current) {
          const currentCPs = refs.constructionPointsRef.current;
          if (currentCPs && currentCPs.length > 0) {
            refs.guideRendererRef.current.renderConstructionPoints(
              ctx, currentCPs, currentTransform, currentViewport, refs.highlightedPointIdRef.current ?? undefined,
            );
          }
        }
      });

      // 2.7: ADR-455 — vertical X/Y section lines + direction arrows (above entities,
      // below rulers). Reads the cut SSoT internally; no-op when both cuts are off.
      if (ctx) {
        withPerf(DXF_CANVAS_STAGES.axisCut, () => renderAxisCutLines(ctx, currentTransform, currentViewport));
      }

      // 3 + 3.5: Rulers και guide overlays (bubbles + dimensions) — ό,τι ζωγραφίζεται ΠΑΝΩ
      // από τα πάντα, σε ένα stage.
      withPerf(DXF_CANVAS_STAGES.rulers, () => {
        if (ctx && uiTransform && refs.rulerRendererRef.current && curRuler?.enabled) {
          const context = createUIRenderContext(ctx, currentViewport, uiTransform);
          refs.rulerRendererRef.current.render(context, currentViewport, curRuler as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
        if (ctx && refs.guideRendererRef.current && refs.guidesVisibleRef.current) {
          const currentGuides = refs.guidesRef.current;
          if (currentGuides && currentGuides.length > 0) {
            refs.guideRendererRef.current.renderGuideBubbles(ctx, currentGuides, currentTransform, currentViewport);
            if (refs.showGuideDimensionsRef.current && currentGuides.length >= 2) {
              refs.guideRendererRef.current.renderGuideDimensions(ctx, currentGuides, currentTransform, currentViewport);
            }
          }
        }
      });

      // 4: Selection box + lasso polygon
      const selState = refs.selectionStateRef.current;
      const currentActiveTool = refs.activeToolRef.current;
      const curSettings = getCursorSettings();

      if (refs.selectionRendererRef.current && currentActiveTool !== 'pan') {
        withPerf(DXF_CANVAS_STAGES.selection, () => {
          if (selState.isSelecting && selState.selectionStart && selState.selectionCurrent) {
            const selectionBox = {
              startPoint: selState.selectionStart,
              endPoint: selState.selectionCurrent,
              type: (selState.selectionCurrent.x > selState.selectionStart.x) ? 'window' : 'crossing',
            } as const;
            refs.selectionRendererRef.current?.renderSelection(selectionBox, currentViewport, curSettings.selection);
          }

          const lassoSnap = LassoStore.getSnapshot();
          if (lassoSnap.isLasso && lassoSnap.lassoPath.length >= 2) {
            refs.selectionRendererRef.current?.renderLasso(
              lassoSnap.lassoPath,
              computeLassoMode(lassoSnap.lassoPath),
              curSettings.selection,
            );
          }
        });
      }
    } catch (error) {
      logger.error('Failed to render DXF scene', { error });
    }
    perfEnd('DxfCanvasRenderer.renderScene', _perfPaintStart);
  }, [refs]);

  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): bitmap cache lifecycle
  // ADR-726 Φ3 — `requestRepaint` is the ONLY way the settled-gesture re-raster can reach
  // the scheduler: when a gesture ends nothing else marks the canvas dirty, so without it
  // the raster would stay projected (and its overscan off-centre) until the next input.
  useEffect(() => {
    bitmapCacheRef.current = new DxfBitmapCache({
      requestRepaint: () => { isDirtyRef.current = true; },
    });
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
      // ADR-743 Φ0 §πείραμα οροφής — με `localStorage['dxf-perf-ceiling']='1'` αυτό το σύστημα
      // δεν ζωγραφίζει καθόλου (η εικόνα παγώνει· ΔΙΑΓΝΩΣΤΙΚΟ). Η ίδια χειρονομία μετρά τότε
      // `frame:INTERVAL` με ΜΗΔΕΝ JS από εδώ ⇒ το κατώφλι του software compositing, δηλαδή το
      // ταβάνι κάθε βελτιστοποίησης JS. Μετρήθηκε ότι το 86,4% του καρέ στο pan ΔΕΝ είναι JS
      // (ADR-735 §7.3· LoAF ADR-726 §4.Γ) — χωρίς αυτόν τον αριθμό η Φ1 σχεδιάζεται στα τυφλά.
      () => isDirtyRef.current && !isCeilingProbeActive(),
    );
    return unsubscribe;
  }, [renderScene, refs]);

  // Mark dirty when dependencies change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [scene, viewport, renderOptions, gridSettings, rulerSettings, guides, guidesVisible, showGuideDimensions, ghostGuide, ghostDiagonalGuide, highlightedGuideId, constructionPoints, highlightedPointId, ghostSegmentLine]);

  // File-size SRP split (N.7.1) — the bitmap-cache dirty/invalidate store subscriptions
  // (isolate / LayerStore / BIM settings / fonts / LWDISPLAY / background) live in a
  // dedicated lifecycle hook. Behaviour is identical; the hot renderScene path is untouched.
  useDxfCanvasCacheInvalidation(bitmapCacheRef, isDirtyRef);

  // Selection dirty-marking handled by DxfCanvas imperative SelectionStore
  // subscription — no useEffect dep array needed here.

  return { isDirtyRef };
}
