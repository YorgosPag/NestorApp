/**
 * topo-scene-layers — the topographic layer SET of the 3D scene, built and torn down as one.
 *
 * `ThreeJsSceneManager` held one field per topo layer, and every one was used for exactly two things:
 * construct it, dispose it (ADR-920 Β4.8 Β2.4 audit). Each new layer therefore cost a line in three
 * files (construct · manager · dispose) and pushed the manager over the 500-line limit. The set is now
 * ONE `SceneDisposable`: adding a layer is a change here only, and the construct/dispose ORDER of the
 * layers is written once instead of twice.
 *
 * Construction order = the previous inline order (+ the committed breaklines last); disposal follows it.
 *
 * @module bim-3d/scene/terrain/topo-scene-layers
 * @enterprise ADR-650 — Topography · ADR-665 — Terrain clip · ADR-920 — Breaklines
 */

import type * as THREE from 'three';
import { TerrainSceneLayer } from './TerrainSceneLayer';
import { TerrainContourLayer } from './TerrainContourLayer';
import { TerrainCutCapLayer } from './TerrainCutCapLayer';
import { PointCloudSceneLayer } from './PointCloudSceneLayer';
import { TopoAutoBreaklineCandidateLayer } from './TopoAutoBreaklineCandidateLayer';
import { TopoBreaklineLayer } from './TopoBreaklineLayer';

/** The whole set answers one question to its owner: «tear yourselves down». */
export interface TopoSceneLayers {
  dispose(): void;
}

/**
 * Build every topo layer.
 *
 * @param reapplyClip ADR-665 — every topo layer rebuilds its materials on each rebuild (a fresh material
 *   starts with `clippingPlanes = null`), so the ONE owner of the planes re-asserts them right after.
 *   Passed as a late-bound callback: the layers build — and call rebuild() — BEFORE the section
 *   controller exists.
 */
export function createTopoSceneLayers(
  scene: THREE.Object3D,
  markDirty: () => void,
  reapplyClip: (root: THREE.Object3D) => void,
): TopoSceneLayers {
  const layers: readonly { dispose(): void }[] = [
    // ADR-650 M4 — topographic surface. Subscribes to the survey + display stores itself and
    // rebuilds its mesh from the ONE derived TIN (the same one the 2D contours are cut from).
    new TerrainSceneLayer(scene, markDirty, reapplyClip),
    // ADR-650 M10d — οι ισοϋψείς της ΙΔΙΑΣ επιφάνειας ως draped γραμμές στο πραγματικό υψόμετρο (μία
    // φορά, όχι ανά όροφο). Ξεχωριστό layer από το mesh: εμφανίζεται/κρύβεται μαζί με το έδαφος, αλλά
    // είναι γραμμές (Revit Toposurface contours), ανεξάρτητο από το floor scope.
    new TerrainContourLayer(scene, markDirty, reapplyClip),
    // ADR-665 M2 — η ΕΠΙΦΑΝΕΙΑ της τομής του εδάφους: poché χώματος αντί για κούφιο κέλυφος. Τρίτο
    // αδερφάκι και όχι περιεχόμενο του terrain layer, γιατί ακούει τη ΣΤΑΘΜΗ (ενεργός όροφος +
    // floor scope) που τα άλλα δύο δεν ακούν — και κάθεται σε άλλο clip scope (M2.6): η κοπή που τον
    // γέννησε δεν τον τρώει, οι τομές του κτιρίου τον κόβουν. Ίδιο `reapplyClip` καλλάκι: ένα
    // φρέσκο υλικό ξεκινά με `clippingPlanes = null` και μόνο ο controller τα ξαναβάζει.
    new TerrainCutCapLayer(scene, markDirty, reapplyClip),
    // ADR-650 M8β/Β — το νέφος σημείων του τελευταίου import. Ξεχωριστό layer από το έδαφος: το
    // έδαφος είναι η ΜΕΤΡΗΜΕΝΗ επιφάνεια, το νέφος είναι display-only τεκμήριο (§6) — μπαίνουν και
    // βγαίνουν ανεξάρτητα, και το νέφος δεν συμμετέχει ποτέ σε raycast/snap.
    new PointCloudSceneLayer(scene, markDirty),
    // ADR-650 M8β/Γ — οι ΠΡΟΤΕΙΝΟΜΕΝΕΣ γραμμές ασυνέχειας υπό έγκριση, ως draped γραμμές πάνω στο έδαφος.
    // Ξεχωριστό layer από τις ισοϋψείς: οι ισοϋψείς είναι ΠΡΟΪΟΝ της αποτύπωσης, οι υποψήφιες είναι
    // ΠΡΟΤΑΣΗ που ζει όσο κρατάει ο έλεγχος (§9) — μπαίνουν και βγαίνουν με το review store, όχι με το TIN.
    new TopoAutoBreaklineCandidateLayer(scene, markDirty, reapplyClip),
    // ADR-920 Β4.8 Β2.4 — οι ΔΕΣΜΕΥΜΕΝΕΣ ασυνέχειες, οι περιορισμοί από τους οποίους χτίστηκε το TIN,
    // στο ΔΙΚΟ τους z. Ακούει και τη στάθμη (όπως ο cap) γιατί κόβεται μόνο του στη CPU.
    new TopoBreaklineLayer(scene, markDirty, reapplyClip),
  ];
  return {
    dispose(): void {
      for (const layer of layers) layer.dispose();
    },
  };
}
