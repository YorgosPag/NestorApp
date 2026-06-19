/**
 * Column diagram 3D mesh builder (ADR-483 / Slice 5).
 *
 * Από το screen-agnostic `ColumnDiagram3DSet` (pure, αναλυτικά μέτρα) → ένα
 * `THREE.Group` με, ανά κολώνα: **γέμισμα κορδέλας** (ζώνες εφελκυσμού/θλίψης για τη
 * ροπή — μπλε θετική/hogging, κόκκινη αρνητική/sagging· μονόχρωμο για V/N) +
 * **καμπύλη περιγράμματος** (outline) + **ετικέτα ακραίας τιμής** (billboard sprite),
 * κατά μήκος του κατακόρυφου άξονα. Σύμβαση χρωμάτων **ίδια με το 2Δ overlay**
 * (`StructuralDiagramOverlay.COMPONENT_STYLE`): η ροπή σπάει στα **zero-crossings**
 * (mirror του 2Δ `fillSignedRibbon`)· αστάθεια → αμπέρ.
 *
 * **Σύστημα:** κάθε κολώνα μπαίνει σε ΔΙΚΟ της pivot group στο plan-σημείο της, **στο μέσο
 * ύψος** (world `(xM, centerY, −yM)` — analytical East/North → x/−z, {@link pivotWorld})· η
 * γεωμετρία χτίζεται σε ΤΟΠΙΚΕΣ συντεταγμένες **κεντραρισμένες κατακόρυφα** (κατακόρυφος άξονας =
 * τοπικό +Y, offset = τοπικό +X) και το {@link billboardColumnDiagrams} κάνει **full-billboard**
 * (το επίπεδο κοιτά πλήρως την κάμερα, ορατό ακόμα και από nadir). Default `buildingBaseElevationM=0`.
 *
 * **Κλίμακα (Revit/Robot model-space):** το πλευρικό μήκος της μέγιστης τιμής =
 * `referenceLengthM · DIAGRAM_HEIGHT_FRACTION` → η κορδέλα κλιμακώνεται με το μοντέλο.
 *
 * **Ετικέτες πάντα μπροστά (3Δ):** sprite με `depthTest:false`/`depthWrite:false` +
 * υψηλό `renderOrder`, προστίθενται **τελευταία** στο group → ποτέ πίσω από το γέμισμα.
 *
 * Καθαρά builder — zero React/store. Ο caller (overlay) προσθέτει/αφαιρεί+disposes.
 *
 * @see ./column-diagram-3d-geometry.ts — pure data source
 * @see ../../bim/structural/analytical/diagrams/member-diagram-draw.ts — 2Δ fillSignedRibbon (ίδια σύμβαση)
 * @see ./ColumnDiagram3DOverlay.tsx — lifecycle owner (scene.add / dispose)
 */

import * as THREE from 'three';
import type { AnalyticalPoint3D } from '../../bim/structural/analytical/analytical-model-types';
import type { DiagramComponent } from '../../bim/structural/analytical/diagrams/member-diagram-sampling';
import type { ColumnDiagram3DPath, ColumnDiagram3DSet } from './column-diagram-3d-geometry';

/** Πλευρικό μήκος μέγιστης τιμής ως ποσοστό του μέσου ύψους κολώνας (model space). */
const DIAGRAM_HEIGHT_FRACTION = 0.35;

// Always-on-top overlay (Giorgio fix #3): τα analysis diagrams είναι overlay ΠΑΝΩ από
// το μοντέλο (όπως στη Revit/Robot και όπως το 2Δ `StructuralDiagramOverlay`), ΟΧΙ
// depth-tested γεωμετρία. Με depth-test το beige σκυρόδεμα της πλάκας έκρυβε το γέμισμα
// από το πάνω ημισφαίριο (occlusion). Λύση: `depthTest:false`/`depthWrite:false` +
// renderOrder ώστε **label > outline > fill** (καθαρή καμπύλη πάνω από το γέμισμα,
// ετικέτα πάνω από όλα). Παραμένει **opaque** → μηδέν blending → ποτέ μπεζ (fix #2).
/** renderOrder γεμίσματος ζωνών (πάνω από το μοντέλο, κάτω από outline/label). */
const FILL_RENDER_ORDER = 9990;
/** renderOrder περιγράμματος (πάνω από το γέμισμα, κάτω από την ετικέτα). */
const OUTLINE_RENDER_ORDER = 9991;
/** renderOrder ετικέτας (πάντα μπροστά από όλα). */
const LABEL_RENDER_ORDER = 10000;

