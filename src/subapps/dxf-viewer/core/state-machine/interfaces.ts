/**
 * DRAWING STATE MACHINE - INTERFACES
 *
 * 🏢 ENTERPRISE (2026-01-25): Formal State Machine for Drawing Operations
 *
 * Based on patterns from:
 * - Autodesk AutoCAD (command line state machine)
 * - Adobe Illustrator (tool state management)
 * - Figma (drawing mode states)
 *
 * Separation of Concerns:
 * - ToolStateManager: WHICH tool is active (select, line, circle)
 * - DrawingStateMachine: WHAT the tool is doing (IDLE, DRAWING, PREVIEWING)
 */

import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// DRAWING STATES
// ============================================================================

/**
 * All possible drawing states
 * Based on AutoCAD command-line state machine
 */
export type DrawingStateType =
  | 'IDLE'                    // No tool active, waiting for tool selection
  | 'TOOL_READY'              // Tool selected, waiting for first point
  | 'COLLECTING_POINTS'       // Actively collecting points (first point added)
  | 'PREVIEWING'              // Mouse moving, showing preview
  | 'COMPLETING'              // Minimum points reached, can complete
  | 'COMPLETED'               // Entity created, transitioning back
  | 'CANCELLED';              // User cancelled, cleaning up

/**
 * State metadata for UI and debugging
 */
export interface DrawingStateInfo {
  readonly type: DrawingStateType;
  readonly displayName: string;
  readonly description: string;
  readonly allowsPreview: boolean;
  readonly allowsComplete: boolean;
  readonly allowsCancel: boolean;
  readonly allowsAddPoint: boolean;
}

/**
 * Registry of all states with metadata
 */
export const DRAWING_STATES: Record<DrawingStateType, DrawingStateInfo> = {
  IDLE: {
    type: 'IDLE',
    displayName: 'Idle',
    description: 'No drawing operation active',
    allowsPreview: false,
    allowsComplete: false,
    allowsCancel: false,
    allowsAddPoint: false,
  },
  TOOL_READY: {
    type: 'TOOL_READY',
    displayName: 'Ready',
    description: 'Tool selected, waiting for first point',
    allowsPreview: true,
    allowsComplete: false,
    allowsCancel: true,
    allowsAddPoint: true,
  },
  COLLECTING_POINTS: {
    type: 'COLLECTING_POINTS',
    displayName: 'Drawing',
    description: 'Collecting points for entity',
    allowsPreview: true,
    allowsComplete: false,
    allowsCancel: true,
    allowsAddPoint: true,
  },
  PREVIEWING: {
    type: 'PREVIEWING',
    displayName: 'Previewing',
    description: 'Showing preview with cursor position',
    allowsPreview: true,
    allowsComplete: false,
    allowsCancel: true,
    allowsAddPoint: true,
  },
  COMPLETING: {
    type: 'COMPLETING',
    displayName: 'Completing',
    description: 'Minimum points reached, ready to complete',
    allowsPreview: true,
    allowsComplete: true,
    allowsCancel: true,
    allowsAddPoint: true,
  },
  COMPLETED: {
    type: 'COMPLETED',
    displayName: 'Completed',
    description: 'Entity created successfully',
    allowsPreview: false,
    allowsComplete: false,
    allowsCancel: false,
    allowsAddPoint: false,
  },
  CANCELLED: {
    type: 'CANCELLED',
    displayName: 'Cancelled',
    description: 'Operation cancelled by user',
    allowsPreview: false,
    allowsComplete: false,
    allowsCancel: false,
    allowsAddPoint: false,
  },
};

// ============================================================================
// EVENTS (Triggers for state transitions)
// ============================================================================

/**
 * All possible events that trigger state transitions
 */
export type DrawingEventType =
  | 'SELECT_TOOL'       // User selects a drawing tool
  | 'DESELECT_TOOL'     // User deselects tool (back to select mode)
  | 'ADD_POINT'         // User clicks to add a point
  | 'UNDO_POINT'        // User removes last point (Undo in context menu)
  | 'MOVE_CURSOR'       // User moves mouse (for preview)
  | 'COMPLETE'          // User requests completion (Enter/Double-click)
  | 'CANCEL'            // User cancels (ESC)
  | 'RESET'             // System reset (after complete/cancel)
  | 'MIN_POINTS_REACHED'; // Automatic: minimum points for tool reached

/**
 * Event payload types
 */
