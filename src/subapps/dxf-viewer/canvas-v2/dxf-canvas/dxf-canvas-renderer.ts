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
    scene, renderOptions, gridSettings, rulerSettings, viewport, refs,
    transform, guides, guidesVisible, showGuideDimensions,
    ghostGuide, ghostDiagonalGuide, highlightedGuideId,
    constructionPoints, highlightedPointId, ghostSegmentLine,
  } = params;

  const isDirtyRef = useRef(true);
  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): hybrid bitmap cache for entities
  const bitmapCacheRef = useRef<DxfBitmapCache | null>(null);

  // O(1) entity lookup — rebuilt only when scene changes, not every frame
  const entityMap = useMemo<Map<string, DxfEntityUnion>>(() => {
    if (!scene) return new Map();
    return new Map(scene.entities.map((e) => [e.id, e]));
  }, [scene]);

  const renderScene = useCallback(() => {
    const renderer = refs.rendererRef.current;
    const currentViewport = refs.resolvedViewportRef.current;
    if (!renderer || !currentViewport.width || !currentViewport.height) return;

    const currentTransform = getImmediateTransform();
    // Canvas ctx retrieved once per frame — avoids repeated DOM getContext() calls
    const ctx = refs.canvasRef.current?.getContext('2d') ?? null;
    // uiTransform built once — reused for grid + ruler
    const uiTransform = ctx ? {
      scale: currentTransform.scale,
      offsetX: currentTransform.offsetX,
      offsetY: currentTransform.offsetY,
      rotation: 0,
    } : null;

    try {
      const hitTesting = serviceRegistry.get('hit-testing');
      hitTesting.updateScene(scene);

      renderer.render(scene, currentTransform, currentViewport, {
        ...renderOptions,
        skipInteractive: true,
      });

      // 1b: Single-entity interactive overlays (O(1) via entityMap)
      if (scene) {
        if (renderOptions.hoveredEntityId) {
          const ent = entityMap.get(renderOptions.hoveredEntityId);
          if (ent) {
            renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'hovered', {
              gripInteractionState: renderOptions.gripInteractionState,
            });
          }
        }

        for (const selId of renderOptions.selectedEntityIds) {
          if (renderOptions.dragPreview && renderOptions.dragPreview.entityId === selId) continue;
          const ent = entityMap.get(selId);
          if (ent) {
            renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'selected', {
              gripInteractionState: renderOptions.gripInteractionState,
            });
          }
        }

        if (renderOptions.dragPreview) {
          const ent = entityMap.get(renderOptions.dragPreview.entityId);
          if (ent) {
            renderer.renderSingleEntity(ent, currentTransform, currentViewport, 'drag-preview', {
              gripInteractionState: renderOptions.gripInteractionState,
              dragPreview: renderOptions.dragPreview,
            });
          }
        }
      }

      // 2: Grid
      if (ctx && uiTransform && refs.gridRendererRef.current && gridSettings?.enabled) {
        const context = createUIRenderContext(ctx, currentViewport, uiTransform);
        refs.gridRendererRef.current.render(context, currentViewport, gridSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
      }

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

      // 3: Rulers
      if (ctx && uiTransform && refs.rulerRendererRef.current && rulerSettings?.enabled) {
        const context = createUIRenderContext(ctx, currentViewport, uiTransform);
        refs.rulerRendererRef.current.render(context, currentViewport, rulerSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
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

      // 4: Selection box
      const selState = refs.selectionStateRef.current;
      const currentActiveTool = refs.activeToolRef.current;
      if (refs.selectionRendererRef.current && currentActiveTool !== 'pan' &&
          selState.isSelecting && selState.selectionStart && selState.selectionCurrent) {
        const curSettings = getCursorSettings();
        const selectionBox = {
          startPoint: selState.selectionStart,
          endPoint: selState.selectionCurrent,
          type: (selState.selectionCurrent.x > selState.selectionStart.x) ? 'window' : 'crossing'
        } as const;
        refs.selectionRendererRef.current.renderSelection(selectionBox, currentViewport, curSettings.selection);
      }
    } catch (error) {
      logger.error('Failed to render DXF scene', { error });
    }
  }, [scene, renderOptions, gridSettings, rulerSettings, refs, entityMap]);

  // Phase D RE-IMPLEMENT (ADR-040, 2026-05-09): bitmap cache lifecycle
  useEffect(() => {
    bitmapCacheRef.current = new DxfBitmapCache();
    return () => {
      bitmapCacheRef.current?.dispose();
      bitmapCacheRef.current = null;
    };
  }, []);

  // Register with UnifiedFrameScheduler (ADR-119)
  useEffect(() => {
    if (viewport.width > 0 && viewport.height > 0 && refs.rendererRef.current) {
      const unsubscribe = registerRenderCallback(
        'dxf-canvas',
        'DXF Entity Renderer',
        RENDER_PRIORITIES.NORMAL,
        () => { renderScene(); isDirtyRef.current = false; },
        () => isDirtyRef.current,
      );
      return unsubscribe;
    }
  }, [renderScene, viewport.width, viewport.height, refs.rendererRef]);

  // Mark dirty when dependencies change
  useEffect(() => {
    isDirtyRef.current = true;
  }, [scene, transform, viewport, renderOptions, gridSettings, rulerSettings, guides, guidesVisible, showGuideDimensions, ghostGuide, ghostDiagonalGuide, highlightedGuideId, constructionPoints, highlightedPointId, ghostSegmentLine]);

  // Selection dirty-marking handled by DxfCanvas imperative SelectionStore
  // subscription — no useEffect dep array needed here.

  return { isDirtyRef };
}