/** Όνομα του group — σταθερό (ποτέ persisted, ποτέ raycast). */
export const COLUMN_DIAGRAM_3D_GROUP_NAME = '__column-analysis-diagram-3d__';

// Σύμβαση χρωμάτων = το 2Δ overlay (μπλε θετική/hogging, κόκκινη αρνητική/sagging για
// ροπή· V πράσινο, N μπλε μονόχρωμα). Calibration solver: sagging=ΑΡΝΗΤΙΚΟ (βλ. ADR-483).
// Απαλοί τόνοι (Giorgio fix #2 — το πλήρως κορεστό opaque ήταν «πολύ έντονο»)· exported
// ώστε τα tests να κλειδώνουν τις ζώνες χωρίς magic-number drift.
export const COLUMN_DIAGRAM_COLORS = {
  momentPos: 0x5b8fd6, // μπλε (απαλό) — θετική (hogging), εφελκ. άνω ίνα
  momentNeg: 0xd96c6c, // κόκκινο (απαλό) — αρνητική (sagging), εφελκ. κάτω ίνα
  shear: 0x4fa06d, // πράσινο
  axial: 0x5b8fd6, // μπλε
  caution: 0xd9a441, // αμπέρ — αστάθεια («unreliable results»)
} as const;

/** Χρώμα γεμίσματος θετικής τιμής ανά μέγεθος. */
function fillPosColor(c: DiagramComponent): number {
  return c === 'moment' ? COLUMN_DIAGRAM_COLORS.momentPos : c === 'shear' ? COLUMN_DIAGRAM_COLORS.shear : COLUMN_DIAGRAM_COLORS.axial;
}
/** Χρώμα γεμίσματος αρνητικής τιμής ανά μέγεθος (μόνο η ροπή έχει διπλή ζώνη). */
function fillNegColor(c: DiagramComponent): number {
  return c === 'moment' ? COLUMN_DIAGRAM_COLORS.momentNeg : c === 'shear' ? COLUMN_DIAGRAM_COLORS.shear : COLUMN_DIAGRAM_COLORS.axial;
}
/** Χρώμα περιγράμματος/καμπύλης ανά μέγεθος (ίδιο με το 2Δ stroke). */
function strokeColor(c: DiagramComponent): number {
  return c === 'moment' ? COLUMN_DIAGRAM_COLORS.momentNeg : c === 'shear' ? COLUMN_DIAGRAM_COLORS.shear : COLUMN_DIAGRAM_COLORS.axial;
}

/** SI μονάδα ανά εντατικό μέγεθος. */
const COMPONENT_UNIT: Record<DiagramComponent, string> = { moment: 'kNm', shear: 'kN', axial: 'kN' };
// Το γέμισμα είναι **opaque** (ΟΧΙ translucent): ημιδιαφανείς DoubleSide επιφάνειες που
// αναδιπλώνονται (μπλε/κόκκινη ζώνη) blend-άρανε σε ορισμένες γωνίες → μπεζ/λασπωμένο
// (Giorgio fix #2). Opaque ⇒ καθαρό κορεσμένο χρώμα σε ΚΑΘΕ γωνία (Robot/SAP σύμβαση).
// **Always-on-top** (fix #3): `depthTest:false` αντί για depth-test/polygonOffset, ώστε το
// beige σκυρόδεμα της πλάκας να μην κρύβει το διάγραμμα από το πάνω ημισφαίριο· το renderOrder
// (fill < outline < label) διατηρεί τη σειρά σχεδίασης χωρίς depth buffer.
/** Μέγεθος sprite ετικέτας σε μέτρα (model space). */
const LABEL_WORLD_HEIGHT_M = 0.28;

/** Flag στο userData ενός pivot group (column billboard) — το βρίσκει ο updater. */
export const COLUMN_DIAGRAM_PIVOT_FLAG = 'columnDiagramPivot';

