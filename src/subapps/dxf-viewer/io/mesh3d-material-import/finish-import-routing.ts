/**
 * finish-import-routing — ADR-678 Φ1.1. Δρομολογεί το C4D υλικό που βάφτηκε πάνω στο **ενιαίο
 * σοβά-δέρμα** (ADR-449 Slice 7 merged silhouette) πίσω στα δομικά μέλη.
 *
 * **Γιατί χρειάζεται ξεχωριστός δρόμος:** ο σοβάς εξάγεται ως ΕΝΑ welded skin ανά κτίριο ανά ζώνη
 * (`structural-finish[-hcol|-hbeam|-hslab|-hup]-<buildingId>`) με **synthetic bimId** — η
 * per-element/per-side ταυτότητα έχει χαθεί γεωμετρικά (Slice X1, non-pickable). Δεν υπάρχει
 * «γονέας» να βρεθεί με name-match (πέφτει στα «χωρίς αντιστοίχιση» → χάνεται). Αντ' αυτού
 * εφαρμόζουμε το υλικό **ομοιόμορφα** σε όλα τα μέλη της ζώνης (Giorgio 2026-07-19: «βάψε όλες τις
 * κολόνες ξύλο») — ταιριάζει με τη φιλοσοφία «ομοιόμορφο κέλυφος» του ADR-449.
 *
 * **SSoT reuse:** ΤΟ ΙΔΙΟ per-face command (`SetFinishFaceOverrideCommand`, ADR-449 PART B) που
 * γράφει το ζωντανό «Paint» — ανά μέλος, ανά κάθετη πλευρά `side:i`. `{materialId}` για catalog id
 * (οδηγεί ΚΑΙ BOQ)· `{colorOverride}` για flat C4D χρώμα (μόνο οπτικό, ΟΧΙ BOQ — texture → flat Kd).
 * Το command αυτο-φιλτράρει (no-op όταν το μέλος δεν έχει ενεργό σοβά ή η όψη δεν είναι πλευρά).
 *
 * **Γνωστός περιορισμός (τίμια):** ο σοβάς είναι building-merged· εφαρμόζουμε ανά **τύπο μέλους**
 * της ζώνης σε ΟΛΟΥΣ τους ορόφους (όχι building-scoped) — το single-building project το θέλει έτσι.
 *
 * @see ../../core/commands/entity-commands/SetFinishFaceOverrideCommand — το ζωντανό «Paint» command
 * @see ../../bim-3d/scene/bim-scene-structural-finish-sync — πηγή των synthetic finish ids
 * @see docs/centralized-systems/reference/adrs/ADR-678-c4d-obj-material-roundtrip-import.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { ICommand } from '../../core/commands/interfaces';
import { extractBim3DEntities } from '../../bim-3d/scene/extract-bim3d-entities';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { SetFinishFaceOverrideCommand } from '../../core/commands/entity-commands/SetFinishFaceOverrideCommand';
import { isFinishActive, type FinishFaceOverride, type StructuralFinishSpec } from '../../bim/finishes/structural-finish-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';
import { getMaterialColorById } from '../../bim/materials/material-color-registry';
import { resolveImportAppearance } from './resolve-import-appearance';
import type { KnownMaterialResolver } from './known-import-materials';
import type { ImportedMaterial, ObjectMaterialAssignment } from './obj-mtl-parse';

/** Τα synthetic bimId ονόματα του merged σοβά ξεκινούν πάντα με αυτό (βλ. finish-sync). */
const FINISH_SKIN_TOKEN = 'structural-finish-';

/** Δομικοί τύποι που κρατούν `StructuralFinishSpec` (οι τοίχοι έχουν δικό σύστημα — ADR-447/511). */
type FinishMemberType = 'column' | 'beam' | 'slab';
const ALL_FINISH_TYPES: readonly FinishMemberType[] = ['column', 'beam', 'slab'];

/** Ελάχιστο structural shape ενός finish-paintable μέλους (mirror `SetFinishFaceOverrideCommand`). */
interface FinishMember {
  readonly id: string;
  readonly params?: {
    readonly finish?: StructuralFinishSpec;
    readonly outline?: { readonly vertices?: readonly unknown[] };
  };
  readonly geometry?: {
    readonly footprint?: { readonly vertices?: readonly unknown[] };
    readonly outline?: { readonly vertices?: readonly unknown[] };
  };
}

/** True όταν το OBJ object είναι merged σοβά-skin (synthetic id), ΟΧΙ πραγματικό στοιχείο. */
export function isFinishSkinName(objectName: string): boolean {
  return objectName.includes(FINISH_SKIN_TOKEN);
}

/**
 * Ποιοι τύποι μελών αφορά ένα finish-skin object, από τη ζώνη στο synthetic id:
 *   `…hcol…` → κολόνες · `…hbeam…` → δοκάρια · `…hslab…` → πλάκες ·
 *   κάθετη σιλουέτα / `…hup…` (top caps) → ΟΛΟΙ οι τύποι (union όλων των μελών).
 */
export function finishTargetTypes(objectName: string): readonly FinishMemberType[] {
  if (objectName.includes('-hcol-')) return ['column'];
  if (objectName.includes('-hbeam-')) return ['beam'];
  if (objectName.includes('-hslab-')) return ['slab'];
  return ALL_FINISH_TYPES;
}