export interface DrawingEventPayloads {
  SELECT_TOOL: { toolType: string };
  DESELECT_TOOL: Record<string, never>;
  ADD_POINT: { point: Point2D; snapped?: boolean; snapType?: string };
  UNDO_POINT: Record<string, never>;  // Remove last point (AutoCAD-style U command)
  MOVE_CURSOR: { position: Point2D; snapped?: boolean; snapType?: string };
  COMPLETE: { forced?: boolean };
  CANCEL: { reason?: string };
  RESET: Record<string, never>;
  MIN_POINTS_REACHED: Record<string, never>;
}

/**
 * Type-safe event with payload
 */
export type DrawingEvent<T extends DrawingEventType = DrawingEventType> = {
  type: T;
  payload: DrawingEventPayloads[T];
  timestamp: number;
};

// ============================================================================
// STATE MACHINE CONTEXT
// ============================================================================

/**
 * Full context of the drawing state machine
 * Contains all data needed for drawing operations
 */
export interface DrawingContext {
  /** Current drawing tool type */
  readonly toolType: string | null;

  /** Collected points */
  readonly points: readonly Point2D[];

  /** Current cursor position (for preview) */
  readonly cursorPosition: Point2D | null;

  /** Current snap info */
  readonly snapInfo: {
    readonly snapped: boolean;
    readonly snapType: string | null;
    readonly snapPoint: Point2D | null;
  };

  /** Minimum points required for current tool */
  readonly minPoints: number;

  /** Maximum points allowed (Infinity for polyline) */
  readonly maxPoints: number;

  /** Whether tool allows continuous drawing (polyline) */
  readonly allowsContinuous: boolean;

  /** Error message if any */
  readonly error: string | null;

  /** Timestamp of last state change */
  readonly lastStateChange: number;
}

/**
 * Default context values
 */
export const DEFAULT_DRAWING_CONTEXT: DrawingContext = {
  toolType: null,
  points: [],
  cursorPosition: null,
  snapInfo: {
    snapped: false,
    snapType: null,
    snapPoint: null,
  },
  minPoints: 2,
  maxPoints: 2,
  allowsContinuous: false,
  error: null,
  lastStateChange: Date.now(),
};

// ============================================================================
// TOOL REQUIREMENTS
// ============================================================================

/**
 * Point requirements for each tool type
 */
export interface ToolPointRequirements {
  readonly minPoints: number;
  readonly maxPoints: number;
  readonly allowsContinuous: boolean;
}

/**
 * Default tool point requirements
 * Based on AutoCAD standards
 */
export const TOOL_POINT_REQUIREMENTS: Record<string, ToolPointRequirements> = {
  // Basic shapes
  line: { minPoints: 2, maxPoints: 2, allowsContinuous: false },
  rectangle: { minPoints: 2, maxPoints: 2, allowsContinuous: false },
  circle: { minPoints: 2, maxPoints: 2, allowsContinuous: false },
  'circle-diameter': { minPoints: 2, maxPoints: 2, allowsContinuous: false },
  'circle-2p-diameter': { minPoints: 2, maxPoints: 2, allowsContinuous: false },

  // Multi-point shapes
  polyline: { minPoints: 2, maxPoints: Infinity, allowsContinuous: true },
  polygon: { minPoints: 3, maxPoints: Infinity, allowsContinuous: false },

  // Measurements
  'measure-distance': { minPoints: 2, maxPoints: 2, allowsContinuous: false },
  'measure-area': { minPoints: 3, maxPoints: Infinity, allowsContinuous: false },
  'measure-angle': { minPoints: 3, maxPoints: 3, allowsContinuous: false },

  // Selection (no points needed)
  select: { minPoints: 0, maxPoints: 0, allowsContinuous: false },
};

// ============================================================================
// TRANSITION RULES
// ============================================================================

/**
 * Valid state transitions
 * Key: current state, Value: allowed next states with triggering events
 */
export type TransitionRule = {
  readonly from: DrawingStateType;
  readonly to: DrawingStateType;
  readonly on: DrawingEventType;
  readonly guard?: (context: DrawingContext, event: DrawingEvent) => boolean;
};

/**
 * All valid transitions
 * Based on formal state machine theory
 */
