/**
 * Member diagram 3D — shared mesh SSoT (ADR-483 / Slice 6).
 *
 * Οι **member-agnostic** βοηθοί κατασκευής three.js γεωμετρίας διαγράμματος M/V/N:
 * παλέτα χρωμάτων, render-order overlay σταθερές, `fillMesh` (always-on-top triangle
 * soup), `makeTextSprite` (billboard ετικέτα), `buildSignedRibbonFill` (γέμισμα ζωνών
 * ανά πρόσημο με split στα zero-crossings + outline) και `billboardDiagramPivots`.
 *
 * Τα καταναλώνουν **και** ο 3Δ builder κολώνας (`column-diagram-3d-mesh`, κατακόρυφος
 * άξονας) **και** ο 3Δ builder δοκαριού (`beam-diagram-3d-mesh`, οριζόντιος άξονας) — ΕΝΑ
 * SSoT, μηδέν copy-paste column→beam. Πριν την εξαγωγή ζούσαν private στο
 * `column-diagram-3d-mesh.ts` (browser-verified, ADR-483 Slice 5)· μετακινήθηκαν εδώ
 * **αυτούσια** (zero behaviour change· ο column builder τα ξανα-εξάγει ως aliases).
 *
 * Η μόνη διαφορά column↔beam ζει στους per-member builders: η τοπική τοποθέτηση
 * άξονα/κορδέλας (axisLocal/ribbonLocal) + ο προσανατολισμός του pivot. Η λογική
 * γεμίσματος/χρωμάτων/ετικέτας είναι κοινή και ζει **εδώ**.
 *
 * Σύμβαση χρωμάτων = το 2Δ overlay (μπλε θετική/hogging, κόκκινη αρνητική/sagging για
 * ροπή· V πράσινο, N μπλε μονόχρωμα). Calibration solver: sagging=ΑΡΝΗΤΙΚΟ (ADR-483 4b).
 *
 * @see ./column-diagram-3d-mesh.ts — column builder (vertical axis) consumer
 * @see ./beam-diagram-3d-mesh.ts — beam builder (horizontal axis) consumer
 * @see ../../bim/structural/analytical/diagrams/member-diagram-sampling.ts — pure sampling SSoT
 */

import * as THREE from 'three';
import type {
  DiagramComponent,
  DiagramSample,
} from '../../bim/structural/analytical/diagrams/member-diagram-sampling';

// Always-on-top overlay (Giorgio fix #3, ADR-483): τα analysis diagrams είναι overlay ΠΑΝΩ
// από το μοντέλο (όπως στη Revit/Robot και όπως το 2Δ `StructuralDiagramOverlay`), ΟΧΙ
// depth-tested γεωμετρία. Με depth-test το beige σκυρόδεμα της πλάκας έκρυβε το γέμισμα από
// το πάνω ημισφαίριο (occlusion). Λύση: `depthTest:false`/`depthWrite:false` + renderOrder
// ώστε **label > outline > fill** (καθαρή καμπύλη πάνω από το γέμισμα, ετικέτα πάνω από όλα).
// Παραμένει **opaque** → μηδέν blending → ποτέ μπεζ (fix #2).
/** renderOrder γεμίσματος ζωνών (πάνω από το μοντέλο, κάτω από outline/label). */
export const FILL_RENDER_ORDER = 9990;
/** renderOrder περιγράμματος (πάνω από το γέμισμα, κάτω από την ετικέτα). */
export const OUTLINE_RENDER_ORDER = 9991;
/** renderOrder ετικέτας (πάντα μπροστά από όλα). */
export const LABEL_RENDER_ORDER = 10000;

// Σύμβαση χρωμάτων = το 2Δ overlay (μπλε θετική/hogging, κόκκινη αρνητική/sagging για
// ροπή· V πράσινο, N μπλε μονόχρωμα). Calibration solver: sagging=ΑΡΝΗΤΙΚΟ (βλ. ADR-483).
// Απαλοί τόνοι (Giorgio fix #2 — το πλήρως κορεστό opaque ήταν «πολύ έντονο»)· exported
// ώστε τα tests να κλειδώνουν τις ζώνες χωρίς magic-number drift.
export const MEMBER_DIAGRAM_3D_COLORS = {
  momentPos: 0x5b8fd6, // μπλε (απαλό) — θετική (hogging), εφελκ. άνω ίνα
  momentNeg: 0xd96c6c, // κόκκινο (απαλό) — αρνητική (sagging), εφελκ. κάτω ίνα
  shear: 0x4fa06d, // πράσινο
  axial: 0x5b8fd6, // μπλε
  caution: 0xd9a441, // αμπέρ — αστάθεια («unreliable results»)
} as const;

/** SI μονάδα ανά εντατικό μέγεθος. */
export const COMPONENT_UNIT: Record<DiagramComponent, string> = { moment: 'kNm', shear: 'kN', axial: 'kN' };

/** Μέγεθος sprite ετικέτας σε μέτρα (model space). */
export const LABEL_WORLD_HEIGHT_M = 0.28;

/** Flag στο userData ενός pivot group — το βρίσκει ο {@link billboardDiagramPivots} updater. */
export const MEMBER_DIAGRAM_PIVOT_FLAG = 'memberDiagramPivot';