/**
 * `FaceAppearance` (import resolve) → `FinishFaceOverride`.
 *
 * ⚠️ Ο σοβάς (silhouette) παίρνει το ΟΡΑΤΟ χρώμα **μόνο** από το `colorOverride` — ΟΧΙ από το
 * `materialId` (ο finish color-resolver ξέρει μόνο plaster/structural υλικά, ΟΧΙ catalog ids).
 * Άρα βάζουμε ΠΑΝΤΑ `colorOverride`: για γνωστό υλικό → το hex από τον ενοποιημένο
 * `material-color-registry` (ADR-679: wall-covering + δάπεδα + library `bmat_*`) + `materialId` για
 * BOQ· για flat χρώμα → το hex. Library υλικό χωρίς επιλύσιμο χρώμα → μόνο `materialId` (BOQ, το
 * ορατό χρώμα του σοβά έρχεται στο Φ2b με τις υφές). Χωρίς αυτό, ο σοβάς έμενε άβαφος.
 */
function appearanceToFinishOverride(appearance: FaceAppearance): FinishFaceOverride | null {
  if (appearance.materialId) {
    const color = getMaterialColorById(appearance.materialId);
    return color
      ? { materialId: appearance.materialId, colorOverride: color }
      : { materialId: appearance.materialId };
  }
  if (appearance.colorHex) return { colorOverride: appearance.colorHex };
  return null;
}

/** Πλήθος πλευρών του footprint (κολόνα→footprint, δοκάρι→outline, πλάκα→params.outline). */
function finishSideCount(member: FinishMember): number {
  const verts = member.geometry?.footprint?.vertices
    ?? member.geometry?.outline?.vertices
    ?? member.params?.outline?.vertices;
  return verts?.length ?? 0;
}

/**
 * Χτίζει τον χάρτη `τύπος μέλους → override`, ενοποιώντας όλα τα finish-skin objects. Παραλείπει
 * αμετάβλητα υλικά (`resolveImportAppearance` → null, ΡΙΖΑ 2). Μεταγενέστερο object υπερισχύει
 * ανά τύπο (τελευταία βαφή κερδίζει) → κάθε μέλος παίρνει ΕΝΑ override (μηδέν διπλά commands).
 */
function buildTypeOverrides(
  finishObjects: readonly ObjectMaterialAssignment[],
  mtl: ReadonlyMap<string, ImportedMaterial>,
  resolveKnownId: KnownMaterialResolver,
  baseline: ReadonlyMap<string, string> | undefined,
): Map<FinishMemberType, FinishFaceOverride> {
  const byType = new Map<FinishMemberType, FinishFaceOverride>();
  for (const obj of finishObjects) {
    const appearance = resolveImportAppearance(obj.materialName, mtl, resolveKnownId, baseline);
    if (!appearance) continue;
    const override = appearanceToFinishOverride(appearance);
    if (!override) continue;
    for (const type of finishTargetTypes(obj.objectName)) byType.set(type, override);
  }
  return byType;
}

/** Τα finish-paintable μέλη ενός επιπέδου ανά τύπο (μόνο όσα έχουν ενεργό σοβά). */
function activeMembersByType(scene: Parameters<typeof extractBim3DEntities>[0]): Record<FinishMemberType, readonly FinishMember[]> {
  const p = extractBim3DEntities(scene);
  const active = (list: readonly { params?: { finish?: StructuralFinishSpec } }[]): readonly FinishMember[] =>
    (list as readonly FinishMember[]).filter((m) => isFinishActive(m.params?.finish));
  return { column: active(p.columns), beam: active(p.beams), slab: active(p.slabs) };
}

export interface FinishImportResult {
  readonly children: readonly ICommand[];
  /** Πόσα δομικά μέλη πήραν σοβά-override (ανεξαρτήτως πλήθους πλευρών). */
  readonly memberCount: number;
}

/**
 * Παράγει τα `SetFinishFaceOverrideCommand` (ΟΧΙ execute) για όλα τα finish-skin objects, σε όλους
 * τους ορόφους. Ανά μέλος: ΕΝΑ override σε ΚΑΘΕ κάθετη πλευρά (`side:i`) → ομοιόμορφος σοβάς. Κενό
 * αποτέλεσμα όταν κανένα object δεν φέρνει αλλαγή (όλα αμετάβλητα ή κανένα finish member).
 */
export function buildFinishImportCommands(
  levels: LevelsHookReturn,
  finishObjects: readonly ObjectMaterialAssignment[],
  mtl: ReadonlyMap<string, ImportedMaterial>,
  resolveKnownId: KnownMaterialResolver,
  baseline?: ReadonlyMap<string, string>,
): FinishImportResult {
  const byType = buildTypeOverrides(finishObjects, mtl, resolveKnownId, baseline);
  if (byType.size === 0) return { children: [], memberCount: 0 };

  const children: ICommand[] = [];
  let memberCount = 0;

  for (const level of levels.levels) {
    const scene = levels.getLevelScene(level.id);
    if (!scene) continue;
    const membersByType = activeMembersByType(scene);
    const adapter = createLevelSceneManagerAdapter(levels.getLevelScene, levels.setLevelScene, level.id);

    for (const type of ALL_FINISH_TYPES) {
      const override = byType.get(type);
      if (!override) continue;
      for (const member of membersByType[type]) {
        const sides = finishSideCount(member);
        if (sides < 3) continue;
        for (let i = 0; i < sides; i += 1) {
          children.push(new SetFinishFaceOverrideCommand(member.id, `side:${i}`, override, adapter));
        }
        memberCount += 1;
      }
    }
  }

  return { children, memberCount };
}
