/**
 * COMMAND HISTORY REACT HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook for undo/redo functionality
 * Provides reactive state updates when command history changes.
 *
 * Usage:
 * ```tsx
 * const { canUndo, canRedo, undo, redo, execute, history } = useCommandHistory();
 *
 * // Execute a command
 * execute(new CreateEntityCommand(entityData, sceneManager));
 *
 * // Undo/Redo
 * if (canUndo) undo();
 * if (canRedo) redo();
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CommandHistory, getGlobalCommandHistory } from './CommandHistory';
import type { ICommand, CommandHistoryEvent, CommandHistoryConfig } from './interfaces';

/**
 * Command history state for React
 */
export interface CommandHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
  lastCommand: ICommand | null;
}

/**
 * Hook return type
 */
export interface UseCommandHistoryReturn extends CommandHistoryState {
  /** Execute a new command */
  execute: (command: ICommand) => void;

  /** Undo the last command */
  undo: () => boolean;

  /** Redo the last undone command */
  redo: () => boolean;

  /** Clear all history */
  clear: () => void;

  /** Get the undo stack */
  getUndoStack: () => readonly ICommand[];

  /** Get the redo stack */
  getRedoStack: () => readonly ICommand[];

  /** The command history instance */
  history: CommandHistory;
}

/**
 * Hook options
 */
export interface UseCommandHistoryOptions {
  /** Use a custom command history instance instead of global */
  customHistory?: CommandHistory;

  /** Configuration for new history (only used if no customHistory) */
  config?: Partial<CommandHistoryConfig>;
}

/**
 * React hook for command history (undo/redo)
 */
export function useCommandHistory(options: UseCommandHistoryOptions = {}): UseCommandHistoryReturn {
  // Get or create command history instance
  const history = useMemo(() => {
    if (options.customHistory) {
      return options.customHistory;
    }
    return getGlobalCommandHistory();
  }, [options.customHistory]);

  // State for reactive updates
  const [state, setState] = useState<CommandHistoryState>({
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
    undoStackSize: history.size(),
    redoStackSize: history.getRedoStack().length,
    lastCommand: history.getLastCommand(),
  });

  // Subscribe to history changes
  useEffect(() => {
    const handleChange = (event: CommandHistoryEvent) => {
      setState({
        canUndo: event.canUndo,
        canRedo: event.canRedo,
        undoStackSize: event.undoStackSize,
        redoStackSize: event.redoStackSize,
        lastCommand: event.command ?? null,
      });
    };

    const unsubscribe = history.subscribe(handleChange);
    return unsubscribe;
  }, [history]);

  // Memoized callbacks
  const execute = useCallback(
    (command: ICommand) => {
      history.execute(command);
    },
    [history]
  );

  const undo = useCallback(() => {
    return history.undo();
  }, [history]);

  const redo = useCallback(() => {
    return history.redo();
  }, [history]);

  const clear = useCallback(() => {
    history.clear();
  }, [history]);

  const getUndoStack = useCallback(() => {
    return history.getUndoStack();
  }, [history]);

  const getRedoStack = useCallback(() => {
    return history.getRedoStack();
  }, [history]);

  return {
    ...state,
    execute,
    undo,
    redo,
    clear,
    getUndoStack,
    getRedoStack,
    history,
  };
}

/**
 * Hook for keyboard shortcut integration
 * Call this in your main component to enable Ctrl+Z/Ctrl+Y
 */
export function useCommandHistoryKeyboard(options: UseCommandHistoryOptions = {}): void {
  const { undo, redo, canUndo, canRedo } = useCommandHistory(options);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Z (Undo)
      if (event.ctrlKey && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Check for Ctrl+Y or Ctrl+Shift+Z (Redo)
      if (
        (event.ctrlKey && event.key === 'y') ||
        (event.ctrlKey && event.shiftKey && event.key === 'z') ||
        (event.ctrlKey && event.shiftKey && event.key === 'Z')
      ) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
