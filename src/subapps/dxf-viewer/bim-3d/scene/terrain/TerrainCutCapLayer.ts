/**
 * TerrainCutCapLayer — το **poché χώματος** στην τομή του αναγλύφου (ADR-665 M2).
 *
 * Το τρίτο αδερφάκι του {@link TerrainSceneLayer} (επιφάνεια) και του `TerrainContourLayer`
 * (ισοϋψείς): και τα τρία διαβάζουν τη ΜΙΑ memoised `getTopoSurface()` και κάθονται με τον ίδιο
 * projector + datum, οπότε ο λόφος, οι ισοϋψείς του και η τομή του δεν μπορούν ποτέ να διαφωνήσουν
 * σιωπηλά. Αυτή η κλάση κατέχει **μόνο** την παραγωγή του cap.
 *
 * ── Γιατί δικό του layer και όχι περιεχόμενο του `TerrainSceneLayer` ─────────────────────────
 * Το κριτήριο είναι τα **inputs**. Ο cap εξαρτάται από το `resolveTerrainClipWorldY()` — ενεργό
 * όροφο + `floor3DScope` — που **κανένα** από τα άλλα δύο δεν ακούει και δεν πρέπει να αρχίσει να
 * ακούει (θα ξανα-τριγωνοποιούσαν τον λόφο σε κάθε αλλαγή ορόφου, χωρίς λόγο). Και το σεατ του
 * είναι αντίστροφο και στα δύο πεδία: **χωρίς** display drop, σε clip scope **`'default'`**
 * (ADR-665 M2.6). Ένα layer δεν μπορεί να έχει δύο σεατ.
 *
 * ── Πότε ΔΕΝ υπάρχει cap ────────────────────────────────────────────────────────────────────
 * Κρυμμένο ανάγλυφο (ο visibility gate της βάσης), «Όλοι οι όροφοι», σβηστό `autoClip`, ή στάθμη
 * πάνω από ολόκληρο τον λόφο. Και οι τέσσερις καταλήγουν στο ίδιο: καθαρό περιεχόμενο, `null`
 * inputs — καμία ξεχωριστή διαδρομή που θα μπορούσε να ξεχαστεί.
 *
 * ADR-040: imperative, μηδέν React state.
 *
 * @module bim-3d/scene/terrain/TerrainCutCapLayer
 */

