/**
 * COMPOSITE COMMAND — Transaction group (GoF Composite + Transaction pattern).
 *
 * 🏢 ENTERPRISE: ομαδοποιεί πολλά `ICommand` σε **ΕΝΑ atomic undo step** (Revit
 * «transaction group» / AutoCAD «undo mark»). Η ενέργεια του χρήστη + οι παράγωγες
 * (associative) ενημερώσεις επανέρχονται **μαζί** με ένα Ctrl+Z — ο χρήστης ΠΟΤΕ δεν
 * βλέπει ενδιάμεση ασυνεπή κατάσταση (π.χ. «λοξή κολώνα σε ίσιο πέδιλο»).
 *
 * Τα children εκτελούνται **forward** (execute/redo) και αναιρούνται **reverse** (undo),
 * όπως σε κάθε nested transaction. Υλοποιεί το υπάρχον `ICompoundCommand`
 * (`interfaces.ts`) — μηδέν νέο contract.
 *
 * Χρήση: `CommandHistory.appendToLast(cmd)` τυλίγει το τελευταίο entry + το νέο
 * (παράγωγο) command σε ένα CompositeCommand. Τα children έχουν ήδη εκτελεστεί
 * ξεχωριστά πριν το wrap — γι' αυτό το `execute()` δεν καλείται στο initial push
 * (μόνο σε redo μετά από undo).
 *
 * @see ./interfaces.ts — ICompoundCommand
 * @see ./CommandHistory.ts — appendToLast
 */

import type { ICommand, ICompoundCommand, SerializedCommand } from './interfaces';
import { generateEntityId } from '../../systems/entity-creation/utils';

export class CompositeCommand implements ICompoundCommand {
  readonly id: string;
  readonly name = 'Composite';
  readonly type = 'composite';
  readonly timestamp: number;

  private children: ICommand[];

  constructor(children: readonly ICommand[]) {
    this.children = [...children];
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  get commands(): readonly ICommand[] {
    return this.children;
  }

  /** Forward (re-execute όλα τα children στη σειρά). */
  execute(): void {
    for (const c of this.children) c.execute();
  }

  /** Reverse (αναίρεση σε αντίστροφη σειρά — nested transaction unwind). */
  undo(): void {
    for (let i = this.children.length - 1; i >= 0; i--) this.children[i].undo();
  }

  /** Forward re-apply μετά από undo. */
  redo(): void {
    for (const c of this.children) c.redo();
  }

  add(command: ICommand): void {
    this.children.push(command);
  }

  remove(commandId: string): void {
    this.children = this.children.filter((c) => c.id !== commandId);
  }

  size(): number {
    return this.children.length;
  }

  /** Τα composites δεν συγχωνεύονται με merge — η ομαδοποίηση γίνεται μέσω appendToLast. */
  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return this.children.map((c) => c.getDescription()).join(' + ');
  }

  getAffectedEntityIds(): string[] {
    return [...new Set(this.children.flatMap((c) => c.getAffectedEntityIds()))];
  }

  validate(): string | null {
    for (const c of this.children) {
      const err = c.validate?.();
      if (err) return err;
    }
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: {
        childIds: this.children.map((c) => c.id),
        childTypes: this.children.map((c) => c.type),
      },
      version: 1,
    };
  }
}