// Billboard (Giorgio fix #3): κάθε κολώνα ζει σε ΔΙΚΟ της pivot group, τοποθετημένο στο
// plan-σημείο της **στο μέσο ύψος** (world x=xM, y=centerY, z=−yM)· η γεωμετρία χτίζεται σε
// ΤΟΠΙΚΕΣ συντεταγμένες κεντραρισμένες κατακόρυφα (κατακόρυφος άξονας = τοπικό +Y, πλευρικό
// offset = τοπικό +X). Ο {@link billboardColumnDiagrams} κάνει **full-billboard** (αντιγραφή
// world quaternion κάμερας) ώστε το επίπεδο να κοιτά πλήρως την κάμερα → ευανάγνωστο σε ΚΑΘΕ
// γωνία orbit, ακόμα κι από nadir, χωρίς να χαλά η αγκύρωση στην κολώνα (origin = μέσο ύψος).

/** Plan-σημείο κολώνας σε world (pivot θέση, πριν το centerY): analytical (xM,yM) → (East, 0, −North). */
function pivotWorld(base: AnalyticalPoint3D): THREE.Vector3 {
  return new THREE.Vector3(base.xM, 0, -base.yM);
}

/** Ύψος στάθμης f (m) — γραμμική παρεμβολή base→top κατά zM. */
function heightAt(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number): number {
  return base.zM + (top.zM - base.zM) * f;
}

/** Κατακόρυφο κέντρο διαγράμματος (μέσο ύψος) — pivot origin για το full-billboard. */
function verticalCenterM(base: AnalyticalPoint3D, top: AnalyticalPoint3D): number {
  return (base.zM + top.zM) / 2;
}

// Η γεωμετρία χτίζεται **κεντραρισμένη κατακόρυφα** ως προς το μέσο ύψος (`centerY`): το pivot
// origin κάθεται στο μέσο ύψος της κολώνας, ώστε το full-billboard ({@link billboardColumnDiagrams})
// να περιστρέφει το διάγραμμα γύρω από το κέντρο του — μένει αγκυρωμένο στην κολώνα από κάθε γωνία
// (αλλιώς το ανυψωμένο γεωμετρικό θα «έφευγε» κατά την περιστροφή pitch).

/** Τοπικό σημείο άξονα στο ύψος f (pivot frame: x=0, y=ύψος−centerY, z=0). */
function axisLocal(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number, centerY: number): THREE.Vector3 {
  return new THREE.Vector3(0, heightAt(base, top, f) - centerY, 0);
}

/** Τοπικό σημείο κορδέλας: offset κατά τοπικό +X = value·scale (το billboard στρέφει το επίπεδο). */
function ribbonLocal(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number, value: number, scale: number, centerY: number): THREE.Vector3 {
  return new THREE.Vector3(value * scale, heightAt(base, top, f) - centerY, 0);
}

/** Δείκτης της στάθμης με τη μέγιστη απόλυτη τιμή (θέση ετικέτας). */
function extremumIndex(path: ColumnDiagram3DPath): number {
  let idx = 0;
  let best = -1;
  path.samples.forEach((s, i) => {
    const a = Math.abs(s.value);
    if (a > best) {
      best = a;
      idx = i;
    }
  });
  return idx;
}

/** Push τρίγωνο (3 κορυφές) σε flat positions array. */
function pushTri(arr: number[], p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void {
  arr.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
}

/** Mesh από flat positions (triangle soup) με δοθέν χρώμα, **always-on-top**. `null` αν κενό. */
function fillMesh(positions: number[], color: number): THREE.Mesh | null {
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      depthTest: false, // overlay: το beige σκυρόδεμα της πλάκας δεν το κρύβει πια από πάνω
      depthWrite: false,
    }),
  );
  mesh.renderOrder = FILL_RENDER_ORDER; // < outline < label
  return mesh;
}

/**
 * Billboard ετικέτα κειμένου (canvas texture → Sprite), **πάντα μπροστά**
 * (`depthTest:false`). `null` εκτός DOM (jest node) ώστε ο builder να μένει
 * unit-testable. Ο caller disposes texture+material.
 */
