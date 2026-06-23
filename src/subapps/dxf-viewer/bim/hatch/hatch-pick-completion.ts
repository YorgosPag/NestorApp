/**
 * Hatch pick-point completion (ADR-507 Φ3 — Τρόπος Β).
 *
 * Pure orchestrator: ΕΝΑ κλικ μέσα σε περιοχή → ανίχνευση κλειστού ορίου (+ νησιά)
 * μέσω του `auto-area-hit` SSoT (half-edge planar face traversal → πιάνει ΔΩΜΑΤΙΑ
 * από πολυγραμμικούς τοίχους χάρη στο `extractLineSegments`) → `HatchEntity`.
 *
 * Καμία React/command εξάρτηση εδώ — ο click handler (`canvas-click-tool-handlers`)
 * παίρνει το entity και το περνά στο `completeEntity` (ίδιο pipeline με τον Τρόπο Α:
 * undo + send-to-back + `drawing:complete` → persistence).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see ../../systems/auto-area/auto-area-hit.ts (room/region detector — κοινό με ghost + «Μέτρηση εμβαδού»)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity, HatchEntity } from '../../types/entities';
import type { Overlay } from '../../overlays/types';
import { getAutoAreaHitResult } from '../../systems/auto-area/auto-area-hit';
import { getHatchDrawDefaults } from './hatch-draw-defaults-store';
import { buildHatchEntityFromRegion } from './hatch-completion';

export interface BuildHatchFromPickParams {
  /** Σημείο κλικ (world coords) μέσα στην περιοχή. */
  readonly worldPoint: Point2D;
  /** Οντότητες της ενεργής σκηνής (DXF + BIM) για ανίχνευση ορίου. */
  readonly entities: ReadonlyArray<Entity>;
  /** Overlays (χρωματιστά layers) ως πρόσθετες πηγές κλειστών περιοχών. */
  readonly overlays: ReadonlyArray<Overlay>;
  /** Τρέχον zoom scale (για zoom-aware snap/gap tolerance). */
  readonly scale: number;
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
  const { worldPoint, entities, overlays, scale, id, layerId } = params;
  const gapTolerance = getHatchDrawDefaults().gapTolerance;
  const result = getAutoAreaHitResult(worldPoint, entities, overlays, scale, gapTolerance);
  if (!result) return null;
  return buildHatchEntityFromRegion(result.polygon, result.holes, id, layerId);
}
