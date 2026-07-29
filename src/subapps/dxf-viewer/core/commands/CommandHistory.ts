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
import { CompositeCommand } from './CompositeCommand';
import { createExternalStore } from '../../stores/createExternalStore';

/**
 * Command History Manager
 * Manages undo/redo stacks for all entity operations
 */
export class CommandHistory implements ICommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  // SSoT pub/sub via createExternalStore (WAVE 2.7): the public `subscribe`
  // signature hands the caller a per-event PAYLOAD (`CommandHistoryEvent`),
  // not a bare notify — createExternalStore's listener contract is `() =>
  // void`. So this is a version-signal internally (bumps on every mutation)
  // with `lastEvent` as a side-channel the wrapper reads to forward the
  // exact same payload shape callers had before migration.
  private readonly versionStore = createExternalStore<number>(0);
  private lastEvent: CommandHistoryEvent;
  private config: CommandHistoryConfig;
  // ADR-729 — ανοιχτή ατομική ομάδα αναίρεσης. `groupDepth > 0` ⇒ το `execute` ΕΚΤΕΛΕΙ κανονικά
  // (η επόμενη εντολή της παρτίδας πρέπει να δει τη γραμμένη σκηνή) αλλά **συλλέγει** αντί να
  // σπρώχνει στη στοίβα· η ομάδα προσγειώνεται ως ΜΙΑ εγγραφή όταν κλείσει η εμβέλεια.
  private groupDepth = 0;
  private groupBuffer: ICommand[] = [];

  constructor(config: Partial<CommandHistoryConfig> = {}) {
    this.config = { ...DEFAULT_HISTORY_CONFIG, ...config };
    this.lastEvent = {
      type: 'clear',
      canUndo: false,
      canRedo: false,
      undoStackSize: 0,
      redoStackSize: 0,
    };
  }

  /**
   * Execute a new command and add to history
   */
  execute(command: ICommand): void {
    // ADR-729 — μέσα σε ατομική ομάδα: τρέξε ΤΩΡΑ (η σκηνή πρέπει να είναι σωστή για την
    // επόμενη εντολή της παρτίδας), αλλά **συλλογή** αντί για push. Χωρίς merge (η ομάδα
    // ΕΙΝΑΙ η ενέργεια), χωρίς trim (δεν καταναλώνει θέσεις ιστορικού ανά οντότητα) και
    // χωρίς ειδοποίηση ανά παιδί (186 ειδοποιήσεις → 1).
    if (this.groupDepth > 0) {
      command.execute();
      this.groupBuffer.push(command);
      return;
    }

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
   * 🏢 ADR-729 — ΑΤΟΜΙΚΗ ΟΜΑΔΑ ΑΝΑΙΡΕΣΗΣ: **ΜΙΑ ενέργεια χρήστη = ΜΙΑ εγγραφή ιστορικού**.
   *
   * Ό,τι εκτελεστεί μέσα στο `work()` — όσο βαθιά κι αν βρίσκεται στη στοίβα κλήσεων —
   * προσγειώνεται ως **ΕΝΑ** βήμα αναίρεσης. Είναι το ίδιο σχήμα που χρησιμοποιούν όλοι οι
   * μεγάλοι, επαληθευμένο (2026-07-29): Revit `TransactionGroup` + `Assimilate()`, AutoCAD
   * `UNDO Begin/End`, Cinema 4D `doc.StartUndo()/EndUndo()` («only the Start/EndUndo containers
   * determine how often you need to hit Ctrl-Z»).
   *
   * ## Γιατί **εμβέλεια** και όχι «τύλιξε αυτόν τον πίνακα»
   * Το `executeAsAtomicBatch` απαιτεί τα commands **χτισμένα και ανεκτέλεστα**. Ο παραγωγός
   * οντοτήτων δεν μπορεί: κάθε `completeEntity` διαβάζει τη **γραμμένη** σκηνή πριν χτίσει την
   * επόμενη. Η εμβέλεια δεν ζητά καμία αναδιάρθρωση του καλούντος — γι' αυτό πιάνει και ό,τι
   * εκτελεί **ένθετος** κώδικας που δεν ελέγχεις (post-create, δομικές αντιδράσεις,
   * `appendToLast`).
   *
   * ## 🎯 Πού πάμε ΠΙΟ ΠΕΡΑ από τους μεγάλους
   * Σε Revit/AutoCAD/C4D η εμβέλεια είναι **πειθαρχία**: αν ο προγραμματιστής ξεχάσει να την
   * ανοίξει, η αποτυχία είναι **σιωπηλή** (πολλά βήματα undo, κανένα σφάλμα). Εδώ την ανοίγει
   * το ίδιο το `completeEntities` (ADR-057 SSoT), άρα η ατομικότητα είναι **ΔΟΜΙΚΗ** — ο
   * επόμενος παραγωγός παρτίδας τη κληρονομεί χωρίς να την ξέρει.
   *
   * ## Συμπεριφορά
   * - **Ένθεση**: εσωτερική εμβέλεια ενώνεται με την εξωτερική (Revit assimilation)· **μόνο** η
   *   εξώτατη γράφει εγγραφή ⇒ η εγγύηση «ΜΙΑ» δεν σπάει από ενδιάμεσο επίπεδο.
   * - **0 παιδιά** ⇒ καμία εγγραφή (όχι φάντασμα, όχι ειδοποίηση)· **1** ⇒ σκέτο το command
   *   (μηδέν overhead, ίδια συμπεριφορά με σήμερα)· **N** ⇒ ΕΝΑ `CompositeCommand`.
   * - **Σφάλμα μέσα στο `work()`** ⇒ **rollback**: τα εκτελεσμένα παιδιά αναιρούνται αντίστροφα
   *   και **τίποτα** δεν μπαίνει στο ιστορικό (Revit `TransactionGroup.RollBack`). Ο χρήστης δεν
   *   μένει ποτέ με μισή παρτίδα που δεν ξεκάνεται.
   *
   * @param name Όνομα της ομάδας — γίνεται η περιγραφή της εγγραφής αναίρεσης.
   * @returns ό,τι επιστρέφει το `work()` (η εμβέλεια είναι διαφανής στον καλούντα).
   * @see ./CompositeCommand.ts — το atomic undo group
   * @see ../../hooks/drawing/completeEntity.ts — ο δομικός καταναλωτής
   */
  runAsSingleUndo<T>(name: string, work: () => T): T {
    // Ένθετη εμβέλεια → ενώνεται με την εξωτερική· μόνο η εξώτατη κάνει commit.
    if (this.groupDepth > 0) return work();

    this.groupDepth = 1;
    this.groupBuffer = [];
    try {
      const result = work();
      this.pushGroupEntry(name, this.endGroup());
      return result;
    } catch (error) {
      undoInReverse(this.endGroup()); // ατομικότητα: ή όλα, ή τίποτα
      throw error;
    }
  }

  /** Είναι ανοιχτή ατομική ομάδα αναίρεσης αυτή τη στιγμή; */
  isGrouping(): boolean {
    return this.groupDepth > 0;
  }

  /**
   * Execute a command and GROUP it with the immediately-preceding entry into a
   * single atomic undo step (Revit transaction group). Used for **derived /
   * associative** reactions — e.g. the auto-foundation re-derive that follows a
   * column rotation: one Ctrl+Z reverts column + footing together, so the user
   * never sees an inconsistent intermediate state.
   *
   * Additive — does NOT alter execute/undo/redo. Falls back to a standalone push
   * when there is no recent previous entry (outside the merge time window), so an
   * unrelated trigger never glues onto the wrong command.
   */
  appendToLast(command: ICommand): void {
    // Run the (derived) command now — its children-effects apply immediately.
    command.execute();

    // ADR-729 — μέσα σε ατομική ομάδα δεν υπάρχει «προηγούμενη εγγραφή» να κολλήσει: ΟΛΑ
    // ανήκουν ήδη στην ίδια ενέργεια. Συλλογή, ώστε μια δομική αντίδραση μέσα σε παρτίδα να
    // μη σπάσει την εγγύηση «ΜΙΑ εγγραφή».
    if (this.groupDepth > 0) {
      this.groupBuffer.push(command);
      return;
    }

    const last = this.undoStack[this.undoStack.length - 1];
    const withinWindow =
      !!last && command.timestamp - last.timestamp < this.config.mergeConfig.mergeTimeWindow;

    if (last && withinWindow) {
      if (last instanceof CompositeCommand) {
        last.add(command); // already on top — extend in place
      } else {
        this.undoStack.pop();
        this.undoStack.push(new CompositeCommand([last, command]));
      }
    } else {
      // No recent companion → behave like a normal execute (standalone entry).
      this.undoStack.push(command);
      this.trimUndoStack();
    }

    this.redoStack = [];
    this.notifyListeners('execute', this.undoStack[this.undoStack.length - 1]);
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
    return this.versionStore.subscribe(() => listener(this.lastEvent));
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
   * ADR-729 — κλείσε την εμβέλεια **ΠΡΙΝ** από κάθε push/notify, ώστε ακροατής που αντιδρά
   * εκτελώντας εντολή να μη συλλεχθεί σε buffer που μόλις αδειάζει.
   */
  private endGroup(): ICommand[] {
    const captured = this.groupBuffer;
    this.groupBuffer = [];
    this.groupDepth = 0;
    return captured;
  }

  /**
   * ADR-729 — γράψε τα συλλεγμένα παιδιά ως **ΜΙΑ** εγγραφή. Δεν επιχειρείται merge με την
   * προηγούμενη εγγραφή: μια ομάδα **ΕΙΝΑΙ** μια διακριτή ενέργεια χρήστη.
   */
  private pushGroupEntry(name: string, captured: ICommand[]): void {
    if (captured.length === 0) return; // τίποτα δεν έγινε → καμία εγγραφή, καμία ειδοποίηση
    const entry = captured.length === 1 ? captured[0] : new CompositeCommand(captured, name);
    this.undoStack.push(entry);
    this.redoStack = [];
    this.trimUndoStack();
    this.notifyListeners('execute', entry);
  }

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
    this.lastEvent = {
      type,
      command,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
    };
    this.versionStore.set(this.versionStore.get() + 1);
  }
}

/**
 * ADR-729 — ξετύλιγμα εκτελεσμένων παιδιών σε αντίστροφη σειρά (Revit
 * `TransactionGroup.RollBack`). Κάθε παιδί προστατεύεται ξεχωριστά: μια αποτυχία αναίρεσης
 * δεν εμποδίζει τα υπόλοιπα να επανέλθουν — ίδια σημασιολογία με `CompoundCommand.rollback`.
 */
function undoInReverse(commands: readonly ICommand[]): void {
  for (let i = commands.length - 1; i >= 0; i--) {
    try {
      commands[i].undo();
    } catch (undoError) {
      console.error(`[CommandHistory] group rollback failed for child ${i}:`, undoError);
    }
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
