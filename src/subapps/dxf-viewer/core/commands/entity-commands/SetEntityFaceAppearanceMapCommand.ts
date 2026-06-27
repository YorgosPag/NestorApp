/**
 * SET ENTITY FACE APPEARANCE MAP COMMAND — ADR-539 Φ4a (entity-level copy/paste).
 *
 * Undoable αντικατάσταση ΟΛΟΚΛΗΡΟΥ του `faceAppearance` map ενός δομικού solid σε ΕΝΑ
 * atomic step — «επικόλληση εμφάνισης entity» (όλες οι όψεις της A → B). Αδελφό του
 * per-face `SetFaceAppearanceCommand` σε granularity ολόκληρου map: αντί να τρέξουμε N
 * per-face commands (N undo steps), ΕΝΑ command θέτει το πλήρες map (replace semantics,
 * Cinema 4D / Revit «paste material» = το B γίνεται ίδιο με το A).
 *
 *   - value = FaceAppearanceMap → αντικατέστησε το map της entity (faces εκτός value καθαρίζονται)
 *   - value = {}               → καθάρισε όλες τις βαμμένες όψεις (επιστροφή σε base look)
 *
 * Persist μέσω του κοινού `signalEntitiesAttached` SSoT. Snapshot του προηγούμενου map
 * χτίζεται ΜΙΑ φορά στο πρώτο `execute()` ώστε undo/redo = pure re-applies.
 *
 * @see core/commands/entity-commands/SetFaceAppearanceCommand.ts — το per-face αδελφό
 * @see bim/types/face-appearance-types.ts — FaceAppearance/FaceAppearanceMap
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FaceAppearance, FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

/** Shallow clone του map (Firestore-safe — κανένα shared reference με το clipboard). */
function cloneMap(map: FaceAppearanceMap): FaceAppearanceMap {
  const next: Record<string, FaceAppearance> = {};
  for (const [k, v] of Object.entries(map)) next[k] = { ...v };
  return next;
}

export class SetEntityFaceAppearanceMapCommand implements ICommand {
  readonly id: string;
  readonly name = 'SetEntityFaceAppearanceMap';
  readonly type = 'set-entity-face-appearance-map';
  readonly timestamp: number;

  private prev: FaceAppearanceMap | undefined;
  private next: FaceAppearanceMap | undefined;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly value: FaceAppearanceMap,
    private readonly sceneManager: ISceneManager,
  ) {
    this.id = generateEntityId();
    this.timestamp = Date.now();
  }

  execute(): void {
    if (!this.wasExecuted) {
      const entity = this.sceneManager.getEntity(this.entityId) as unknown as
        { faceAppearance?: FaceAppearanceMap } | undefined;
      if (!entity) return;
      this.prev = entity.faceAppearance;
      this.next = cloneMap(this.value);
      this.wasExecuted = true;
    }
    this.apply(this.next);
  }

  undo(): void {
    if (!this.wasExecuted) return;
    this.apply(this.prev);
  }

  redo(): void {
    this.apply(this.next);
  }

  private apply(faceAppearance: FaceAppearanceMap | undefined): void {
    this.sceneManager.updateEntity(this.entityId, { faceAppearance } as unknown as Partial<SceneEntity>);
    signalEntitiesAttached(this.sceneManager, [this.entityId]);
  }

  canMergeWith(): boolean {
    return false;
  }

  getDescription(): string {
    return `Set entity face appearance map on ${this.entityId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity id is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.entityId, value: this.value },
      version: 1,
    };
  }
}
