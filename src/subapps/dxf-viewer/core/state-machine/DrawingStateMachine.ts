/**
 * DRAWING STATE MACHINE
 *
 * 🏢 ENTERPRISE (2026-01-25): Formal State Machine Implementation
 *
 * Based on patterns from:
 * - Autodesk AutoCAD (command state machine)
 * - Adobe Illustrator (tool state management)
 * - XState (modern state machine library patterns)
 *
 * Features:
 * - Type-safe state transitions
 * - Guard conditions for complex logic
 * - State history for debugging
 * - Subscription pattern for React integration
 * - Immutable state updates
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  DrawingStateType,
  DrawingEventType,
  DrawingEvent,
  DrawingEventPayloads,
  DrawingContext,
  DrawingMachineState,
  DrawingMachineListener,
  DrawingStateMachineConfig,
  IDrawingStateMachine,
  TransitionRule,
  DrawingStateInfo,
} from './interfaces';

import {
  DRAWING_STATES,
  DEFAULT_DRAWING_CONTEXT,
  DEFAULT_STATE_MACHINE_CONFIG,
  TRANSITION_RULES,
  TOOL_POINT_REQUIREMENTS,
} from './interfaces';
import { createExternalStore } from '../../stores/createExternalStore';

/**
 * Drawing State Machine Implementation
 *
 * Enterprise-grade state machine for managing drawing operations
 */
export class DrawingStateMachine implements IDrawingStateMachine {
  // SSoT pub/sub via createExternalStore (WAVE 2.7). `state` is a single discriminated
  // object replaced wholesale on every transition (reducer-over-single-object shape) —
  // no `equals` guard, every valid transition/reset notifies unconditionally, matching
  // the hand-rolled `notifyListeners()` behaviour it replaces. The public `subscribe`
  // signature passes the new `DrawingMachineState` to the listener (unlike the factory's
  // bare `() => void`), so the wrapper below reads `store.get()` at notify time.
  private readonly store = createExternalStore<DrawingMachineState>({
    currentState: 'IDLE',
    context: { ...DEFAULT_DRAWING_CONTEXT },
    history: ['IDLE'],
  });
  private config: Required<DrawingStateMachineConfig>;

  constructor(config: DrawingStateMachineConfig = {}) {
    this.config = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config };

    this.log('State machine initialized', this.store.get());
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Get full state
   */
  getState(): DrawingMachineState {
    return this.store.get();
  }

  /**
   * Get current state type
   */
  getCurrentStateType(): DrawingStateType {
    return this.store.get().currentState;
  }

  /**
   * Get current context
   */
  getContext(): DrawingContext {
    return this.store.get().context;
  }

  /**
   * Get state info
   */
  getStateInfo(): DrawingStateInfo {
    return DRAWING_STATES[this.store.get().currentState];
  }

  /**
   * Send event to trigger state transition
   */
  send<T extends DrawingEventType>(type: T, payload: DrawingEventPayloads[T]): void {
    const event: DrawingEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
    };

    this.log(`Event: ${type}`, payload);

    // Find valid transition
    const transition = this.findTransition(type);

    if (!transition) {
      this.log(`No valid transition for ${type} from ${this.store.get().currentState}`);
      return;
    }

    // Check guard condition
    if (transition.guard && !transition.guard(this.store.get().context, event as DrawingEvent)) {
      this.log(`Guard blocked transition for ${type}`);
      return;
    }

