/**
 * ADR-662 Φάση 2β (Δρόμος Γ) — TopoSurfaceEntity builder SSoT.
 *
 * ΕΝΑ construction site για το thin/derived `TopoSurfaceEntity`, ώστε ο interactive
 * producer (`useTopoSurfaceEntity`) ΚΑΙ το silent regenerate-on-load (`regenerate-topo`)
 * να παράγουν το ΙΔΙΟ entity — μηδέν create-logic clone (N.18), μηδέν frame drift.
 *
 * Frame (mirror ισοϋψών): το `topoSurfacePerimeter` δίνει WORLD (ΕΓΣΑ) canonical mm·
 * μετά προβάλλεται στο ενεργό **display frame** μέσω του ΙΔΙΟΥ projector που κινεί τις
 * ισοϋψείς + τον βορρά (`topo-display-frame`, ADR-650 M10/M10f). Identity/unset
 * geo-reference → no-op (backward compatible — μη-geo-referenced survey μένει ως έχει).
 * Έτσι το footprint «κάθεται» πάνω στην κάτοψη ακριβώς εκεί που κάθονται οι ισοϋψείς →
 * το hit-test (Stage A) πέφτει στο σωστό σημείο.
 *
 * Layer name/χρώμα = config constants (structural DXF identifiers, ΟΧΙ user-facing copy —
 * ίδιος κανόνας με τα `TOPO_CONTOUR_*` του `contour-config`, άρα εκτός i18n/N.11).
 *
 * @see ./topo-surface-perimeter.ts — το WORLD footprint (pure core)
 * @see ./persistence/regenerate-topo.ts — projectContoursToLocal (το δίδυμο μονοπάτι)
 * @see ../../types/topo-surface.ts — TopoSurfaceEntity contract
 */

import type { TopoSurfaceEntity } from '../../types/topo-surface';
import type { TopoSurfaceId } from './topo-types';
import { getTopoSurface } from './topo-surface';
import { topoSurfacePerimeter } from './topo-surface-perimeter';
import { getTopoDisplayProjector, projectWorldRings } from './topo-display-frame';

/** DXF layer name for the topo surface footprint — structural id, not UI copy (mirror TOPO_CONTOUR_*). */
export const TOPO_SURFACE_LAYER_NAME = 'TOPO-SURFACE' as const;
/** Default footprint colour — dark olive «terrain border», distinct from the brown contour family. */
export const TOPO_SURFACE_COLOR = '#556B2F' as const;

/**
 * Stable, deterministic entity id per surface (`topo-surface-existing` / `-proposed`), so
 * re-generating REPLACES the one footprint instead of stacking duplicates. NOT a Firestore
 * doc (derived, silently rebuilt on load like the contours) → `setDoc`/enterprise-id (N.6)
 * do not apply; the id only needs to be stable within the scene.
 */
export function topoSurfaceEntityId(surfaceId: TopoSurfaceId): string {
  return `topo-surface-${surfaceId}`;
}

/**
 * Build the `TopoSurfaceEntity` for `surfaceId` on `layerId`, in the display frame. Returns
 * `null` when the surface has no triangulable ground (empty footprint) — the caller then
 * commits nothing (mirror ισοϋψών on an empty survey).
 *
 * ADR-650 §M10f — η προβολή WORLD→display γίνεται από το ΕΝΑ σπίτι (`topo-display-frame`)·
 * παλιότερα ζούσε εδώ ως τοπικό αντίγραφο δίπλα στο δίδυμό του στο `regenerate-topo`.
 */
export function buildTopoSurfaceEntity(
  surfaceId: TopoSurfaceId,
  layerId: string,
): TopoSurfaceEntity | null {
  const footprint = projectWorldRings(
    topoSurfacePerimeter(getTopoSurface(surfaceId)),
    getTopoDisplayProjector(),
  );
  if (footprint.length === 0) return null;
  return {
    id: topoSurfaceEntityId(surfaceId),
    type: 'topo-surface',
    layerId,
    color: TOPO_SURFACE_COLOR,
    surfaceId,
    footprint,
  };
}
