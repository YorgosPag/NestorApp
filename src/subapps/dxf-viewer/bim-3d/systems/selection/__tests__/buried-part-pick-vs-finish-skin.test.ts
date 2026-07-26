/**
 * ADR-715 Φ0 — ΤΟ ΑΝΟΙΧΤΟ ΡΙΣΚΟ: κλέβει ο ΣΟΒΑΣ το κλικ μπροστά από τον πυρήνα;
 *
 * Το `buried-face-highlight.test.ts` απέδειξε ότι ο `raycastBimFace` ξεχωρίζει τη θαμμένη ζώνη —
 * αλλά σε group που περιείχε **ΜΟΝΟ** τον πυρήνα. Στη ζωντανή σκηνή μπροστά από τον πυρήνα
 * κάθεται το ενιαίο δέρμα σοβά (ADR-449 Slice 7), ένα ΞΕΧΩΡΙΣΤΟ mesh σε **μεγαλύτερο** offset
 * από την παρειά — δηλαδή **πιο κοντά στην κάμερα**. Αν ήταν pickable, κάθε κλικ σε σοβατισμένη
 * όψη θα γύριζε το synthetic `bimId` του σοβά ολόκληρου του κτιρίου (`structural-finish-<id>`,
 * `stampBimIdentity`) και ΚΑΘΕ σχέδιο επιλογής κοντόστυλου θα ήταν άκυρο από τη ρίζα του.
 *
 * ⚠️ **Γιατί δεν αρκεί ο clamp του ADR-713.** Ο σοβάς κόβεται στη στάθμη εδάφους, οπότε
 * *κανονικά* δεν υπάρχει καθόλου δέρμα στη θαμμένη ζώνη (`structural-finish-grade-clamp.test.ts`).
 * Εδώ ο clamp είναι **ΕΠΙΤΗΔΕΣ ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΟΣ** (δεν περνάμε `columnGradeById`), ώστε το
 * δέρμα να καλύπτει ΟΛΟ το ύψος — ακριβώς το σενάριο που περιγράφει το §6 του handoff
 * («χτυπήθηκε όψη του σοβά, που καλύπτει την εκτεθειμένη ζώνη σε όλο της το ύψος»). Άρα το
 * suite δεν επαληθεύει τον clamp: επαληθεύει ότι η επιλογή κοντόστυλου στέκει **ΑΚΟΜΗ ΚΑΙ ΑΝ**
 * ο clamp αστοχήσει. Δύο ανεξάρτητες δικλείδες για δύο ανεξάρτητες αστοχίες.
 *
 * Η μηχανή που το κάνει σωστό είναι το `makeSkinNonPickable` (ADR-449 Slice X1): no-op
 * `raycast` σε κάθε mesh του δέρματος → η ακτίνα **περνά μέσα του**. Αυτό το suite είναι η
 * δικλείδα του: αφαίρεσε το και τα tests εδώ κοκκινίζουν (mutation-verified).
 *
 * @see ../../../converters/structural-finish-silhouette-3d.ts — makeSkinNonPickable
 * @see ./buried-face-highlight.test.ts — η γεωμετρία του overlay (ADR-715 Φ0, ήδη κλειστή)
 */

