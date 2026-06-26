/**
 * SET FACE APPEARANCE COMMAND — ADR-539 (Cinema 4D «Polygon Mode» writer).
 *
 * Undoable set/clear του per-face χρώματος/υλικού (`faceAppearance[faceKey]`) σε ΕΝΑ
 * δομικό solid. Generic: το `faceAppearance` είναι base field του `BimEntity` (δεν
 * αλλάζει geometry/params), άρα ΕΝΑ command καλύπτει και τα 6 kinds — mirror του
 * `SetComponentVisibilityCommand` (που γράφει το αδελφό `styleOverride`).
 *
 *   - value = FaceAppearance → βάψε/ντύσε αυτή την όψη
 *   - value = null           → καθάρισε το override της όψης (επιστροφή σε base look)
 *
 * Persist μέσω του κοινού `signalEntitiesAttached` SSoT (`bim:entities-attached` →
 * `useBimEntityMovedPersistEffect` → `saveSlab`), non-selected-safe. Snapshot του ΠΛΗΡΟΥΣ
 * προηγούμενου map χτίζεται ΜΙΑ φορά στο πρώτο `execute()` ώστε undo/redo = pure re-applies.
 *
 * @see core/commands/entity-commands/SetComponentVisibilityCommand.ts — το πρότυπο (styleOverride)
 * @see bim/types/face-appearance-types.ts — FaceAppearance/FaceAppearanceMap
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { ICommand, ISceneManager, SceneEntity, SerializedCommand } from '../interfaces';
import type { FaceAppearance, FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { signalEntitiesAttached } from './attach-persist-signal';

/** Συνθέτει νέο map θέτοντας/καθαρίζοντας ΜΙΑ όψη. Firestore-safe (κανένα explicit undefined). */
function withFaceAppearance(
  prev: FaceAppearanceMap | undefined,
  faceKey: string,
  value: FaceAppearance | null,
): FaceAppearanceMap {
  const next: Record<string, FaceAppearance> = { ...(prev ?? {}) };
  if (value === null) delete next[faceKey];
  else next[faceKey] = value;
  return next;
}

export class SetFaceAppearanceCommand implements ICommand {
  readonly id: string;
  readonly name = 'SetFaceAppearance';
  readonly type = 'set-face-appearance';
  readonly timestamp: number;

  private prev: FaceAppearanceMap | undefined;
  private next: FaceAppearanceMap | undefined;
  private wasExecuted = false;

  constructor(
    private readonly entityId: string,
    private readonly faceKey: string,
    private readonly value: FaceAppearance | null,
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
      this.next = withFaceAppearance(this.prev, this.faceKey, this.value);
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
    return `Set face appearance (${this.faceKey}) on ${this.entityId}`;
  }

  getAffectedEntityIds(): string[] {
    return [this.entityId];
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity id is required';
    if (!this.faceKey) return 'faceKey is required';
    return null;
  }

  serialize(): SerializedCommand {
    return {
      type: this.type,
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      data: { entityId: this.entityId, faceKey: this.faceKey, value: this.value },
      version: 1,
    };
  }
}
