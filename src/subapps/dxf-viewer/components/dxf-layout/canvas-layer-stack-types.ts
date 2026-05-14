/**
 * CanvasLayerStack Type Definitions
 *
 * Props interface and supporting types for CanvasLayerStack component.
 * Extracted per ADR-065 (file size compliance).
 */

import type { RefObject, MutableRefObject, Dispatch, SetStateAction } from 'react';
import type { DxfCanvasRef } from '../../canvas-v2';
import type { PreviewCanvasHandle } from '../../canvas-v2/preview-canvas';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { OverlayEditorMode } from '../../overlays/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { CrosshairSettings } from '../../rendering/ui/crosshair/CrosshairTypes';
import type { CursorSettings } from '../../systems/cursor/config';
import type { GridSettings, RulerSettings, SnapSettings, SelectionSettings } from '../../canvas-v2';
import type { GripSettings } from '../../types/gripSettings';
import type { RulerSettings as GlobalRulerSettings } from '../../systems/rulers-grid/config';
import type {
  VertexHoverInfo,
  EdgeHoverInfo,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from '../../hooks/canvas/useCanvasMouse';
import type { UseDxfGripInteractionReturn } from '../../hooks/useDxfGripInteraction';
import type { useDrawingHandlers } from '../../hooks/drawing/useDrawingHandlers';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GuideWorkflowState } from '../../hooks/guides/guide-workflow-types';
import type { RotationPhase } from '../../hooks/tools/useRotationTool';
import type { useLevels } from '../../systems/levels';
import type { RegionStatus } from '../../types/overlay';
import type { UseConstructionPointStateReturn } from '../../hooks/state/useConstructionPointState';
import type { UseGuideStateReturn } from '../../hooks/state/useGuideState';

type DrawingHandlersReturn = ReturnType<typeof useDrawingHandlers>;

interface Viewport {
  width: number;
  height: number;
}

/** Minimal universal selection interface for DxfCanvas callbacks */
interface UniversalSelectionForStack {
  clearByType: (type: 'overlay' | 'dxf-entity') => void;
  clearAll: () => void;
  select: (id: string, type: 'overlay' | 'dxf-entity') => void;
  selectMultiple: (items: Array<{ id: string; type: 'overlay' | 'dxf-entity' }>) => void;
  add: (id: string, type: 'overlay' | 'dxf-entity') => void;
  addMultiple: (items: Array<{ id: string; type: 'overlay' | 'dxf-entity' }>) => void;
  deselect: (id: string) => void;
}

/** Zoom system methods used by CanvasLayerStack */
interface ZoomSystemForStack {
  zoomToFit: (bounds: { min: Point2D; max: Point2D }, viewport: Viewport, alignToOrigin?: boolean) => { transform: ViewTransform } | null;
  setTransform: (transform: ViewTransform) => void;
  handleWheelZoom: (delta: number, center: Point2D) => void;
  zoomTo100: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomPrevious: () => void;
  zoomToScale: (scale: number) => void;
}

export interface CanvasLayerStackProps {
  // === Core canvas state ===
  transform: ViewTransform;
  viewport: Viewport;
  activeTool: string;
  overlayMode: OverlayEditorMode;
  showLayers: boolean;

  // === Visibility flags ===
  showDxfCanvas: boolean;
  showLayerCanvas: boolean;

  // === Canvas refs ===
  containerRef: RefObject<HTMLDivElement | null>;
  dxfCanvasRef: RefObject<DxfCanvasRef> | undefined;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  previewCanvasRef: RefObject<PreviewCanvasHandle | null>;
  drawingHandlersRef: MutableRefObject<DrawingHandlersReturn | null>;
  entitySelectedOnMouseDownRef: MutableRefObject<boolean>;

  // === Canvas data ===
  dxfScene: DxfScene | null;
  colorLayers: ColorLayer[];
  // 🚀 PERF (2026-05-09): colorLayersWithDraft computed via
  // `useDraftPolygonLayer` inside CanvasLayerStack — was previously prop-drilled
  // from CanvasSection where it caused parent re-render on every mousemove.
  draftPolygon: Array<[number, number]>;
  currentStatus: RegionStatus;

  // === Settings (grouped) ===
  settings: {
    crosshair: CrosshairSettings;
    cursor: CursorSettings;
    snap: SnapSettings;
    ruler: RulerSettings;
    grid: GridSettings;
    gridMajorInterval: number;
    selection: SelectionSettings;
    grip: GripSettings;
    globalRuler: GlobalRulerSettings;
  };

  // === Grip render state (grouped) ===
  gripState: {
    draggingVertex: DraggingVertexState | null;
    draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
    hoveredVertexInfo: VertexHoverInfo | null;
    hoveredEdgeInfo: EdgeHoverInfo | null;
    draggingOverlayBody: DraggingOverlayBodyState | null;
    dragPreviewPosition: Point2D | null;
  };

