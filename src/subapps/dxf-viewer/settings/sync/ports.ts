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

// ============================================================================
// PORT REGISTRY - RUNTIME VERIFICATION (Enterprise Pattern)
// ============================================================================

/**
 * Port Descriptor - Metadata for runtime port validation
 *
 * Based on patterns from:
 * - Angular InjectionToken
 * - NestJS Provider metadata
 * - InversifyJS ServiceIdentifier
 */
export interface PortDescriptor {
  /** Unique port identifier */
  readonly name: string;
  /** Port version for compatibility checks */
  readonly version: string;
  /** Required methods that must be implemented */
  readonly requiredMethods: readonly string[];
  /** Optional methods */
  readonly optionalMethods?: readonly string[];
  /** Human-readable description */
  readonly description: string;
}

/**
 * PORT_REGISTRY - Central registry of all ports with runtime metadata
 *
 * ✅ ENTERPRISE: This object EXISTS at runtime (unlike interfaces)
 * ✅ Used for: Runtime validation, debugging, introspection
 *
 * @example
 * ```ts
 * // Runtime check
 * const hasLoggerPort = PORT_REGISTRY.LoggerPort !== undefined;
 *
 * // Validation
 * const isValid = isValidPort(myAdapter, PORT_REGISTRY.LoggerPort);
 * ```
 */
export const PORT_REGISTRY = {
  /** Logger Port metadata */
  LoggerPort: {
    name: 'LoggerPort',
    version: '1.0.0',
    requiredMethods: ['info', 'warn', 'error'] as const,
    description: 'Abstraction for logging operations'
  },

  /** Clock Port metadata */
  ClockPort: {
    name: 'ClockPort',
    version: '1.0.0',
    requiredMethods: ['now'] as const,
    description: 'Abstraction for time operations'
  },

  /** Event Bus Port metadata */
  EventBusPort: {
    name: 'EventBusPort',
    version: '1.0.0',
    requiredMethods: ['emit', 'on'] as const,
    description: 'Abstraction for event broadcasting'
  },

  /** Tool Style Port metadata */
  ToolStylePort: {
    name: 'ToolStylePort',
    version: '1.0.0',
    requiredMethods: ['getCurrent', 'apply', 'onChange'] as const,
    description: 'Abstraction for tool/line style management'
  },

  /** Text Style Port metadata */
  TextStylePort: {
    name: 'TextStylePort',
    version: '1.0.0',
    requiredMethods: ['getCurrent', 'apply', 'onChange'] as const,
    description: 'Abstraction for text style management'
  },

  /** Grip Style Port metadata */
  GripStylePort: {
    name: 'GripStylePort',
    version: '1.0.0',
    requiredMethods: ['getCurrent', 'apply', 'onChange'] as const,
    description: 'Abstraction for grip style management'
  },

  /** Grid Port metadata */
  GridPort: {
    name: 'GridPort',
    version: '1.0.0',
    requiredMethods: ['getState', 'apply', 'onChange'] as const,
    description: 'Abstraction for grid system'
  },

  /** Ruler Port metadata */
  RulerPort: {
    name: 'RulerPort',
    version: '1.0.0',
    requiredMethods: ['getState', 'apply', 'onChange'] as const,
    description: 'Abstraction for ruler system'
  },

  /** Sync Dependencies metadata */
  SyncDependencies: {
    name: 'SyncDependencies',
    version: '1.0.0',
    requiredMethods: [] as const,
    requiredPorts: ['logger'] as const,
    optionalPorts: ['clock', 'bus', 'toolStyle', 'textStyle', 'gripStyle', 'grid', 'ruler'] as const,
    description: 'Aggregate interface for all sync dependencies'
  }
} as const;

/**
 * Type for port names (type-safe)
 */
export type PortName = keyof typeof PORT_REGISTRY;

// ============================================================================
// TYPE GUARDS - RUNTIME PORT VALIDATION
// ============================================================================

