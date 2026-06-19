/**
 * Column diagram 3D mesh builder (ADR-483 / Slice 5).
 *
 * Από το screen-agnostic `ColumnDiagram3DSet` (pure, αναλυτικά μέτρα) → ένα
 * `THREE.Group` με, ανά κολώνα: **γέμισμα κορδέλας** (ζώνες εφελκυσμού/θλίψης για τη
 * ροπή — μπλε θετική/hogging, κόκκινη αρνητική/sagging· μονόχρωμο για V/N) +
 * **καμπύλη περιγράμματος** (outline) + **ετικέτα ακραίας τιμής** (billboard sprite),
 * κατά μήκος του κατακόρυφου άξονα. Η λογική γεμίσματος/χρωμάτων/ετικέτας/billboard
 * ζει στο **member-agnostic SSoT** (`member-diagram-3d-shared`)· εδώ μένει ΜΟΝΟ η
 * column-specific τοπική τοποθέτηση (κατακόρυφος άξονας, full-billboard) — μηδέν
 * copy-paste με τον beam builder (ADR-483 Slice 6 SSoT extraction).
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
 * @see ./column-diagram-3d-geometry.ts — pure data source
 * @see ./member-diagram-3d-shared.ts — member-agnostic mesh SSoT (χρώματα/fill/label/billboard)
 * @see ./ColumnDiagram3DOverlay.tsx — lifecycle owner (scene.add / dispose)
 */

import * as THREE from 'three';
import type { AnalyticalPoint3D } from '../../bim/structural/analytical/analytical-model-types';
import type { DiagramComponent } from '../../bim/structural/analytical/diagrams/member-diagram-sampling';
import type { ColumnDiagram3DPath, ColumnDiagram3DSet } from './column-diagram-3d-geometry';
import {
  COMPONENT_UNIT,
  MEMBER_DIAGRAM_3D_COLORS,
  MEMBER_DIAGRAM_PIVOT_FLAG,
  billboardDiagramPivots,
  buildSignedRibbonFill,
  makeTextSprite,
} from './member-diagram-3d-shared';

/** Πλευρικό μήκος μέγιστης τιμής ως ποσοστό του μέσου ύψους κολώνας (model space). */
const DIAGRAM_HEIGHT_FRACTION = 0.35;

/** Όνομα του group — σταθερό (ποτέ persisted, ποτέ raycast). */
export const COLUMN_DIAGRAM_3D_GROUP_NAME = '__column-analysis-diagram-3d__';

/**
 * Παλέτα χρωμάτων διαγράμματος — alias του member-agnostic SSoT
 * ({@link MEMBER_DIAGRAM_3D_COLORS}). Διατηρείται για backwards-compat (tests/consumers).
 */
export const COLUMN_DIAGRAM_COLORS = MEMBER_DIAGRAM_3D_COLORS;

/** Flag στο userData ενός pivot group (column billboard) — alias του shared SSoT. */
export const COLUMN_DIAGRAM_PIVOT_FLAG = MEMBER_DIAGRAM_PIVOT_FLAG;

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

/** Γέμισμα + outline μιας κολώνας σε ΤΟΠΙΚΕΣ (pivot) συντεταγμένες, κεντραρισμένες στο `centerY`. */
function buildPathFill(path: ColumnDiagram3DPath, scale: number, component: DiagramComponent, reliable: boolean, centerY: number): THREE.Object3D[] {
  const axisL: THREE.Vector3[] = [];
  const ribbonL: THREE.Vector3[] = [];
  for (const s of path.samples) {
    axisL.push(axisLocal(path.base, path.top, s.f, centerY));
    ribbonL.push(ribbonLocal(path.base, path.top, s.f, s.value, scale, centerY));
  }
  return buildSignedRibbonFill(path.samples, axisL, ribbonL, component, reliable);
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

/**
 * Full-billboard κάθε per-column pivot ώστε το επίπεδο διαγράμματος να κοιτά πλήρως την
 * κάμερα (ορατό ακόμα κι από nadir). Alias του member-agnostic
 * {@link billboardDiagramPivots} — καλείται από τον overlay per-frame (camera-dirty).
 */
export const billboardColumnDiagrams = billboardDiagramPivots;