    // Execute transition
    this.executeTransition(transition, event as DrawingEvent);
  }

  /**
   * Check if transition is valid
   */
  canTransition(eventType: DrawingEventType): boolean {
    return this.findTransition(eventType) !== undefined;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: DrawingMachineListener): () => void {
    return this.store.subscribe(() => listener(this.store.get()));
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.store.set({
      currentState: 'IDLE',
      context: { ...DEFAULT_DRAWING_CONTEXT, lastStateChange: Date.now() },
      history: ['IDLE'],
    });
    this.log('State machine reset');
  }

  // ==========================================================================
  // ACTION CHECKS
  // ==========================================================================

  canAddPoint(): boolean {
    return DRAWING_STATES[this.store.get().currentState].allowsAddPoint;
  }

  canComplete(): boolean {
    return DRAWING_STATES[this.store.get().currentState].allowsComplete;
  }

  canCancel(): boolean {
    return DRAWING_STATES[this.store.get().currentState].allowsCancel;
  }

  canPreview(): boolean {
    return DRAWING_STATES[this.store.get().currentState].allowsPreview;
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Select a drawing tool
   */
  selectTool(toolType: string): void {
    this.send('SELECT_TOOL', { toolType });
  }

  /**
   * Deselect current tool
   */
  deselectTool(): void {
    this.send('DESELECT_TOOL', {});
  }

  /**
   * Add a point
   */
  addPoint(point: Point2D, snapped = false, snapType?: string): void {
    this.send('ADD_POINT', { point, snapped, snapType });
  }

  /**
   * Update cursor position
   */
  moveCursor(position: Point2D, snapped = false, snapType?: string): void {
    this.send('MOVE_CURSOR', { position, snapped, snapType });
  }

  /**
   * Complete current drawing
   */
  complete(forced = false): void {
    this.send('COMPLETE', { forced });
  }

  /**
   * Cancel current drawing
   */
  cancel(reason?: string): void {
    this.send('CANCEL', { reason });
  }

  /**
   * Undo last point (AutoCAD-style U command)
   * 🏢 ENTERPRISE (2026-01-30): ADR-047 - Context menu undo support
   */
  undoPoint(): void {
    this.send('UNDO_POINT', {});
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Find valid transition for event
   */
  private findTransition(eventType: DrawingEventType): TransitionRule | undefined {
    return TRANSITION_RULES.find(
      (rule) => rule.from === this.store.get().currentState && rule.on === eventType
    );
  }

  /**
   * Execute state transition
   */
  private executeTransition(transition: TransitionRule, event: DrawingEvent): void {
    const previousState = this.store.get().currentState;
    const newContext = this.computeNewContext(event);

    // Check if min points reached (auto-transition)
    let targetState = transition.to;
    if (this.shouldTransitionToCompleting(targetState, newContext)) {
      targetState = 'COMPLETING';
    }

    // Update state
    const newHistory = [...this.store.get().history, targetState].slice(-this.config.maxHistorySize);

    this.store.set({
      currentState: targetState,
      context: newContext,
      history: newHistory,
    });

    this.log(`Transition: ${previousState} -> ${targetState}`);

    // Handle auto-reset for terminal states
    if (targetState === 'COMPLETED' || targetState === 'CANCELLED') {
      this.scheduleAutoReset();
    }
  }

  /**
   * Compute new context based on event
   */
  private computeNewContext(event: DrawingEvent): DrawingContext {
    const currentContext = this.store.get().context;

    switch (event.type) {
      case 'SELECT_TOOL': {
        const payload = event.payload as DrawingEventPayloads['SELECT_TOOL'];
        const requirements = this.getToolRequirements(payload.toolType);
        return {
          ...DEFAULT_DRAWING_CONTEXT,
          toolType: payload.toolType,
          minPoints: requirements.minPoints,
          maxPoints: requirements.maxPoints,
          allowsContinuous: requirements.allowsContinuous,
          lastStateChange: event.timestamp,
        };
      }

      case 'DESELECT_TOOL':
        return {
          ...DEFAULT_DRAWING_CONTEXT,
          lastStateChange: event.timestamp,
        };

      case 'ADD_POINT': {
        const payload = event.payload as DrawingEventPayloads['ADD_POINT'];
        const newPoints = [...currentContext.points, payload.point];

        // Check max points
        if (newPoints.length > currentContext.maxPoints && currentContext.maxPoints !== Infinity) {
          return currentContext; // Don't add more points
        }

        return {
          ...currentContext,
          points: newPoints,
          snapInfo: {
            snapped: payload.snapped ?? false,
            snapType: payload.snapType ?? null,
            snapPoint: payload.snapped ? payload.point : null,
          },
          lastStateChange: event.timestamp,
        };
      }

      case 'MOVE_CURSOR': {
        const payload = event.payload as DrawingEventPayloads['MOVE_CURSOR'];
        return {
          ...currentContext,
          cursorPosition: payload.position,
          snapInfo: {
            snapped: payload.snapped ?? false,
            snapType: payload.snapType ?? null,
            snapPoint: payload.snapped ? payload.position : null,
          },
          lastStateChange: event.timestamp,
        };
      }

      case 'UNDO_POINT': {
        // 🏢 ENTERPRISE (2026-01-30): ADR-047 - Remove last point (AutoCAD U command)
        if (currentContext.points.length === 0) {
          return currentContext; // Nothing to undo
        }
        const newPoints = currentContext.points.slice(0, -1);
        return {
          ...currentContext,
          points: newPoints,
          lastStateChange: event.timestamp,
        };
      }

      case 'CANCEL': {
        const payload = event.payload as DrawingEventPayloads['CANCEL'];
        return {
          ...currentContext,
          error: payload.reason ?? 'Cancelled by user',
          lastStateChange: event.timestamp,
        };
      }

      case 'COMPLETE':
      case 'RESET':
      case 'MIN_POINTS_REACHED':
        return {
          ...currentContext,
          lastStateChange: event.timestamp,
        };

      default:
        return currentContext;
    }
  }

  /**
   * Check if should auto-transition to COMPLETING
   */
  private shouldTransitionToCompleting(
    targetState: DrawingStateType,
    context: DrawingContext
  ): boolean {
    // Only check for states that can transition to COMPLETING
    if (
      targetState !== 'COLLECTING_POINTS' &&
      targetState !== 'PREVIEWING'
    ) {
      return false;
    }

    // Check if minimum points reached
    return context.points.length >= context.minPoints;
  }

  /**
   * Get tool point requirements
   */
  private getToolRequirements(toolType: string): {
    minPoints: number;
    maxPoints: number;
    allowsContinuous: boolean;
  } {
    const customRequirements = this.config.toolRequirements[toolType];
    if (customRequirements) {
      return customRequirements;
    }

    const defaultRequirements = TOOL_POINT_REQUIREMENTS[toolType];
    if (defaultRequirements) {
      return defaultRequirements;
    }

    // Fallback for unknown tools
    return { minPoints: 2, maxPoints: 2, allowsContinuous: false };
  }

  /**
   * Schedule auto-reset for terminal states
   */
  private scheduleAutoReset(): void {
    if (this.config.autoResetDelay > 0) {
      setTimeout(() => {
        const currentState = this.store.get().currentState;
        if (currentState === 'COMPLETED' || currentState === 'CANCELLED') {
          this.send('RESET', {});
        }
      }, this.config.autoResetDelay);
    }
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[DrawingStateMachine] ${message}`, data ?? '');
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalInstance: DrawingStateMachine | null = null;

/**
 * Get global drawing state machine instance
 */
export function getGlobalDrawingStateMachine(): DrawingStateMachine {
  if (!globalInstance) {
    globalInstance = new DrawingStateMachine();
  }
  return globalInstance;
}

/**
 * Reset global instance (for testing)
 */
export function resetGlobalDrawingStateMachine(): void {
  globalInstance = null;
}

/**
 * Create new drawing state machine instance
 */
export function createDrawingStateMachine(
  config?: DrawingStateMachineConfig
): DrawingStateMachine {
  return new DrawingStateMachine(config);
}
