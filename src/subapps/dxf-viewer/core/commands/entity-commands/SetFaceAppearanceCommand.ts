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

import type { ISceneManager } from '../interfaces';
import type { FaceAppearance, FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { FaceAppearanceFieldCommand } from './face-appearance-field-command';
import { validateFaceKeyOverride, faceKeyOverrideData } from './entity-field-override-command';

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

export class SetFaceAppearanceCommand extends FaceAppearanceFieldCommand {
  readonly name = 'SetFaceAppearance';
  readonly type = 'set-face-appearance';

  constructor(
    entityId: string,
    private readonly faceKey: string,
    private readonly value: FaceAppearance | null,
    sceneManager: ISceneManager,
  ) {
    super(entityId, sceneManager);
  }

  protected computeNextMap(prev: FaceAppearanceMap | undefined): FaceAppearanceMap {
    return withFaceAppearance(prev, this.faceKey, this.value);
  }

  getDescription(): string {
    return `Set face appearance (${this.faceKey}) on ${this.entityId}`;
  }

  validate(): string | null {
    return validateFaceKeyOverride(this.entityId, this.faceKey);
  }

  protected serializeData(): Record<string, unknown> {
    return faceKeyOverrideData(this.entityId, this.faceKey, this.value);
  }
}
