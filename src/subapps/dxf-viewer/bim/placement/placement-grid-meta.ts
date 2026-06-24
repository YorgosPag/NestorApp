/**
 * ADR-398 §3.13/§3.15 — placement-guidance **grid meta** (πολικό δίσκου ή καρτεσιανό ορθογωνίου),
 * κοινό SSoT για **κολώνα ΚΑΙ δοκάρι** (Giorgio 2026-06-24, ενοποίηση φαντάσματος πριν το 1ο κλικ).
 *
 * Χτίζει το ορατό πλέγμα (κέντρο/δακτύλιοι/άξονες) γύρω από ένα **σημείο αναφοράς** ώστε ο
 * `drawing-hover-handler` να το ζωγραφίσει ως overlay. Η δομή ανήκει στον στόχο (κύκλος/ορθογώνιο)·
 * το `ref` καθορίζει μόνο το ενεργό δαχτυλίδι/πυκνότητα. **ΙΔΙΟΣ resolver με το snap** (reuse
 * `buildPolarDiskGrid`/`buildRectGrid`) → καμία απόκλιση πλέγματος↔snap.
 *
 * Εξήχθη από το `column-preview-helpers.ts` (ήταν local pure helper) ώστε το beam preview να το
 * μοιράζεται αυτούσιο — μηδέν διπλότυπο.
 *
 * Pure — zero React/DOM/store.
 *
 * @see ../columns/polar-disk-snap.ts — buildPolarDiskGrid / findDiskContaining
 * @see ../columns/rect-cartesian-snap.ts — buildRectGrid / findRectContaining
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md §3.13/§3.15
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { SceneSnapTargets } from '../framing/scene-snap-targets';
import { buildPolarDiskGrid, findDiskContaining, type PolarDiskGrid, type PolarDiskSnapOptions } from '../columns/polar-disk-snap';
import { buildRectGrid, findRectContaining, type RectGrid } from '../columns/rect-cartesian-snap';

/**
 * Χτίζει το placement-guidance πλέγμα (πολικό δίσκου ή καρτεσιανό ορθογωνίου) γύρω από το `ref`. Κενό
 * object όταν ο `ref` δεν είναι εντός κανενός δίσκου/ορθογωνίου. **Κοινό SSoT** column + beam (+ awaitingRotation).
 */
export function buildPlacementGridMeta(
  ref: Readonly<Point2D>,
  targets: Readonly<SceneSnapTargets>,
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): { polarDiskGrid?: PolarDiskGrid; rectGrid?: RectGrid } {
  const disk = findDiskContaining(ref, targets.diskTargets);
  const polarDiskGrid = disk ? buildPolarDiskGrid(ref, disk, sceneUnits, opts) : null;
  const rect = findRectContaining(ref, targets.rectTargets);
  const rectGrid = rect ? buildRectGrid(rect, sceneUnits, opts) : null;
  return { ...(polarDiskGrid ? { polarDiskGrid } : {}), ...(rectGrid ? { rectGrid } : {}) };
}