import * as THREE from 'three';
import { raycastBimFace, raycastBimGroup } from '../../raycaster/BimEntityRaycaster';
import { columnToMesh } from '../../../converters/BimToThreeConverter';
import { buildStructuralSilhouetteSkin } from '../../../converters/structural-finish-silhouette-3d';
import { computeStructuralFinishSilhouette } from '../../../../bim/finishes/structural-finish-scene-silhouette';
import {
  buildDefaultColumnParams,
  buildColumnEntity,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';
import type { StructuralFinishSpec } from '../../../../bim/finishes/structural-finish-types';

/** Πέδιλο 1 m κάτω από τη nominal βάση → θαμμένη ζώνη 1 m (default: έδαφος στο FFL). */
const FOOTING_TOP_ABS_MM = -1000;
/** World Y (m) μέσα στη θαμμένη ζώνη [−1, 0] και μέσα στην ανωδομή [0, 3]. */
const Y_IN_BURIED = -0.5;
const Y_IN_EXPOSED = 0.5;

/** Παχύς σοβάς ώστε το δέρμα να πέφτει ΣΙΓΟΥΡΑ μπροστά από την παρειά του πυρήνα. */
const SKIN_SPEC: StructuralFinishSpec = {
  enabled: true,
  interiorMaterialId: 'mat-plaster-int',
  exteriorMaterialId: 'mat-plaster-ext',
  thickness: 25,
  exteriorThickness: 25,
};

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Ο πυρήνας, εδρασμένος σε πέδιλο (`suppressFinishSkin` → σκέτο faced mesh, όπως στη σκηνή). */
function buriedColumnMesh(column: ColumnEntity): THREE.Mesh {
  return columnToMesh(
    column, 0, '0', 0, undefined, undefined, undefined, [], [], true,
    FOOTING_TOP_ABS_MM,
  ) as THREE.Mesh;
}

/**
 * Το ενιαίο δέρμα σοβά της ΙΔΙΑΣ κολώνας, **ΧΩΡΙΣ** clamp στάθμης — άρα από το πέδιλο
 * (−1000) ως την κορυφή. Το footprint διαβάζεται από το ΙΔΙΟ entity, ώστε δέρμα και
 * πυρήνας να είναι εγγυημένα ομόκεντρα (καμία hardcoded συντεταγμένη να αποκλίνει).
 */
function fullHeightFinishSkin(column: ColumnEntity): THREE.Group {
  const bands = computeStructuralFinishSilhouette({
    columns: [{
      id: column.id,
      params: { finish: SKIN_SPEC, sceneUnits: 'mm', baseOffset: 0, height: column.params.height },
      geometry: { footprint: { vertices: column.geometry.footprint.vertices } },
    }],
    beams: [],
    walls: [],
    floorElevationMm: 0,
    columnExtents: new Map([[column.id, { zBotMm: FOOTING_TOP_ABS_MM, zTopMm: column.params.height }]]),
    // ΚΑΜΙΑ `columnGradeById` — ο clamp του ADR-713 είναι επίτηδες εκτός (βλ. header).
  });
  const skin = buildStructuralSilhouetteSkin(bands, 'mm', 0, '0', 'structural-finish-test');
  if (!skin) throw new Error('finish skin fixture empty');
  return skin;
}

/** Ελάχιστο dom stub: μόνο το rect χρησιμοποιεί ο `clientToNdc`. Κέντρο = NDC (0,0). */
const domStub = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
} as unknown as HTMLElement;

/** Group με πυρήνα ΚΑΙ δέρμα ως **αδέλφια** — ακριβώς όπως τα προσθέτει το scene sync. */
function sceneWithCoreAndSkin(): { group: THREE.Group; column: ColumnEntity; skin: THREE.Group } {
  const column = flatColumn();
  const group = new THREE.Group();
  const skin = fullHeightFinishSkin(column);
  group.add(skin);                      // ΠΡΩΤΑ το δέρμα (μπροστά, πιο κοντά στην κάμερα)
  group.add(buriedColumnMesh(column));  // …και πίσω του ο πυρήνας
  group.updateMatrixWorld(true);
  return { group, column, skin };
}

