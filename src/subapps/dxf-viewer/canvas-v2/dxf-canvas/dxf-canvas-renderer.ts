/**
 * DXF CANVAS RENDERER HOOK
 * Extracted from DxfCanvas.tsx for SRP (ADR-065)
 *
 * Contains: renderScene callback, UnifiedFrameScheduler registration,
 * dirty-flag management for RAF loop.
 */

import { useRef, useCallback, useEffect } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import type { DxfRenderer } from './DxfRenderer';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
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
  cursorIsSelecting: boolean;
  cursorSelectionStartX?: number;
  cursorSelectionStartY?: number;
  cursorSelectionCurrentX?: number;
  cursorSelectionCurrentY?: number;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useDxfCanvasRenderer(params: DxfCanvasRendererParams) {
  const {
    scene, renderOptions, gridSettings, rulerSettings, viewport, refs,
    transform, guides, guidesVisible, showGuideDimensions,
    ghostGuide, ghostDiagonalGuide, highlightedGuideId,
    constructionPoints, highlightedPointId, ghostSegmentLine,
    cursorIsSelecting, cursorSelectionStartX, cursorSelectionStartY,
    cursorSelectionCurrentX, cursorSelectionCurrentY,
  } = params;

  const isDirtyRef = useRef(true);

  const renderScene = useCallback(() => {
    const renderer = refs.rendererRef.current;
    const currentViewport = refs.resolvedViewportRef.current;
    if (!renderer || !currentViewport.width || !currentViewport.height) return;

    const currentTransform = refs.transformRef.current;

    try {
      const hitTesting = serviceRegistry.get('hit-testing');
      hitTesting.updateScene(scene);

      // 1: Scene
      renderer.render(scene, currentTransform, currentViewport, renderOptions);

      // 2: Grid
      if (refs.gridRendererRef.current && gridSettings?.enabled) {
        const ctx = refs.canvasRef.current?.getContext('2d');
        if (ctx) {
          const uiTransform = { scale: currentTransform.scale, offsetX: currentTransform.offsetX, offsetY: currentTransform.offsetY, rotation: 0 };
          const context = createUIRenderContext(ctx, currentViewport, uiTransform);
          refs.gridRendererRef.current.render(context, currentViewport, gridSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      }

      // 2.5: Guides
      if (refs.guideRendererRef.current && refs.guidesVisibleRef.current) {
        const currentGuides = refs.guidesRef.current;
        const ctx = refs.canvasRef.current?.getContext('2d');
        if (ctx && currentGuides && currentGuides.length > 0) {
          refs.guideRendererRef.current.renderGuides(
            ctx, currentGuides, currentTransform, currentViewport,
            refs.highlightedGuideIdRef.current, refs.selectedGuideIdsRef.current,
          );
        }
        const currentGhost = refs.ghostGuideRef.current;
        if (ctx && currentGhost) {
          refs.guideRendererRef.current.renderGhostGuide(ctx, currentGhost.axis, currentGhost.offset, currentTransform, currentViewport);
        }
        const currentGhostDiagonal = refs.ghostDiagonalGuideRef.current;
        if (ctx && currentGhostDiagonal) {
          refs.guideRendererRef.current.renderGhostDiagonalGuide(ctx, currentGhostDiagonal.start, currentGhostDiagonal.end, currentTransform, currentViewport);
        }
        const currentGhostSegment = refs.ghostSegmentLineRef.current;
        if (ctx && currentGhostSegment) {
          refs.guideRendererRef.current.renderGhostDiagonalGuide(ctx, currentGhostSegment.start, currentGhostSegment.end, currentTransform, currentViewport);
        }
      }

      // 2.6: Construction points
      if (refs.guideRendererRef.current) {
        const currentCPs = refs.constructionPointsRef.current;
        const ctx = refs.canvasRef.current?.getContext('2d');
        if (ctx && currentCPs && currentCPs.length > 0) {
          refs.guideRendererRef.current.renderConstructionPoints(
            ctx, currentCPs, currentTransform, currentViewport, refs.highlightedPointIdRef.current ?? undefined,
          );
        }
      }

      // 3: Rulers
      if (refs.rulerRendererRef.current && rulerSettings?.enabled) {
        const ctx = refs.canvasRef.current?.getContext('2d');
        if (ctx) {
          const uiTransform = { scale: currentTransform.scale, offsetX: currentTransform.offsetX, offsetY: currentTransform.offsetY, rotation: 0 };
          const context = createUIRenderContext(ctx, currentViewport, uiTransform);
          refs.rulerRendererRef.current.render(context, currentViewport, rulerSettings as import('../../rendering/ui/core/UIRenderer').UIElementSettings);
        }
      }

      // 3.5: Guide overlays (bubbles + dimensions — on top of rulers)
      if (refs.guideRendererRef.current && refs.guidesVisibleRef.current) {
        const currentGuides = refs.guidesRef.current;
        const ctx = refs.canvasRef.current?.getContext('2d');
        if (ctx && currentGuides && currentGuides.length > 0) {
          refs.guideRendererRef.current.renderGuideBubbles(ctx, currentGuides, currentTransform, currentViewport);
          if (refs.showGuideDimensionsRef.current && currentGuides.length >= 2) {
            refs.guideRendererRef.current.renderGuideDimensions(ctx, currentGuides, currentTransform, currentViewport);
          }
        }
      }

      // 4: Selection box (on top of everything)
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
  }, [scene, renderOptions, gridSettings, rulerSettings, refs]);

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

  // Mark dirty when selection state changes
  useEffect(() => {
    isDirtyRef.current = true;
  }, [cursorIsSelecting, cursorSelectionStartX, cursorSelectionStartY, cursorSelectionCurrentX, cursorSelectionCurrentY]);

  return { isDirtyRef };
}
