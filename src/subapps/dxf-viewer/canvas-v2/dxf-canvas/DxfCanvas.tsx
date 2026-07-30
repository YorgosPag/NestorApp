/**
 * CANVAS V2 - DXF CANVAS COMPONENT
 * Καθαρό DXF canvas χωρίς legacy κώδικα
 *
 * Split: ADR-065 — Rendering logic extracted to dxf-canvas-renderer.ts
 */

'use client';

import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('DxfCanvas');

import React, { useRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { DxfRenderer } from './DxfRenderer';
import { useCentralizedMouseHandlers } from '../../systems/cursor/useCentralizedMouseHandlers';
import { wheelDeltaForFactor } from '../../systems/zoom/utils/calculations';
import { useCursor } from '../../systems/cursor/CursorSystem';
import { SelectionStore } from '../../systems/cursor/SelectionStore';
import { LassoStore } from '../../systems/cursor/LassoStore';
import { SelectionRenderer } from '../layer-canvas/selection/SelectionRenderer';
import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfRenderOptions } from './dxf-types';
import { serviceRegistry } from '../../services';
import type { GridSettings, RulerSettings, ColorLayer } from '../layer-canvas/layer-types';
import { GridRenderer } from '../../rendering/ui/grid/GridRenderer';
import { RulerRenderer } from '../../rendering/ui/ruler/RulerRenderer';
import { GuideRenderer } from '../../systems/guides/guide-renderer';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import { canvasUI } from '@/styles/design-tokens/canvas';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { useCanvasBackingStore } from '../../hooks/canvas';
import { useDxfCanvasRenderer } from './dxf-canvas-renderer';
// ADR-040 Phase XXII.B — το transform ΔΕΝ είναι πια React prop: ο render tick και οι
// handlers διαβάζουν το ζωντανό SSoT· το handle `getTransform` επιστρέφει την ίδια πηγή
// (διόρθωση του λανθάνοντος stale closure — το παλιό handle πάγωνε στο memo χωρίς dep).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
// ADR-040 Phase XXII.B — κοινός SSoT αγκύρωσης world(0,0) στη γωνία χαράκων (bootstrap +
// zoom-reset· βλ. ruler-origin.ts για το γιατί το interception μέσω prop καταργήθηκε).
import { computeRulerOriginTransform } from '../../systems/rulers-grid/ruler-origin';

const DEFAULT_RENDER_OPTIONS: DxfRenderOptions = {
  showGrid: false,
  showLayerNames: false,
  wireframeMode: false,
  selectedEntityIds: []
};

interface DxfCanvasProps {
  scene: DxfScene | null;
  viewport?: Viewport;
  crosshairSettings?: { enabled?: boolean };
  gridSettings?: GridSettings;
  rulerSettings?: RulerSettings;
  renderOptions?: DxfRenderOptions;
  className?: string;
  activeTool?: string;
  overlayMode?: 'select' | 'draw' | 'edit';
  colorLayers?: ColorLayer[];
  guides?: readonly Guide[];
  guidesVisible?: boolean;
  showGuideDimensions?: boolean;
  ghostGuide?: { axis: GridAxis; offset: number } | null;
  ghostDiagonalGuide?: { start: Point2D; end: Point2D } | null;
  highlightedGuideId?: string | null;
  selectedGuideIds?: ReadonlySet<string>;
  constructionPoints?: readonly ConstructionPoint[];
  highlightedPointId?: string | null;
  ghostSegmentLine?: { start: Point2D; end: Point2D } | null;
  onTransformChange?: (transform: ViewTransform) => void;
  onEntitySelect?: (entityId: string | null) => void;
  onMouseMove?: (screenPos: Point2D, worldPos: Point2D) => void;
  onWheelZoom?: (wheelDelta: number, center: Point2D) => void;
  onCanvasClick?: (point: Point2D, shiftKey?: boolean, altKey?: boolean, ctrlKey?: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onLayerSelected?: (layerId: string, position: Point2D) => void;
  onMultiLayerSelected?: (layerIds: string[]) => void;
  onEntitiesSelected?: (entityIds: string[]) => void;
  onUnifiedMarqueeResult?: (result: { layerIds: string[]; entityIds: string[]; circuitIds?: string[] }) => void;
  isGripDragging?: boolean;
  onHoverEntity?: (entityId: string | null) => void;
  onHoverOverlay?: (overlayId: string | null) => void;
  onGripMouseDown?: (worldPos: Point2D) => boolean;
  onGripMouseUp?: (worldPos: Point2D) => boolean;
  entityPickingActive?: boolean;
}

export interface DxfCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  getTransform: () => ViewTransform;
  fitToView: () => void;
  zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => void;
}

