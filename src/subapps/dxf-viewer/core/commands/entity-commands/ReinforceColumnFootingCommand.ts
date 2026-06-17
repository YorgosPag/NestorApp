/**
 * REINFORCE COLUMN-FOOTING COMMAND — ADR-459 Phase 4 (ενιαίος οπλισμός οργανισμού).
 *
 * ΕΝΑ undoable βήμα που οπλίζει τον οργανισμό «κολόνα + πέδιλο» όταν το πέδιλο ζει
 * στον όροφο **Θεμελίωσης** (cross-level): (α) οπλίζει τις κολόνες (ενεργός όροφος)
 * συνθέτοντας το `AutoReinforceOrganismCommand` (μηδέν duplicate — SSoT
 * `buildReinforcePatch`) και (β) οπλίζει το πέδιλο cross-level μέσω του
 * `FoundationCrossLevelWriter`. Οι συνδέσεις οπλισμού (αναμονές/αγκυρώσεις/ματίσεις)
 * προκύπτουν αυτόματα DERIVED από τον cross-level οργανισμό (reinforcement-continuity).
 *
 * Single-level περίπτωση (πέδιλο στον ίδιο όροφο) ΔΕΝ χρειάζεται αυτή την command —
 * ο καλών εκπέμπει απλώς `bim:auto-reinforce-requested` (υπάρχον hook).
 *
 * @see ./AutoReinforceOrganismCommand.ts — column reinforce (συντίθεται)
 * @see ../../../bim/structural/section-context.ts — buildReinforcePatch (SSoT)
 * @see ../../../bim/foundations/foundation-cross-level-writer.ts — footing cross-level write
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §Phase 4
 */

import type { ICommand, ISceneManager, SerializedCommand } from '../interfaces';
import type { StructuralCodeProvider } from '../../../bim/structural/codes/structural-code-types';
import type { FoundationCrossLevelWriter } from '../../../bim/foundations/foundation-cross-level-writer';
import type { FoundationEntity, FoundationParams } from '../../../bim/types/foundation-types';
import { buildReinforcePatch } from '../../../bim/structural/reinforce-patch';
import { AutoReinforceOrganismCommand } from './AutoReinforceOrganismCommand';
import { generateEntityId } from '../../../systems/entity-creation/utils';

export class ReinforceColumnFootingCommand implements ICommand {
  readonly id: string;
  readonly name = 'ReinforceColumnFooting';
  readonly type = 'reinforce-column-footing';
  readonly timestamp: number;

  private readonly columnReinforce: AutoReinforceOrganismCommand;
  private readonly footingPrev: FoundationEntity;
  private readonly footingNext: FoundationEntity;
  private readonly footingChanged: boolean;

  constructor(
    columnIds: readonly string[],
    private readonly footing: FoundationEntity,
    private readonly writer: FoundationCrossLevelWriter,
    sceneManager: ISceneManager,
    provider: StructuralCodeProvider,
  ) {
    this.columnReinforce = new AutoReinforceOrganismCommand(columnIds, sceneManager, provider);
    const patch = buildReinforcePatch(footing, provider);
    this.footingChanged = patch !== null;
    this.footingPrev = patch ? { ...footing, params: patch.prev as FoundationParams } : footing;
    this.footingNext = patch ? { ...footing, params: patch.next as FoundationParams } : footing;
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    this.columnReinforce.execute();
    if (this.footingChanged) this.writer.update(this.footingNext);
  }

  undo(): void {
    this.columnReinforce.undo();
    if (this.footingChanged) this.writer.update(this.footingPrev);
  }

  redo(): void {
    this.columnReinforce.redo();
    if (this.footingChanged) this.writer.update(this.footingNext);
  }

  /** Πλήθος μελών που πράγματι οπλίστηκαν (κολόνες + πέδιλο) — για toast/emit. */
  reinforcedCount(): number {
    return this.columnReinforce.getReinforcedEntityIds().length + (this.footingChanged ? 1 : 0);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Reinforce organism: ${this.columnReinforce.getReinforcedEntityIds().length} column(s) + footing ${this.footing.id}`;
  }

  getAffectedEntityIds(): string[] {
    return [...this.columnReinforce.getAffectedEntityIds(), this.footing.id];
  }

  validate(): string | null {
    if (!this.footing.id) return 'Footing entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { footingId: this.footing.id },
      version: 1,
    };
  }
}
