/**
 * placement-ghost-3d-contracts — type-keyed registry των 3D placement ghosts
 * (ADR-550 Φ-Ghost).
 *
 * Κάθε οικογένεια με 3D φάντασμα τοποθέτησης (column / wall / beam / furniture /
 * electrical-panel / mep-fixture / mep-segment / mep-manifold / mep-radiator /
 * mep-boiler / mep-water-heater) δηλώνεται ΜΙΑ φορά εδώ ως factory. Τα 11
 * placement hooks (`use-bim3d-*-placement` + ο beam pick hook) instantiate-άρουν
 * το ghost τους ΜΕΣΩ αυτού του registry αντί για `new XxxPlacementGhost(scene)` —
 * έτσι το μητρώο είναι ΖΩΝΤΑΝΟ (production-used) κι ένα νέο ghost εκτός registry δεν
 * μπορεί να συνδεθεί (κλείνει το orphan gap).
 *
 * Adapter, ΟΧΙ rewrite: κάθε entry καλεί τον ΙΔΙΟ constructor `(scene)` που είχε το
 * hook — μηδέν αλλαγή build/update logic. Το `update()` παραμένει ετερογενές μέσα στα
 * hooks· το `satisfies` (ΟΧΙ type-annotation widening) διατηρεί το concrete return
 * type ανά key, ώστε `PLACEMENT_GHOST_3D_FACTORIES.column(scene)` να είναι
 * `ColumnPlacementGhost` με πλήρη type-safety (no `any`).
 *
 * SSoT-binding: το coverage test εγγυάται ότι το σύνολο των types εδώ ταυτίζεται με
 * τα `placementGhost3D: true` του `ENTITY_RENDER_CONTRACTS` (no drift declaration ↔
 * registry) + ότι κάθε factory παράγει πραγματικό ghost (liveness, no-lie).
 *
 * 2D ghost: ΔΕΝ μοντελοποιείται — το 2D preview dispatch είναι triply-scattered
 * (generator if-chain + wysiwyg-BIM + bespoke Canvas2D renderers), χωρίς
 * introspectable seam· ένα 2D πεδίο θα «σάπιζε». Βλ. ADR-550 Φ-Ghost.
 *
 * @see rendering/contract/entity-render-contract.ts — η δηλωτική αυθεντία (placementGhost3D)
 * @see bim-3d/scene/bim-scene-point-contracts.ts — το πρότυπο type-keyed registry (Φ2)
 */

import type * as THREE from 'three';
import type { BimRenderableType } from '../../rendering/contract/renderable-entity-type';
import { ColumnPlacementGhost } from './ColumnPlacementGhost';
import { WallPlacementGhost } from './WallPlacementGhost';
import { BeamFromWallGhost } from './BeamFromWallGhost';
import { FurniturePlacementGhost } from './FurniturePlacementGhost';
import { ElectricalPanelPlacementGhost } from './ElectricalPanelPlacementGhost';
import { MepFixturePlacementGhost } from './MepFixturePlacementGhost';
import { MepSegmentPlacementGhost } from './MepSegmentPlacementGhost';
import { MepManifoldPlacementGhost } from './MepManifoldPlacementGhost';
import { MepRadiatorPlacementGhost } from './MepRadiatorPlacementGhost';
import { MepBoilerPlacementGhost } from './MepBoilerPlacementGhost';
import { MepWaterHeaterPlacementGhost } from './MepWaterHeaterPlacementGhost';

/**
 * Το ελάχιστο κοινό contract των 11 placement ghosts. ΜΟΝΟ `dispose` είναι κοινό σε
 * ΟΛΕΣ τις κλάσεις — ο `BeamFromWallGhost` δεν έχει `setVisible` (API:
 * `showForWall`/`hide`/`dispose`). Το concrete type κάθε ghost διατηρείται μέσω του
 * `satisfies`, οπότε τα hooks βλέπουν τα πλήρη (ετερογενή) `update`/`setVisible` APIs.
 */
export interface PlacementGhost3D {
  dispose(): void;
}

/**
 * Οι `BimRenderableType` που έχουν 3D placement ghost (literal union → η παράλειψη
 * key στο registry παρακάτω γίνεται tsc-error μέσω του `Record<GhostBimType, …>`).
 */
type GhostBimType =
  | 'column'
  | 'wall'
  | 'beam'
  | 'furniture'
  | 'electrical-panel'
  | 'mep-fixture'
  | 'mep-segment'
  | 'mep-manifold'
  | 'mep-radiator'
  | 'mep-boiler'
  | 'mep-water-heater';

/**
 * Το type-keyed factory registry. `satisfies Record<GhostBimType, …>` (ΟΧΙ
 * `Record<string, …>`, ΟΧΙ type-annotation): εγγυάται completeness (κάθε ghost type
 * παρών) ΚΑΙ διατηρεί το concrete return type ανά key.
 */
export const PLACEMENT_GHOST_3D_FACTORIES = {
  column: (s: THREE.Scene) => new ColumnPlacementGhost(s),
  wall: (s: THREE.Scene) => new WallPlacementGhost(s),
  beam: (s: THREE.Scene) => new BeamFromWallGhost(s),
  furniture: (s: THREE.Scene) => new FurniturePlacementGhost(s),
  'electrical-panel': (s: THREE.Scene) => new ElectricalPanelPlacementGhost(s),
  'mep-fixture': (s: THREE.Scene) => new MepFixturePlacementGhost(s),
  'mep-segment': (s: THREE.Scene) => new MepSegmentPlacementGhost(s),
  'mep-manifold': (s: THREE.Scene) => new MepManifoldPlacementGhost(s),
  'mep-radiator': (s: THREE.Scene) => new MepRadiatorPlacementGhost(s),
  'mep-boiler': (s: THREE.Scene) => new MepBoilerPlacementGhost(s),
  'mep-water-heater': (s: THREE.Scene) => new MepWaterHeaterPlacementGhost(s),
} satisfies Record<GhostBimType, (scene: THREE.Scene) => PlacementGhost3D>;

/** Οι renderable types του registry (για το coverage test binding). */
export const PLACEMENT_GHOST_3D_TYPES: readonly BimRenderableType[] =
  Object.keys(PLACEMENT_GHOST_3D_FACTORIES) as GhostBimType[];