export const DxfCanvas = React.memo(React.forwardRef<DxfCanvasRef, DxfCanvasProps>(({
  scene,
  viewport: viewportProp,
  crosshairSettings,
  gridSettings,
  rulerSettings,
  renderOptions = DEFAULT_RENDER_OPTIONS,
  className = '',
  activeTool,
  overlayMode,
  colorLayers = [],
  guides,
  guidesVisible = true,
  showGuideDimensions = true,
  ghostGuide,
  ghostDiagonalGuide,
  highlightedGuideId,
  selectedGuideIds,
  constructionPoints,
  highlightedPointId,
  ghostSegmentLine,
  onTransformChange,
  onEntitySelect,
  onMouseMove,
  onWheelZoom,
  onCanvasClick,
  onContextMenu,
  onLayerSelected,
  onMultiLayerSelected,
  onEntitiesSelected,
  onUnifiedMarqueeResult,
  isGripDragging = false,
  onHoverEntity,
  onHoverOverlay,
  onGripMouseDown,
  onGripMouseUp,
  entityPickingActive,
  ...props
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);
  const selectionRendererRef = useRef<SelectionRenderer | null>(null);
  const gridRendererRef = useRef<GridRenderer | null>(null);
  const rulerRendererRef = useRef<RulerRenderer | null>(null);
  const guideRendererRef = useRef<GuideRenderer | null>(null);

  // 🏢 SSoT backing-store lifecycle (ADR-040) — resize hook + DPR indirection + sizing effects
  // live in ONE module shared with LayerCanvas (they were byte-identical twins).
  const { viewport, resolvedViewportRef } = useCanvasBackingStore({
    canvasRef,
    viewportProp,
    label: 'DXF',
  });

  const cursor = useCursor();

  // 🚀 PERF (2026-05-10 Phase III corrected): selection ref updated via
  // imperative SelectionStore callback — zero React re-renders on selection drag.
  const selectionStateRef = useRef<{ isSelecting: boolean; selectionStart: Point2D | null; selectionCurrent: Point2D | null }>({
    isSelecting: false, selectionStart: null, selectionCurrent: null
  });

  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Guide refs for RAF callback
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const guidesVisibleRef = useRef(guidesVisible);
  guidesVisibleRef.current = guidesVisible;
  const showGuideDimensionsRef = useRef(showGuideDimensions);
  showGuideDimensionsRef.current = showGuideDimensions;
  const highlightedGuideIdRef = useRef(highlightedGuideId);
  highlightedGuideIdRef.current = highlightedGuideId;
  const selectedGuideIdsRef = useRef(selectedGuideIds);
  selectedGuideIdsRef.current = selectedGuideIds;
  const ghostGuideRef = useRef(ghostGuide);
  ghostGuideRef.current = ghostGuide;
  const ghostDiagonalGuideRef = useRef(ghostDiagonalGuide);
  ghostDiagonalGuideRef.current = ghostDiagonalGuide;
  const constructionPointsRef = useRef(constructionPoints);
  constructionPointsRef.current = constructionPoints;
  const highlightedPointIdRef = useRef(highlightedPointId);
  highlightedPointIdRef.current = highlightedPointId;
  const ghostSegmentLineRef = useRef(ghostSegmentLine);
  ghostSegmentLineRef.current = ghostSegmentLine;

  // Imperative handle
  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    // ADR-040 Phase XXII.B — ζωντανή ανάγνωση από το SSoT. Το παλιό `() => transform`
    // ήταν stale closure (το memo ΔΕΝ είχε το transform στα deps) — snap tolerance /
    // drawing scale μπορούσαν να διαβάσουν παγωμένη τιμή μετά από zoom.
    getTransform: () => getImmediateTransform(),
    fitToView: () => {
      if (!onTransformChange) { logger.warn('fitToView: No onTransformChange callback'); return; }
      const fitToViewService = serviceRegistry.get('fit-to-view');
      const success = fitToViewService.performFitToView(scene, colorLayers, viewport, onTransformChange, { padding: 0.1, maxScale: 20, alignToOrigin: false });
      if (!success) logger.warn('fitToView: FitToViewService failed');
    },
    zoomAtScreenPoint: (factor: number, screenPoint: Point2D) => {
      if (onWheelZoom) {
        // Περνά τον ΑΚΡΙΒΗ factor μέσα από τον ΕΝΑ wheel-zoom δρόμο (αντίστροφο του exp), ώστε τα
        // κουμπιά zoom (BUTTON_IN/OUT) να τιμούν το 20% τους — όχι το παλιό ψεύτικο ±120 που γινόταν 10%.
        onWheelZoom(wheelDeltaForFactor(factor), screenPoint);
      }
    }
  }), [scene, colorLayers, viewport, onTransformChange, onWheelZoom]);

  // Centralized mouse handlers — event-time transform reads (cardinal rule #2, XXII.B).
  const mouseHandlers = useCentralizedMouseHandlers({
    scene, viewport, activeTool, overlayMode,
    onTransformChange, onEntitySelect, onMouseMove, onWheelZoom, onCanvasClick,
    colorLayers, onLayerSelected, onMultiLayerSelected, onEntitiesSelected,
    onUnifiedMarqueeResult, canvasRef, isGripDragging,
    onHoverEntity, onHoverOverlay, onGripMouseDown, onGripMouseUp, entityPickingActive,
    hitTestCallback: (scene, screenPos, transform, viewport) => {
      try {
        const hitTesting = serviceRegistry.get('hit-testing');
        const result = hitTesting.hitTest(screenPos, transform, viewport, {
          tolerance: TOLERANCE_CONFIG.ENTITY_HOVER_PIXELS, maxResults: 1
        });
        return result.entityId;
      } catch (error) {
        logger.error('hitTest failed', { error });
        return null;
      }
    }
  });

  // Initialize renderers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      rendererRef.current = new DxfRenderer(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        selectionRendererRef.current = new SelectionRenderer(ctx);
        gridRendererRef.current = new GridRenderer();
        rulerRendererRef.current = new RulerRenderer();
        guideRendererRef.current = new GuideRenderer();
      }
    } catch (error) {
      logger.error('Failed to initialize DXF renderer', { error });
    }
  }, []);

  // Refs are stable for component lifetime — bundle once to keep `renderScene`
  // useCallback dep stable across renders (was the dominant invalidation cause).
  const rendererRefs = useMemo(() => ({
    rendererRef, canvasRef, gridRendererRef, rulerRendererRef,
    guideRendererRef, selectionRendererRef, resolvedViewportRef,
    selectionStateRef, activeToolRef,
    guidesRef, guidesVisibleRef, showGuideDimensionsRef, highlightedGuideIdRef,
    selectedGuideIdsRef, ghostGuideRef, ghostDiagonalGuideRef,
    constructionPointsRef, highlightedPointIdRef, ghostSegmentLineRef,
  }), []);

  // Rendering (extracted hook)
  const { isDirtyRef } = useDxfCanvasRenderer({
    scene, renderOptions, gridSettings, rulerSettings, viewport,
    refs: rendererRefs,
    guides, guidesVisible, showGuideDimensions,
    ghostGuide, ghostDiagonalGuide, highlightedGuideId,
    constructionPoints, highlightedPointId, ghostSegmentLine,
    // selection state read imperatively from selectionStateRef via subscription below
  });

  // Force re-render when activeTool changes (grips show/hide — AutoCAD parity).
  useEffect(() => {
    isDirtyRef.current = true;
  }, [activeTool, isDirtyRef]);

  // 🚀 PERF (2026-05-10): imperative SelectionStore subscription.
  // Updates selectionStateRef + marks canvas dirty — zero React re-renders.
  useEffect(() => {
    const snap = SelectionStore.getSnapshot();
    selectionStateRef.current = { isSelecting: snap.isSelecting, selectionStart: snap.selectionStart, selectionCurrent: snap.selectionCurrent };
    return SelectionStore.subscribe(() => {
      const s = SelectionStore.getSnapshot();
      selectionStateRef.current = { isSelecting: s.isSelecting, selectionStart: s.selectionStart, selectionCurrent: s.selectionCurrent };
      isDirtyRef.current = true;
    });
  }, [isDirtyRef]);

  // Lasso subscription — mark DXF canvas dirty on every path append.
  // dxf-canvas-renderer reads LassoStore.getSnapshot() directly at render time.
  useEffect(() => {
    return LassoStore.subscribe(() => {
      isDirtyRef.current = true;
    });
  }, [isDirtyRef]);

  // Backing-store sizing on mount/resize → useCanvasBackingStore (SSoT, shared with LayerCanvas).
  // Το dirty-on-viewport το κάνει ήδη ο renderer (useDxfCanvasRenderer, dep `viewport`).

  // Initial transform: set world (0,0) at bottom-left ruler corner.
  // ADR-040 Phase XXII.B — τρέχει σε mount/viewport change και διαβάζει το ζωντανό SSoT.
  // ΔΕΝ ξανα-πυροδοτείται σε transform change: το zoom-reset ΔΕΝ περνά πια από εδώ —
  // το `resetToOrigin()` (useCanvasOperations) θέτει ΑΠΕΥΘΕΙΑΣ το αγκυρωμένο transform
  // μέσω του ΙΔΙΟΥ SSoT helper (`computeRulerOriginTransform`), χωρίς interception.
  useEffect(() => {
    if (!viewport.width || !viewport.height || !onTransformChange) return;
    const t = getImmediateTransform();
    if (t.offsetX === 0 && t.offsetY === 0 && t.scale === 1) {
      onTransformChange(computeRulerOriginTransform(viewport.height));
    }
  }, [viewport.width, viewport.height, onTransformChange]);

  return (
    <canvas
      ref={canvasRef}
      className={`dxf-canvas ${className}`}
      {...props}
      data-canvas-type="dxf" // 🎯 DEBUG: stable identifier για alignment/stacking tests (μετά το spread ώστε να μην παρακάμπτεται)
      style={canvasUI.positioning.layers.dxfCanvasWithTools(activeTool, crosshairSettings?.enabled)}
      onMouseDown={(e) => mouseHandlers.handleMouseDown(e)}
      onMouseMove={(e) => mouseHandlers.handleMouseMove(e)}
      onMouseUp={mouseHandlers.handleMouseUp}
      onMouseLeave={(e) => mouseHandlers.handleMouseLeave(e)}
      onWheel={(e) => mouseHandlers.handleWheel(e)}
      onAuxClick={(e) => e.preventDefault()}
      onContextMenu={onContextMenu}
    />
  );
}));

DxfCanvas.displayName = 'DxfCanvas';
