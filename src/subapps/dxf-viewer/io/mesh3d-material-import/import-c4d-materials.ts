/**
 * import-c4d-materials — ADR-678 Φ1 orchestrator. Το «κατέβασμα» των υλικών του C4D πίσω στα
 * BIM στοιχεία: parse OBJ+MTL → match ονομάτων σε bimId → resolve σε `FaceAppearance` → εφαρμογή
 * ως base (`'*'`) όψη, με **ΕΝΑ** atomic undo (Cinema 4D / Revit «paint» parity).
 *
 * **Cross-floor:** το export κουβαλά όλους τους ορόφους, οπότε απαριθμούμε τις οντότητες ΟΛΩΝ των
 * επιπέδων και εφαρμόζουμε ανά επίπεδο (δικός adapter ανά levelId), όλα μέσα σε ένα `CompositeCommand`.
 *
 * @see ./obj-mtl-parse · ./match-objects-to-entities · ./resolve-import-appearance — pure core
 * @see ../../bim-3d/ui/apply-face-appearance — το ζωντανό αντίστοιχο (polygon panel / drag-drop)
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { ICommand } from '../../core/commands/interfaces';
import { extractBim3DEntities } from '../../bim-3d/scene/extract-bim3d-entities';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { SetFaceAppearanceCommand } from '../../core/commands/entity-commands/SetFaceAppearanceCommand';
import { BASE_FACE_KEY } from '../../bim/types/face-appearance-types';
import type { MeshNameCharset } from '../../export/core/mesh3d/mesh3d-naming';
import {
  parseObjObjects,
  parseMtl,
  type ObjectMaterialAssignment,
  type ImportedMaterial,
} from './obj-mtl-parse';
import { resolveImportAppearance } from './resolve-import-appearance';
import type { KnownMaterialResolver } from './known-import-materials';
import { matchObjectsToEntities, type EntityExportIdentity } from './match-objects-to-entities';
import { isFinishSkinName, buildFinishImportCommands } from './finish-import-routing';

/**
 * **Format-agnostic** είσοδος του πυρήνα εφαρμογής (ADR-683 Φ2-UI). Ό,τι έχει ήδη αναλυθεί: ποιο
 * object → ποιο υλικό, και τι είναι το κάθε υλικό. Το OBJ το παράγει με text parsing
 * (`parseObjObjects` + `parseMtl`), το glTF με `parseGltfScene` — **ίδιο σχήμα, ένας πυρήνας**.
 */
export interface ImportedAppearanceInput {
  readonly objects: readonly ObjectMaterialAssignment[];
  readonly materials: ReadonlyMap<string, ImportedMaterial>;
  /**
   * Το charset με το οποίο παρήχθησαν τα ονόματα στο export: `'latin'` για OBJ (ο C4D R15
   * transliteration), `'unicode'` για glTF (επιβάλλει UTF-8). Λάθος charset ⇒ **κανένα** ταίριασμα
   * σε ελληνικά ονόματα ορόφων.
   */
  readonly charset: MeshNameCharset;
}

/** Το OBJ+MTL κείμενο + το charset του export (OBJ = 'latin' λόγω C4D R15). */
export interface C4dMaterialImportInput {
  readonly objText: string;
  readonly mtlText: string;
  /** Default 'latin' (OBJ). Το glTF μονοπάτι δίνει 'unicode' (βλ. `importGltfAppearance`). */
  readonly charset?: MeshNameCharset;
}

/** Αναφορά εισαγωγής εμφάνισης — κοινή για OBJ και glTF. */
export interface ImportedAppearanceResult {
  /** Πόσα objects είχε το αρχείο. */
  readonly objectCount: number;
  /** Πόσα (μη-σοβά) objects ταιριάξαν σε BIM στοιχείο. */
  readonly matchedCount: number;
  /** Πόσα σώματα (base `'*'`) βάφτηκαν πραγματικά (matched ΚΑΙ με ΑΛΛΑΓΜΕΝΟ χρώμα/υλικό). */
  readonly appliedCount: number;
  /** ADR-678 Φ1.1 — πόσα δομικά μέλη πήραν σοβά-override από merged finish-skins. */
  readonly finishMemberCount: number;
  /** Ονόματα object χωρίς αντίστοιχο BIM στοιχείο (νέα γεωμετρία C4D κ.λπ.· ΟΧΙ σοβά-skins). */
  readonly unmatched: readonly string[];
}

/**
 * Ιστορικό όνομα (ADR-678 Φ1) — διατηρείται ώστε να μη σπάσουν οι υπάρχοντες καταναλωτές. Ο
 * τύπος είναι πλέον format-agnostic ({@link ImportedAppearanceResult}).
 */
