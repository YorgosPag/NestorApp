/**
 * topo-scene-layer-support — shared lifecycle scaffold for the topographic 3D scene layers
 * (ADR-650, N.18 anti-clone). `TerrainSceneLayer` (surface mesh) and `TerrainContourLayer`
 * (draped contour lines) are structural siblings: both are `ThreeJsSceneManager`-owned scene
 * layers that seat a root a hair below internal z=0 and react to the SAME survey / visibility /
 * geo-reference stores with zero React state (ADR-040). This module owns everything that was
 * identical between them — the seating, the shared subscription set, and the whole
 * construct/rebuild/dispose lifecycle ({@link TopoSceneLayer}) — so there is ONE place to change
 * the drop margin, the subscriptions, or the ADR-665 clip re-assertion.
 *
 * @module bim-3d/scene/terrain/topo-scene-layer-support
 * @enterprise ADR-650 — Topography · ADR-665 — Terrain clip at active level · ADR-584 — Anti-Duplication
 */

import * as THREE from 'three';
import { subscribeTopo } from '../../../systems/topography/TopoPointStore';
import { getTerrain3DState, subscribeTerrain3D } from '../../../systems/topography/terrain-3d-store';
import { subscribeGeoReference } from '../../../systems/geo-referencing/geo-reference-store';
import { TERRAIN_DISPLAY_DROP_MM } from '../../../systems/topography/vertical-datum';
import type { ClipScope } from '../../systems/section/section-clip-applicator';
import { lockClipScope } from '../../systems/section/clip-scope-guard';
// ADR-665 M2.5 — και τα δύο χρειάζονται από τη `SingleMeshTopoLayer` (βλ. τεκμηρίωσή της).
import { excludeFromSectionParity } from '../../systems/section/section-parity-overlay';
import { disposeObjectTree } from '../dispose-object-tree';

/** A store subscription: register `cb`, get back an unsubscribe. */
type LayerSubscribe = (cb: () => void) => () => void;

/**
 * Name a topo scene-layer root, sit it (optionally) a hair BELOW internal z=0 (so the ground-floor
 * plan/images at z=0 win from above — «κάτοψη πάνω, έδαφος κάτω») and attach it to the scene.
 * Constant world-space drop of the whole layer (ADR-650 M10d).
 *
 * ADR-665 — also stamps the CLIP SCOPE marker, which the clip applicator inherits down the whole
 * subtree: everything under a `'topo'` root gets the terrain's level cut instead of the building's
 * planes. The marker lives on the ROOT (never on the leaves) so a layer rebuild — which discards
 * and recreates every mesh/line under it — can never lose it.
 *
 * ADR-665 M2 — και τα δύο έγιναν **παράμετροι** ({@link TopoLayerSeating}), γιατί ο cap της τομής
 * απαντά αντίστροφα και στα δύο ερωτήματα. Η προεπιλογή μένει το ανάγλυφο, ώστε τα δύο υπάρχοντα
 * layers να μην αλλάξουν ούτε στο ελάχιστο.
 *
 * Marker, not name-matching: names are cosmetic and a rename would silently break the routing.
 *
 * NOTE the drop needs no clip compensation — `clippingPlanes` are WORLD-space and this offset is
 * already baked into the child world matrices. A plane at world-Y = FFL cuts at world-Y = FFL.
 */
function seatTopoLayerRoot(
  root: THREE.Group,
  scene: THREE.Object3D,
  name: string,
  options: TopoLayerSeating,
): void {
  root.name = name;
  root.position.y = options.dropped ? -TERRAIN_DISPLAY_DROP_MM / 1000 : 0;
  // ADR-665 M2 — ο marker είναι τρικατάστατος στον applicator: `true` → 'topo', `false` → ΡΗΤΗ
  // επαναφορά σε 'default', απών → κληρονομιά. Γράφεται πάντα, ποτέ παραλείπεται: «δεν σφράγισα»
  // δίνει σήμερα το ίδιο αποτέλεσμα μόνο κατά σύμπτωση (τα roots κρέμονται στο `scene`).
  root.userData['topoClipScope'] = options.clipScope === 'topo';
  // ADR-665 Φ2 — και δήλωσέ το ως ΑΠΑΙΤΗΣΗ: αν αύριο κάποιος ξανα-κρεμάσει αυτό το root κάτω από
  // ξένο scope, ο φύλακας το φωνάζει αντί να το ανακαλύψει ο χρήστης ως «χάθηκε το σχέδιο».
  lockClipScope(root, options.clipScope);
  scene.add(root);
}