function makeTextSprite(text: string): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const font = '700 48px sans-serif';
  ctx.font = font;
  const padX = 12;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 72;
  canvas.width = w;
  canvas.height = h;
  // ΔΙΑΦΑΝΕΣ φόντο (ΟΧΙ κρεμ κουτί — αυτό φαινόταν «μπεζ» πάνω στο διάγραμμα κατά το
  // orbit, αφού η ετικέτα είναι πάντα μπροστά). Λευκό κείμενο + σκούρο halo (stroke) ώστε
  // να διαβάζεται σε κάθε φόντο, χωρίς κανένα αδιαφανές patch.
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(15,17,22,0.92)';
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LABEL_WORLD_HEIGHT_M * (w / h), LABEL_WORLD_HEIGHT_M, 1);
  sprite.renderOrder = LABEL_RENDER_ORDER; // πάντα πάνω από το γέμισμα/outline
  return sprite;
}

/** Γέμισμα + outline μιας κολώνας σε ΤΟΠΙΚΕΣ (pivot) συντεταγμένες, κεντραρισμένες στο `centerY`. */
function buildPathFill(path: ColumnDiagram3DPath, scale: number, component: DiagramComponent, reliable: boolean, centerY: number): THREE.Object3D[] {
  const axisL: THREE.Vector3[] = [];
  const ribbonL: THREE.Vector3[] = [];
  for (const s of path.samples) {
    axisL.push(axisLocal(path.base, path.top, s.f, centerY));
    ribbonL.push(ribbonLocal(path.base, path.top, s.f, s.value, scale, centerY));
  }
  const n = axisL.length;
  if (n < 2) return [];

  const posColor = reliable ? fillPosColor(component) : COLUMN_DIAGRAM_COLORS.caution;
  const negColor = reliable ? fillNegColor(component) : COLUMN_DIAGRAM_COLORS.caution;
  const stroke = reliable ? strokeColor(component) : COLUMN_DIAGRAM_COLORS.caution;

  // ── Γέμισμα ζωνών ανά πρόσημο (mirror 2Δ fillSignedRibbon): σε zero-crossing η
  // κορδέλα σπάει στον άξονα (value=0 → offset=0 → ribbon==axis). ──
  const posTris: number[] = [];
  const negTris: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const va = path.samples[k]!.value;
    const vb = path.samples[k + 1]!.value;
    const axisA = axisL[k]!;
    const axisB = axisL[k + 1]!;
    const ribA = ribbonL[k]!;
    const ribB = ribbonL[k + 1]!;
    if (va >= 0 && vb >= 0) {
      pushTri(posTris, axisA, ribA, ribB);
      pushTri(posTris, axisA, ribB, axisB);
    } else if (va <= 0 && vb <= 0) {
      pushTri(negTris, axisA, ribA, ribB);
      pushTri(negTris, axisA, ribB, axisB);
    } else {
      const t = Math.abs(va) / (Math.abs(va) + Math.abs(vb));
      const axisCross = axisA.clone().lerp(axisB, t); // ribbon==axis εδώ (value=0)
      pushTri(va >= 0 ? posTris : negTris, axisA, ribA, axisCross);
      pushTri(vb >= 0 ? posTris : negTris, axisCross, ribB, axisB);
    }
  }

  const out: THREE.Object3D[] = [];
  const posMesh = fillMesh(posTris, posColor);
  if (posMesh) out.push(posMesh);
  const negMesh = fillMesh(negTris, negColor);
  if (negMesh) out.push(negMesh);

  // ── Περίγραμμα: ordinate base → καμπύλη ribbon → ordinate top (always-on-top) ──
  const outline = [axisL[0]!, ...ribbonL, axisL[n - 1]!];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(outline);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: stroke, depthTest: false, depthWrite: false }));
  line.renderOrder = OUTLINE_RENDER_ORDER; // πάνω από το γέμισμα, κάτω από την ετικέτα
  out.push(line);

  return out;
}

