/**
 * import-gltf-appearance — ADR-683 Φ2-UI. Ο **wrapper glTF/GLB** πάνω από τον format-agnostic
 * πυρήνα `applyImportedAppearance` (ADR-678 Φ1).
 *
 * Ο Giorgio στέλνει `.glb` στον συνεργάτη, εκείνος το γυρίζει βαμμένο, και τα χρώματα/υλικά
 * «κατεβαίνουν» στα ίδια BIM στοιχεία — **ακριβώς** όπως ήδη γίνεται με το OBJ. Δύο διαφορές από
 * το OBJ μονοπάτι, και **μόνο** αυτές:
 *
 *  1. **async + binary** — ο `GLTFLoader` φορτώνει πραγματική γεωμετρία, άρα `Promise`.
 *  2. **`charset: 'unicode'`** — το glTF επιβάλλει UTF-8, άρα τα ονόματα ορόφων ταξιδεύουν
 *     ελληνικά ακέραια. Το OBJ χρειάζεται `'latin'` transliteration για τον C4D R15. Λάθος
 *     charset εδώ ⇒ **μηδέν** ταιριάσματα σε κάθε ελληνικό όνομα ορόφου (σιωπηλή αποτυχία).
 *
 * Ό,τι είναι μετά το parsing (matching → resolve → SetFaceAppearanceCommand → ΕΝΑ undo) είναι
 * κοινό — δεν επαναλαμβάνεται εδώ (N.18: ο πειρασμός για δεύτερο orchestrator ανά format είναι
 * ακριβώς το sibling clone που πιάνει το jscpd).
 *
 * @see ./gltf-scene-parse — parseGltfScene (objects + υλικά, μία διέλευση)
 * @see ../mesh3d-material-import/import-c4d-materials — ο κοινός πυρήνας + ο OBJ wrapper
 * @see docs/centralized-systems/reference/adrs/ADR-683-bim-collaboration-roundtrip.md §2.1 Κ1
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { KnownMaterialResolver } from '../mesh3d-material-import/known-import-materials';
import {
  applyImportedAppearance,
  type ImportedAppearanceResult,
} from '../mesh3d-material-import/import-c4d-materials';
import { parseGltfScene } from './gltf-scene-parse';

/** Εφαρμόζει την εμφάνιση ενός επιστρεφόμενου `.glb`/`.gltf` στα ζωντανά BIM στοιχεία. */
export async function importGltfAppearance(
  levels: LevelsHookReturn,
  data: ArrayBuffer | string,
  resolveKnownId: KnownMaterialResolver,
): Promise<ImportedAppearanceResult> {
  const { objects, materials } = await parseGltfScene(data);
  return applyImportedAppearance(levels, { objects, materials, charset: 'unicode' }, resolveKnownId);
}
