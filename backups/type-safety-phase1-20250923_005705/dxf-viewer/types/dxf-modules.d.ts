// Module declarations for DXF Viewer
declare module './ui/toolbar/EnhancedDXFToolbar' {
  import { FC } from 'react';
  export interface EnhancedDXFToolbarProps {
    activeTool: string;
    onToolChange: (tool: string) => void;
    onAction: (action: string) => void;
    showGrid: boolean;
    autoCrop: boolean;
    canUndo: boolean;
    canRedo: boolean;
    snapEnabled: boolean;
    showLayers: boolean;
    showProperties: boolean;
    showCalibration: boolean;
    currentZoom: number;
    commandCount: number;
    onSceneImported: (file: File, encoding?: string) => void;
  }
  export const EnhancedDXFToolbar: FC<EnhancedDXFToolbarProps>;
}

declare module './ui/components/QuickSnapButtons' {
  import { FC } from 'react';
  export interface QuickSnapButtonsProps {
    snapEnabled: boolean;
    onSnapToggle: () => void;
  }
  export const QuickSnapButtons: FC<QuickSnapButtonsProps>;
}

declare module './canvas/DxfCanvas' {
  import { ForwardRefExoticComponent, RefAttributes } from 'react';
  export interface DxfCanvasProps {
    scene: any;
    onTransformChange: (transform: any) => void;
    selectedEntityIds: string[];
    onSelectEntity: (entityIds: string | string[]) => void;
    alwaysShowCoarseGrid: boolean;
    isZoomWindowActive: boolean;
    onZoomWindowModeChange: (active: boolean) => void;
    showCalibration: boolean;
    onCalibrationToggle: () => void;
    onSceneChange: (scene: any) => void;
    activeTool: string;
    measurements: any[];
    tempMeasurementPoints: any[];
    onMeasurementPoint: (point: any) => void;
    onMeasurementHover: (point: any) => void;
    onMeasurementCancel: () => void;
    drawingState: any;
    onDrawingPoint: (point: any) => void;
    onDrawingHover: (point: any) => void;
    onDrawingCancel: () => void;
    onDrawingDoubleClick: (point: any) => void;
    gripSettings: any;
    onEntityCreated: (entity: any) => void;
    className?: string;
  }
  export interface DxfCanvasRef {
    zoomToFit: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    panTo: (x: number, y: number) => void;
    getViewTransform: () => any;
    setViewTransform: (transform: any) => void;
  }
  export const DxfCanvas: ForwardRefExoticComponent<DxfCanvasProps & RefAttributes<DxfCanvasRef>>;
}

declare module './canvas/OverlayCanvas' {
  import { FC } from 'react';
  export interface OverlayCanvasProps {
    [key: string]: any;
  }
  export const OverlayCanvas: FC<OverlayCanvasProps>;
}

declare module './ui/FloatingPanelContainer' {
  import { FC } from 'react';
  export interface FloatingPanelContainerProps {
    sceneModel: any;
    selectedEntityIds: string[];
    onEntitySelect: (ids: string[]) => void;
    zoomLevel: number;
    currentTool: string;
  }
  export const FloatingPanelContainer: FC<FloatingPanelContainerProps>;
}

declare module './ui/OverlayToolbar' {
  import { FC } from 'react';
  export interface OverlayToolbarProps {
    mode: string;
    onModeChange: () => void;
    currentStatus: string;
    onStatusChange: () => void;
    currentKind: string;
    onKindChange: () => void;
    snapEnabled: boolean;
    onSnapToggle: () => void;
    selectedOverlayId: string | null;
    onDuplicate: () => void;
    onDelete: () => void;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
  }
  export const OverlayToolbar: FC<OverlayToolbarProps>;
}

declare module './systems/levels' {
  import { FC, ReactNode } from 'react';
  export interface LevelsSystemProps {
    children: ReactNode;
  }
  export const LevelsSystem: FC<LevelsSystemProps>;
}

declare module './overlays/overlay-store' {
  import { FC, ReactNode } from 'react';
  export interface OverlayStoreProviderProps {
    children: ReactNode;
  }
  export const OverlayStoreProvider: FC<OverlayStoreProviderProps>;
}

declare module './types/scene' {
  export interface SceneModel {
    entities: any[];
    layers: any[];
    bounds: any;
    metadata: any;
  }
}

declare module './snapping/context/SnapContext' {
  import { FC, ReactNode } from 'react';
  export interface SnapProviderProps {
    children: ReactNode;
  }
  export const SnapProvider: FC<SnapProviderProps>;
}

declare module './canvas/useDxfImport' {
  export function useDxfImport(): {
    importScene: (file: File) => Promise<any>;
    isLoading: boolean;
    error: string | null;
  };
}

declare module './hooks/useDxfViewerState' {
  export function useDxfViewerState(canvasRef: any): {
    activeTool: string;
    handleToolChange: (tool: string) => void;
    handleAction: (action: string) => void;
    showGrid: boolean;
    canUndo: boolean;
    canRedo: boolean;
    snapEnabled: boolean;
    showLayers: boolean;
    showProperties: boolean;
    showCalibration: boolean;
    currentZoom: number;
    handleFileImport: (file: File) => void;
    currentScene: any;
    selectedEntityIds: string[];
    setSelectedEntityIds: (ids: string[]) => void;
    handleTransformChange: (transform: any) => void;
    handleSceneChange: (scene: any) => void;
    handleCalibrationToggle: () => void;
    measurementSystem: any;
    drawingState: any;
    onMeasurementPoint: (point: any) => void;
    onMeasurementHover: (point: any) => void;
    onMeasurementCancel: () => void;
    onDrawingPoint: (point: any) => void;
    onDrawingHover: (point: any) => void;
    onDrawingCancel: () => void;
    onDrawingDoubleClick: (point: any) => void;
    onEntityCreated: (entity: any) => void;
    gripSettings: any;
  };
}