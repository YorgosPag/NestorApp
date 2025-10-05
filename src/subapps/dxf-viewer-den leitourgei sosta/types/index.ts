// Enhanced DXF Types με Full Feature Support
import type { LineType } from '../settings-core/types';

export type ToolType = 
  | 'select' | 'pan' | 'zoom-in' | 'zoom-out' | 'zoom-window'
  | 'line' | 'rectangle' | 'circle' | 'polyline' | 'arc' | 'ellipse'
  | 'move' | 'copy' | 'delete' | 'rotate' | 'scale' | 'mirror'
  | 'measure' | 'measure-distance' | 'measure-area' | 'measure-angle' | 'measure-angle-line-arc' | 'measure-angle-two-arcs' | 'measure-angle-measuregeom' | 'measure-angle-constraint' | 'text' | 'dimension' | 'hatch' | 'block';

export type TextAlignment = 'LEFT' | 'CENTER' | 'RIGHT' | 'TOP' | 'MIDDLE' | 'BOTTOM';

export type DimensionType = 'LINEAR' | 'ANGULAR' | 'RADIAL' | 'DIAMETRAL';

export interface Point {
  x: number;
  y: number;
  z?: number; // 3D support
}

export interface DXFEntity {
  id: string;
  type: string;
  layer: string;
  points: Point[];
  color: string;
  selected?: boolean;
  visible?: boolean;
  lineWidth?: number;
  lineType?: LineType;
  radius?: number;
  text?: string;
  textHeight?: number;
  textAlignment?: TextAlignment;
  angle?: number;
  scaleX?: number;
  scaleY?: number;
  transparency?: number;
  elevation?: number;
  thickness?: number;
  // DXF specific properties
  handle?: string;
  ownerHandle?: string;
  subclassMarker?: string;
  materialHandle?: string;
  plotStyleHandle?: string;
  // Extended properties
  extendedData?: Record<string, unknown>;
  hyperlinks?: string[];
  reactors?: string[];
  closed?: boolean; // For polylines
}

export interface Layer {
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  frozen: boolean;
  plotStyle: string;
  lineType: LineType;
  lineWeight: number;
  transparency: number;
  entities: string[];
  // DXF specific layer properties
  handle?: string;
  flags?: number;
  plotFlag?: boolean;
  description?: string;
}

export interface Block {
  name: string;
  basePoint: Point;
  entities: DXFEntity[];
  description?: string;
  handle?: string;
  flags?: number;
}

export interface TextStyle {
  name: string;
  fontFile: string;
  bigFontFile?: string;
  height: number;
  width: number;
  oblique: number;
  backwards: boolean;
  upsideDown: boolean;
  vertical: boolean;
}

export interface DimensionStyle {
  name: string;
  textHeight: number;
  arrowSize: number;
  extensionLineOffset: number;
  extensionLineExtension: number;
  textColor: string;
  lineColor: string;
  precision: number;
}

export interface Viewport {
  center: Point;
  height: number;
  width: number;
  zoom: number;
  snapMode: boolean;
  gridMode: boolean;
  orthoMode: boolean;
  polarMode: boolean;
}

export interface SnapSettings {
  enabled: boolean;
  gridSnap: boolean;
  objectSnap: boolean;
  polarSnap: boolean;
  snapAngle: number;
  snapBase: Point;
  snapSpacing: Point;
  // Object snap modes
  endpoint: boolean;
  midpoint: boolean;
  center: boolean;
  node: boolean;
  quadrant: boolean;
  intersection: boolean;
  extension: boolean;
  insertion: boolean;
  perpendicular: boolean;
  tangent: boolean;
  nearest: boolean;
  parallel: boolean;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'area';
  points: Point[];
  value: number;
  unit: string;
  label: string;
  visible: boolean;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ?: number;
  maxZ?: number;
  width: number;
  height: number;
  depth?: number;
  centerX: number;
  centerY: number;
  centerZ?: number;
}

export interface DrawingState {
  isDrawing: boolean;
  currentPoints: Point[];
  previewEntity: DXFEntity | null;
  snapPoint: Point | null;
  snapType: string | null;
  zoomWindow?: {
    startPoint: Point;
    endPoint: Point;
  };
}

export interface SelectionState {
  selectedIds: string[];
  selectionBox: {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null;
}

export interface ToolState {
  activeTool: ToolType;
  drawing: DrawingState;
  selection: SelectionState;
  view: Viewport;
  snap: SnapSettings;
}

export interface Command {
  id: string;
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
  undo: (currentState: ToolState) => ToolState;
  redo: (currentState: ToolState) => ToolState;
  description: string;
}

export type ViewMode = 'hidden' | 'normal' | 'fullscreen';
export type Status = 'idle' | 'loading' | 'success' | 'error';
export type PanelType = 'layers' | 'properties' | 'blocks' | 'styles' | 'variables';
export interface DxfViewerAppProps {
  className?: string;
}
