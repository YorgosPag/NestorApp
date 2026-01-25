/**
 * COMMAND PATTERN SYSTEM
 *
 * 🏢 ENTERPRISE (2026-01-25): Undo/Redo system for DXF Viewer
 *
 * Based on patterns used by:
 * - Autodesk AutoCAD
 * - Adobe Photoshop/Illustrator
 * - Figma
 * - Sketch
 *
 * Architecture:
 * - Command Pattern (GoF) for encapsulating operations
 * - Memento Pattern for state snapshots
 * - Observer Pattern for UI updates
 *
 * Usage:
 * ```tsx
 * import { useCommandHistory, CreateEntityCommand, MoveVertexCommand } from '@/subapps/dxf-viewer/core/commands';
 *
 * // In component
 * const { execute, undo, redo, canUndo, canRedo } = useCommandHistory();
 *
 * // Create entity with undo support
 * execute(new CreateEntityCommand(entityData, sceneManager));
 *
 * // Move vertex with undo support (consecutive moves merge)
 * execute(new MoveVertexCommand(entityId, vertexIndex, oldPos, newPos, sceneManager));
 *
 * // Undo/Redo
 * if (canUndo) undo();
 * if (canRedo) redo();
 * ```
 */

// Core interfaces
export type {
  ICommand,
  ICommandHistory,
  ICompoundCommand,
  ISceneManager,
  SceneEntity,
  EntityRef,
  CreateEntityOptions,
  CommandHistoryListener,
  CommandHistoryEvent,
  CommandMergeConfig,
  CommandHistoryConfig,
  SerializedCommand,
  AuditLogEntry,
  AuditLogFilter,
  PersistenceConfig,
  ICommandPersistence,
  ICommandRegistry,
  IAuditTrail,
  CommandFactory,
} from './interfaces';

export { DEFAULT_MERGE_CONFIG, DEFAULT_HISTORY_CONFIG, DEFAULT_PERSISTENCE_CONFIG } from './interfaces';

// Command History
export { CommandHistory, getGlobalCommandHistory, resetGlobalCommandHistory } from './CommandHistory';

// 🏢 ENTERPRISE: Compound Commands (batch operations with rollback)
export { CompoundCommand } from './CompoundCommand';

// 🏢 ENTERPRISE: Audit Trail (SAP/Salesforce compliance logging)
export { AuditTrail, type AuditTrailStats } from './AuditTrail';

// 🏢 ENTERPRISE: Persistence (session restore via IndexedDB/localStorage)
export { CommandPersistence, createDebouncedSave } from './CommandPersistence';

// 🏢 ENTERPRISE: Command Registry (deserialization factory)
export {
  CommandRegistry,
  getGlobalCommandRegistry,
  resetGlobalCommandRegistry,
  registerBuiltInCommands,
} from './CommandRegistry';

// Entity Commands
export { CreateEntityCommand } from './entity-commands/CreateEntityCommand';
export { DeleteEntityCommand, DeleteMultipleEntitiesCommand } from './entity-commands/DeleteEntityCommand';

// Vertex Commands
export { MoveVertexCommand } from './vertex-commands/MoveVertexCommand';
export { AddVertexCommand } from './vertex-commands/AddVertexCommand';
export { RemoveVertexCommand } from './vertex-commands/RemoveVertexCommand';

// React Hooks
export {
  useCommandHistory,
  useCommandHistoryKeyboard,
  type CommandHistoryState,
  type UseCommandHistoryReturn,
  type UseCommandHistoryOptions,
} from './useCommandHistory';
