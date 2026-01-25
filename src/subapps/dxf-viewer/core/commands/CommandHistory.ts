/**
 * COMMAND HISTORY MANAGER
 *
 * 🏢 ENTERPRISE (2026-01-25): Undo/Redo stack implementation
 * Based on Autodesk AutoCAD and Adobe Photoshop patterns.
 *
 * Features:
 * - Undo/Redo stacks with configurable max size
 * - Command merging for consecutive similar operations
 * - Event subscription for UI updates
 * - Memory-efficient with automatic trimming
 */

import type {
  ICommand,
  ICommandHistory,
  CommandHistoryListener,
  CommandHistoryEvent,
  CommandHistoryConfig,
} from './interfaces';
import { DEFAULT_HISTORY_CONFIG } from './interfaces';

/**
 * Command History Manager
 * Manages undo/redo stacks for all entity operations
 */
export class CommandHistory implements ICommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private listeners: Set<CommandHistoryListener> = new Set();
  private config: CommandHistoryConfig;

  constructor(config: Partial<CommandHistoryConfig> = {}) {
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...config };
  }

  /**
   * Execute a new command and add to history
   */
  execute(command: ICommand): void {
    // Check for merge with last command
    if (this.config.mergeConfig.enableMerging) {
      const lastCommand = this.undoStack[this.undoStack.length - 1];

      if (lastCommand && this.canMergeCommands(lastCommand, command)) {
        // Merge commands
        this.undoStack.pop();
        const merged = lastCommand.mergeWith!(command);
        merged.execute();
        this.undoStack.push(merged);
        this.notifyListeners('execute', merged);
        return;
      }
    }

    // Execute the command
    command.execute();

    // Add to undo stack
    this.undoStack.push(command);

    // Clear redo stack (new action invalidates redo history)
    this.redoStack = [];

    // Trim if over max size
    this.trimUndoStack();

    // Notify listeners
    this.notifyListeners('execute', command);
  }

  /**
   * Undo the last command
   */
  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) {
      return false;
    }

    // Undo the command
    command.undo();

    // Move to redo stack
    this.redoStack.push(command);

    // Notify listeners
    this.notifyListeners('undo', command);

    return true;
  }

  /**
   * Redo the last undone command
   */
  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) {
      return false;
    }

    // Redo the command
    command.redo();

    // Move back to undo stack
    this.undoStack.push(command);

    // Notify listeners
    this.notifyListeners('redo', command);

    return true;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners('clear');
  }

  /**
   * Get the undo stack (readonly)
   */
  getUndoStack(): readonly ICommand[] {
    return this.undoStack;
  }

  /**
   * Get the redo stack (readonly)
   */
  getRedoStack(): readonly ICommand[] {
    return this.redoStack;
  }

  /**
   * Get the last executed command
   */
  getLastCommand(): ICommand | null {
    return this.undoStack[this.undoStack.length - 1] ?? null;
  }

  /**
   * Subscribe to history changes
   * Returns unsubscribe function
   */
  subscribe(listener: CommandHistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current history size
   */
  size(): number {
    return this.undoStack.length;
  }

  /**
   * Get maximum history size
   */
  maxSize(): number {
    return this.config.maxHistorySize;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Check if two commands can be merged
   */
  private canMergeCommands(lastCommand: ICommand, newCommand: ICommand): boolean {
    // Check if merge is possible
    if (!lastCommand.canMergeWith || !lastCommand.mergeWith) {
      return false;
    }

    // Check time window
    const timeDiff = newCommand.timestamp - lastCommand.timestamp;
    if (timeDiff > this.config.mergeConfig.mergeTimeWindow) {
      return false;
    }

    // Let the command decide
    return lastCommand.canMergeWith(newCommand);
  }

  /**
   * Trim undo stack if over max size
   */
  private trimUndoStack(): void {
    while (this.undoStack.length > this.config.maxHistorySize) {
      this.undoStack.shift(); // Remove oldest command
    }
  }

  /**
   * Notify all listeners of a change
   */
  private notifyListeners(type: CommandHistoryEvent['type'], command?: ICommand): void {
    const event: CommandHistoryEvent = {
      type,
      command,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
    };

    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[CommandHistory] Error in listener:', error);
      }
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global command history instance
 * Use this for application-wide undo/redo
 */
let globalCommandHistory: CommandHistory | null = null;

/**
 * Get the global command history instance
 */
export function getGlobalCommandHistory(): CommandHistory {
  if (!globalCommandHistory) {
    globalCommandHistory = new CommandHistory();
  }
  return globalCommandHistory;
}

/**
 * Reset the global command history (for testing)
 */
export function resetGlobalCommandHistory(): void {
  globalCommandHistory = null;
}
