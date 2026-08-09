/**
 * `BasemapGroundLayer` — το υπόβαθρο χάρτη στην **τρισδιάστατη** προβολή.
 *
 * Αδερφός του {@link ../grid/cinema4d-grid-floor}: ίδιο πρότυπο ιδιοκτησίας (κατασκευάζεται μία
 * φορά από τον `ThreeJsSceneManager`, `dispose()` στο τέλος), ίδια εγγραφή ως post-FX
 * `'underlay'` ώστε να ελέγχεται σε βάθος από το κτίριο αλλά να μη βάφεται από το SSAO.
 *
 * ## Δεν είναι δεύτερος χάρτης — είναι η ίδια απόφαση, αλλού
 * Τα πλακίδια, το επίπεδο λεπτομέρειας, η προβολή και το πλέγμα παραμόρφωσης έρχονται από τα
 * **ίδια** καθαρά modules που τροφοδοτούν το 2Δ. Εδώ ζει μόνο ό,τι είναι αποκλειστικά
 * τρισδιάστατο: πώς μεταφράζεται η κάμερα σε «τι βλέπω», και ο κύκλος ζωής των αντικειμένων.
 * Ένα store, δύο καταναλωτές — το σχήμα που ήδη χρησιμοποιεί η γεωαναφορά για ισοϋψείς (2Δ) και
 * ανάγλυφο (3Δ).
 *
 * ## ⚠️ Ξαναχτίζει ΜΟΝΟ όταν αλλάξει το σύνολο πλακιδίων
 * Η μέθοδος ανανέωσης καλείται σε κάθε καρέ. Χωρίς τη σύγκριση υπογραφής, κάθε καρέ θα
 * κατέστρεφε και θα ξανάφτιαχνε δεκάδες γεωμετρίες και υφές — δηλαδή ο χάρτης θα δούλευε σωστά
 * και θα ρίχνει τα καρέ στο μηδέν, βλάβη που δεν φαίνεται ως σφάλμα αλλά ως «βαρύ πρόγραμμα».
 */

import * as THREE from 'three';
import { registerPostFxOverlay, OVERLAY_ORDER } from '../post-fx-overlay-pass';
import { worldToDxfPlan } from '../../viewport/coordinate-transforms';
import {
  resolveBasemapPaint,
  type BasemapContent,
} from '../../../systems/basemap/basemap-paint-decision';
import {
  getBasemapDisplayProjector,
  worldMmToGeographic,
} from '../../../systems/basemap/basemap-projection';
import { chooseZoomLevel, tilesForDisplayRect } from '../../../systems/basemap/basemap-tile-model';
import { buildTileWarpMesh } from '../../../systems/basemap/basemap-warp';
import { getTileImage } from '../../../systems/basemap/basemap-tile-cache';
import { buildTileGeometry, createTileMaterial } from '../../../systems/basemap/basemap-3d-geometry';
import type { TileId } from '../../../systems/basemap/web-mercator';

/**
 * Πόσο κάτω από το επίπεδο εργασίας κάθεται ο χάρτης, σε mm κάτοψης. Δέκα χιλιοστά είναι αρκετά
 * ώστε ο οδηγός βάθους να μην ταλαντεύεται, και πολύ λίγα ώστε να φαίνεται κενό από πλάγια όψη.
 */
const BASEMAP_ELEVATION_MM = -10;

/**
 * Ισοδύναμη κλίμακα «εικονοστοιχεία ανά mm» για την τρισδιάστατη κάμερα.
 *
 * Το 3Δ δεν έχει `scale` όπως το 2Δ· έχει **απόσταση**. Η μετάφραση είναι: ένα αντικείμενο στην
 * απόσταση του στόχου καλύπτει τόσα εικονοστοιχεία όσα το ύψος του παραθύρου δια το ορατό ύψος
 * στη θέση του στόχου. Αυτό δίνει στον κοινό επιλογέα επιπέδου την **ίδια** ερώτηση που του
 * κάνει το 2Δ, οπότε οι δύο προβολές δεν ζητούν διαφορετική λεπτομέρεια για την ίδια σκηνή.
 */
function pixelsPerMmForCamera(camera: THREE.Camera, distanceM: number, viewportHeightPx: number): number {
  if (!(camera instanceof THREE.PerspectiveCamera) || distanceM <= 0) return 0;
  const visibleHeightM = 2 * distanceM * Math.tan((camera.fov * Math.PI) / 360);
  if (visibleHeightM <= 0) return 0;
  return viewportHeightPx / (visibleHeightM * 1000);
}

/** Η υπογραφή ενός συνόλου πλακιδίων — αλλάζει μόνο όταν αλλάζει πραγματικά τι πρέπει να δείχνει. */
function tileSetSignature(sourceId: string, opacity: number, tiles: readonly TileId[]): string {
  if (tiles.length === 0) return `${sourceId}|${opacity}|∅`;
  const first = tiles[0];
  const last = tiles[tiles.length - 1];
  return `${sourceId}|${opacity}|${first.z}|${first.x},${first.y}|${last.x},${last.y}|${tiles.length}`;
}

export class BasemapGroundLayer {
  private readonly root = new THREE.Group();
  private readonly unregister: () => void;
  private signature = '';
  /** Πλακίδια που ζητήθηκαν αλλά δεν είχαν φτάσει — αναγκάζουν επανέλεγχο στο επόμενο καρέ. */
  private pendingTiles = false;

  constructor(
    scene: THREE.Object3D,
    private readonly getCamera: () => THREE.Camera,
    private readonly getTarget: () => THREE.Vector3,
    private readonly getViewportHeightPx: () => number,
  ) {
    this.root.visible = false; // overlay-owned (συμβόλαιο ADR-537)
    this.unregister = registerPostFxOverlay(
      scene,
      () => this.overlayRoots(),
      'underlay',
      OVERLAY_ORDER.BASEMAP,
    );
  }