/** Χρώμα γεμίσματος θετικής τιμής ανά μέγεθος. */
export function fillPosColor(c: DiagramComponent): number {
  return c === 'moment' ? MEMBER_DIAGRAM_3D_COLORS.momentPos : c === 'shear' ? MEMBER_DIAGRAM_3D_COLORS.shear : MEMBER_DIAGRAM_3D_COLORS.axial;
}
/** Χρώμα γεμίσματος αρνητικής τιμής ανά μέγεθος (μόνο η ροπή έχει διπλή ζώνη). */
export function fillNegColor(c: DiagramComponent): number {
  return c === 'moment' ? MEMBER_DIAGRAM_3D_COLORS.momentNeg : c === 'shear' ? MEMBER_DIAGRAM_3D_COLORS.shear : MEMBER_DIAGRAM_3D_COLORS.axial;
}
/** Χρώμα περιγράμματος/καμπύλης ανά μέγεθος (ίδιο με το 2Δ stroke). */
export function strokeColor(c: DiagramComponent): number {
  return c === 'moment' ? MEMBER_DIAGRAM_3D_COLORS.momentNeg : c === 'shear' ? MEMBER_DIAGRAM_3D_COLORS.shear : MEMBER_DIAGRAM_3D_COLORS.axial;
}

/** Push τρίγωνο (3 κορυφές) σε flat positions array. */
function pushTri(arr: number[], p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void {
  arr.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
}

/** Mesh από flat positions (triangle soup) με δοθέν χρώμα, **always-on-top**. `null` αν κενό. */
export function fillMesh(positions: number[], color: number): THREE.Mesh | null {
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
export function makeTextSprite(text: string): THREE.Sprite | null {
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

/**
 * Γέμισμα ζωνών (ανά πρόσημο, split στα zero-crossings) + outline ενός μέλους, σε
 * **τοπικές** συντεταγμένες. Member-agnostic: ο caller δίνει precomputed `axisLocal`
 * (ordinate, value=0) + `ribbonLocal` (offset value·scale) arrays — η τοπική γεωμετρική
 * τοποθέτηση (κατακόρυφος vs οριζόντιος άξονας) ζει στον caller, η λογική σχεδίασης εδώ.
 *
 * Mirror του 2Δ `fillSignedRibbon`: σε zero-crossing η κορδέλα σπάει στον άξονα
 * (value=0 → offset=0 → ribbon==axis). `[]` αν <2 στάθμες. Επιστρέφει
 * `[posMesh?, negMesh?, outline]` με renderOrder fill (9990) < outline (9991).
 */
export function buildSignedRibbonFill(
  samples: readonly DiagramSample[],
  axisLocal: readonly THREE.Vector3[],
  ribbonLocal: readonly THREE.Vector3[],
  component: DiagramComponent,
  reliable: boolean,
): THREE.Object3D[] {
  const n = axisLocal.length;
  if (n < 2) return [];

  const posColor = reliable ? fillPosColor(component) : MEMBER_DIAGRAM_3D_COLORS.caution;
  const negColor = reliable ? fillNegColor(component) : MEMBER_DIAGRAM_3D_COLORS.caution;
  const stroke = reliable ? strokeColor(component) : MEMBER_DIAGRAM_3D_COLORS.caution;

  // ── Γέμισμα ζωνών ανά πρόσημο (mirror 2Δ fillSignedRibbon): σε zero-crossing η
  // κορδέλα σπάει στον άξονα (value=0 → offset=0 → ribbon==axis). ──
  const posTris: number[] = [];
  const negTris: number[] = [];
  for (let k = 0; k < n - 1; k++) {
    const va = samples[k]!.value;
    const vb = samples[k + 1]!.value;
    const axisA = axisLocal[k]!;
    const axisB = axisLocal[k + 1]!;
    const ribA = ribbonLocal[k]!;
    const ribB = ribbonLocal[k + 1]!;
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

  // ── Περίγραμμα: ordinate start → καμπύλη ribbon → ordinate end (always-on-top) ──
  const outline = [axisLocal[0]!, ...ribbonLocal, axisLocal[n - 1]!];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(outline);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: stroke, depthTest: false, depthWrite: false }));
  line.renderOrder = OUTLINE_RENDER_ORDER; // πάνω από το γέμισμα, κάτω από την ετικέτα
  out.push(line);

  return out;
}

/** Reusable temp — world quaternion κάμερας (per-frame, μηδέν alloc). */
const _cameraWorldQuat = new THREE.Quaternion();

/**
 * Full-billboard (Giorgio fix #3, ADR-483): προσανατολίζει κάθε pivot group με flag
 * {@link MEMBER_DIAGRAM_PIVOT_FLAG} ώστε το επίπεδο του διαγράμματος να κοιτά **πλήρως**
 * την κάμερα — ευανάγνωστο από ΚΑΘΕ γωνία orbit, συμπεριλαμβανομένου του nadir.
 * Αντιγράφει το world quaternion της κάμερας (όπως ένα `THREE.Sprite`).
 *
 * Το χρησιμοποιεί ο column overlay (κατακόρυφα μέλη → edge-on από nadir χωρίς billboard).
 * Ο beam overlay κρατά **fixed κάθετο επίπεδο** (Revit-style) → ΔΕΝ flag-άρει τα pivots
 * του, οπότε αυτή η συνάρτηση τα αφήνει ανέπαφα. Διαθέσιμη αν ζητηθεί nadir readability.
 */
export function billboardDiagramPivots(group: THREE.Group, camera: THREE.Camera): void {
  camera.getWorldQuaternion(_cameraWorldQuat);
  for (const child of group.children) {
    if (!child.userData[MEMBER_DIAGRAM_PIVOT_FLAG]) continue;
    child.quaternion.copy(_cameraWorldQuat);
  }
}
