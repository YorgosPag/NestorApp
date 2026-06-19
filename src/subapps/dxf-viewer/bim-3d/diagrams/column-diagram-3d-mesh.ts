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
 * **Σύστημα:** κάθε κολώνα μπαίνει σε ΔΙΚΟ της pivot group στο plan-σημείο της
 * (world `(xM, 0, −yM)` — analytical East/North → x/−z, {@link pivotWorld})· η γεωμετρία
 * χτίζεται σε ΤΟΠΙΚΕΣ συντεταγμένες (κατακόρυφος άξονας = τοπικό +Y, offset = τοπικό +X) και
 * το {@link billboardColumnDiagrams} περιστρέφει το pivot γύρω από τον κατακόρυφο άξονα ώστε
 * να κοιτά την κάμερα. Default `buildingBaseElevationM=0`.
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
// (Giorgio fix #2). Opaque + depth-test ⇒ ανά pixel μένει η πλησιέστερη επιφάνεια →
// καθαρό κορεσμένο χρώμα σε ΚΑΘΕ γωνία (Robot/SAP σύμβαση). `polygonOffset` σπρώχνει το
// γέμισμα ελαφρά πίσω ώστε το outline + οι ζώνες να μην z-fight-άρουν στο όριο.
/** Μέγεθος sprite ετικέτας σε μέτρα (model space). */
const LABEL_WORLD_HEIGHT_M = 0.28;

/** Flag στο userData ενός pivot group (column billboard) — το βρίσκει ο updater. */
export const COLUMN_DIAGRAM_PIVOT_FLAG = 'columnDiagramPivot';

// Billboard (Giorgio fix #3): κάθε κολώνα ζει σε ΔΙΚΟ της pivot group, τοποθετημένο στο
// plan-σημείο της (world x=xM, y=0, z=−yM)· η γεωμετρία χτίζεται σε ΤΟΠΙΚΕΣ συντεταγμένες
// (κατακόρυφος άξονας = τοπικό +Y, πλευρικό offset = τοπικό +X). Ο {@link billboardColumnDiagrams}
// περιστρέφει κάθε pivot ΜΟΝΟ γύρω από τον κατακόρυφο άξονα (world/τοπικό +Y) ώστε το επίπεδο
// να κοιτά την κάμερα → ευανάγνωστο σε ΚΑΘΕ γωνία orbit, χωρίς να χαλά η κατακόρυφη θέση.

/** Plan-σημείο κολώνας σε world (pivot θέση): analytical (xM,yM) → (East, 0, −North). */
function pivotWorld(base: AnalyticalPoint3D): THREE.Vector3 {
  return new THREE.Vector3(base.xM, 0, -base.yM);
}

/** Ύψος στάθμης f (m) — γραμμική παρεμβολή base→top κατά zM. */
function heightAt(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number): number {
  return base.zM + (top.zM - base.zM) * f;
}

/** Τοπικό σημείο άξονα στο ύψος f (pivot frame: x=0, y=ύψος, z=0). */
function axisLocal(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number): THREE.Vector3 {
  return new THREE.Vector3(0, heightAt(base, top, f), 0);
}

/** Τοπικό σημείο κορδέλας: offset κατά τοπικό +X = value·scale (το billboard στρέφει το επίπεδο). */
function ribbonLocal(base: AnalyticalPoint3D, top: AnalyticalPoint3D, f: number, value: number, scale: number): THREE.Vector3 {
  return new THREE.Vector3(value * scale, heightAt(base, top, f), 0);
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

/** Mesh από flat positions (triangle soup) με δοθέν χρώμα/διαφάνεια. `null` αν κενό. */
function fillMesh(positions: number[], color: number): THREE.Mesh | null {
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  );
}

/**
 * Billboard ετικέτα κειμένου (canvas texture → Sprite), **πάντα μπροστά**
 * (`depthTest:false`). `null` εκτός DOM (jest node) ώστε ο builder να μένει
 * unit-testable. Ο caller disposes texture+material.
 */
function makeTextSprite(text: string, colorHex: number): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const font = '600 48px sans-serif';
  ctx.font = font;
  const padX = 16;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 72;
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LABEL_WORLD_HEIGHT_M * (w / h), LABEL_WORLD_HEIGHT_M, 1);
  sprite.renderOrder = 10000; // πάντα πάνω από το γέμισμα/outline
  return sprite;
}

/** Γέμισμα + outline μιας κολώνας σε ΤΟΠΙΚΕΣ (pivot) συντεταγμένες. */
function buildPathFill(path: ColumnDiagram3DPath, scale: number, component: DiagramComponent, reliable: boolean): THREE.Object3D[] {
  const axisL: THREE.Vector3[] = [];
  const ribbonL: THREE.Vector3[] = [];
  for (const s of path.samples) {
    axisL.push(axisLocal(path.base, path.top, s.f));
    ribbonL.push(ribbonLocal(path.base, path.top, s.f, s.value, scale));
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

  // ── Περίγραμμα: ordinate base → καμπύλη ribbon → ordinate top ──
  const outline = [axisL[0]!, ...ribbonL, axisL[n - 1]!];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(outline);
  out.push(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: stroke })));

  return out;
}

/** Ετικέτα ακραίας τιμής μιας κολώνας σε ΤΟΠΙΚΕΣ συντεταγμένες (ή `null` εκτός DOM). */
function buildPathLabel(path: ColumnDiagram3DPath, scale: number, component: DiagramComponent, reliable: boolean): THREE.Sprite | null {
  const ei = extremumIndex(path);
  const s = path.samples[ei]!;
  const color = reliable ? strokeColor(component) : COLUMN_DIAGRAM_COLORS.caution;
  const sprite = makeTextSprite(`${s.value.toFixed(1)} ${COMPONENT_UNIT[component]}`, color);
  if (!sprite) return null;
  sprite.position.copy(ribbonLocal(path.base, path.top, s.f, s.value, scale));
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
    const fills = buildPathFill(path, scale, set.component, set.reliable);
    if (fills.length === 0) continue;
    const pivot = new THREE.Group();
    pivot.userData[COLUMN_DIAGRAM_PIVOT_FLAG] = true;
    pivot.position.copy(pivotWorld(path.base));
    pivot.raycast = () => {};
    for (const obj of fills) pivot.add(obj);
    const label = buildPathLabel(path, scale, set.component, set.reliable);
    if (label) pivot.add(label); // τελευταία → πάντα μπροστά
    group.add(pivot);
  }

  return group.children.length > 0 ? group : null;
}

/**
 * Billboard: περιστρέφει κάθε per-column pivot group γύρω από τον κατακόρυφο άξονα
 * (world +Y) ώστε το επίπεδο του διαγράμματος να κοιτά την κάμερα — ευανάγνωστο σε
 * κάθε γωνία orbit, χωρίς να αλλάζει η κατακόρυφη θέση/μήκος. Καλείται από τον overlay
 * per-frame (μόνο όταν κινηθεί η κάμερα). `θ = atan2(dx, dz)` ώστε το τοπικό +Z (normal
 * του επιπέδου) να δείχνει οριζόντια προς την κάμερα.
 */
export function billboardColumnDiagrams(group: THREE.Group, camera: THREE.Camera): void {
  const cx = camera.position.x;
  const cz = camera.position.z;
  for (const child of group.children) {
    if (!child.userData[COLUMN_DIAGRAM_PIVOT_FLAG]) continue;
    const dx = cx - child.position.x;
    const dz = cz - child.position.z;
    if (dx === 0 && dz === 0) continue;
    child.rotation.y = Math.atan2(dx, dz);
  }
}