export const TRANSITION_RULES: readonly TransitionRule[] = [
  // From IDLE
  { from: 'IDLE', to: 'TOOL_READY', on: 'SELECT_TOOL' },

  // From TOOL_READY
  { from: 'TOOL_READY', to: 'COLLECTING_POINTS', on: 'ADD_POINT' },
  { from: 'TOOL_READY', to: 'PREVIEWING', on: 'MOVE_CURSOR' },
  { from: 'TOOL_READY', to: 'IDLE', on: 'DESELECT_TOOL' },
  { from: 'TOOL_READY', to: 'CANCELLED', on: 'CANCEL' },

  // From COLLECTING_POINTS
  { from: 'COLLECTING_POINTS', to: 'COLLECTING_POINTS', on: 'ADD_POINT' },
  { from: 'COLLECTING_POINTS', to: 'COLLECTING_POINTS', on: 'UNDO_POINT' },
  { from: 'COLLECTING_POINTS', to: 'PREVIEWING', on: 'MOVE_CURSOR' },
  { from: 'COLLECTING_POINTS', to: 'COMPLETING', on: 'MIN_POINTS_REACHED' },
  { from: 'COLLECTING_POINTS', to: 'CANCELLED', on: 'CANCEL' },

  // From PREVIEWING
  { from: 'PREVIEWING', to: 'COLLECTING_POINTS', on: 'ADD_POINT' },
  { from: 'PREVIEWING', to: 'PREVIEWING', on: 'UNDO_POINT' },
  { from: 'PREVIEWING', to: 'PREVIEWING', on: 'MOVE_CURSOR' },
  { from: 'PREVIEWING', to: 'COMPLETING', on: 'MIN_POINTS_REACHED' },
  { from: 'PREVIEWING', to: 'CANCELLED', on: 'CANCEL' },

  // From COMPLETING
  { from: 'COMPLETING', to: 'COMPLETING', on: 'ADD_POINT' },
  { from: 'COMPLETING', to: 'COMPLETING', on: 'UNDO_POINT' },
  { from: 'COMPLETING', to: 'COMPLETING', on: 'MOVE_CURSOR' },
  { from: 'COMPLETING', to: 'COMPLETED', on: 'COMPLETE' },
  { from: 'COMPLETING', to: 'CANCELLED', on: 'CANCEL' },

  // From COMPLETED (auto-reset)
  { from: 'COMPLETED', to: 'TOOL_READY', on: 'RESET' },
  { from: 'COMPLETED', to: 'IDLE', on: 'DESELECT_TOOL' },

  // From CANCELLED (auto-reset)
  { from: 'CANCELLED', to: 'TOOL_READY', on: 'RESET' },
  { from: 'CANCELLED', to: 'IDLE', on: 'DESELECT_TOOL' },
];

// ============================================================================
// STATE MACHINE INTERFACE
// ============================================================================

/**
 * Full state of the machine
 */
export interface DrawingMachineState {
  readonly currentState: DrawingStateType;
  readonly context: DrawingContext;
  readonly history: readonly DrawingStateType[];
}

/**
 * State machine listener callback
 */
export type DrawingMachineListener = (state: DrawingMachineState) => void;

/**
 * State machine interface
 */
export interface IDrawingStateMachine {
  /** Get current state */
  getState(): DrawingMachineState;

  /** Get current state type */
  getCurrentStateType(): DrawingStateType;

  /** Get current context */
  getContext(): DrawingContext;

  /** Send event to state machine */
  send<T extends DrawingEventType>(type: T, payload: DrawingEventPayloads[T]): void;

  /** Check if transition is valid */
  canTransition(eventType: DrawingEventType): boolean;

  /** Subscribe to state changes */
  subscribe(listener: DrawingMachineListener): () => void;

  /** Reset to initial state */
  reset(): void;

  /** Get state info */
  getStateInfo(): DrawingStateInfo;

  /** Check if action is allowed */
  canAddPoint(): boolean;
  canComplete(): boolean;
  canCancel(): boolean;
  canPreview(): boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * State machine configuration
 */
export interface DrawingStateMachineConfig {
  /** Enable debug logging */
  readonly debug?: boolean;

  /** Max history entries to keep */
  readonly maxHistorySize?: number;

  /** Auto-reset delay after complete/cancel (ms) */
  readonly autoResetDelay?: number;

  /** Custom tool requirements */
  readonly toolRequirements?: Record<string, ToolPointRequirements>;
}

/**
 * Default configuration
 */
export const DEFAULT_STATE_MACHINE_CONFIG: Required<DrawingStateMachineConfig> = {
  debug: false,
  maxHistorySize: 50,
  autoResetDelay: 0,
  toolRequirements: TOOL_POINT_REQUIREMENTS,
};
