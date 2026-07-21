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
import { isUnchangedNestorMaterial } from './resolve-import-appearance';
import { stripHiddenPrefix } from '../../export/core/mesh3d/mesh3d-naming';

/**
 * ADR-678 Βήμα 3 — χωρίζει τις υφές σε **foreign** (χρειάζονται upload) και **repair** (self-heal). Οι
 * ΔΙΚΕΣ μας εξαγόμενες υφές έχουν γνωστά Nestor ονόματα (`mat-*`/`elem-*`/`mat_<hex>` = αμετάβλητο DNA·
 * `tex_*` = legacy texture export· catalog/preset/`bmat_*` = γνωστό id) — δεν χρειάζονται upload (η όψη
 * μένει no-op) και δεν πρέπει ούτε να δημιουργήσουν διπλότυπο `bmat_*` ούτε να μπουν ως «missing» στο
 * warning. Ξένο = τίποτα από τα παραπάνω (π.χ. `Trunk.1`, `road_wood`) → `foreign`.
 *
 * **Self-heal (ground-truth 2026-07-22):** ένα γνωστό υλικό (π.χ. `Trunk.1`) του οποίου το albedo έγινε
 * απρόσιτο (ghost doc → 403) μπαίνει ΚΑΙ στο `foreign` (θα ανέβει η υφή) ΚΑΙ στο `repairIds` (upload στο
 * ίδιο id) → η κολώνα θεραπεύεται σε επόμενο import, χωρίς διπλότυπο, σταθερό id. Χωρίς probe → η παλιά
 * συμπεριφορά ακέραιη (κάθε γνωστό = skip).
 *
 * **Γιατί εδώ (ground-truth 2026-07-22):** χωρίς το φίλτρο, ο pre-pass ζητούσε upload για ΟΛΑ τα
 * textured (mat-wood/tex_concrete_albedo/…) → θορυβώδες warning + πιθανό διπλότυπο των δικών μας.
 */
export async function foreignAndBrokenTextures(
  textures: ReadonlyMap<string, string>,
  resolveKnownId: KnownMaterialResolver,
  isKnownBroken?: KnownMaterialHealthProbe,
): Promise<{ foreign: Map<string, string>; repairIds: Map<string, string> }> {
  const foreign = new Map<string, string>();
  const repairIds = new Map<string, string>();
  for (const [name, file] of textures) {
    const clean = stripHiddenPrefix(name);
    if (isUnchangedNestorMaterial(clean)) continue;
    if (clean.startsWith('tex_')) continue;
    const id = resolveKnownId(clean);
    if (id === null) { foreign.set(name, file); continue; }
    // Self-heal (ground-truth 2026-07-22): ένα «γνωστό» υλικό του οποίου το albedo έγινε 403/απόν (ghost
    // doc) ΔΕΝ πρέπει να προσπερνιέται σιωπηλά — αλλιώς κανένα re-import δεν το θεραπεύει (sticky). Το
    // βάζουμε στο foreign (θα ανέβει η υφή) + στο repairIds (upload στο ΙΔΙΟ id → σταθερό, μηδέν διπλότυπο).
    if (isKnownBroken && (await isKnownBroken(id))) {
      foreign.set(name, file);
      repairIds.set(name, id);
    }
    // αλλιώς γνωστό & υγιές → no-op (η όψη κρατά ό,τι είχε)
  }
  return { foreign, repairIds };
}

/**
 * ADR-678 Βήμα 3 — injected pre-pass που δημιουργεί `bmat_*` από ξένες υφές (C4D `<library_images>`)
 * και επιστρέφει `όνομα υλικού → bmat_*`. Injected (όχι άμεση εξάρτηση) ώστε αυτός ο wrapper να μένει
 * καθαρός από Firebase/React — ο button τον καλωδιώνει με τα SSoT (`importForeignTextures`).
 */
export type ColladaTextureImporter = (
  texturesByMaterialName: ReadonlyMap<string, string>,
  repairIds: ReadonlyMap<string, string>,
) => Promise<ReadonlyMap<string, string>>;

/**
 * ADR-678 self-heal probe — είναι «σπασμένο» (μη-προσβάσιμο albedo) το γνωστό υλικό με αυτό το id;
 * Injected (ο io wrapper μένει καθαρός από Firebase): ο button το καλωδιώνει με το durability SSoT
 * `isMaterialTextureReachable`. `true` → self-heal στόχος (η υφή ξανα-ανεβαίνει στο ίδιο id).
 */
export type KnownMaterialHealthProbe = (materialId: string) => Promise<boolean>;

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
  isKnownBroken?: KnownMaterialHealthProbe,
): Promise<ImportedAppearanceResult> {
  const { objects, materials, texturesByMaterialName } = parseColladaScene(daeText);
  // ΜΟΝΟ οι ξένες υφές ανεβαίνουν — οι δικές μας (mat-*/tex_*/catalog) είναι no-op, ούτε upload ούτε
  // «missing» θόρυβος (ground-truth 2026-07-22: ο R15 έγραφε textured effects και για τα Nestor DNA).
  // Εξαίρεση: γνωστό υλικό με σπασμένο albedo (ghost) → self-heal (repairIds), ξανα-ανεβαίνει στο ίδιο id.
  const { foreign, repairIds } = await foreignAndBrokenTextures(
    texturesByMaterialName, resolveKnownId, isKnownBroken,
  );
  const importedIds = textureImporter && foreign.size > 0
    ? await textureImporter(foreign, repairIds)
    : new Map<string, string>();
  const resolver = withImportedMaterials(resolveKnownId, importedIds);
  return applyImportedAppearance(
    levels,
    { objects, materials, charset: 'unicode', baseline, materialBaselineByMesh },
    resolver,
  );
}
