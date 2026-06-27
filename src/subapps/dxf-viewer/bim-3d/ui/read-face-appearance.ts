/**
 * read-face-appearance — ADR-539 Φ4a SSoT. Read counterpart του `applyFaceAppearance`:
 * διαβάζει την τρέχουσα per-face εμφάνιση από το live level-scene (ΟΧΙ undoable —
 * pure read). Κοινό για:
 *   - `FaceContextMenu` (copy μιας όψης → clipboard),
 *   - `use-polygon-clipboard-shortcuts` (Ctrl+C / Ctrl+Shift+C).
 *
 * Πριν ήταν private μέσα στο `FaceContextMenu.tsx` — εξήχθη εδώ ώστε keyboard +
 * context-menu να μοιράζονται ΕΝΑ read (Boy-Scout dedupe, N.0.2).
 *
 * @see ./apply-face-appearance.ts — write SSoT (per-face)
 * @see ./apply-entity-face-appearance-map.ts — write SSoT (entity-level)
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import type { LevelsHookReturn } from '../../systems/levels/useLevels';
import type { FaceAppearance, FaceAppearanceMap } from '../../bim/types/face-appearance-types';

/** Ολόκληρο το `faceAppearance` map της entity από το live scene, ή null. */
export function readEntityFaceAppearanceMap(
  levels: LevelsHookReturn | null,
  bimId: string,
): FaceAppearanceMap | null {
  if (!levels?.currentLevelId) return null;
  const entity = levels.getLevelScene(levels.currentLevelId)?.entities.find((e) => e.id === bimId);
  return (entity as { faceAppearance?: FaceAppearanceMap } | undefined)?.faceAppearance ?? null;
}

/** Η εμφάνιση ΜΙΑΣ όψης από το live scene, ή null όταν αβαφής. */
export function readFaceAppearance(
  levels: LevelsHookReturn | null,
  bimId: string,
  faceKey: string,
): FaceAppearance | null {
  return readEntityFaceAppearanceMap(levels, bimId)?.[faceKey] ?? null;
}
