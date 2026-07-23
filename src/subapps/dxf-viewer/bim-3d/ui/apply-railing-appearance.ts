/**
 * apply-railing-appearance — ADR-407 Φ8 SSoT. Βάφει κιγκλίδωμα με πλήρες `FaceAppearance` (χρώμα/
 * υλικό/υφή), ΑΚΡΙΒΩΣ όπως το `apply-stair-sub-element-appearance` βάφει σκάλα: το κάγκελο render-άρεται
 * ΑΠΟ τα `params`, οπότε το appearance ζει στα δικά του params (`appearance` = whole-railing base·
 * `componentAppearance[post|baluster|rail]` = per-component override, Revit railing-type). Ίδιο undoable
 * pipeline (`UpdateRailingParamsCommand` → geometry recompute), ΕΝΑ undo.
 *
 * Two-tier μοντέλο (επιβεβαιωμένο big-player research, Revit/ArchiCAD): per-component-role default +
 * explicit override. `applyRailingWholeAppearance` = ο container default (Cinema 4D object tag)·
 * `applyRailingComponentAppearance` = το per-role override (κουπαστή/κάγκελα/κολόνες ξεχωριστά).
 *
 * `value = FaceAppearance` → βάψε/ντύσε· `value = null` → καθάρισε το override.
 *
 * @see ./apply-stair-sub-element-appearance.ts — το ισοδύναμο της σκάλας (mirror pattern)
 * @see bim-3d/materials/railing-material-resolver.ts — resolveRailingMaterial (cascade)
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import { currentLevelAdapter } from './current-level-adapter';
import { getGlobalCommandHistory } from '../../core/commands';
import { UpdateRailingParamsCommand } from '../../core/commands/entity-commands/UpdateRailingParamsCommand';
import type { RailingEntity, RailingParams, RailingComponent } from '../../bim/types/railing-types';
import type { FaceAppearance } from '../../bim/types/face-appearance-types';

/**
 * Κοινό commit SSoT (N.18): resolve adapter + fetch railing + guard + `UpdateRailingParamsCommand`
 * (ΕΝΑ undo, geometry recompute). Ο `mutate` παίρνει τα τρέχοντα params και επιστρέφει τα επόμενα.
 * No-op όταν λείπει επίπεδο ή το entity δεν είναι κάγκελο (fail-safe). Κοινό από whole + component.
 */
function commitRailingParams(
  levels: LevelsHookReturn | null,
  railingId: string,
  mutate: (prev: RailingParams) => RailingParams,
): void {
  const adapter = currentLevelAdapter(levels);
  if (!adapter) return;
  const entity = adapter.getEntity(railingId) as RailingEntity | undefined;
  if (!entity || entity.type !== 'railing') return;
  const prev = entity.params;
  getGlobalCommandHistory().execute(
    new UpdateRailingParamsCommand(railingId, mutate(prev), prev, adapter, false),
  );
}

/**
 * ADR-407 Φ8 — βάφει ΟΛΟ το κάγκελο (whole-railing «base» / Cinema 4D object tag): γράφει το
 * `params.appearance`, που τιμούν ΟΛΑ τα components (εκτός όσων έχουν per-component override).
 * `value=null` → clear. ΕΝΑ undo. No-op όταν λείπει επίπεδο/κάγκελο (fail-safe).
 */
export function applyRailingWholeAppearance(
  levels: LevelsHookReturn | null,
  railingId: string,
  value: FaceAppearance | null,
): void {
  commitRailingParams(levels, railingId, (prev) => ({
    // value=null → appearance: undefined (persist strips → επιστροφή στο element default).
    ...prev,
    appearance: value ?? undefined,
  }));
}

/**
 * ADR-407 Φ8 — βάφει ΕΝΑ component (κουπαστή/κάγκελα/κολόνες) με το per-component override (Revit
 * railing-type material ανά ρόλο). Κερδίζει του whole-railing `appearance`. `value=null` → καθάρισε
 * μόνο αυτού του component το override (τα υπόλοιπα μένουν). ΕΝΑ undo. No-op όταν λείπει επίπεδο/κάγκελο.
 */
export function applyRailingComponentAppearance(
  levels: LevelsHookReturn | null,
  railingId: string,
  component: RailingComponent,
  value: FaceAppearance | null,
): void {
  commitRailingParams(levels, railingId, (prev) => ({
    ...prev,
    componentAppearance: { ...prev.componentAppearance, [component]: value ?? undefined },
  }));
}
