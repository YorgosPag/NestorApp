/**
 * COMMAND PATTERN INTERFACES
 *
 * 🏢 ENTERPRISE (2026-01-25): Feature-Complete Command Pattern
 * SAP/Salesforce/Autodesk-grade implementation.
 *
 * Design Patterns:
 * - Command Pattern (GoF Chapter 5)
 * - Memento Pattern for state snapshots
 * - Composite Pattern for compound commands
 * - Transaction Pattern for rollback support
 *
 * Enterprise Features:
 * - Serialization for persistence/session restore
 * - Compound commands for grouping operations
 * - Transaction rollback on failure
 * - Audit trail for compliance
 * - IndexedDB/localStorage persistence
 *
 * Used by: Autodesk AutoCAD, SAP, Salesforce, Adobe, Figma
 */

import type { Point2D } from '../../rendering/types/Types';

// ============================================================================
// SERIALIZATION TYPES
// ============================================================================

/**
 * Serialized command data for persistence
 * All commands must be serializable to this format
 */
export interface SerializedCommand {
  /** Command type identifier for deserialization */
  type: string;

  /** Unique command identifier */
  id: string;

  /** Command name */
  name: string;

  /** Timestamp when command was created */
  timestamp: number;

  /** Command-specific data */
  data: Record<string, unknown>;

  /** Version for schema migrations */
  version: number;
}

/**
 * Command factory function type for deserialization
 */
export type CommandFactory = (
  serialized: SerializedCommand,
  sceneManager: ISceneManager
) => ICommand;

// ============================================================================
// CORE COMMAND INTERFACE
// ============================================================================

/**
 * Base command interface - all commands must implement this
 * 🏢 ENTERPRISE: Full serialization and transaction support
 */
export interface ICommand {
  /** Unique command identifier */
  readonly id: string;

  /** Human-readable command name for UI display */
  readonly name: string;

  /** Command type identifier (for serialization registry) */
  readonly type: string;

  /** Timestamp when command was created */
  readonly timestamp: number;

  /** Execute the command (first time or redo) */
  execute(): void;

  /** Reverse the command effects */
  undo(): void;

  /** Re-apply the command after undo */
  redo(): void;

  /**
   * Check if this command can be merged with another
   * Used for merging consecutive similar operations (e.g., drag movements)
   */
  canMergeWith?(other: ICommand): boolean;

  /**
   * Merge this command with another
   * Returns a new merged command
   */
  mergeWith?(other: ICommand): ICommand;

  /**
   * Get a description of what this command does
   * Used for tooltips and history display
   */
  getDescription(): string;

  /**
   * 🏢 ENTERPRISE: Serialize command for persistence
   * Returns data that can be stored in IndexedDB/localStorage
   */
  serialize(): SerializedCommand;

  /**
   * 🏢 ENTERPRISE: Validate command can be executed
   * Returns error message if invalid, null if valid
   */
  validate?(): string | null;

  /**
   * 🏢 ENTERPRISE: Get affected entity IDs
   * Used for conflict detection and audit trails
   */
  getAffectedEntityIds(): string[];
}

// ============================================================================
// COMPOUND COMMAND (Transaction/Batch)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Compound command for grouping multiple commands
 * All child commands execute/undo as a single atomic operation
 *
 * SAP/Salesforce Pattern: Batch operations with rollback
 */
export interface ICompoundCommand extends ICommand {
  /** Child commands in execution order */
  readonly commands: readonly ICommand[];

  /** Add a command to the compound */
  add(command: ICommand): void;

  /** Remove a command from the compound */
  remove(commandId: string): void;

  /** Get number of child commands */
  size(): number;
}

// ============================================================================
// TRANSACTION SUPPORT
// ============================================================================

/**
 * 🏢 ENTERPRISE: Transaction state for rollback support
 */
export type TransactionState = 'pending' | 'executing' | 'committed' | 'rolled_back' | 'failed';

/**
 * 🏢 ENTERPRISE: Transaction interface for atomic operations
 */
export interface ITransaction {
  /** Transaction ID */
  readonly id: string;

  /** Current state */
  readonly state: TransactionState;

  /** Commands in this transaction */
  readonly commands: readonly ICommand[];

  /** Begin transaction */
  begin(): void;

  /** Commit all commands */
  commit(): void;

  /** Rollback all executed commands */
  rollback(): void;

  /** Add command to transaction */
  addCommand(command: ICommand): void;
}

// AUDIT TRAIL types moved to ./types/audit-types.ts (ADR-031 file-size split)
export type { AuditLogEntry, IAuditTrail, AuditLogFilter } from './types/audit-types';

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * 🏢 ENTERPRISE: Persistence interface for session restore
 */
export interface ICommandPersistence {
  /** Save command history to storage */
  save(undoStack: SerializedCommand[], redoStack: SerializedCommand[]): Promise<void>;

  /** Load command history from storage */
  load(): Promise<{ undoStack: SerializedCommand[]; redoStack: SerializedCommand[] } | null>;

  /** Clear stored history */
  clear(): Promise<void>;

  /** Check if storage is available */
  isAvailable(): boolean;
}

/**
 * Storage type for persistence
 */
export type PersistenceStorage = 'localStorage' | 'indexedDB' | 'memory';

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Storage type */
  storage: PersistenceStorage;

  /** Storage key prefix */
  keyPrefix: string;

  /** Auto-save on each command */
  autoSave: boolean;

  /** Auto-save debounce (ms) */
  autoSaveDebounce: number;

  /** Max commands to persist */
  maxPersisted: number;
}

// ============================================================================
// COMMAND HISTORY INTERFACE
// ============================================================================

