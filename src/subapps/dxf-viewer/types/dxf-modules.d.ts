// Module declarations for DXF Viewer
import type { Point2D, ViewTransform } from '../rendering/types/Types';
import type { SceneModel } from './scene';
import type { AnyMeasurement } from './measurements';
import type { GripSettings } from './gripSettings';

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

declare module './canvas-v2/dxf-canvas/DxfCanvas' {
  import { ForwardRefExoticComponent, RefAttributes } from 'react';
  export interface DxfCanvasProps {
    scene: SceneModel | null;
    onTransformChange: (transform: ViewTransform) => void;
    selectedEntityIds: string[];
    onSelectEntity: (entityIds: string | string[]) => void;
    alwaysShowCoarseGrid: boolean;
    isZoomWindowActive: boolean;
    onZoomWindowModeChange: (active: boolean) => void;
    showCalibration: boolean;
    onCalibrationToggle: () => void;
    onSceneChange: (scene: SceneModel) => void;
    activeTool: string;
    measurements: AnyMeasurement[];
    tempMeasurementPoints: Point2D[];
    onMeasurementPoint: (point: Point2D) => void;
    onMeasurementHover: (point: Point2D | null) => void;
    onMeasurementCancel: () => void;
    // 🎯 TYPE-SAFE: Use proper DrawingState type from useUnifiedDrawing
    drawingState: import('../hooks/drawing/useUnifiedDrawing').DrawingState;
    onDrawingPoint: (point: Point2D) => void;
    onDrawingHover: (point: Point2D | null) => void;
    onDrawingCancel: () => void;
    onDrawingDoubleClick: (point: Point2D) => void;
    gripSettings: GripSettings;
    // 🎯 TYPE-SAFE: Use proper entity union type
    onEntityCreated: (entity: import('./scene').AnySceneEntity) => void;
    className?: string;
  }
  // DxfCanvasRef interface removed - using DxfCanvasImperativeAPI instead
}


declare module './ui/FloatingPanelContainer' {
  import { FC } from 'react';
  export interface FloatingPanelContainerProps {
    sceneModel: SceneModel | null;
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
    bounds: { min: Point2D; max: Point2D };
    metadata: Record<string, any>;
    version?: string; // ✅ ENTERPRISE FIX: Added version property για DxfSecurityValidator.ts
  }
}

declare module './snapping/context/SnapContext' {
  import { FC, ReactNode } from 'react';
  export interface SnapProviderProps {
    children: ReactNode;
  }
  export const SnapProvider: FC<SnapProviderProps>;
}

declare module './canvas-v2/shared/useDxfImport' {
  export function useDxfImport(): {
    importDxfFile: (file: File) => Promise<SceneModel | null>;
    isLoading: boolean;
    error: string | null;
    clearError: () => void;
  };
}

declare module './hooks/useDxfViewerState' {
  export function useDxfViewerState(canvasRef: React.RefObject<any>): {
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
    currentScene: SceneModel | null;
    selectedEntityIds: string[];
    setSelectedEntityIds: (ids: string[]) => void;
    handleTransformChange: (transform: ViewTransform) => void;
    handleSceneChange: (scene: SceneModel) => void;
    handleCalibrationToggle: () => void;
    measurementSystem: any; // Complex measurement system
    drawingState: any; // Complex drawing state
    onMeasurementPoint: (point: Point2D) => void;
    onMeasurementHover: (point: Point2D | null) => void;
    onMeasurementCancel: () => void;
    onDrawingPoint: (point: Point2D) => void;
    onDrawingHover: (point: Point2D | null) => void;
    onDrawingCancel: () => void;
    onDrawingDoubleClick: (point: Point2D) => void;
    onEntityCreated: (entity: any) => void;
    gripSettings: GripSettings;
  };
}