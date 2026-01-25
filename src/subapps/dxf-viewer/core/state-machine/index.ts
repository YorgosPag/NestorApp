/**
 * DRAWING STATE MACHINE SYSTEM
 *
 * 🏢 ENTERPRISE (2026-01-25): Formal State Machine for Drawing Operations
 *
 * Based on patterns from:
 * - Autodesk AutoCAD (command state machine)
 * - Adobe Illustrator (tool state management)
 * - XState (modern state machine patterns)
 *
 * Separation of Concerns:
 * - ToolStateManager (systems/tools/): WHICH tool is active
 * - DrawingStateMachine (this module): WHAT the tool is doing
 *
 * Usage:
 * ```tsx
 * import {
 *   useDrawingMachine,
 *   DrawingStateMachine,
 *   DRAWING_STATES
 * } from '@/subapps/dxf-viewer/core/state-machine';
 *
 * // In React component
 * const {
 *   state,        // 'IDLE' | 'TOOL_READY' | 'COLLECTING_POINTS' | etc.
 *   isDrawing,    // true when in any drawing state
 *   canComplete,  // true when min points reached
 *   addPoint,     // (point: Point2D) => void
 *   complete,     // () => void
 *   cancel,       // () => void
 * } = useDrawingMachine();
 *
 * // Handle canvas click
 * const handleClick = (point: Point2D) => {
 *   addPoint(point);
 * };
 *
 * // Handle double-click to complete
 * const handleDoubleClick = () => {
 *   if (canComplete) complete();
 * };
 * ```
 */

// Core interfaces and types
export type {
  DrawingStateType,
  DrawingEventType,
  DrawingEvent,
  DrawingEventPayloads,
  DrawingContext,
  DrawingMachineState,
  DrawingMachineListener,
  DrawingStateMachineConfig,
  IDrawingStateMachine,
  DrawingStateInfo,
  TransitionRule,
  ToolPointRequirements,
} from './interfaces';

// Constants
export {
  DRAWING_STATES,
  DEFAULT_DRAWING_CONTEXT,
  DEFAULT_STATE_MACHINE_CONFIG,
  TRANSITION_RULES,
  TOOL_POINT_REQUIREMENTS,
} from './interfaces';

// State Machine class
export {
  DrawingStateMachine,
  getGlobalDrawingStateMachine,
  resetGlobalDrawingStateMachine,
  createDrawingStateMachine,
} from './DrawingStateMachine';

// React hooks
export {
  useDrawingMachine,
  useDrawingKeyboardShortcuts,
  useDrawingStateInfo,
  useDrawingStateHistory,
  type UseDrawingMachineOptions,
  type UseDrawingMachineReturn,
} from './useDrawingMachine';
