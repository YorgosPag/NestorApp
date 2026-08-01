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
// ADR-711 / ADR-739 Φ.Δ βήμα 4 — ο δομικός φύλακας των global accelerators.
import { addGlobalShortcutListener } from '../../keyboard/global-shortcut-listener';
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

  /**
   * Execute a **derived** command and group it with the immediately-preceding
   * entry into ONE atomic undo step (Revit transaction group). Use for
   * associative reactions (e.g. auto-foundation re-derive after a column edit)
   * so a single undo reverts both. Falls back to a standalone entry when there
   * is no recent companion command.
   */
  executeGrouped: (command: ICommand) => void;

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

  const executeGrouped = useCallback(
    (command: ICommand) => {
      history.appendToLast(command);
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
    executeGrouped,
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
 *
 * ── ADR-739 Φ.Δ βήμα 4 — ΓΙΑΤΙ ΠΕΡΑΣΕ ΠΙΣΩ ΑΠΟ ΤΟΝ ΔΟΜΙΚΟ ΦΥΛΑΚΑ ──
 *
 * Ήταν ωμή εγγραφή keydown στο `window` με **κανέναν** φύλακα (η φράση γράφεται έτσι
 * επίτηδες: το κυριολεκτικό literal θα έκανε αυτό το αρχείο να μετρηθεί ξανά ως παραβάτης
 * από τον ratchet του `keyboard/__tests__`) — ένα από τα 20
 * τέτοια που μέτρησε το audit του βήματος 4, και το **πρώτο θύμα** του: με ανοιχτό δρομέα
 * κελιού, το `Ctrl+Z` του χρήστη ανέτρεπε την τελευταία εντολή **σχεδίασης** αντί για την
 * πληκτρολόγησή του. Στο Excel το `Ctrl+Z` μέσα σε κελί ανήκει στο κελί.
 *
 * ⚠️ `capture: false` **επίτηδες**: ο προηγούμενος listener ήταν στη φάση **bubble**
 * (η προεπιλογή του `addEventListener`), ενώ ο wrapper προεπιλέγει `capture`. Χωρίς αυτή
 * τη γραμμή η μετατροπή θα άλλαζε σιωπηλά τη **σειρά** έναντι κάθε άλλου listener του
 * viewer — δηλαδή θα ήταν αλλαγή συμπεριφοράς μεταμφιεσμένη σε καθαρισμό.
 *
 * ⚠️ Ο φύλακας κάνει το `Ctrl+Z` να παραιτείται και με **οποιοδήποτε** εστιασμένο πεδίο
 * κειμένου (γραμμή εντολών, Dynamic Input, διάλογοι) — αυτό είναι διόρθωση, όχι απώλεια:
 * μέχρι τώρα το undo σχεδίασης πυροδοτούσε ενώ ο χρήστης πληκτρολογούσε.
 *
 * @see subapps/dxf-viewer/keyboard/global-shortcut-listener.ts — ο φύλακας
 * @see ui/table-cell-editor/table-cell-key-intent.ts — ποιος το διεκδικεί μέσα στον πίνακα
 */
export function useCommandHistoryKeyboard(options: UseCommandHistoryOptions = {}): void {
  const { undo, redo, canUndo, canRedo } = useCommandHistory(options);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Z (Undo) — event.code is layout-independent (works on Greek/any keyboard)
      if (event.ctrlKey && event.code === 'KeyZ' && !event.shiftKey) {
        event.preventDefault();
        if (canUndo) {
          undo();
        }
        return;
      }

      // Check for Ctrl+Y or Ctrl+Shift+Z (Redo)
      if (
        (event.ctrlKey && event.code === 'KeyY') ||
        (event.ctrlKey && event.shiftKey && event.code === 'KeyZ')
      ) {
        event.preventDefault();
        if (canRedo) {
          redo();
        }
        return;
      }
    };

    return addGlobalShortcutListener(handleKeyDown, { capture: false });
  }, [undo, redo, canUndo, canRedo]);
}
