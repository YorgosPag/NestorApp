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
import type { GridAxis } from '../../ai-assistant/grid-types';

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
  addMultiple: (items: Array<{ id: string; type: 'overlay' | 'dxf-entity' }>) => void;
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
  colorLayersWithDraft: ColorLayer[];

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
  entityState: {
    selectedEntityIds: string[];
    setSelectedEntityIds: Dispatch<SetStateAction<string[]>>;
    hoveredEntityId: string | null;
    setHoveredEntityId: (id: string | null) => void;
    hoveredOverlayId: string | null;
    setHoveredOverlayId: (id: string | null) => void;
  };

  // === System objects ===
  zoomSystem: ZoomSystemForStack;
  dxfGripInteraction: UseDxfGripInteractionReturn;
  universalSelection: UniversalSelectionForStack;
  setTransform: (t: ViewTransform) => void;

  // === Mouse state ===
  mouseCss: Point2D | null;
  updateMouseCss: (pos: Point2D) => void;
  updateMouseWorld: (pos: Point2D) => void;

  // === Container event handlers (grouped) ===
  containerHandlers: {
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseUp: (e: React.MouseEvent<HTMLDivElement>) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
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
  guides?: readonly Guide[];
  guidesVisible?: boolean;
  ghostGuide?: { axis: GridAxis; offset: number } | null;
  ghostDiagonalGuide?: { start: Point2D; end: Point2D } | null;
  highlightedGuideId?: string | null;
  selectedGuideIds?: ReadonlySet<string>;
  constructionPoints?: readonly ConstructionPoint[];
  highlightedPointId?: string | null;
  ghostSegmentLine?: { start: Point2D; end: Point2D } | null;

  // === Entity-picking mode ===
  entityPickingActive?: boolean;

  // === External callback ===
  onMouseMove?: (worldPos: Point2D, event: React.MouseEvent) => void;
}