import * as THREE from 'three';
import { getTopoSurface } from '../../../systems/topography/topo-surface';
import { getTerrain3DState } from '../../../systems/topography/terrain-3d-store';
import {
  getActiveWorldToDisplayProjector,
  getGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import {
  getActiveVerticalDatumMm,
  surfaceElevationAtWorldYMm,
} from '../../../systems/topography/vertical-datum';
import { buildTerrainCutCapPlan } from '../../../systems/topography/terrain-cut-cap-geometry';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { CUT_CAP_SEATING, SingleMeshTopoLayer } from './topo-scene-layer-support';
import { resolveTerrainClipWorldY } from './terrain-clip-plane';
import type { TinSurface } from '../../../systems/topography/topo-types';
import type { GeoReference } from '../../../systems/geo-referencing/geo-transform';
import { terrainCapToBufferGeometry } from '../../converters/terrain-cap-to-three';
import { getTerrainCutCapMaterial3D } from '../../materials/terrain-materials-3d';

/**
 * Τα inputs που επιβάλλουν επαναπαραγωγή. Η **διαφάνεια δεν είναι ένα από αυτά** (όπως και στα δύο
 * αδέρφια): αλλαγή διαφάνειας μεταλλάσσει το υλικό, δεν ξανακόβει την επιφάνεια.
 *
 * Το `levelWorldY` είναι εδώ ως κανονικό input και **αυτό** είναι όλη η διαφορά αυτού του layer
 * από τα άλλα δύο. Το `sameInputs()` της βάσης είναι key-driven (`Object.keys`), οπότε μπήκε χωρίς
 * καμία αλλαγή στη σύγκριση — και δεν γίνεται να μείνει σιωπηλά εκτός της.
 */
interface TerrainCapInputs {
  readonly surface: TinSurface;
  /** Three-world Y (μέτρα) του επιπέδου τομής· `null` = καμία κοπή, άρα κανένας cap. */
  readonly levelWorldY: number | null;
  readonly datumMm: number;
  readonly geoRef: GeoReference | null;
}

export class TerrainCutCapLayer extends SingleMeshTopoLayer<TerrainCapInputs> {
  constructor(
    scene: THREE.Object3D,
    markDirty: () => void,
    onRebuilt: (root: THREE.Object3D) => void = () => {},
  ) {
    // Πάνω από τις κοινές συνδρομές (αποτύπωση / ορατότητα / γεωαναφορά) ο cap χρειάζεται τις ΔΥΟ
    // εισόδους της στάθμης: τον ενεργό όροφο και το `floor3DScope` («Όλοι οι όροφοι» ⇒ καμία κοπή).
    // Χωρίς αυτές, η αλλαγή ορόφου θα μετακινούσε το clip plane και ο cap θα έμενε στην παλιά
    // στάθμη — δηλαδή θα αιωρούνταν, ακριβώς το σφάλμα που οι άκοπες ισοϋψείς είχαν στην v1.
    super(scene, 'topo-cut-cap', markDirty, onRebuilt, [
      (rebuild) => useActiveStoreyStore.subscribe(rebuild),
      (rebuild) => useViewMode3DStore.subscribe(rebuild),
    ], CUT_CAP_SEATING);
    this.start();
  }

  protected rebuildGeometry(): void {
    const state = getTerrain3DState();
    const opacity = state.surfaceOpacity[state.style] ?? 1;
    const inputs: TerrainCapInputs = {
      surface: getTopoSurface(),
      levelWorldY: resolveTerrainClipWorldY(),
      datumMm: getActiveVerticalDatumMm(),
      geoRef: getGeoReference(),
    };

    // Αλλαγή μόνο διαφάνειας (το συνηθισμένο σύρσιμο του slider): κανένα input δεν κουνήθηκε →
    // ξανα-εφάρμοσε το (μεταλλαγμένο) υλικό στο ΙΔΙΟ mesh, χωρίς να ξανακοπεί η επιφάνεια.
    if (this.mesh && this.sameInputs(inputs)) {
      this.mesh.material = getTerrainCutCapMaterial3D(opacity);
      this.markDirty();
      return;
    }

    this.clearContent();
    if (inputs.levelWorldY === null) {
      this.lastInputs = null; // καμία κοπή ⇒ καμία τομή να ντυθεί· δεν είναι σφάλμα
      this.markDirty();
      return;
    }

    // ADR-665 M2.3 — από three-world Y πίσω σε υψόμετρο αποτύπωσης. Η αντιστροφή περνά ΚΑΙ από το
    // datum ΚΑΙ από το display drop· παράλειψη του δεύτερου ξεκολλά τον cap 5 cm από την ακμή.
    const levelElevMm = surfaceElevationAtWorldYMm(inputs.levelWorldY, inputs.datumMm);
    const plan = buildTerrainCutCapPlan(inputs.surface, levelElevMm);
    const geometry = terrainCapToBufferGeometry(plan, {
      // ADR-650 §M10f — η υποχρεωτική γέφυρα WORLD→DISPLAY, διαβασμένη εδώ (ακάθαρτο layer) και
      // περασμένη μέσα στον καθαρό converter, ακριβώς όπως το κάνει ο `TerrainSceneLayer`.
      projector: getActiveWorldToDisplayProjector(),
      levelWorldYM: inputs.levelWorldY,
    });
    if (!geometry) {
      // Η στάθμη είναι πάνω από ολόκληρο τον λόφο (ή η επιφάνεια είναι εκφυλισμένη): τίποτα να
      // σχεδιαστεί. Κρατάμε `lastInputs = null` ώστε η επόμενη αλλαγή να ξαναδοκιμάσει.
      this.lastInputs = null;
      this.markDirty();
      return;
    }

    const mesh = new THREE.Mesh(geometry, getTerrainCutCapMaterial3D(opacity));
    mesh.name = 'topo-cut-cap-mesh';
    // Χωρίς σκιές: το poché είναι σχεδιαστική σύμβαση, όχι φυσική επιφάνεια.
    this.seatMesh(mesh, inputs, false);
  }
}