/**
 * ADR-665 M2 — πώς κάθεται ένα topo layer στη σκηνή. Δύο ερωτήσεις που ΔΕΝ έχουν πάντα την ίδια
 * απάντηση, γι' αυτό είναι δύο πεδία και όχι ένα flag:
 *
 *  - **`dropped`** — παίρνει το layer τη μετατόπιση `TERRAIN_DISPLAY_DROP_MM` (ADR-650 M10d);
 *    Ναι για ό,τι ΕΙΝΑΙ το ανάγλυφο (επιφάνεια, ισοϋψείς) — «κάτοψη πάνω, έδαφος κάτω». **Όχι**
 *    για τον cap της τομής: αυτός κάθεται πάνω στο clip plane, το οποίο ζει σε **world** Y και
 *    δεν αντισταθμίζεται από το drop (το drop είναι ήδη ενσωματωμένο στο ΠΟΥ κόβει το επίπεδο).
 *  - **`clipScope`** — ποια planes τον κόβουν. `'topo'` για το ανάγλυφο· `'default'` για τον cap,
 *    που δεν επιτρέπεται να κοπεί από την κοπή που τον γέννησε (ADR-665 M2.6).
 */
interface TopoLayerSeating {
  readonly dropped: boolean;
  readonly clipScope: ClipScope;
}

/** Το σεατ των δύο αρχικών layers — ανάγλυφο + ισοϋψείς. Byte-for-byte η προ-M2 συμπεριφορά. */
const TERRAIN_SEATING: TopoLayerSeating = { dropped: true, clipScope: 'topo' };

/**
 * ADR-665 M2.6 — το σεατ του cap της τομής: **χωρίς** drop, σε scope **`'default'`**.
 *
 * Ο κανόνας με μία πρόταση: *«είμαι η επιφάνεια που παρήγαγε η τομή του εδάφους· η τομή που με
 * έφτιαξε δεν με τρώει, κάθε τομή του κτιρίου με κόβει.»* Το `'default'` **είναι ήδη** ακριβώς
 * αυτό το σύνολο planes (`combinedPlanes` = axis cuts + section box + crop, χωρίς το terrain
 * plane) — γι' αυτό δεν χρειάστηκε τρίτο scope ούτε μία γραμμή στον `SectionSceneController`.
 */
export const CUT_CAP_SEATING: TopoLayerSeating = { dropped: false, clipScope: 'default' };

/**
 * Wire the subscriptions every topo scene-layer shares — survey edit (re-triangulation), 3D
 * visibility, and the geo-reference «κούμπωμα» that seats the hill under the building (ADR-650
 * M10b) — plus any layer-specific `extra` subscribers (cut-fill reference level / contour config),
 * inserted in their original position between visibility and geo-reference. Every subscription
 * fires the same `rebuild`. Returns the unsubscribe handles in subscription order.
 */
function subscribeTopoLayer(
  rebuild: () => void,
  extra: readonly LayerSubscribe[],
): (() => void)[] {
  return [
    subscribeTopo(rebuild),
    subscribeTerrain3D(rebuild),
    ...extra.map((subscribe) => subscribe(rebuild)),
    subscribeGeoReference(rebuild),
  ];
}

/**
 * The lifecycle every topo scene layer has: seat a root, subscribe, gate on visibility, rebuild on
 * every change, re-assert the clip planes after each rebuild, and tear the whole thing down on
 * `dispose()`. Subclasses supply only what genuinely differs — how to derive their content
 * ({@link rebuildGeometry}) and how to free it ({@link clearContent}).
 *
 * `TInputs` is the layer's geometry-input record: the values that force a re-derivation (surface,
 * datum, geo-reference, plus whatever else the layer reads). Opacity is deliberately NOT one of
 * them anywhere — see {@link sameInputs}.
 *
 * ADR-665 — `rebuild()` wraps `rebuildGeometry()` and re-asserts the clip planes
 * UNCONDITIONALLY. Wrapping instead of calling `onRebuilt` at each of the subclass's rebuild exits
 * is deliberate: freshly built meshes/lines start with `clippingPlanes = null` and the clip owner
 * (`SectionSceneController`) does not watch the survey store, so a forgotten exit path means the
 * layer silently loses its level cut on the next edit. No future return path can forget it here,
 * and the no-change cost is a ~3-node subtree walk.
 */
export abstract class TopoSceneLayer<TInputs extends object> {
  protected readonly root = new THREE.Group();
  private readonly unsubscribes: readonly (() => void)[];
  protected disposed = false;
  /** ADR-650 M10d — inputs the current content was built from; lets an opacity-only change skip rebuild. */
  protected lastInputs: TInputs | null = null;

  /**
   * @param name Scene-graph name for this layer's root (`'topo-terrain'`, `'topo-contours'`).
   * @param onRebuilt ADR-665 — «I rebuilt; re-assert the clip planes on my subtree».
   * @param extra Layer-specific subscriptions (cut-fill reference / contour config), on top of the
   *   shared survey + visibility + geo-reference set.
   * @param seating ADR-665 M2 — drop + clip scope. Default = το ανάγλυφο ({@link TERRAIN_SEATING});
   *   ο cap της τομής είναι η μοναδική εξαίρεση και τη δηλώνει ρητά.
   */
  protected constructor(
    scene: THREE.Object3D,
    name: string,
    protected readonly markDirty: () => void,
    private readonly onRebuilt: (root: THREE.Object3D) => void,
    extra: readonly LayerSubscribe[],
    seating: TopoLayerSeating = TERRAIN_SEATING,
  ) {
    seatTopoLayerRoot(this.root, scene, name, seating);
    this.unsubscribes = subscribeTopoLayer(() => this.rebuild(), extra);
  }

