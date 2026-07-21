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
import { BASE_FACE_KEY, type FaceAppearance } from '../../bim/types/face-appearance-types';
import type { MeshNameCharset } from '../../export/core/mesh3d/mesh3d-naming';
import {
  parseObjObjects,
  parseMtl,
  type ObjectMaterialAssignment,
  type ImportedMaterial,
} from './obj-mtl-parse';
import { resolveImportAppearance } from './resolve-import-appearance';
import type { KnownMaterialResolver } from './known-import-materials';
import { matchObjectsToEntities, type EntityExportIdentity, type MatchedObject } from './match-objects-to-entities';
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
  /**
   * ADR-683 §7 — το manifest baseline (`καθαρό όνομα υλικού → sRGB hex`) από το `.nestor.json`.
   * Επιτρέπει ανίχνευση repaint που κράτησε το όνομα υλικού (βλ. `resolveImportAppearance`).
   * **Μόνο glTF** — το OBJ δεν το περνά (colour-space mismatch, βλ. `import-gltf-appearance`).
   */
  readonly baseline?: ReadonlyMap<string, string>;
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
  /** Πόσα σώματα βάφτηκαν πραγματικά (matched ΚΑΙ ≥1 όψη με αλλαγμένο χρώμα/υλικό — base ή per-face). */
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

type LevelSceneAdapter = ReturnType<typeof createLevelSceneManagerAdapter>;

/** Ίδιο appearance (ίδιο catalog id ΚΑΙ ίδιο flat χρώμα) — για collapse ομοιόμορφης per-face βαφής. */
function sameAppearance(a: FaceAppearance, b: FaceAppearance): boolean {
  return a.materialId === b.materialId && a.colorHex === b.colorHex;
}

/**
 * ADR-678 Φ3 — τα commands βαφής ενός ταιριασμένου object. Με per-face δεδομένα (glTF): κάθε όψη
 * λύνεται ανεξάρτητα με τον ίδιο pure `resolveImportAppearance` (μηδέν αλλαγή εκεί)· αμετάβλητες όψεις
 * → κανένα command. **Collapse σε ΕΝΑ base `'*'`** όταν ΟΛΕΣ οι όψεις βάφτηκαν με το ΙΔΙΟ appearance
 * (idempotent, ένα καθαρό undo — parity με τον ζωντανό «βάψε όλο το στοιχείο»). Χωρίς per-face δεδομένα
 * (OBJ/legacy single-material) → το ανά-στοιχείο `materialName` στο `BASE_FACE_KEY`.
 */
function buildBodyFaceCommands(
  m: MatchedObject,
  mtl: ReadonlyMap<string, ImportedMaterial>,
  resolveKnownId: KnownMaterialResolver,
  baseline: ReadonlyMap<string, string> | undefined,
  adapter: LevelSceneAdapter,
): ICommand[] {
  const faces = m.faceMaterials;
  if (!faces || faces.size === 0) {
    const appearance = resolveImportAppearance(m.materialName, mtl, resolveKnownId, baseline);
    return appearance ? [new SetFaceAppearanceCommand(m.bimId, BASE_FACE_KEY, appearance, adapter)] : [];
  }

  const painted: { faceKey: string; appearance: FaceAppearance }[] = [];
  for (const [faceKey, materialName] of faces) {
    const appearance = resolveImportAppearance(materialName, mtl, resolveKnownId, baseline);
    if (appearance) painted.push({ faceKey, appearance });
  }
  if (painted.length === 0) return [];

  const uniform = painted.length === faces.size
    && painted.every((p) => sameAppearance(p.appearance, painted[0].appearance));
  return uniform
    ? [new SetFaceAppearanceCommand(m.bimId, BASE_FACE_KEY, painted[0].appearance, adapter)]
    : painted.map((p) => new SetFaceAppearanceCommand(m.bimId, p.faceKey, p.appearance, adapter));
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
  const { objects, materials: mtl, charset, baseline } = input;

  // ADR-678 Φ1.1 — τα merged σοβά-skins (synthetic bimId) δεν κάνουν name-match· δρομολογούνται
  // ξεχωριστά (ομοιόμορφος σοβάς ανά ζώνη), αλλιώς θα έπεφταν άδικα στα «χωρίς αντιστοίχιση».
  const finishObjects = objects.filter((o) => isFinishSkinName(o.objectName));
  const bodyObjects = objects.filter((o) => !isFinishSkinName(o.objectName));

  const { identities, levelByBimId } = enumerateEntities(levels);
  const { matched, unmatched } = matchObjectsToEntities(bodyObjects, identities, charset);

  const bodyGroups = matched.map((m) => {
    const levelId = levelByBimId.get(m.bimId);
    if (levelId === undefined) return [] as ICommand[];
    const adapter = createLevelSceneManagerAdapter(levels.getLevelScene, levels.setLevelScene, levelId);
    return buildBodyFaceCommands(m, mtl, resolveKnownId, baseline, adapter);
  });
  const bodyChildren = bodyGroups.flat();

  const finish = buildFinishImportCommands(levels, finishObjects, mtl, resolveKnownId, baseline);
  const children: ICommand[] = [...bodyChildren, ...finish.children];

  if (children.length > 0) {
    getGlobalCommandHistory().execute(
      children.length === 1 ? children[0] : new CompositeCommand(children),
    );
  }

  return {
    objectCount: objects.length,
    matchedCount: matched.length,
    appliedCount: bodyGroups.filter((g) => g.length > 0).length,
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