/**
 * Command history manager interface
 */
export interface ICommandHistory {
  /** Execute a new command and add to history */
  execute(command: ICommand): void;

  /** Undo the last command */
  undo(): boolean;

  /** Redo the last undone command */
  redo(): boolean;

  /** Check if undo is available */
  canUndo(): boolean;

  /** Check if redo is available */
  canRedo(): boolean;

  /** Clear all history */
  clear(): void;

  /** Get the undo stack (readonly) */
  getUndoStack(): readonly ICommand[];

  /** Get the redo stack (readonly) */
  getRedoStack(): readonly ICommand[];

  /** Get the last executed command */
  getLastCommand(): ICommand | null;

  /** Subscribe to history changes */
  subscribe(listener: CommandHistoryListener): () => void;

  /** Get current history size */
  size(): number;

  /** Get maximum history size */
  maxSize(): number;
}

/**
 * Listener for command history changes
 */
export type CommandHistoryListener = (event: CommandHistoryEvent) => void;

/**
 * Events emitted by command history
 */
export interface CommandHistoryEvent {
  type: 'execute' | 'undo' | 'redo' | 'clear';
  command?: ICommand;
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
}

// ============================================================================
// ENTITY COMMAND TYPES
// ============================================================================

/**
 * Entity reference for commands
 */
export interface EntityRef {
  id: string;
  type: string;
}

// CreateEntityOptions moved to ./types/create-entity-options.ts (ADR-031 file-size split)
export type { CreateEntityOptions } from './types/create-entity-options';

/**
 * Scene manager interface for commands
 * Commands interact with the scene through this interface
 */
export interface ISceneManager {
  /** Add an entity to the scene */
  addEntity(entity: SceneEntity): void;

  /** Remove an entity from the scene */
  removeEntity(entityId: string): void;

  /** Get an entity by ID */
  getEntity(entityId: string): SceneEntity | undefined;

  /** Update an entity */
  updateEntity(entityId: string, updates: Partial<SceneEntity>): void;

  /** Update a specific vertex of an entity */
  updateVertex(entityId: string, vertexIndex: number, position: Point2D): void;

  /** Insert a vertex into an entity */
  insertVertex(entityId: string, insertIndex: number, position: Point2D): void;

  /** Remove a vertex from an entity */
  removeVertex(entityId: string, vertexIndex: number): void;

  /** Get all vertices of an entity */
  getVertices(entityId: string): Point2D[] | undefined;
}

/**
 * Generic scene entity type
 * Commands work with this abstract type
 */
export interface SceneEntity {
  id: string;
  type: string;
  layer: string;
  visible: boolean;
  [key: string]: unknown;
}

// ============================================================================
// COMMAND MERGE CONFIGURATION
// ============================================================================

/**
 * Configuration for command merging behavior
 */
export interface CommandMergeConfig {
  /** Time window for merging consecutive commands (ms) */
  mergeTimeWindow: number;

  /** Enable/disable command merging */
  enableMerging: boolean;
}

/**
 * Default merge configuration
 */
export const DEFAULT_MERGE_CONFIG: CommandMergeConfig = {
  mergeTimeWindow: 500, // 500ms - same as Autodesk/Adobe
  enableMerging: true,
};

// ============================================================================
// COMMAND HISTORY CONFIGURATION
// ============================================================================

/**
 * Configuration for command history
 */
export interface CommandHistoryConfig {
  /** Maximum number of commands to keep in history */
  maxHistorySize: number;

  /** Command merge configuration */
  mergeConfig: CommandMergeConfig;
}

/**
 * Default history configuration
 */
export const DEFAULT_HISTORY_CONFIG: CommandHistoryConfig = {
  maxHistorySize: 100, // Standard for CAD applications
  mergeConfig: DEFAULT_MERGE_CONFIG,
};

// ============================================================================
// PERSISTENCE CONFIGURATION
// ============================================================================

/**
 * Default persistence configuration
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  storage: 'indexedDB',
  keyPrefix: 'dxf-viewer-commands',
  autoSave: true,
  autoSaveDebounce: 1000, // 1 second debounce
  maxPersisted: 50, // Keep last 50 commands for session restore
};

// ============================================================================
// COMMAND REGISTRY (for deserialization)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Command registry for serialization/deserialization
 * Register all command types here for persistence support
 */
export interface ICommandRegistry {
  /** Register a command factory */
  register(type: string, factory: CommandFactory): void;

  /** Unregister a command factory */
  unregister(type: string): void;

  /** Create command from serialized data */
  deserialize(serialized: SerializedCommand, sceneManager: ISceneManager): ICommand | null;

  /** Check if type is registered */
  isRegistered(type: string): boolean;

  /** Get all registered types */
  getRegisteredTypes(): string[];
}

// ============================================================================
// ENHANCED COMMAND HISTORY INTERFACE
// ============================================================================

/**
 * 🏢 ENTERPRISE: Enhanced command history with full enterprise features
 */
export interface IEnhancedCommandHistory extends ICommandHistory {
  /** Execute within a transaction (atomic operation) */
  executeTransaction(commands: ICommand[]): boolean;

  /** Get audit trail */
  getAuditTrail(): IAuditTrail;

  /** Get persistence interface */
  getPersistence(): ICommandPersistence;

  /** Restore from persistence */
  restore(): Promise<boolean>;

  /** Save to persistence */
  persist(): Promise<void>;

  /** Get command by ID */
  getCommand(id: string): ICommand | null;

  /** Get commands by entity ID */
  getCommandsByEntity(entityId: string): ICommand[];
}
