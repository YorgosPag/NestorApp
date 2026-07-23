/**
 * apply-stair-sub-element-appearance — ADR-539 Φ7 SSoT. Βάφει ΜΙΑ υποενότητα παραμετρικής σκάλας
 * (πάτημα/ρίχτι/πλατύσκαλο/πλάκα) με πλήρες `FaceAppearance`, ΑΚΡΙΒΩΣ όπως το `apply-face-appearance`
 * βάφει μια όψη solid — αλλά η σκάλα ΔΕΝ έχει per-face override· κρατά το appearance στα δικά της
 * `params` (`perTreadOverrides`/`perRiserOverrides`/`perLandingOverrides`/`perWaistOverrides`), keyed
 * by the 0-based `stairComponentIndex`. Ίδιο undoable pipeline με τα υπόλοιπα stair edits
 * (`UpdateStairParamsCommand` → associative geometry recompute, ADR-358 §5.1), ΕΝΑ undo.
 *
 * Revit «Paint» / Cinema 4D material tag parity: το ίδιο swatch/χρώμα/υφή που βάφει τοίχο/πλάκα
 * βάφει και σκαλί — η επίλυση σε THREE material γίνεται στο `resolveStairMaterial`
 * (→ `resolveStairAppearanceMaterial`, κοινό SSoT με το per-face solid resolve).
 *
 * `value = FaceAppearance` → βάψε/ντύσε· `value = null` → καθάρισε το appearance override.
 *
 * @see ./apply-face-appearance.ts — το solid ισοδύναμο (per-face)
 * @see bim-3d/materials/stair-material-resolver.ts — resolveStairAppearanceMaterial (SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { StairSubPart } from '../../bim/stairs/stair-sub-element-selection-store';
import { currentLevelAdapter } from './current-level-adapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { UpdateStairParamsCommand } from '../../core/commands/entity-commands/UpdateStairParamsCommand';
import type { StairEntity, StairParams, StairMaterials } from '../../bim/types/stair-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/** Ποιο `params` record κρατά το appearance override κάθε sub-part. */
type OverrideField = 'perTreadOverrides' | 'perRiserOverrides' | 'perLandingOverrides' | 'perWaistOverrides';
const PART_TO_FIELD: Record<StairSubPart, OverrideField> = {
  tread: 'perTreadOverrides',
  riser: 'perRiserOverrides',
  landing: 'perLandingOverrides',
  waist: 'perWaistOverrides',
};

/**
 * Immutable merge: επιστρέφει το `params` record του `field` με το `appearance` του `index` set
 * (ή καθαρισμένο όταν `value === null`). Διατηρεί ΟΛΑ τα υπόλοιπα πεδία του override (π.χ.
 * `material`/`nosing` του tread) και τα άλλα indices — shallow-merge parity με `dispatchStairParamPatch`.
 */
function mergedOverrides(
  params: StairParams,
  field: OverrideField,
  index: number,
  value: FaceAppearance | null,
): StairParamsPatch {
  const current = (params[field] ?? {}) as Readonly<Record<number, { readonly appearance?: FaceAppearance }>>;
  const existing = current[index] ?? {};
  // value=null → appearance: undefined (persist strips it → override επιστρέφει στο default).
  const nextEntry = { ...existing, appearance: value ?? undefined };
  return { [field]: { ...current, [index]: nextEntry } } as StairParamsPatch;
}

type StairParamsPatch = Partial<StairParams>;

/**
 * Κοινό commit SSoT (N.18): resolve adapter + fetch stair + guard + `UpdateStairParamsCommand`
 * (ΕΝΑ undo, geometry recompute). Ο `mutate` παίρνει τα τρέχοντα params και επιστρέφει τα επόμενα.
 * No-op όταν λείπει επίπεδο ή το entity δεν είναι σκάλα (fail-safe). Κοινό από sub-element + whole.
 */
function commitStairParams(
  levels: LevelsHookReturn | null,
  stairId: string,
  mutate: (prev: StairParams) => StairParams,
): void {
  const adapter = currentLevelAdapter(levels);
  if (!adapter) return;
  const entity = adapter.getEntity(stairId) as StairEntity | undefined;
  if (!entity || entity.type !== 'stair') return;
  const prev = entity.params;
  getGlobalCommandHistory().execute(
    new UpdateStairParamsCommand(stairId, mutate(prev), prev, adapter, false),
  );
}

/**
 * Εφαρμόζει (ή καθαρίζει) το appearance ΜΙΑΣ υποενότητας σκάλας μέσω `UpdateStairParamsCommand`
 * (ΕΝΑ undo, geometry recompute). No-op όταν λείπει επίπεδο/σκάλα (fail-safe).
 */
export function applyStairSubElementAppearance(
  levels: LevelsHookReturn | null,
  stairId: string,
  part: StairSubPart,
  index: number,
  value: FaceAppearance | null,
): void {
  commitStairParams(levels, stairId, (prev) => ({
    ...prev, ...mergedOverrides(prev, PART_TO_FIELD[part], index, value),
  }));
}

/**
 * ADR-539 Φ7 — βάφει ΟΛΗ τη σκάλα (mode ΣΩΜΑ / Cinema 4D object material tag): γράφει το
 * `params.materials.appearance`, το «base» που τιμούν ΟΛΑ τα components (εκτός όσων έχουν
 * per-sub-element override). `value=null` → clear. ΕΝΑ undo (UpdateStairParamsCommand).
 * No-op όταν λείπει επίπεδο ή το entity δεν είναι σκάλα (fail-safe).
 */
export function applyStairWholeAppearance(
  levels: LevelsHookReturn | null,
  stairId: string,
  value: FaceAppearance | null,
): void {
  commitStairParams(levels, stairId, (prev) => {
    // value=null → appearance: undefined (persist strips → επιστροφή στα preset/structure defaults).
    const materials: StairMaterials = { ...prev.materials, appearance: value ?? undefined };
    return { ...prev, materials };
  });
}
