/**
 * COMPOUND COMMAND
 *
 * 🏢 ENTERPRISE (2026-01-25): Batch operations with atomic execution
 * SAP/Salesforce pattern for grouping multiple commands.
 *
 * Features:
 * - Execute multiple commands as single undo/redo unit
 * - Automatic rollback on failure
 * - Nested compound commands support
 */

import type { ICommand, ICompoundCommand, SerializedCommand, ISceneManager } from './interfaces';
import { generateEntityId } from '../../systems/entity-creation/utils';

/**
 * Compound command for grouping multiple commands
 * All child commands execute/undo as a single atomic operation
 */
export class CompoundCommand implements ICompoundCommand {
  readonly id: string;
  readonly name: string;
  readonly type = 'compound';
  readonly timestamp: number;

  private _commands: ICommand[] = [];
  private executedCount = 0;

  constructor(name: string = 'Batch Operation', commands: ICommand[] = []) {
    this.id = generateEntityId();
    this.name = name;
    this.timestamp = Date.now();
    this._commands = [...commands];
  }

  /**
   * Get child commands (readonly)
   */
  get commands(): readonly ICommand[] {
    return this._commands;
  }

  /**
   * Add a command to the compound
   */
  add(command: ICommand): void {
    this._commands.push(command);
  }

  /**
   * Remove a command from the compound
   */
  remove(commandId: string): void {
    const index = this._commands.findIndex((c) => c.id === commandId);
    if (index !== -1) {
      this._commands.splice(index, 1);
    }
  }

  /**
   * Get number of child commands
   */
  size(): number {
    return this._commands.length;
  }

  /**
   * Execute all commands atomically
   * If any command fails, rollback all executed commands
   */
  execute(): void {
    this.executedCount = 0;

    for (let i = 0; i < this._commands.length; i++) {
      const command = this._commands[i];

      try {
        // Validate if available
        if (command.validate) {
          const error = command.validate();
          if (error) {
            throw new Error(`Command validation failed: ${error}`);
          }
        }

        command.execute();
        this.executedCount++;
      } catch (error) {
        // Rollback all executed commands
        console.error(`[CompoundCommand] Command ${i} failed, rolling back:`, error);
        this.rollback();
        throw error;
      }
    }
  }

  /**
   * Undo all commands in reverse order
   */
  undo(): void {
    for (let i = this._commands.length - 1; i >= 0; i--) {
      try {
        this._commands[i].undo();
      } catch (error) {
        console.error(`[CompoundCommand] Undo failed for command ${i}:`, error);
        // Continue with remaining undos
      }
    }
    this.executedCount = 0;
  }

  /**
   * Redo all commands in order
   */
  redo(): void {
    this.execute();
  }

  /**
   * Rollback executed commands (for failure recovery)
   */
  private rollback(): void {
    for (let i = this.executedCount - 1; i >= 0; i--) {
      try {
        this._commands[i].undo();
      } catch (undoError) {
        console.error(`[CompoundCommand] Rollback failed for command ${i}:`, undoError);
      }
    }
    this.executedCount = 0;
  }

  /**
   * Get description
   */
  getDescription(): string {
    if (this._commands.length === 0) {
      return this.name;
    }
    if (this._commands.length === 1) {
      return this._commands[0].getDescription();
    }
    return `${this.name} (${this._commands.length} operations)`;
  }

  /**
   * Compound commands cannot be merged
   */
  canMergeWith(): boolean {
    return false;
  }

  /**
   * Serialize for persistence
   */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        commands: this._commands.map((c) => c.serialize()),
      },
      version: 1,
    };
  }

  /**
   * Get all affected entity IDs
   */
  getAffectedEntityIds(): string[] {
    const ids = new Set<string>();
    for (const command of this._commands) {
      for (const id of command.getAffectedEntityIds()) {
        ids.add(id);
      }
    }
    return Array.from(ids);
  }

  /**
   * Create compound command from serialized data
   */
  static deserialize(
    serialized: SerializedCommand,
    deserializeCommand: (s: SerializedCommand, sm: ISceneManager) => ICommand | null,
    sceneManager: ISceneManager
  ): CompoundCommand | null {
    if (serialized.type !== 'compound') {
      return null;
    }

    const data = serialized.data as { commands: SerializedCommand[] };
    const commands: ICommand[] = [];

    for (const cmdData of data.commands) {
      const command = deserializeCommand(cmdData, sceneManager);
      if (command) {
        commands.push(command);
      }
    }

    const compound = new CompoundCommand(serialized.name, commands);
    return compound;
  }
}
