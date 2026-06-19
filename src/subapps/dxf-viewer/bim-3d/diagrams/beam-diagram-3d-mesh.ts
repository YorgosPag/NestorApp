/**
 * Beam diagram 3D mesh builder (ADR-483 / Slice 6).
 *
 * Από το screen-agnostic `BeamDiagram3DSet` (pure, αναλυτικά μέτρα) → ένα `THREE.Group`
 * με, ανά δοκάρι: **γέμισμα κορδέλας** (ζώνες εφελκυσμού/θλίψης για ροπή — μπλε
 * θετική/hogging, κόκκινη αρνητική/sagging· μονόχρωμο για V/N) + **καμπύλη περιγράμματος**
 * + **ετικέτα ακραίας τιμής** (sprite). Η λογική γεμίσματος/χρωμάτων/ετικέτας ζει στο
 * member-agnostic SSoT (`member-diagram-3d-shared`) — εδώ ΜΟΝΟ η beam-specific τοπική
 * τοποθέτηση + ο προσανατολισμός του επιπέδου (μηδέν copy-paste με τον column builder).
 *
 * **Σύστημα (Revit/Robot beam diagram):** κάθε δοκάρι μπαίνει σε ΔΙΚΟ του pivot group στο
 * **3D μέσο** του (world `((xM_i+xM_j)/2, (zM_i+zM_j)/2, −(yM_i+yM_j)/2)` — analytical
 * East/North/Up → x/−z/y). Η κορδέλα ζει στο **κάθετο επίπεδο που περιέχει τον άξονα του
 * δοκαριού** (fixed, ΟΧΙ billboard — Revit-style): τοπικό **+X = κατεύθυνση ανοίγματος**
 * (οριζόντιος μοναδιαίος `normalize(Δx,0,−Δy)`), τοπικό **+Y = world up** (το offset της
 * τιμής κρέμεται πάνω/κάτω από το δοκάρι), τοπικό **+Z = κάθετη οριζόντια νορμάλ** του
 * επιπέδου. Ο προσανατολισμός κλειδώνεται μία φορά στο build (pivot quaternion) → το
 * επίπεδο διαβάζεται από κάθε πλάγιο orbit, edge-on μόνο από αυστηρό nadir.
 *
 * Sagging = ΑΡΝΗΤΙΚΟ (ADR-483 4b) → η αρνητική ζώνη κρέμεται **κάτω** από τον άξονα
 * (τοπικό −Y, world down) σε κόκκινο, η θετική/hogging **πάνω** σε μπλε — φυσική σύμβαση
 * σχεδίασης δοκαριού (ροπή στην εφελκυόμενη ίνα).
 *
 * **Κλίμακα (Revit/Robot model-space):** το πλευρικό μήκος της μέγιστης τιμής =
 * `referenceLengthM · DIAGRAM_HEIGHT_FRACTION` → η κορδέλα κλιμακώνεται με το μοντέλο.
 *
 * Καθαρά builder — zero React/store. Ο caller (overlay) προσθέτει/αφαιρεί+disposes.
 *
 * @see ./beam-diagram-3d-geometry.ts — pure data source
 * @see ./member-diagram-3d-shared.ts — member-agnostic mesh SSoT (χρώματα/fill/label)
 * @see ./BeamDiagram3DOverlay.tsx — lifecycle owner (scene.add / dispose)
 */

import * as THREE from 'three';
import type { AnalyticalPoint3D } from '../../bim/structural/analytical/analytical-model-types';
import type { DiagramComponent } from '../../bim/structural/analytical/diagrams/member-diagram-sampling';
import type { BeamDiagram3DPath, BeamDiagram3DSet } from './beam-diagram-3d-geometry';
import {
  COMPONENT_UNIT,
  buildSignedRibbonFill,
  makeTextSprite,
} from './member-diagram-3d-shared';

/** Πλευρικό μήκος μέγιστης τιμής ως ποσοστό του μέσου ανοίγματος δοκαριού (model space). */
const DIAGRAM_HEIGHT_FRACTION = 0.35;

/** Όνομα του group — σταθερό (ποτέ persisted, ποτέ raycast). */
export const BEAM_DIAGRAM_3D_GROUP_NAME = '__beam-analysis-diagram-3d__';

/** Reusable temps — προσανατολισμός pivot (build-time, μηδέν per-frame alloc στον overlay). */
const _ex = new THREE.Vector3();
const _ey = new THREE.Vector3(0, 1, 0);
const _ez = new THREE.Vector3();
const _basis = new THREE.Matrix4();

/** 3D μέσο δοκαριού σε world: analytical (xM,yM,zM) → (East, Up, −North). */
function midWorld(start: AnalyticalPoint3D, end: AnalyticalPoint3D): THREE.Vector3 {
  return new THREE.Vector3(
    (start.xM + end.xM) / 2,
    (start.zM + end.zM) / 2,
    -(start.yM + end.yM) / 2,
  );
}

/**
 * Οριζόντια μοναδιαία κατεύθυνση ανοίγματος σε world: `normalize(Δx, 0, −Δy)` (αγνοεί το
 * zM → οριζόντιο δοκάρι· κεκλιμένο = DEFER). `null` αν εκφυλισμένο (μηδενικό plan μήκος).
 */