export type C4dMaterialImportResult = ImportedAppearanceResult;

/** Απαριθμεί όλες τις BIM οντότητες όλων των επιπέδων → export identity + χάρτης bimId→levelId. */
function enumerateEntities(
  levels: LevelsHookReturn,
): { identities: EntityExportIdentity[]; levelByBimId: Map<string, string> } {
  const identities: EntityExportIdentity[] = [];
  const levelByBimId = new Map<string, string>();

  for (const level of levels.levels) {
    const scene = levels.getLevelScene(level.id);
    if (!scene) continue;
    const partitions = extractBim3DEntities(scene);
    for (const entity of Object.values(partitions).flat()) {
      identities.push({ bimId: entity.id, bimType: entity.type, floorName: level.name });
      levelByBimId.set(entity.id, level.id);
    }
  }
  return { identities, levelByBimId };
}

/**
 * **Ο πυρήνας** (ADR-683 Φ2-UI) — εφαρμόζει εμφάνιση από ήδη αναλυμένα objects+υλικά, ανεξάρτητα
 * από το format προέλευσης. Επιστρέφει αναφορά (πόσα ταιριάξαν/βάφτηκαν/έμειναν). Καμία
 * παρενέργεια όταν δεν βρεθεί τίποτα — άδειο CompositeCommand δεν εκτελείται.
 *
 * **Γιατί εδώ κόβεται το συμβόλαιο:** το OBJ είναι sync text, το glTF async binary — δεν χωράνε σε
 * μία υπογραφή. Ό,τι είναι *μετά* το parsing όμως (matching → resolve → command → undo) είναι
 * **ταυτόσημο**. Δύο orchestrators θα ήταν sibling clone (N.18)· ένας πυρήνας + δύο λεπτοί
 * wrappers είναι ο μόνος τρόπος να μην αποκλίνουν ποτέ.
 */
export function applyImportedAppearance(
  levels: LevelsHookReturn,
  input: ImportedAppearanceInput,
  resolveKnownId: KnownMaterialResolver,
): ImportedAppearanceResult {
  const { objects, materials: mtl, charset } = input;

  // ADR-678 Φ1.1 — τα merged σοβά-skins (synthetic bimId) δεν κάνουν name-match· δρομολογούνται
  // ξεχωριστά (ομοιόμορφος σοβάς ανά ζώνη), αλλιώς θα έπεφταν άδικα στα «χωρίς αντιστοίχιση».
  const finishObjects = objects.filter((o) => isFinishSkinName(o.objectName));
  const bodyObjects = objects.filter((o) => !isFinishSkinName(o.objectName));

  const { identities, levelByBimId } = enumerateEntities(levels);
  const { matched, unmatched } = matchObjectsToEntities(bodyObjects, identities, charset);

  const bodyChildren = matched.flatMap((m) => {
    const appearance = resolveImportAppearance(m.materialName, mtl, resolveKnownId);
    const levelId = levelByBimId.get(m.bimId);
    if (appearance === null || levelId === undefined) return [];
    const adapter = createLevelSceneManagerAdapter(levels.getLevelScene, levels.setLevelScene, levelId);
    return [new SetFaceAppearanceCommand(m.bimId, BASE_FACE_KEY, appearance, adapter)];
  });

  const finish = buildFinishImportCommands(levels, finishObjects, mtl, resolveKnownId);
  const children: ICommand[] = [...bodyChildren, ...finish.children];

  if (children.length > 0) {
    getGlobalCommandHistory().execute(
      children.length === 1 ? children[0] : new CompositeCommand(children),
    );
  }

  return {
    objectCount: objects.length,
    matchedCount: matched.length,
    appliedCount: bodyChildren.length,
    finishMemberCount: finish.memberCount,
    unmatched,
  };
}

/**
 * **Wrapper OBJ** (ADR-678 Φ1) — text parsing → πυρήνας. Το `.mtl` είναι προαιρετικό (ο C4D R15
 * δεν το γράφει· τότε το χρώμα έρχεται name-based, βλ. `resolve-import-appearance`).
 */
export function importC4dMaterials(
  levels: LevelsHookReturn,
  input: C4dMaterialImportInput,
  resolveKnownId: KnownMaterialResolver,
): ImportedAppearanceResult {
  return applyImportedAppearance(
    levels,
    {
      objects: parseObjObjects(input.objText),
      materials: parseMtl(input.mtlText),
      charset: input.charset ?? 'latin',
    },
    resolveKnownId,
  );
}