  // === Entity interaction state (grouped) ===
  // 🚀 PERF (2026-05-09 Phase E): hoveredEntityId + hoveredOverlayId REMOVED.
  // They now live in HoverStore (systems/hover/HoverStore.ts) and are read
  // via useHoveredEntity() / useHoveredOverlay() inside nano-leaf subscribers,
  // so CanvasSection and CanvasLayerStack do NOT re-render on hover changes.
  entityState: {
    selectedEntityIds: string[];
    setSelectedEntityIds: Dispatch<SetStateAction<string[]>>;
  };

  // === System objects ===
  zoomSystem: ZoomSystemForStack;
  dxfGripInteraction: UseDxfGripInteractionReturn;
  universalSelection: UniversalSelectionForStack;
  setTransform: (t: ViewTransform) => void;

  // 🚀 PERF (2026-05-09): mouseCss / updateMouseCss / updateMouseWorld
  // REMOVED. Position SSoT lives in `ImmediatePositionStore`. Components that
  // need to react to position use `useCursorPosition()` /
  // `useCursorWorldPosition()` (useSyncExternalStore) directly.

  // === Container event handlers (grouped) ===
  containerHandlers: {
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    /** ADR-344 Phase 6.E — double-click → in-canvas text editor (DBLCLKEDIT). */
    onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  };

  // === Canvas interaction handlers ===
  handleOverlayClick: (overlayId: string, point: Point2D) => void;
  handleMultiOverlayClick: (layerIds: string[]) => void;
  handleCanvasClick: (worldPoint: Point2D, shiftKey?: boolean) => void;
  handleUnifiedMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  handleDrawingContextMenu: (e: React.MouseEvent) => void;

  // === Drawing state (grouped) ===
  drawingState: {
    drawingHandlers: DrawingHandlersReturn;
    draftPolygon: Array<[number, number]>;
    handleDrawingFinish: () => void;
    handleDrawingClose: () => void;
    handleDrawingCancel: () => void;
    handleDrawingUndoLastPoint: () => void;
    handleFlipArc: () => void;
  };

  // === Entity context menu (ADR-161) ===
  entityJoin: {
    canJoin: boolean;
    joinResultLabel?: string;
    onJoin: () => void;
    onDelete: () => void;
  };

  // === Floorplan background (ADR-340 — replaces legacy `pdf`) ===
  /** Active level/floor ID for the floorplan-background system. Null = no level. */
  floorId: string | null;

  // === ADR-189: Construction guides ===
  // 🚀 PERF (2026-05-09): ghostGuide / ghostDiagonalGuide / ghostSegmentLine /
  // highlightedGuideId / highlightedPointId REMOVED — computed inside
  // CanvasLayerStack via `useGuideWorkflowComputed` (subscribes to mouse
  // position locally to avoid CanvasSection re-render).
  guides?: readonly Guide[];
  guidesVisible?: boolean;
  selectedGuideIds?: ReadonlySet<string>;
  constructionPoints?: readonly ConstructionPoint[];
  /** Guide tool workflow state — passed to `useGuideWorkflowComputed` inside CanvasLayerStack */
  guideWorkflowState: GuideWorkflowState;
  /** Live guide state object (needed by useGuideWorkflowComputed for guide list) */
  guideStateObj: UseGuideStateReturn;
  /** Construction-point state object (needed by useGuideWorkflowComputed for delete-point highlight) */
  cpStateObj: UseConstructionPointStateReturn;

  // === ADR-188: Rotation tool preview ===
  rotationPreview: {
    phase: RotationPhase;
    basePoint: Point2D | null;
    referencePoint: Point2D | null;
    currentAngle: number;
  };
  // === ADR-049: Move tool preview ===
  movePreview: {
    phase: import('../../hooks/tools/useMoveTool').MovePhase;
    basePoint: Point2D | null;
    selectedOverlayIds?: string[];
    getOverlay?: (id: string) => import('../../overlays/types').Overlay | null;
  };
  // === Mirror tool preview ===
  mirrorPreview: {
    phase: import('../../hooks/tools/useMirrorTool').MirrorPhase;
    firstPoint: Point2D | null;
    secondPoint: Point2D | null;
  };
  // === ADR-348: Scale tool preview (ScaleToolStore-driven, zero props needed) ===
  scalePreview: Record<string, never>;
  /** Level manager — needed by useRotationPreview + useMovePreview for entity reads */
  levelManager: ReturnType<typeof useLevels>;

  // === Entity-picking mode ===
  entityPickingActive?: boolean;

  // === External callback ===
  onMouseMove?: (worldPos: Point2D, event: React.MouseEvent) => void;
}
