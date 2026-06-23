/**
 * Hatch pick-point completion (ADR-507 Φ3 — Τρόπος Β).
 *
 * Pure orchestrator: ΕΝΑ κλικ μέσα σε περιοχή → ανίχνευση δωματίου (+ νησιά) μέσω
 * του ενοποιημένου `resolveHatchPickRegion` SSoT (ΙΔΙΟ detector με «Τοποθέτηση
 * χώρου») → `HatchEntity` με τα τρέχοντα draw-defaults.
 *
 * Καμία React/command εξάρτηση εδώ — ο click handler (`canvas-click-tool-handlers`)
 * παίρνει το entity και το περνά στο `completeEntity` (ίδιο pipeline με τον Τρόπο Α:
 * undo + send-to-back + `drawing:complete` → persistence).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see ./hatch-region-detect.ts (layered room detector — κοινό με το ghost)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, HatchEntity } from '../../types/entities';
import type { Overlay } from '../../overlays/types';
import type { SceneUnits } from '../../utils/scene-units';
import { getHatchDrawDefaults } from './hatch-draw-defaults-store';
import { buildHatchEntityFromRegion } from './hatch-completion';
import { resolveHatchPickRegion } from './hatch-region-detect';

export interface BuildHatchFromPickParams {
  /** Σημείο κλικ (world coords) μέσα στην περιοχή. */
  readonly worldPoint: Point2D;
  /** Οντότητες της ενεργής σκηνής (DXF + BIM) για ανίχνευση ορίου. */
  readonly entities: ReadonlyArray<Entity>;
  /** Overlays (χρωματιστά layers) ως πρόσθετες πηγές κλειστών περιοχών. */
  readonly overlays: ReadonlyArray<Overlay>;
  /** Τρέχον zoom scale (για zoom-aware snap/gap tolerance). */
  readonly scale: number;
  /** Μονάδες σχεδίου — για την units-aware ανοχή βρόχου (ίδια με Place Space). */
  readonly sceneUnits: SceneUnits;
  /** Οριστικό/transient id για το νέο entity. */
  readonly id: string;
  /** Layer id για το νέο entity (default layer αν undefined). */
  readonly layerId: string | undefined;
}

/**
 * Επιστρέφει `HatchEntity` αν το σημείο βρίσκεται μέσα σε κλειστή περιοχή, αλλιώς
 * `null` (καμία περιοχή — ο caller δίνει feedback). Η gap tolerance διαβάζεται από
 * τα draw-defaults (AutoCAD HPGAPTOL) ώστε preview (hover) ≡ commit (click).
 */
export function buildHatchFromPick(params: BuildHatchFromPickParams): HatchEntity | null {
  const { worldPoint, entities, overlays, scale, sceneUnits, id, layerId } = params;
  const gapTolerance = getHatchDrawDefaults().gapTolerance;
  const region = resolveHatchPickRegion({
    worldPoint,
    entities,
    overlays,
    scale,
    sceneUnits,
    gapTolerance,
  });
  if (!region) return null;
  return buildHatchEntityFromRegion(region.outer, region.holes, id, layerId);
}
