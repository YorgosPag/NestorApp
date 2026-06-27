/**
 * placement-overlay-fields — SSoT για το **σύνολο** των overlay-meta πεδίων που προσαρτά το
 * placement ghost (`assemblePlacementGhost`) στο `ExtendedSceneEntity`: μαγνητικό πλέγμα
 * (πολικό/καρτεσιανό), δυναμικές διαστάσεις (listening / dx-dy / R-θ), γραμμή(ές)-οδηγός
 * ευθυγράμμισης.
 *
 * Πριν (ADR-544 audit, Giorgio), το ίδιο σύνολο πεδίων διαβαζόταν με **inline structural casts**
 * σε ΔΥΟ σημεία — 2D `drawing-hover-handler` και 3D `placement-overlay-meta` — δηλαδή η γνώση
 * «ποια πεδία φέρει το ghost» ήταν διπλή. Τώρα ζει εδώ, μία φορά· και οι δύο readers κάνουν
 * `entity as PlacementOverlayFields`. Μηδέν διπλότυπη γνώση πεδίων.
 *
 * @see ./placement-grid-meta.ts — buildPlacementGridMeta (παράγει polar/rect grid)
 * @see ./placement-ghost-assembly.ts — assemblePlacementGhost (προσαρτά τα πεδία)
 * @see ../../hooks/drawing/drawing-hover-handler.ts · ../../bim-3d/placement/placement-overlay-meta.ts — readers
 */

import type { PolarDiskGrid } from '../columns/polar-disk-snap';
import type { RectGrid } from '../columns/rect-cartesian-snap';
import type { GhostFaceDimensionsMeta } from '../framing/ghost-face-dim-references';
import type { PlacementAlignmentGuide } from '../framing/placement-alignment-guide';

/** Τα overlay-meta πεδία ενός preview ghost (όλα optional — προσαρτώνται μόνο όταν ισχύουν). */
export interface PlacementOverlayFields {
  /** ADR-398 §3.13 — πολικό μαγνητικό πλέγμα (Polar Magnet, cursor μέσα σε δίσκο). */
  readonly polarDiskGrid?: PolarDiskGrid;
  /** ADR-398 §3.15 — καρτεσιανό μαγνητικό πλέγμα (Cartesian Magnet, cursor μέσα σε ορθογώνιο). */
  readonly rectGrid?: RectGrid;
  /** ADR-508 §dim — δυναμικές διαστάσεις (listening / dx-dy / R-θ) κατά μήκος της παρειάς. */
  readonly faceDimensions?: GhostFaceDimensionsMeta;
  /** ADR-398 §3.20 — γραμμή(ές)-οδηγός ευθυγράμμισης (έως 2 στη γωνία). */
  readonly alignmentGuide?: PlacementAlignmentGuide | readonly PlacementAlignmentGuide[];
}
