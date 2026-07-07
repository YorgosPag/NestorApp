/**
 * ADR-581 Φ6 — Match/Transfer live-ghost preview entity builder (SSoT).
 *
 * Χτίζει την «προεπισκόπηση» οντότητα που ζωγραφίζει το live hover ghost της
 * σύριγγας: παίρνει τον στόχο + τα coerced patches (`collectMatchPatches`, ΤΟ ΙΔΙΟ
 * που τρέχει το commit) και επιστρέφει ένα κλώνο με:
 *   - scene κανάλι  → merge στα top-level scene πεδία (style / styleOverride),
 *                     καθρέφτης του `UpdateEntityCommand`.
 *   - params κανάλι → merge στα `params` + **recompute** `geometry` μέσω των ΙΔΙΩΝ
 *                     `compute{Kind}Geometry` που καλεί το `Update{Kind}ParamsCommand`.
 *
 * Έτσι το φάντασμα ΕΙΝΑΙ byte-identical με το αποτέλεσμα του click-commit
 * (ghost ≡ commit) — δεν επανεφευρίσκει mapping/coercion/geometry.
 *
 * ΣΗΜΕΙΩΣΗ (pending-ratchet): ο τύπος `type→compute*Geometry` ζει ήδη σε 3 σημεία
 * (`Update*ParamsCommand` · `apply-parametric-box-preview` grip-drag · εδώ). Δεν
 * ενοποιείται τώρα (διαφορετικά inputs/context)· βλ. `.claude-rules/pending-ratchet-work.md`.
 *
 * @see match-transfer-applier — `collectMatchPatches` (η πηγή των patches)
 * @see core/commands/entity-commands/UpdateColumnParamsCommand — ο commit-side καθρέφτης
 */

import type { EntityType } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Channelled } from './match-transfer-applier';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { computeSlabGeometry } from '../../bim/geometry/slab-geometry';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { computeStairGeometry } from '../../bim/geometry/stairs/StairGeometryService';
import type { ColumnParams } from '../../bim/types/column-types';
import type { BeamParams } from '../../bim/types/beam-types';
import type { SlabParams } from '../../bim/types/slab-types';
import type { WallParams, WallKind } from '../../bim/types/wall-types';
import type { StairParams } from '../../bim/types/stair-types';

/** Top-level params record — flat merge only (mirror `match-params-command-builder`). */
type ParamsRecord = Readonly<Record<string, unknown>>;

/**
 * Ξαναϋπολογίζει `geometry` από τα (patched) `params`, μέσω ΕΝΟΣ switch που καλεί
 * τα ΥΠΑΡΧΟΝΤΑ `compute{Kind}Geometry` — τα ΙΔΙΑ που τρέχει το commit path, ώστε το
 * ghost να ταυτίζεται με το τελικό αποτέλεσμα. `opening` χρειάζεται host-wall context
 * (μη διαθέσιμο στο ghost), οπότε επιστρέφει `null` → style-only preview· ό,τι δεν
 * είναι parametric kind → `null`.
 */
export function recomputeParametricGeometry(
  type: EntityType,
  params: ParamsRecord,
  wallKind: WallKind = 'straight',
): unknown | null {
  switch (type) {
    case 'column': return computeColumnGeometry(params as unknown as ColumnParams);
    case 'beam':   return computeBeamGeometry(params as unknown as BeamParams);
    case 'slab':   return computeSlabGeometry(params as unknown as SlabParams);
    case 'stair':  return computeStairGeometry(params as unknown as StairParams);
    case 'wall':   return computeWallGeometry(params as unknown as WallParams, wallKind);
    default:       return null; // opening (host-wall context) + μη-parametric → μόνο style
  }
}

/**
 * Χτίζει την preview οντότητα ενός στόχου από τα coerced patches. Καθρέφτης του
 * commit: scene πεδία → top-level merge (`UpdateEntityCommand`)· params → merge +
 * geometry recompute (`Update{Kind}ParamsCommand.applyPatch`). Καθαρή συνάρτηση —
 * ΠΟΤΕ δεν μεταλλάσσει το `target` (πάντα shallow clone).
 */
export function buildMatchPreviewEntity(
  target: DxfEntityUnion,
  targetType: EntityType,
  patches: Channelled,
): DxfEntityUnion {
  const { scenePatch, paramsPatch } = patches;
  const merged: Record<string, unknown> = { ...(target as object) };

  // scene κανάλι → top-level scene πεδία (raw style / BIM styleOverride).
  if (Object.keys(scenePatch).length > 0) Object.assign(merged, scenePatch);

  // params κανάλι → params merge + geometry recompute (ghost ≡ commit).
  if (Object.keys(paramsPatch).length > 0) {
    const prevParams = (target as { params?: Record<string, unknown> }).params;
    if (prevParams) {
      const nextParams = { ...prevParams, ...paramsPatch };
      merged.params = nextParams;
      const wallKind = (target as { kind?: WallKind }).kind ?? 'straight';
      const geometry = recomputeParametricGeometry(targetType, nextParams, wallKind);
      if (geometry) merged.geometry = geometry;
    }
  }

  return merged as unknown as DxfEntityUnion;
}
