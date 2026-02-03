import * as React from 'react';
import type { Point2D } from './config';
import type {
  RulerSettings,
  GridSettings,
  RulersGridState,
  SnapResult,
  ViewTransform,
  UnitType,
  GridBounds,
  GridLine,
  RulerTick,
  RulersLayoutInfo,
  RulersGridOperationResult,
  RulersGridOperation
} from './config';

// DOMRect is a native browser type, use global DOMRect
type DOMRectReadOnly = globalThis.DOMRect;
// 🏢 ADR-118: Centralized Zero Point Pattern
import { DEFAULT_ORIGIN } from '../../config/geometry-constants';

// ============================================================================
// 🏢 ENTERPRISE: CONTEXT TYPE DEFINITION (ADR-125)
// ============================================================================
// Context type is defined here to prevent circular dependencies between
// RulersGridSystem.tsx and useRulersGrid.ts
// ============================================================================

/**
 * RulersGridContext type definition
 * Used by both RulersGridSystem (Provider) and useRulersGrid (Consumer)
 */
export interface RulersGridContextType {
  // State
  state: RulersGridState;

  // Ruler Management
  toggleRulers: (type?: 'horizontal' | 'vertical' | 'both') => void;
  setRulerVisibility: (type: 'horizontal' | 'vertical', visible: boolean) => void;
  updateRulerSettings: (updates: Partial<RulerSettings>) => void;
  setRulerUnits: (units: UnitType) => void;
  setRulerPosition: (type: 'horizontal' | 'vertical', position: 'top' | 'bottom' | 'left' | 'right') => void;

  // Grid Management
  toggleGrid: () => void;
  setGridVisibility: (visible: boolean) => void;
  updateGridSettings: (updates: Partial<GridSettings>) => void;
  setGridStep: (step: number) => void;
  setGridOpacity: (opacity: number) => void;
  setGridColor: (color: string) => void;

  // Origin and Coordinate System
  setOrigin: (point: Point2D) => void;
  resetOrigin: () => void;
  getOrigin: () => Point2D;

  // Snap Functionality
  toggleRulerSnap: () => void;
  toggleGridSnap: () => void;
  setSnapTolerance: (tolerance: number) => void;
  findSnapPoint: (point: Point2D, transform: ViewTransform, canvasRect: DOMRectReadOnly) => SnapResult | null;

  // Operations
  performOperation: (operation: RulersGridOperation) => Promise<RulersGridOperationResult>;

  // Calculation Functions
  calculateGridBounds: (transform: ViewTransform, canvasRect: DOMRectReadOnly) => GridBounds;
  calculateGridLines: (bounds: GridBounds, settings: GridSettings, transform: ViewTransform) => GridLine[];
  calculateRulerTicks: (
    type: 'horizontal' | 'vertical',
    bounds: GridBounds,
    settings: RulerSettings,
    transform: ViewTransform,
    canvasRect: DOMRectReadOnly
  ) => RulerTick[];

  // Layout Information
  getLayoutInfo: (canvasRect: DOMRectReadOnly) => RulersLayoutInfo;
  getContentArea: (canvasRect: DOMRectReadOnly) => DOMRectReadOnly;

  // Unit Conversion
  convertUnits: (value: number, fromUnit: UnitType, toUnit: UnitType) => number;
  formatValue: (value: number, units: UnitType, precision?: number) => string;

  // Visibility and Display
  isRulerVisible: (type: 'horizontal' | 'vertical') => boolean;
  isGridVisible: () => boolean;
  getEffectiveOpacity: (transform: ViewTransform) => number;
  shouldRenderGrid: (transform: ViewTransform) => boolean;
  shouldRenderRulers: (transform: ViewTransform) => boolean;

  // Performance and Optimization
  getMaxGridLines: () => number;
  getMaxRulerTicks: () => number;
  isPerformanceOptimized: () => boolean;

  // Settings Management
  resetRulerSettings: () => void;
  resetGridSettings: () => void;
  resetAllSettings: () => void;
  exportSettings: () => string;
  importSettings: (data: string) => Promise<RulersGridOperationResult>;
  validateSettings: (settings: unknown) => { valid: boolean; errors: string[] };

  // System Visibility
  setVisibility: (visible: boolean) => void;
  getVisibility: () => boolean;

  // Auto-fit and Smart Behavior
  autoFitGrid: (transform: ViewTransform, canvasRect: DOMRectReadOnly) => void;
  getOptimalGridStep: (transform: ViewTransform) => number;
  getOptimalTickSpacing: (transform: ViewTransform, type: 'horizontal' | 'vertical') => number;
}

// Type alias for hook return (backward compatibility)
export type RulersGridHookReturn = RulersGridContextType;

export interface RulersGridSystemProps {
  children: React.ReactNode;
  initialRulerSettings?: Partial<RulerSettings>;
  initialGridSettings?: Partial<GridSettings>;
  initialOrigin?: Point2D;
  initialVisibility?: boolean;
  enablePersistence?: boolean;
  persistenceKey?: string;
  onSettingsChange?: (rulers: RulerSettings, grid: GridSettings) => void;
  onOriginChange?: (origin: Point2D) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onSnapResult?: (result: SnapResult | null) => void;
  viewTransform?: ViewTransform;
  canvasBounds?: DOMRect;
}

// 🏢 ADR-118: Re-export for backward compatibility
export { DEFAULT_ORIGIN };
