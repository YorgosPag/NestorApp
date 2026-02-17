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
 * import {
 *   useCommandHistory,
 *   CreateEntityCommand,
 *   MoveVertexCommand,
 *   MoveEntityCommand,
 *   MoveMultipleEntitiesCommand,
 *   MoveMultipleOverlayVerticesCommand,
 *   type VertexMovement
 * } from '@/subapps/dxf-viewer/core/commands';
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
 * // 🆕 Move entity by delta (supports merging for drag operations)
 * execute(new MoveEntityCommand(entityId, { x: 10, y: 5 }, sceneManager, true));
 *
 * // 🆕 Move multiple entities at once
 * execute(new MoveMultipleEntitiesCommand(['id1', 'id2'], { x: 10, y: 5 }, sceneManager, true));
 *
 * // 🆕 Move multiple overlay vertices (multi-grip) with undo support
 * const movements: VertexMovement[] = [
 *   { overlayId: 'id1', vertexIndex: 0, oldPosition: [0, 0], newPosition: [10, 10] },
 *   { overlayId: 'id1', vertexIndex: 1, oldPosition: [5, 5], newPosition: [15, 15] }
 * ];
 * execute(new MoveMultipleOverlayVerticesCommand(movements, overlayStore));
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
export { MoveEntityCommand, MoveMultipleEntitiesCommand } from './entity-commands/MoveEntityCommand';
export { JoinEntityCommand } from './entity-commands/JoinEntityCommand';

// Vertex Commands
export { MoveVertexCommand } from './vertex-commands/MoveVertexCommand';
export { AddVertexCommand } from './vertex-commands/AddVertexCommand';
export { RemoveVertexCommand } from './vertex-commands/RemoveVertexCommand';

// 🏢 ENTERPRISE (2026-01-26): Overlay Commands - ADR-032
export { DeleteOverlayCommand, DeleteMultipleOverlaysCommand } from './overlay-commands';
// 🏢 ENTERPRISE (2026-01-26): Overlay Vertex Commands - ADR-032
export { DeleteOverlayVertexCommand, DeleteMultipleOverlayVerticesCommand } from './overlay-commands';
// 🏢 ENTERPRISE (2027-01-27): Overlay Move Commands with Undo/Redo - Unified Toolbar Integration
export { MoveOverlayCommand, MoveMultipleOverlaysCommand } from './overlay-commands';
// 🏢 ENTERPRISE (2026-01-26): Overlay Vertex Move Commands with Undo/Redo - ADR-032
export { MoveOverlayVertexCommand, MoveMultipleOverlayVerticesCommand, type VertexMovement } from './overlay-commands';

// React Hooks
export {
  useCommandHistory,
  useCommandHistoryKeyboard,
  type CommandHistoryState,
  type UseCommandHistoryReturn,
  type UseCommandHistoryOptions,
} from './useCommandHistory';