  /**
   * Kick off the first build. Subclasses MUST call this as the LAST statement of their constructor,
   * never the base: a base-constructor build would run before the subclass's field initializers,
   * which would then overwrite the state that build just produced.
   */
  protected start(): void {
    this.rebuild();
  }

  /**
   * Contours belong to the surface — shown with it, hidden with it (Revit Toposurface parity) — so
   * the visibility gate lives here, once, for every topo layer. Cheap when hidden: an invisible
   * layer costs nothing on every survey edit.
   */
  private rebuild(): void {
    if (this.disposed) return;
    if (getTerrain3DState().visible) {
      this.rebuildGeometry();
    } else {
      this.clearContent();
      this.lastInputs = null;
      this.markDirty();
    }
    this.onRebuilt(this.root);
  }

  /**
   * True when every geometry input is identity-equal to the last build. Compares every key of
   * `TInputs` rather than a hand-written list: adding an input to the record automatically makes it
   * invalidating, so a new input can never be silently left out of the comparison and serve stale
   * geometry. Opacity is not part of `TInputs` and so is never compared — an opacity-only change
   * mutates the shared material instead of re-deriving.
   */
  protected sameInputs(next: TInputs): boolean {
    const previous = this.lastInputs;
    if (!previous) return false;
    return (Object.keys(next) as (keyof TInputs)[]).every((key) => previous[key] === next[key]);
  }

  /**
   * Derive this layer's content from the current stores. Called on construct and on every change,
   * but ONLY when the terrain is visible — the base owns that gate.
   */
  protected abstract rebuildGeometry(): void;

  /** Remove + free the current content. Geometry only — materials are catalog singletons. */
  protected abstract clearContent(): void;

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.clearContent();
    this.root.removeFromParent();
  }
}

/**
 * ADR-665 M2.5 — βάση για topo layers που κρατούν **ακριβώς ένα** mesh.
 *
 * Το `TerrainSceneLayer` και το `TerrainCutCapLayer` γεννήθηκαν δίδυμα: ίδιο πεδίο `mesh`, ίδια
 * έδραση (add + parity-exclude + σκιές + bookkeeping), ίδιο `clearContent`. Το CHECK 3.28 τα
 * έπιασε **μέσα στο ίδιο commit** — ο κανονικός τρόπος με τον οποίο γεννιέται sibling clone:
 * αντιγράφεις τον αδερφό επειδή «κάνει ήδη το σωστό».
 *
 * Ό,τι διαφέρει γνήσια μένει παράμετρος: οι **σκιές**. Το ανάγλυφο τις θέλει (το κτίριο πρέπει να
 * ρίχνει πάνω στο χώμα, αλλιώς διαβάζεται σαν να αιωρείται)· το poché **όχι** — είναι σχεδιαστική
 * σύμβαση, όχι φυσική επιφάνεια.
 */
export abstract class SingleMeshTopoLayer<TInputs extends object> extends TopoSceneLayer<TInputs> {
  protected mesh: THREE.Mesh | null = null;

  /**
   * Εδράζει το νέο mesh και κλείνει τον κύκλο ανακατασκευής.
   *
   * Το `excludeFromSectionParity` μπαίνει **εδώ**, όχι στους καλούντες: **καμία** από τις δύο
   * επιφάνειες δεν είναι κλειστό στερεό και καμία δεν έχει `bimId`, άρα και οι δύο θα μετρούσαν σε
   * stencil parity φτιαγμένο για κλειστά στερεά (ADR-665 M2.7). Ένας μελλοντικός τρίτος καταναλωτής
   * αυτής της βάσης έχει **ακριβώς** το ίδιο σχήμα — οπότε το να το θυμάται ο καθένας μόνος του
   * είναι το σφάλμα, όχι η λύση.
   */
  protected seatMesh(mesh: THREE.Mesh, inputs: TInputs, castsAndReceivesShadows: boolean): void {
    excludeFromSectionParity(mesh);
    mesh.castShadow = castsAndReceivesShadows;
    mesh.receiveShadow = castsAndReceivesShadows;
    this.root.add(mesh);
    this.mesh = mesh;
    this.lastInputs = inputs;
    this.markDirty();
  }

  /** Remove + free the current mesh. Geometry only — materials are catalog singletons. */
  protected clearContent(): void {
    if (!this.mesh) return;
    this.root.remove(this.mesh);
    disposeObjectTree(this.mesh);
    this.mesh = null;
  }
}
