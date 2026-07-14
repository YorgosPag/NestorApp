/**
 * PointCloudSceneLayer — το νέφος σημείων (LAS/LAZ) στην 3Δ όψη (ADR-650 M8β/Β).
 *
 * Ο αδελφός του `TerrainSceneLayer`, με την ΙΔΙΑ ιθαγένεια: standalone scene layer, ΟΧΙ BIM
 * entity (§12.3 — το ίδιο επιχείρημα ισχύει αυτούσιο: ο ορισμός του νέφους δεν ζει πάνω σε
 * element, ένα entity θα ήταν περιτύλιγμα ενός store, δηλαδή δεύτερη πηγή αλήθειας). Ο
 * `ThreeJsSceneManager` το κατασκευάζει μία φορά και κάνει `dispose()` στο teardown.
 *
 * 🚨 ADR-650 §6 — VISUALIZATION, ΠΟΤΕ ΓΕΩΜΕΤΡΙΑ ΜΕΤΡΗΣΗΣ:
 * το `Points` βγαίνει ΡΗΤΑ από κάθε raycast (`raycast = () => {}`). Δεν είναι διακοσμητικό:
 * ο 2Δ section picker κάνει `intersectObjects(scene.children, true)` — σαρώνει ΟΛΗ τη σκηνή — και
 * το three κάνει raycast σε `Points` by default. Χωρίς αυτή τη γραμμή ο μηχανικός θα «έπιανε»
 * σημεία νέφους σαν να ήταν μετρημένη γεωμετρία. Δεν είναι: η μετρήσιμη αποτύπωση είναι μόνο το
 * αραιωμένο σύνολο εδάφους στον `TopoPointStore`.
 *
 * Imperative, μηδέν React state (ADR-040): subscribe στον store → `rebuild()` → `markDirty()`.
 *
 * @module bim-3d/scene/terrain/PointCloudSceneLayer
 */

import * as THREE from 'three';
import {
  getPointCloud3DState,
  subscribePointCloud3D,
} from '../../../systems/topography/pointcloud-3d-store';
import { PREVIEW_POINT_SIZE_PX } from '../../../systems/topography/pointcloud/pointcloud-defaults';
import { cloudPreviewToBufferGeometry } from '../../converters/cloud-to-three';
import { disposeObjectTree } from '../dispose-object-tree';

export class PointCloudSceneLayer {
  private readonly root = new THREE.Group();
  private readonly unsubscribe: () => void;
  /**
   * Ιδιόκτητο υλικό (ΟΧΙ singleton του `MaterialCatalog3D` — εκείνος δίνει `MeshStandardMaterial`
   * για στερεά BIM). Σταθερό μέγεθος σε pixel (`sizeAttenuation: false`): ένα νέφος με προοπτική
   * εξασθένηση εξαφανίζεται στο βάθος και ο μηχανικός νομίζει ότι λείπουν δεδομένα — ReCap και
   * CloudCompare κρατούν σταθερό splat για τον ίδιο λόγο.
   */
  private readonly material = new THREE.PointsMaterial({
    size: PREVIEW_POINT_SIZE_PX,
    sizeAttenuation: false,
    vertexColors: true, // ο converter δίνει ΠΑΝΤΑ χρώματα (fallback γκρι όταν λείπει ταξινόμηση)
  });

  private points: THREE.Points | null = null;
  private disposed = false;

  constructor(
    scene: THREE.Object3D,
    private readonly markDirty: () => void,
  ) {
    this.root.name = 'topo-pointcloud';
    scene.add(this.root);
    this.unsubscribe = subscribePointCloud3D(() => this.rebuild());
    this.rebuild();
  }

  /**
   * Πέτα το παλιό νέφος και ξαναχτίσε από το τρέχον state.
   *
   * Rebuild-all, όπως ο `TerrainSceneLayer`: το νέφος είναι immutable buffer — δεν επεξεργάζεται
   * σημείο-σημείο, αντικαθίσταται ολόκληρο σε κάθε import. Όταν είναι κρυμμένο δεν κοστίζει
   * τίποτα (πρώιμη έξοδος πριν από κάθε allocation) και τα GPU buffers ελευθερώνονται αμέσως.
   */
  private rebuild(): void {
    if (this.disposed) return;
    this.clearPoints();

    const { preview, visible } = getPointCloud3DState();
    if (!visible || !preview) {
      this.markDirty();
      return;
    }

    const geometry = cloudPreviewToBufferGeometry(preview);
    if (!geometry) {
      this.markDirty(); // άδειο ή εξ ολοκλήρου μη-πεπερασμένο νέφος — δεν είναι σφάλμα
      return;
    }

    const points = new THREE.Points(geometry, this.material);
    points.name = 'topo-pointcloud-points';
    points.raycast = () => {}; // §6 — ΠΟΤΕ pickable/snappable. Βλ. docstring του module.
    this.root.add(points);
    this.points = points;
    this.markDirty();
  }

  /** Αφαίρεση + απελευθέρωση του τρέχοντος νέφους. Γεωμετρία μόνο — το υλικό ζει όσο το layer. */
  private clearPoints(): void {
    if (!this.points) return;
    this.root.remove(this.points);
    disposeObjectTree(this.points);
    this.points = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe(); // unregister ΠΡΙΝ το dispose — κανένα in-flight rebuild πάνω σε νεκρό layer
    this.clearPoints();
    this.material.dispose(); // ιδιόκτητο, όχι singleton catalog → το ελευθερώνουμε εμείς
    this.root.removeFromParent();
  }
}
