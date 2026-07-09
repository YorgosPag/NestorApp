/**
 * @module core/commands/base-command
 * @description Generic Template-Method base for `ICommand` implementations.
 *
 * Owns the universal command boilerplate — `id`/`timestamp` initialisation,
 * `redo() → execute()`, the `canMergeWith()` default and the `serialize()`
 * envelope — so concrete commands implement only their domain behaviour plus a
 * serialised payload. A single command base in the spirit of the AutoCAD /
 * Figma command architectures (one root, thin leaves).
 *
 * @see ADR-613 (Guide command SSoT)
 * @see ./interfaces.ts (ICommand, SerializedCommand)
 * @since 2026-07-09
 */

import type { ICommand, SerializedCommand } from './interfaces';
import { generateEntityId } from '../../systems/entity-creation/utils';

/**
 * Abstract base for every command. Concrete subclasses supply `name`/`type`,
 * the `execute`/`undo` behaviour, a human description, the affected entity ids
 * and the serialised `data` payload via {@link serializeData}.
 */
export abstract class BaseCommand implements ICommand {
  readonly id: string;
  readonly timestamp: number;

  /** Human-readable command name for UI display. */
  abstract readonly name: string;
  /** Command type identifier (serialization registry). */
  abstract readonly type: string;

  /** Serialization schema version — override for migrated payloads. */
  protected readonly version: number = 1;

  /**
   * @param id Optional pre-built command id. When omitted a fresh
   * `generateEntityId()` is used (guide/text commands). Families that mint
   * their own history key — e.g. layer commands via `makeLayerCommandKey` —
   * pass it here so the exact key format is preserved (ADR-616).
   */
  constructor(id?: string) {
    this.id = id ?? generateEntityId();
    this.timestamp = Date.now();
  }

  abstract execute(): void;
  abstract undo(): void;
  abstract getDescription(): string;
  abstract getAffectedEntityIds(): string[];

  /** Default redo re-runs execute. Override only for divergent redo paths. */
  redo(): void {
    this.execute();
  }

  /** Default: commands do not merge. Override for drag-style coalescing. */
  canMergeWith(): boolean {
    return false;
  }

  /** Assemble the serialized envelope; subclasses provide only the payload. */
  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: this.serializeData(),
      version: this.version,
    };
  }

  /** Command-specific serialized payload (the `data` field). */
  protected abstract serializeData(): Record<string, unknown>;
}
