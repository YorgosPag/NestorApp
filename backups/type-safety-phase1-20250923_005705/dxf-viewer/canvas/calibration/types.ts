/**
 * COORDINATE CALIBRATION TYPES
 * Shared types για το calibration system
 */

import type { Point2D as Point } from '../../types/scene';

export interface CalibrationProps {
  mousePos: Point | null;
  worldPos: Point | null;
  canvasRect?: DOMRect;
  coordinateManager?: any;
  currentScene?: any;
  onInjectTestEntity?: (entity: any) => void;
  show?: boolean;
  onToggle?: (show: boolean) => void;
}

export interface ClickTest {
  id: number;
  cssPoint: { x: number; y: number };
  worldPoint: { x: number; y: number };
  canvasPoint: { x: number; y: number };
  canvasPointWorldUp: { x: number; y: number }; 
  timestamp: string;
  roundTripError?: number;
  coordinateAccuracy?: CoordinateAccuracy;
}

export interface CoordinateAccuracy {
  xOk: boolean;
  yOk: boolean;
  overall: boolean;
}

export interface CalibrationState {
  clickTests: ClickTest[];
  showGrid: boolean;
  showDetails: boolean;
  testEntityInjected: boolean;
}

export interface CalibrationActions {
  addClickTest: (test: ClickTest) => void;
  clearTests: () => void;
  setShowGrid: (show: boolean) => void;
  setShowDetails: (show: boolean) => void;
  setTestEntityInjected: (injected: boolean) => void;
}

export interface CoordinateCalculations {
  calculateUnifiedCoordinates: (cssPoint: { x: number; y: number }) => { canvasPoint: Point; canvasPointWorldUp: Point } | null;
  calculateRoundTripError: (cssPoint: { x: number; y: number }) => number | null;
  checkCoordinateAccuracy: (cssPoint: { x: number; y: number }, worldPoint: { x: number; y: number }) => CoordinateAccuracy;
}

export interface GridRenderingProps {
  canvasRect: DOMRect;
  coordinateManager: any;
  showGrid: boolean;
}

export interface TestEntityManagement {
  injectTestEntity: () => void;
  canInjectEntity: boolean;
}