  /**
   * Πάροχος overlay: ανανεώνει και επιστρέφει τη ρίζα, ή τίποτα όταν ο χάρτης δεν ισχύει.
   *
   * Η άρνηση έρχεται από τη **ΜΙΑ** απόφαση (`basemap-paint-decision`) — την ίδια που ρωτά και
   * ο ζωγράφος του 2Δ. Περιλαμβάνει τον όρο της άδειας: χωρίς επιφάνεια απόδοσης στην οθόνη,
   * αυτό το στρώμα **δεν** ζωγραφίζει, όσο κι αν ο χρήστης έχει ανάψει τον χάρτη αλλού.
   */
  private overlayRoots(): readonly THREE.Object3D[] {
    if (!resolveBasemapPaint().show) {
      this.clearTiles();
      // ⚠️ Η υπογραφή μηδενίζεται **εδώ** και όχι μέσα στο `clearTiles`: εκείνο καλείται και από
      // το `rebuild`, όπου ο μηδενισμός θα ακύρωνε την υπογραφή που μόλις γράφτηκε ⇒ ξαναχτίσιμο
      // δεκάδων γεωμετριών σε **κάθε** καρέ. Χωρίς τον μηδενισμό όμως, ένα σβήσιμο-και-άναμμα
      // χωρίς κίνηση κάμερας θα υπολόγιζε την ίδια υπογραφή, θα έβγαινε νωρίς, και ο χάρτης θα
      // έμενε άδειος μέχρι ο χρήστης να κουνήσει την προβολή.
      this.signature = '';
      return [];
    }
    this.refresh();
    return this.root.children.length > 0 ? [this.root] : [];
  }

  /** Ξαναχτίζει τα πλακίδια αν — και μόνο αν — άλλαξε το σύνολο ή έφτασαν εικόνες που έλειπαν. */
  private refresh(): void {
    const decision = resolveBasemapPaint();
    if (!decision.show) return;
    const { source, opacity } = decision.content;
    const camera = this.getCamera();
    const target = this.getTarget();
    const distanceM = camera.position.distanceTo(target);
    const pixelsPerMm = pixelsPerMmForCamera(camera, distanceM, this.getViewportHeightPx());
    if (pixelsPerMm <= 0) return;

    const projector = getBasemapDisplayProjector();
    const rect = this.visibleRectAround(target, distanceM);
    const centreDisplay = { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
    const latitude = this.latitudeAt(centreDisplay, projector);
    const zoom = chooseZoomLevel({ pixelsPerMm, devicePixelRatio: 1, latitude, source });
    const selection = tilesForDisplayRect(rect, zoom, projector);

    const signature = tileSetSignature(source.id, opacity, selection.tiles);
    if (signature === this.signature && !this.pendingTiles) return;
    this.signature = signature;
    this.rebuild(decision.content, selection.tiles, projector, pixelsPerMm);
  }

  /** Το ορατό ορθογώνιο σε mm κάτοψης, γύρω από τον στόχο της κάμερας. */
  private visibleRectAround(target: THREE.Vector3, distanceM: number) {
    const plan = worldToDxfPlan(target);
    // Ο συντελεστής καλύπτει με άνεση το οπτικό πεδίο χωρίς να ζητά πλακίδια πολύ έξω από αυτό·
    // το ταβάνι πλήθους του μοντέλου προστατεύει ούτως ή άλλως από υπερβολή.
    const halfSpanMm = Math.max(distanceM, 1) * 1000;
    return {
      minX: plan.x - halfSpanMm, maxX: plan.x + halfSpanMm,
      minY: plan.y - halfSpanMm, maxY: plan.y + halfSpanMm,
    };
  }

  /** Το γεωγραφικό πλάτος στο κέντρο του ορατού — καθορίζει την παραμόρφωση Mercator. */
  private latitudeAt(
    centreDisplay: { x: number; y: number },
    projector: ReturnType<typeof getBasemapDisplayProjector>,
  ): number {
    const world = projector ? projector.unproject(centreDisplay.x, centreDisplay.y) : centreDisplay;
    return worldMmToGeographic(world.x, world.y).lat;
  }

  /** Καταστρέφει τα τρέχοντα πλακίδια και χτίζει τα νέα. */
  private rebuild(
    content: BasemapContent,
    tiles: readonly TileId[],
    projector: ReturnType<typeof getBasemapDisplayProjector>,
    pixelsPerMm: number,
  ): void {
    this.clearTiles();
    const { source, opacity } = content;
    let missing = false;
    for (const tile of tiles) {
      const image = getTileImage(source, tile);
      if (!image) {
        missing = true;
        continue;
      }
      const mesh = buildTileWarpMesh(tile, projector, pixelsPerMm);
      const geometry = buildTileGeometry(mesh, BASEMAP_ELEVATION_MM);
      const material = createTileMaterial(image, opacity);
      const object = new THREE.Mesh(geometry, material);
      object.renderOrder = OVERLAY_ORDER.BASEMAP;
      object.frustumCulled = false;
      this.root.add(object);
    }
    this.pendingTiles = missing;
  }

  /** Αποδέσμευση γεωμετριών και υφών — αλλιώς κάθε ξαναχτίσιμο διαρρέει μνήμη GPU. */
  private clearTiles(): void {
    for (const child of this.root.children) {
      if (!(child instanceof THREE.Mesh)) continue;
      child.geometry.dispose();
      const material = child.material;
      if (material instanceof THREE.MeshBasicMaterial) {
        material.map?.dispose();
        material.dispose();
      }
    }
    this.root.clear();
  }

  dispose(): void {
    this.unregister();
    this.clearTiles();
  }
}
