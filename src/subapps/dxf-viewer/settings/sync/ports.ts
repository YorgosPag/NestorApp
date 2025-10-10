/**
 * @file Ports (Interfaces) for Settings Sync
 * @module settings/sync/ports
 *
 * ✅ ENTERPRISE: Hexagonal Architecture - Ports & Adapters Pattern
 *
 * **ARCHITECTURAL PRINCIPLE**: Dependency Inversion
 * - Settings module defines WHAT it needs (ports)
 * - Application layer provides HOW (adapters)
 * - Zero coupling to legacy stores/contexts
 *
 * **BENEFITS**:
 * - Testability: Fake ports for unit tests
 * - Flexibility: Change implementation without refactor
 * - Observability: All operations go through LoggerPort
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI) + ChatGPT-5 Architecture
 * @since 2025-10-09
 */

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Unsubscribe function returned by event subscriptions
 */
export type Unsubscribe = () => void;

// ============================================================================
// CORE PORTS
// ============================================================================

/**
 * Logger Port - Abstraction for logging
 *
 * Implementation can be:
 * - Console logger (development)
 * - Structured logger (production)
 * - Silent logger (tests)
 */
export interface LoggerPort {
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

/**
 * Clock Port - Abstraction for time operations
 *
 * Useful for:
 * - Timestamps
 * - Debounce calculations
 * - Testing with fake time
 */
export interface ClockPort {
  now(): number; // Unix timestamp in milliseconds
}

/**
 * Event Bus Port - Abstraction for event broadcasting
 *
 * Enables:
 * - Fanout events to multiple listeners
 * - Bidirectional sync (if needed)
 * - Event-driven architecture
 */
export interface EventBusPort {
  emit(event: { type: string; payload?: unknown }): void;
  on(type: string, handler: (payload: unknown) => void): Unsubscribe;
}

// ============================================================================
// DOMAIN-SPECIFIC PORTS (Legacy Store Abstractions)
// ============================================================================

/**
 * Tool Style Port - Abstraction for tool/line style management
 *
 * Maps to: toolStyleStore (legacy)
 */
export interface ToolStylePort {
  /**
   * Get current tool style state
   * @returns Partial style object (stroke, fill, width, etc.)
   */
  getCurrent(): Partial<{
    stroke: string;
    fill: string;
    width: number;
    opacity: number;
    dashArray: number[];
  }>;

  /**
   * Apply style updates to tool
   * @param partial - Style updates to apply
   */
  apply(partial: Partial<{
    stroke: string;
    fill: string;
    width: number;
    opacity: number;
    dashArray: number[];
  }>): void;

  /**
   * Subscribe to tool style changes (from UI)
   * @param handler - Callback when style changes
   * @returns Unsubscribe function
   */
  onChange(handler: (partial: Partial<{
    stroke: string;
    fill: string;
    width: number;
    opacity: number;
    dashArray: number[];
  }>) => void): Unsubscribe;
}

/**
 * Text Style Port - Abstraction for text style management
 *
 * Maps to: textStyleStore (legacy)
 */
export interface TextStylePort {
  /**
   * Get current text style state
   */
  getCurrent(): Partial<{
    font: string;
    size: number;
    color: string;
    weight: string;
    style: string;
  }>;

  /**
   * Apply text style updates
   */
  apply(partial: Partial<{
    font: string;
    size: number;
    color: string;
    weight: string;
    style: string;
  }>): void;

  /**
   * Subscribe to text style changes
   */
  onChange(handler: (partial: Partial<{
    font: string;
    size: number;
    color: string;
    weight: string;
    style: string;
  }>) => void): Unsubscribe;
}

/**
 * Grip Style Port - Abstraction for grip style management
 *
 * Maps to: gripStyleStore (legacy)
 */
export interface GripStylePort {
  /**
   * Get current grip style state
   */
  getCurrent(): Partial<{
    size: number;
    color: string;
    hoverColor: string;
    selectedColor: string;
  }>;

  /**
   * Apply grip style updates
   */
  apply(partial: Partial<{
    size: number;
    color: string;
    hoverColor: string;
    selectedColor: string;
  }>): void;

  /**
   * Subscribe to grip style changes
   */
  onChange(handler: (partial: Partial<{
    size: number;
    color: string;
    hoverColor: string;
    selectedColor: string;
  }>) => void): Unsubscribe;
}

/**
 * Grid Port - Abstraction for grid system
 *
 * Maps to: globalGridStore (legacy)
 */
export interface GridPort {
  /**
   * Get current grid state
   */
  getState(): Partial<{
    enabled: boolean;
    spacing: number;
    color: string;
    opacity: number;
  }>;

  /**
   * Apply grid state updates
   */
  apply(partial: Partial<{
    enabled: boolean;
    spacing: number;
    color: string;
    opacity: number;
  }>): void;

  /**
   * Subscribe to grid state changes
   */
  onChange(handler: (partial: Partial<{
    enabled: boolean;
    spacing: number;
    color: string;
    opacity: number;
  }>) => void): Unsubscribe;
}

/**
 * Ruler Port - Abstraction for ruler system
 *
 * Maps to: globalRulerStore (legacy)
 */
export interface RulerPort {
  /**
   * Get current ruler state
   */
  getState(): Partial<{
    enabled: boolean;
    units: string;
    color: string;
    opacity: number;
  }>;

  /**
   * Apply ruler state updates
   */
  apply(partial: Partial<{
    enabled: boolean;
    units: string;
    color: string;
    opacity: number;
  }>): void;

  /**
   * Subscribe to ruler state changes
   */
  onChange(handler: (partial: Partial<{
    enabled: boolean;
    units: string;
    color: string;
    opacity: number;
  }>) => void): Unsubscribe;
}

// ============================================================================
// AGGREGATE INTERFACE (Dependency Injection Container)
// ============================================================================

/**
 * Sync Dependencies - All ports needed for settings sync
 *
 * This is what gets injected into the Provider via DI.
 *
 * @example
 * ```tsx
 * const syncDeps: SyncDependencies = {
 *   logger: consoleLogger,
 *   toolStyle: toolStyleAdapter,
 *   textStyle: textStyleAdapter,
 *   grid: gridAdapter,
 *   ruler: rulerAdapter
 * };
 * ```
 */
export interface SyncDependencies {
  /** Required: Logger for all operations */
  logger: LoggerPort;

  /** Optional: Clock for timestamps (defaults to Date.now) */
  clock?: ClockPort;

  /** Optional: Event bus for bidirectional sync */
  bus?: EventBusPort;

  /** Optional: Tool/Line style port */
  toolStyle?: ToolStylePort;

  /** Optional: Text style port */
  textStyle?: TextStylePort;

  /** Optional: Grip style port */
  gripStyle?: GripStylePort;

  /** Optional: Grid system port */
  grid?: GridPort;

  /** Optional: Ruler system port */
  ruler?: RulerPort;
}