/**
 * Validates if an object implements a port contract
 *
 * ✅ ENTERPRISE: Runtime validation with detailed error reporting
 *
 * @param candidate - Object to validate
 * @param descriptor - Port descriptor with required methods
 * @returns Validation result with details
 *
 * @example
 * ```ts
 * const result = validatePortContract(myAdapter, PORT_REGISTRY.LoggerPort);
 * if (!result.valid) {
 *   console.error('Missing methods:', result.missingMethods);
 * }
 * ```
 */
export function validatePortContract(
  candidate: unknown,
  descriptor: PortDescriptor
): { valid: boolean; missingMethods: string[]; presentMethods: string[] } {
  if (candidate === null || candidate === undefined) {
    return {
      valid: false,
      missingMethods: [...descriptor.requiredMethods],
      presentMethods: []
    };
  }

  const obj = candidate as Record<string, unknown>;
  const missingMethods: string[] = [];
  const presentMethods: string[] = [];

  for (const method of descriptor.requiredMethods) {
    if (typeof obj[method] === 'function') {
      presentMethods.push(method);
    } else {
      missingMethods.push(method);
    }
  }

  return {
    valid: missingMethods.length === 0,
    missingMethods,
    presentMethods
  };
}

/**
 * Type guard: Checks if object is a valid LoggerPort
 */
export function isValidLoggerPort(candidate: unknown): candidate is LoggerPort {
  return validatePortContract(candidate, PORT_REGISTRY.LoggerPort).valid;
}

/**
 * Type guard: Checks if object is a valid ToolStylePort
 */
export function isValidToolStylePort(candidate: unknown): candidate is ToolStylePort {
  return validatePortContract(candidate, PORT_REGISTRY.ToolStylePort).valid;
}

/**
 * Type guard: Checks if object is a valid TextStylePort
 */
export function isValidTextStylePort(candidate: unknown): candidate is TextStylePort {
  return validatePortContract(candidate, PORT_REGISTRY.TextStylePort).valid;
}

/**
 * Type guard: Checks if object is a valid GripStylePort
 */
export function isValidGripStylePort(candidate: unknown): candidate is GripStylePort {
  return validatePortContract(candidate, PORT_REGISTRY.GripStylePort).valid;
}

/**
 * Type guard: Checks if object is a valid GridPort
 */
export function isValidGridPort(candidate: unknown): candidate is GridPort {
  return validatePortContract(candidate, PORT_REGISTRY.GridPort).valid;
}

/**
 * Type guard: Checks if object is a valid RulerPort
 */
export function isValidRulerPort(candidate: unknown): candidate is RulerPort {
  return validatePortContract(candidate, PORT_REGISTRY.RulerPort).valid;
}

/**
 * Validates SyncDependencies object
 *
 * ✅ ENTERPRISE: Comprehensive validation for DI container
 */
export function validateSyncDependencies(deps: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (deps === null || deps === undefined) {
    return { valid: false, errors: ['SyncDependencies is null or undefined'], warnings: [] };
  }

  const obj = deps as Record<string, unknown>;

  // Required: logger
  if (!isValidLoggerPort(obj.logger)) {
    errors.push('Missing or invalid required port: logger');
  }

  // Optional ports - validate if present
  if (obj.toolStyle !== undefined && !isValidToolStylePort(obj.toolStyle)) {
    warnings.push('Invalid optional port: toolStyle');
  }
  if (obj.textStyle !== undefined && !isValidTextStylePort(obj.textStyle)) {
    warnings.push('Invalid optional port: textStyle');
  }
  if (obj.gripStyle !== undefined && !isValidGripStylePort(obj.gripStyle)) {
    warnings.push('Invalid optional port: gripStyle');
  }
  if (obj.grid !== undefined && !isValidGridPort(obj.grid)) {
    warnings.push('Invalid optional port: grid');
  }
  if (obj.ruler !== undefined && !isValidRulerPort(obj.ruler)) {
    warnings.push('Invalid optional port: ruler');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
