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

import type { ISceneManager } from '../interfaces';
import type { FaceAppearance, FaceAppearanceMap } from '../../../bim/types/face-appearance-types';
import { FaceAppearanceFieldCommand } from './face-appearance-field-command';

/** Shallow clone του map (Firestore-safe — κανένα shared reference με το clipboard). */
function cloneMap(map: FaceAppearanceMap): FaceAppearanceMap {
  const next: Record<string, FaceAppearance> = {};
  for (const [k, v] of Object.entries(map)) next[k] = { ...v };
  return next;
}

export class SetEntityFaceAppearanceMapCommand extends FaceAppearanceFieldCommand {
  readonly name = 'SetEntityFaceAppearanceMap';
  readonly type = 'set-entity-face-appearance-map';

  constructor(
    entityId: string,
    private readonly value: FaceAppearanceMap,
    sceneManager: ISceneManager,
  ) {
    super(entityId, sceneManager);
  }

  protected computeNextMap(): FaceAppearanceMap {
    return cloneMap(this.value);
  }

  getDescription(): string {
    return `Set entity face appearance map on ${this.entityId}`;
  }

  validate(): string | null {
    if (!this.entityId) return 'Entity id is required';
    return null;
  }

  protected serializeData(): Record<string, unknown> {
    return { entityId: this.entityId, value: this.value };
  }
}
