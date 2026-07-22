/**
 * apply-imported-mesh-material-map — ADR-686 Φ5 SSoT. Εφαρμόζει σε **πολλά κομμάτια** ενός
 * εισαγόμενου μοντέλου (καρέκλα = δεκάδες `imported-mesh` οντότητες) το user override υλικού, σε
 * **ΕΝΑ undoable βήμα** (batch «Αντιστοίχιση Υλικών» — Revit Material Mapping).
 *
 * ## Γιατί `'*'` (base) και όχι `slot:` (ADR-686 SSoT απόφαση)
 *
 * Κάθε εισαγόμενο κομμάτι είναι **μία** οντότητα με **ένα** (συχνά ανώνυμο) υλικό — ο `GLTFLoader`
 * σπάει κάθε node σε ξεχωριστό addressable mesh (μετρημένο: πραγματικό HMI_Aeron = 10 οντότητες,
 * ανώνυμα υλικά). Άρα η αντιστοίχιση είναι **per-ENTITY**, όχι per-slot: γράφουμε `faceAppearance['*']`
 * (base) που βάφει ΟΛΟ το κομμάτι, μέσω του κοινού `entireElementFaceMap`. Το `slot:${name}` machinery
 * μένει έγκυρο για τυχόν αρχεία με ονομασμένα υλικά, αλλά εδώ δεν πυροδοτείται.
 *
 * ## Ένας μηχανισμός, όχι δεύτερος
 *
 * Χτίζει τα ΙΔΙΑ `SetEntityFaceAppearanceMapCommand` που χρησιμοποιεί το drag-drop (`apply-entity-
 * face-appearance-map`) και το file-import (`import-c4d-materials`) — μηδέν νέος μηχανισμός βαφής,
 * ένας SSoT (`faceAppearance`, ADR-539). Ο 3Δ enhancer + ο 2Δ renderer διαβάζουν αυτόματα το override.
 *
 * @see ./apply-entity-face-appearance-map — το single-entity αδελφό (drag-drop path)
 * @see ../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand
 * @see docs/centralized-systems/reference/adrs/ADR-686-imported-mesh-appearance-override.md
 */

import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { executeAsAtomicBatch } from '../../core/commands/execute-atomic-batch';
import { SetEntityFaceAppearanceMapCommand } from '../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand';
import { entireElementFaceMap, type FaceAppearance } from '../../bim/types/face-appearance-types';

/** Μία ανάθεση υλικού σε ένα κομμάτι: `value = null` καθαρίζει το override (επιστροφή σε preset/embedded). */
export interface ImportedMeshMaterialAssignment {
  readonly entityId: string;
  readonly value: FaceAppearance | null;
}

/**
 * Εφαρμόζει τις αναθέσεις ως ένα atomic batch. Άδεια λίστα ή απών level → no-op. Όλα τα κομμάτια
 * ζουν στον ίδιο (τρέχοντα) όροφο — μία εισαγωγή σε έναν όροφο — άρα ένας adapter αρκεί.
 */
export function applyImportedMeshMaterialMap(
  levelManager: LevelSceneWriter | null,
  assignments: readonly ImportedMeshMaterialAssignment[],
): void {
  const levelId = levelManager?.currentLevelId;
  if (!levelId || assignments.length === 0) return;

  const adapter = createLevelSceneManagerAdapter(
    levelManager.getLevelScene, levelManager.setLevelScene, levelId,
  );
  const children = assignments.map(
    (a) => new SetEntityFaceAppearanceMapCommand(a.entityId, entireElementFaceMap(a.value), adapter),
  );
  executeAsAtomicBatch(children);
}
