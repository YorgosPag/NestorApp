/**
 * placement-overlay-meta — PURE εξαγωγή του 3D placement overlay meta από το 2D preview ghost
 * (ADR-544). Το `generateColumnPreview` (ΕΝΑ SSoT με το 2D) επιστρέφει ένα `ExtendedSceneEntity`
 * με προσαρτημένα τα overlay meta (πολικό/καρτεσιανό πλέγμα, δυναμικές διαστάσεις, γραμμή-οδηγός)
 * — ΑΚΡΙΒΩΣ τα ίδια πεδία που διαβάζει ο 2D `drawing-hover-handler` για να καλέσει τους painters.
 *
 * Εδώ τα διαβάζουμε με την ΙΔΙΑ δομική ανάγνωση και τα συσκευάζουμε σε `Placement3DMeta` για το
 * store. `null` όταν δεν υπάρχει preview ή κανένα overlay πεδίο → ο overlay σβήνει αυτό το frame.
 *
 * Pure: zero React/DOM/Three — jest-friendly. Τα σημεία μένουν σε **scene units** (ο projector
 * τα μετατρέπει στο 3D), όπως ακριβώς στο 2D.
 *
 * @see ../../hooks/drawing/column-preview-helpers.ts — generateColumnPreview (η πηγή του meta)
 * @see ../stores/Placement3DOverlayStore.ts — ο καταναλωτής
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import type { ExtendedSceneEntity } from '../../hooks/drawing/drawing-types';
import type { PolarDiskGrid } from '../../bim/columns/polar-disk-snap';
import type { RectGrid } from '../../bim/columns/rect-cartesian-snap';
import type { GhostFaceDimensionsMeta } from '../../bim/framing/ghost-face-dim-references';
import type { PlacementAlignmentGuide } from '../../bim/columns/column-tangent-snap';
import type { Placement3DMeta } from '../stores/Placement3DOverlayStore';

/** Τα overlay πεδία όπως προσαρτώνται στο preview ghost (δομική ανάγνωση — μηδέν `any`). */
type PreviewOverlayFields = {
  readonly polarDiskGrid?: PolarDiskGrid;
  readonly rectGrid?: RectGrid;
  readonly faceDimensions?: GhostFaceDimensionsMeta;
  readonly alignmentGuide?: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[];
};

/**
 * Συσκεύασε το overlay meta του preview ghost για το 3D store. `null` όταν `preview` λείπει ή
 * δεν φέρει κανένα overlay πεδίο (καθαρό cursor → ο overlay σβήνει).
 */
export function extractPlacement3DMeta(
  preview: ExtendedSceneEntity | null,
  anchorScene: Readonly<Point2D>,
  elevMm: number,
  sceneUnits: SceneUnits,
): Placement3DMeta | null {
  if (!preview) return null;
  const f = preview as PreviewOverlayFields;
  const polarDiskGrid = f.polarDiskGrid ?? null;
  const rectGrid = f.rectGrid ?? null;
  const faceDimensions = f.faceDimensions ?? null;
  const alignmentGuide = f.alignmentGuide ?? null;
  if (!polarDiskGrid && !rectGrid && !faceDimensions && !alignmentGuide) return null;
  return {
    polarDiskGrid,
    rectGrid,
    faceDimensions,
    alignmentGuide,
    elevMm,
    sceneUnits,
    anchorScene: { x: anchorScene.x, y: anchorScene.y },
  };
}
