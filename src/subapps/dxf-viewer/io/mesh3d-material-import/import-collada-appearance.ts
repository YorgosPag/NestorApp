/**
 * import-collada-appearance — ADR-678 Φ4. Ο **wrapper COLLADA (`.dae`)** πάνω από τον
 * format-agnostic πυρήνα `applyImportedAppearance` (ADR-678 Φ1).
 *
 * Ο Giorgio στέλνει `.dae` στον συνεργάτη (C4D R15), εκείνος το γυρίζει βαμμένο **ανά όψη**, και τα
 * χρώματα/υλικά «κατεβαίνουν» στα ίδια BIM στοιχεία — ακριβώς όπως ήδη γίνεται με OBJ/glTF. Μία μόνο
 * διαφορά από το OBJ μονοπάτι: `charset: 'unicode'` (το `.dae` είναι UTF-8 XML by spec — τα ονόματα
 * ορόφων ταξιδεύουν ελληνικά ακέραια· ίδιο με glTF, βλ. `charsetFor` στο mesh3d-export-adapter).
 *
 * Ό,τι είναι μετά το parsing (matching → resolve → SetFaceAppearanceCommand → ΕΝΑ undo) είναι κοινό
 * — δεν επαναλαμβάνεται εδώ (N.18: δεύτερος orchestrator ανά format = sibling clone).
 *
 * @see ./dae-material-parse — parseColladaScene (objects + υλικά + faceKeys, μία διέλευση)
 * @see ./import-c4d-materials — ο κοινός πυρήνας + ο OBJ wrapper
 * @see ../mesh3d-roundtrip/import-gltf-appearance — ο glTF wrapper (ίδιο μοτίβο)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { withImportedMaterials, type KnownMaterialResolver } from './known-import-materials';
import { applyImportedAppearance, type ImportedAppearanceResult } from './import-c4d-materials';
import { parseColladaScene } from './dae-material-parse';

/**
 * ADR-678 Βήμα 3 — injected pre-pass που δημιουργεί `bmat_*` από ξένες υφές (C4D `<library_images>`)
 * και επιστρέφει `όνομα υλικού → bmat_*`. Injected (όχι άμεση εξάρτηση) ώστε αυτός ο wrapper να μένει
 * καθαρός από Firebase/React — ο button τον καλωδιώνει με τα SSoT (`importForeignTextures`).
 */
export type ColladaTextureImporter = (
  texturesByMaterialName: ReadonlyMap<string, string>,
) => Promise<ReadonlyMap<string, string>>;

/**
 * Εφαρμόζει την εμφάνιση ενός επιστρεφόμενου `.dae` στα ζωντανά BIM στοιχεία (per-face όταν το αρχείο
 * κουβαλά faceKeys). `baseline` = manifest baseline (`όνομα υλικού → sRGB hex`) από συνοδό
 * `.nestor.json` — repaint detection (ADR-683 §7)· το `.dae` `<color>` είναι sRGB, άρα συγκρίσιμο.
 * `materialBaselineByMesh` = ADR-678 Βήμα 2 per-entity/per-face baseline (`meshName → { faceKey →
 * εξαχθέν όνομα υλικού }`) από το ίδιο `.nestor.json` — εντοπίζει catalog→catalog swap. Το `.dae`
 * είναι το **κύριο** per-face μονοπάτι του C4D round-trip, άρα αυτή η καλωδίωση είναι απαραίτητη.
 *
 * **Async (ADR-678 Βήμα 3):** όπως ο glTF wrapper, γίνεται `async` — όχι για το parse (sync) αλλά για
 * το `textureImporter` pre-pass: ανεβάζει τις ξένες υφές → νέα `bmat_*` → επαυξάνει τον resolver
 * ({@link withImportedMaterials}), ώστε ο sync πυρήνας να βάψει τις όψεις με `{ materialId }`. Χωρίς
 * υφές ή χωρίς importer → η προηγούμενη sync συμπεριφορά ακέραιη (μηδέν regression).
 */
export async function importColladaAppearance(
  levels: LevelsHookReturn,
  daeText: string,
  resolveKnownId: KnownMaterialResolver,
  baseline?: ReadonlyMap<string, string>,
  materialBaselineByMesh?: ReadonlyMap<string, Readonly<Record<string, string>>>,
  textureImporter?: ColladaTextureImporter,
): Promise<ImportedAppearanceResult> {
  const { objects, materials, texturesByMaterialName } = parseColladaScene(daeText);
  const importedIds = textureImporter && texturesByMaterialName.size > 0
    ? await textureImporter(texturesByMaterialName)
    : new Map<string, string>();
  const resolver = withImportedMaterials(resolveKnownId, importedIds);
  return applyImportedAppearance(
    levels,
    { objects, materials, charset: 'unicode', baseline, materialBaselineByMesh },
    resolver,
  );
}