/** Οριζόντια κάμερα στο ύψος `worldY`, κοιτώντας την κολώνα από +Z. */
function cameraAt(worldY: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, worldY, 10);
  camera.lookAt(0, worldY, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/** Bounding box (world) ενός object — για τους ελέγχους αξιοπιστίας του fixture. */
function worldBox(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}

describe('ADR-715 Φ0 — το δέρμα σοβά ΔΕΝ κλέβει το κλικ του κοντόστυλου', () => {
  /**
   * ΕΛΕΓΧΟΙ ΑΞΙΟΠΙΣΤΙΑΣ ΤΟΥ FIXTURE. Χωρίς αυτούς, ένα δέρμα που (λόγω μελλοντικής αλλαγής)
   * δεν καλύπτει τη ζώνη ή δεν κάθεται μπροστά θα έκανε τα επόμενα tests να περνούν **κενά**:
   * θα «αποδεικνύαμε» ότι ο σοβάς δεν κλέβει το κλικ, επειδή απλώς δεν ήταν εκεί.
   */
  it('το fixture είναι όντως αντίπαλο: το δέρμα καλύπτει τη ΘΑΜΜΕΝΗ ζώνη', () => {
    const box = worldBox(sceneWithCoreAndSkin().skin);
    expect(box.min.y).toBeLessThanOrEqual(Y_IN_BURIED);
    expect(box.max.y).toBeGreaterThanOrEqual(Y_IN_EXPOSED);
  });

  it('το fixture είναι όντως αντίπαλο: το δέρμα κάθεται ΜΠΡΟΣΤΑ από τον πυρήνα', () => {
    const { group, column, skin } = sceneWithCoreAndSkin();
    const core = group.children.find((c) => c.userData['bimId'] === column.id);
    if (!core) throw new Error('core mesh missing from fixture');
    // Η κάμερα κοιτά από +Z → «μπροστά» = μεγαλύτερο max.z.
    expect(worldBox(skin).max.z).toBeGreaterThan(worldBox(core).max.z);
  });

  it('ΤΟ ΚΡΙΣΙΜΟ: ακτίνα στη θαμμένη ζώνη → `buried:i` του ΠΥΡΗΝΑ, όχι ο σοβάς', () => {
    const { group, column } = sceneWithCoreAndSkin();
    const hit = raycastBimFace(group, cameraAt(Y_IN_BURIED), domStub, 50, 50);
    expect(hit?.bimId).toBe(column.id);
    expect(hit?.faceKey).toMatch(/^buried:\d+$/);
  });

  it('ακτίνα πάνω από τη στάθμη → `side:i` του πυρήνα (η ανωδομή μένει ανέπαφη)', () => {
    const { group, column } = sceneWithCoreAndSkin();
    const hit = raycastBimFace(group, cameraAt(Y_IN_EXPOSED), domStub, 50, 50);
    expect(hit?.bimId).toBe(column.id);
    expect(hit?.faceKey).toMatch(/^side:\d+$/);
  });

  /**
   * Ο δρόμος του **ΚΑΝΟΝΙΚΟΥ** mode (εκτός «ΠΟΛΥΓΩΝΑ»): εκεί το κλικ περνά από τον
   * `raycastBimGroup`, που επιστρέφει το **πρώτο** tagged hit ΧΩΡΙΣ να προτιμά faced όψεις.
   * Άρα είναι ο **αυστηρότερος** έλεγχος: ένα pickable δέρμα θα κέρδιζε εδώ ακόμη κι αν το
   * `raycastBimFace` κατάφερνε να το προσπεράσει.
   */
  it('ΚΑΝΟΝΙΚΟ mode: το κλικ επιλέγει την ΚΟΛΩΝΑ, ποτέ το synthetic id του σοβά', () => {
    const { group, column } = sceneWithCoreAndSkin();
    for (const y of [Y_IN_BURIED, Y_IN_EXPOSED]) {
      const hit = raycastBimGroup(group, cameraAt(y), domStub, 50, 50);
      expect(hit?.bimId).toBe(column.id);
      expect(hit?.bimType).toBe('column');
    }
  });

  it('κάτω από τη στάθμη ΔΕΝ υπάρχει άλλο pickable mesh: ο πυρήνας είναι μόνος του εκεί', () => {
    // ADR-713 §3.5 — καμία obstacle λίστα/τοίχος κάτω από τη στάθμη. Αν κάποια μελλοντική
    // προσθήκη βάλει pickable γεωμετρία στη θαμμένη ζώνη, αυτό κοκκινίζει ΠΡΙΝ σπάσει η επιλογή.
    const { group, column } = sceneWithCoreAndSkin();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), cameraAt(Y_IN_BURIED));
    const tagged = raycaster
      .intersectObjects(group.children, true)
      .map((i) => i.object.userData['bimId'])
      .filter((id): id is string => typeof id === 'string');
    expect(new Set(tagged)).toEqual(new Set([column.id]));
  });
});