/** Ετικέτα ακραίας τιμής μιας κολώνας σε ΤΟΠΙΚΕΣ συντεταγμένες (ή `null` εκτός DOM). */
function buildPathLabel(path: ColumnDiagram3DPath, scale: number, component: DiagramComponent, centerY: number): THREE.Sprite | null {
  const ei = extremumIndex(path);
  const s = path.samples[ei]!;
  const sprite = makeTextSprite(`${s.value.toFixed(1)} ${COMPONENT_UNIT[component]}`);
  if (!sprite) return null;
  sprite.position.copy(ribbonLocal(path.base, path.top, s.f, s.value, scale, centerY));
  return sprite;
}

/**
 * Από `ColumnDiagram3DSet` → `THREE.Group` (μη-pickable) με ΕΝΑ **pivot sub-group ανά
 * κολώνα** (στο plan-σημείο της, γεωμετρία σε τοπικές συντεταγμένες). Τα pivots
 * περιστρέφονται γύρω από τον κατακόρυφο άξονα μέσω {@link billboardColumnDiagrams}
 * ώστε να κοιτούν την κάμερα (ευανάγνωστα σε κάθε orbit). Μέσα σε κάθε pivot: πρώτα
 * γεμίσματα/outline, μετά η ετικέτα (draw order → πάντα μπροστά). `null` όταν κενό.
 */
export function buildColumnDiagram3DGroup(set: ColumnDiagram3DSet): THREE.Group | null {
  if (set.paths.length === 0 || set.globalMaxAbs <= 0 || set.referenceLengthM <= 0) return null;
  const scale = (set.referenceLengthM * DIAGRAM_HEIGHT_FRACTION) / set.globalMaxAbs;

  const group = new THREE.Group();
  group.name = COLUMN_DIAGRAM_3D_GROUP_NAME;
  group.raycast = () => {};

  for (const path of set.paths) {
    const centerY = verticalCenterM(path.base, path.top);
    const fills = buildPathFill(path, scale, set.component, set.reliable, centerY);
    if (fills.length === 0) continue;
    const pivot = new THREE.Group();
    pivot.userData[COLUMN_DIAGRAM_PIVOT_FLAG] = true;
    pivot.position.copy(pivotWorld(path.base));
    pivot.position.y = centerY; // origin στο μέσο ύψος → full-billboard περιστρέφει γύρω από το κέντρο
    pivot.raycast = () => {};
    for (const obj of fills) pivot.add(obj);
    const label = buildPathLabel(path, scale, set.component, centerY);
    if (label) pivot.add(label); // τελευταία → πάντα μπροστά
    group.add(pivot);
  }

  return group.children.length > 0 ? group : null;
}

/** Reusable temp — world quaternion κάμερας (per-frame, μηδέν alloc). */
const _cameraWorldQuat = new THREE.Quaternion();

/**
 * Full-billboard (Giorgio fix #3): προσανατολίζει κάθε per-column pivot group ώστε το
 * επίπεδο του διαγράμματος να κοιτά **πλήρως** την κάμερα — ευανάγνωστο από ΚΑΘΕ γωνία orbit,
 * **συμπεριλαμβανομένου του nadir** (κάμερα ακριβώς από πάνω, όπου το yaw-only billboard
 * γινόταν edge-on/λεπτή γραμμή). Αντιγράφει το world quaternion της κάμερας (όπως ένα
 * `THREE.Sprite`): τοπικό +Y → screen-up, +X → screen-right, +Z (normal) → προς την κάμερα.
 *
 * Σε κανονικές πλάγιες όψεις (camera up = world up) ο κατακόρυφος άξονας μένει κατακόρυφος —
 * ίδια εμφάνιση με πριν· μόνο όταν η κάμερα ανέβει/κατέβει το επίπεδο γέρνει για να κοιτά τον
 * θεατή. Το pivot origin κάθεται στο μέσο ύψος (βλ. {@link buildColumnDiagram3DGroup}) → η
 * περιστροφή κρατά το διάγραμμα αγκυρωμένο στην κολώνα. Καλείται από τον overlay per-frame
 * (μόνο όταν κινηθεί η κάμερα).
 */
export function billboardColumnDiagrams(group: THREE.Group, camera: THREE.Camera): void {
  camera.getWorldQuaternion(_cameraWorldQuat);
  for (const child of group.children) {
    if (!child.userData[COLUMN_DIAGRAM_PIVOT_FLAG]) continue;
    child.quaternion.copy(_cameraWorldQuat);
  }
}
