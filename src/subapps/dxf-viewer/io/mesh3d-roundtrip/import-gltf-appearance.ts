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
import { parseGltfScene, type GltfObjectRecord } from './gltf-scene-parse';

/**
 * ADR-683 Φ3β — το αποτέλεσμα κουβαλά, δίπλα στην αναφορά βαφής, τις **πλήρεις εγγραφές** των
 * κόμβων χωρίς αντιστοίχιση (κατάσταση D).
 *
 * **Γιατί εγγραφές και όχι ονόματα:** το `ImportedAppearanceResult.unmatched` είναι `string[]` —
 * αρκετό για να πει «3 δεν ταίριαξαν», άχρηστο για να τα **εισαγάγει**. Οι διαστάσεις και η θέση
 * τους έχουν ήδη υπολογιστεί κατά το parse· επιστρέφοντας μόνο ονόματα θα αναγκάζαμε τον καλούντα
 * να ξανα-φορτώσει και να ξανα-αναλύσει ολόκληρο το `.glb` για δεδομένα που κρατούσαμε στο χέρι.
 */
export interface GltfAppearanceImportResult {
  readonly appearance: ImportedAppearanceResult;
  /** Οι κόμβοι που δεν ταίριαξαν σε καμία ζωντανή οντότητα — υποψήφιοι για `imported-mesh`. */
  readonly unmatchedRecords: readonly GltfObjectRecord[];
}

/**
 * Εφαρμόζει την εμφάνιση ενός επιστρεφόμενου `.glb`/`.gltf` στα ζωντανά BIM στοιχεία.
 *
 * `baseline` = το manifest baseline (`όνομα υλικού → sRGB hex`) από το συνοδό `.nestor.json`, όταν
 * ο χρήστης το επιλέξει (ADR-683 §7). Επιτρέπει ανίχνευση repaint που κράτησε το όνομα υλικού
 * (Blender/glTF). Σωστό **μόνο** στο glTF: εδώ και το πραγματικό χρώμα και το baseline είναι sRGB.
 * `materialBaselineByMesh` = ADR-678 Βήμα 2 per-entity/per-face baseline από το ίδιο `.nestor.json`
 * (`meshName → { faceKey → εξαχθέν όνομα υλικού }`) — εντοπίζει catalog→catalog swap ανά όψη (το
 * glTF είναι το per-primitive per-face format, άρα εδώ αξιοποιείται πλήρως).
 */
export async function importGltfAppearance(
  levels: LevelsHookReturn,
  data: ArrayBuffer | string,
  resolveKnownId: KnownMaterialResolver,
  baseline?: ReadonlyMap<string, string>,
  materialBaselineByMesh?: ReadonlyMap<string, Readonly<Record<string, string>>>,
): Promise<GltfAppearanceImportResult> {
  const { objects, materials } = await parseGltfScene(data);
  const appearance = applyImportedAppearance(
    levels,
    { objects, materials, charset: 'unicode', baseline, materialBaselineByMesh },
    resolveKnownId,
  );

  // Το `unmatched` του πυρήνα είναι ονόματα object· τα ξανασυνδέουμε με τις εγγραφές τους. Ο
  // πυρήνας μένει format-agnostic (ο OBJ δρόμος δεν έχει γεωμετρία να επιστρέψει) — η γνώση ότι
  // «στο glTF ένα unmatched είναι εισαγώγιμο» ανήκει εδώ, στον glTF wrapper.
  const unmatchedNames = new Set(appearance.unmatched);
  const unmatchedRecords = objects.filter((o) => unmatchedNames.has(o.objectName));

  return { appearance, unmatchedRecords };
}
