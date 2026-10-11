/**
 * @module core/commands/entity-commands/precomputed-patch-command
 * @description Το κοινό σώμα των εντολών που ΔΕΝ υπολογίζουν τίποτα: λαμβάνουν έτοιμα
 * `{prev, next}` ανά οντότητα από καθαρό σχεδιασμό και τα γράφουν συμμετρικά.
 *
 * Το {@link BatchEntityPatchCommand} (ADR-617) χτίζει τα patches από τη ζωντανή σκηνή στο πρώτο
 * `execute`. Όταν ο υπολογισμός έχει ΗΔΗ γίνει μία φορά έξω από την εντολή (ένα πέρασμα ενώσεων
 * για όλη την παρτίδα, ένα σχέδιο εγγραφής ανοιγμάτων), το `buildPatches` είναι πάντα «επίστρεψε
 * ό,τι σου δόθηκε» και τα `getAffectedEntityIds` / `validate` / `serializeData` είναι πάντα τα
 * ίδια τρία σώματα. Ζουν εδώ ΜΙΑ φορά· το φύλλο δηλώνει μόνο ΠΩΣ γράφεται ένα entry.
 *
 * @see ./RetrimWallsCommand.ts — ενώσεις γειτόνων (ADR-911 Φ2)
 * @see ./opening-host-commands.ts — επαναφιλοξενία ανοιγμάτων + καθρέφτης ξενιστή (ADR-911 Φ4-2)
 */

import type { ISceneManager } from '../interfaces';
import { BatchEntityPatchCommand, type BatchPatchEntry } from './batch-entity-patch-command';

export abstract class PrecomputedPatchCommand<
  TState,
  TEntry extends BatchPatchEntry<TState> = BatchPatchEntry<TState>,
> extends BatchEntityPatchCommand<TState, TEntry> {
  constructor(
    protected readonly entries: readonly TEntry[],
    sceneManager: ISceneManager,
  ) {
    super(sceneManager);
  }

  protected buildPatches(): TEntry[] {
    return [...this.entries];
  }

  getAffectedEntityIds(): string[] {
    return this.entries.map((e) => e.entityId);
  }

  validate(): string | null {
    return this.entries.length === 0 ? 'At least one entry is required' : null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityIds: this.getAffectedEntityIds() };
  }
}