function spanDirWorld(start: AnalyticalPoint3D, end: AnalyticalPoint3D): THREE.Vector3 | null {
  const v = new THREE.Vector3(end.xM - start.xM, 0, -(end.yM - start.yM));
  const len = v.length();
  return len > 1e-9 ? v.divideScalar(len) : null;
}

/**
 * Quaternion που κλειδώνει το pivot στο κάθετο επίπεδο του δοκαριού (fixed, ΟΧΙ billboard):
 * τοπικό +X → κατεύθυνση ανοίγματος, +Y → world up, +Z → οριζόντια νορμάλ (ex × up). Για
 * οριζόντιο δοκάρι ο +X είναι ορθογώνιος στο +Y (ex.y=0) → ορθοκανονική βάση.
 */
function planeQuaternion(spanDir: THREE.Vector3): THREE.Quaternion {
  _ex.copy(spanDir);
  _ez.copy(_ex).cross(_ey).normalize();
  _basis.makeBasis(_ex, _ey, _ez);
  return new THREE.Quaternion().setFromRotationMatrix(_basis);
}

/** Τοπικό σημείο άξονα στη στάθμη f (pivot frame: x κατά μήκος span, y=0, z=0). */
function axisLocal(f: number, spanLenM: number): THREE.Vector3 {
  return new THREE.Vector3((f - 0.5) * spanLenM, 0, 0);
}

/** Τοπικό σημείο κορδέλας: offset κατά τοπικό +Y (world up) = value·scale. */
function ribbonLocal(f: number, value: number, scale: number, spanLenM: number): THREE.Vector3 {
  return new THREE.Vector3((f - 0.5) * spanLenM, value * scale, 0);
}

/** Δείκτης της στάθμης με τη μέγιστη απόλυτη τιμή (θέση ετικέτας). */
function extremumIndex(path: BeamDiagram3DPath): number {
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

/** Γέμισμα + outline ενός δοκαριού σε ΤΟΠΙΚΕΣ (pivot) συντεταγμένες. */
function buildPathFill(path: BeamDiagram3DPath, scale: number, spanLenM: number, component: DiagramComponent, reliable: boolean): THREE.Object3D[] {
  const axisL: THREE.Vector3[] = [];
  const ribbonL: THREE.Vector3[] = [];
  for (const s of path.samples) {
    axisL.push(axisLocal(s.f, spanLenM));
    ribbonL.push(ribbonLocal(s.f, s.value, scale, spanLenM));
  }
  return buildSignedRibbonFill(path.samples, axisL, ribbonL, component, reliable);
}

/** Ετικέτα ακραίας τιμής ενός δοκαριού σε ΤΟΠΙΚΕΣ συντεταγμένες (ή `null` εκτός DOM). */
function buildPathLabel(path: BeamDiagram3DPath, scale: number, spanLenM: number, component: DiagramComponent): THREE.Sprite | null {
  const ei = extremumIndex(path);
  const s = path.samples[ei]!;
  const sprite = makeTextSprite(`${s.value.toFixed(1)} ${COMPONENT_UNIT[component]}`);
  if (!sprite) return null;
  sprite.position.copy(ribbonLocal(s.f, s.value, scale, spanLenM));
  return sprite;
}

/**
 * Από `BeamDiagram3DSet` → `THREE.Group` (μη-pickable) με ΕΝΑ **pivot sub-group ανά
 * δοκάρι** (στο 3D μέσο του, προσανατολισμένο στο κάθετο επίπεδο του ανοίγματος, γεωμετρία
 * σε τοπικές συντεταγμένες). Τα pivots **δεν** flag-άρονται για billboard → κρατούν fixed
 * προσανατολισμό (Revit-style). Μέσα σε κάθε pivot: πρώτα γεμίσματα/outline, μετά η ετικέτα
 * (draw order → πάντα μπροστά). `null` όταν κενό.
 */
export function buildBeamDiagram3DGroup(set: BeamDiagram3DSet): THREE.Group | null {
  if (set.paths.length === 0 || set.globalMaxAbs <= 0 || set.referenceLengthM <= 0) return null;
  const scale = (set.referenceLengthM * DIAGRAM_HEIGHT_FRACTION) / set.globalMaxAbs;

  const group = new THREE.Group();
  group.name = BEAM_DIAGRAM_3D_GROUP_NAME;
  group.raycast = () => {};

  for (const path of set.paths) {
    const spanDir = spanDirWorld(path.start, path.end);
    if (!spanDir) continue; // εκφυλισμένο plan μήκος → άκυρο
    const spanLenM = Math.hypot(path.end.xM - path.start.xM, path.end.yM - path.start.yM);
    const fills = buildPathFill(path, scale, spanLenM, set.component, set.reliable);
    if (fills.length === 0) continue;

    const pivot = new THREE.Group();
    pivot.position.copy(midWorld(path.start, path.end));
    pivot.quaternion.copy(planeQuaternion(spanDir)); // fixed κάθετο επίπεδο (ΟΧΙ billboard)
    pivot.raycast = () => {};
    for (const obj of fills) pivot.add(obj);
    const label = buildPathLabel(path, scale, spanLenM, set.component);
    if (label) pivot.add(label); // τελευταία → πάντα μπροστά
    group.add(pivot);
  }

  return group.children.length > 0 ? group : null;
}
