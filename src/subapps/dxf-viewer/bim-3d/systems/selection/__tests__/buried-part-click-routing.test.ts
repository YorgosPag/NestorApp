/**
 * ADR-715 — ΤΟ ΑΙΤΗΜΑ ΤΟΥ GIORGIO, ΩΣ ΜΕΤΡΗΣΗ: «κλικ στο κοντόστυλο επιλέγει ΑΥΤΟ, όχι την κολώνα».
 *
 * Το suite ενώνει τα τρία κομμάτια που στο ζωντανό κλικ είναι σειριακά, ώστε το συμβόλαιο να
 * ελέγχεται **ολόκληρο** και όχι κατά μονάδα:
 *
 *   ακτίνα → `raycastBimGroup` (ΚΑΝΟΝΙΚΟ mode, με faceKey) → `isBuriedFaceKey` → Τμήμα ή κολώνα
 *
 * Γιατί όχι test του React hook: ο `use-bim3d-pointer-handlers` απαιτεί manager/DOM/gizmo stores.
 * Η **απόφαση** όμως — «τι επιλέγει αυτό το κλικ» — είναι καθαρή συνάρτηση του hit, και αυτή
 * ελέγχεται εδώ πάνω σε **πραγματικό mesh** (`columnToMesh`), όχι σε synthetic literal. Ό,τι μένει
 * στο hook είναι σειρά κλήσεων store, που καλύπτεται από το `exit-sub-element-selections.test.ts`.
 *
 * ⚠️ Το `raycastBimGroup` (και όχι ο `raycastBimFace`) είναι το σωστό υπό δοκιμή: εκτός
 * «ΠΟΛΥΓΩΝΑ» **αυτός** τρέχει. Πριν το ADR-715 πέταγε το `materialIndex` του hit, οπότε το
 * κανονικό κλικ ήταν δομικά **ανίκανο** να ξεχωρίσει θαμμένη από εκτεθειμένη ζώνη.
 *
 * @see ../../raycaster/BimEntityRaycaster.ts — `raycastBimGroup` + `resolveHitFaceKey`
 * @see ../../../viewport/use-bim3d-pointer-handlers.ts — ο ζωντανός κλάδος
 */

import * as THREE from 'three';
import { raycastBimGroup } from '../../raycaster/BimEntityRaycaster';
import { columnToMesh } from '../../../converters/BimToThreeConverter';
import { isBuriedFaceKey } from '../../../../bim/types/face-appearance-types';
import { buriedFaceTargets } from '../../../../bim/parts/buried-part';
import { readEntityFaceKeys } from '../faced-mesh-lookup';
import {
  buildDefaultColumnParams,
  buildColumnEntity,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';

const FOOTING_TOP_ABS_MM = -1000;
/** World Y (m): θαμμένη ζώνη [−1, 0], ανωδομή [0, 3]. */
const Y_IN_BURIED = -0.5;
const Y_IN_EXPOSED = 1.5;

const domStub = {
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
} as unknown as HTMLElement;

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Σκηνή με ΜΙΑ κολώνα εδρασμένη σε πέδιλο (ό,τι φτιάχνει το «Όλοι οι όροφοι» στο Ισόγειο). */
function scene(column: ColumnEntity): THREE.Group {
  const group = new THREE.Group();
  const mesh = columnToMesh(
    column, 0, '0', 0, undefined, undefined, undefined, [], [], true, FOOTING_TOP_ABS_MM,
  );
  if (!mesh) throw new Error('column mesh fixture empty');
  group.add(mesh);
  group.updateMatrixWorld(true);
  return group;
}

/** Κολώνα ΧΩΡΙΣ έδραση (όροφος): κανένα `baseDropMm` → καμία θαμμένη ζώνη. */
function sceneWithoutFooting(column: ColumnEntity): THREE.Group {
  const group = new THREE.Group();
  const mesh = columnToMesh(column, 0, '0', 0, undefined, undefined, undefined, [], [], true);
  if (!mesh) throw new Error('column mesh fixture empty');
  group.add(mesh);
  group.updateMatrixWorld(true);
  return group;
}

function cameraAt(worldY: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, worldY, 10);
  camera.lookAt(0, worldY, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Η ΑΠΟΦΑΣΗ του κανονικού κλικ, όπως την παίρνει ο pointer handler: `'part'` όταν χτυπήθηκε
 * θαμμένη όψη κολώνας, `'entity'` αλλιώς, `'miss'` σε αστοχία ακτίνας. **Ίδια συνθήκη** με τον
 * ζωντανό κλάδο (bimType === 'column' && isBuriedFaceKey) — αν αποκλίνουν, η δικλείδα κρίνει
 * κάτι που δεν εκτελείται.
 */
function clickDecisionAt(group: THREE.Group, worldY: number): 'part' | 'entity' | 'miss' {
  const hit = raycastBimGroup(group, cameraAt(worldY), domStub, 50, 50);
  if (!hit?.bimId) return 'miss';
  return hit.bimType === 'column' && isBuriedFaceKey(hit.faceKey) ? 'part' : 'entity';
}

describe('ADR-715 — τι επιλέγει το ΚΑΝΟΝΙΚΟ κλικ', () => {
  it('ΤΟ ΑΙΤΗΜΑ: κλικ στη θαμμένη ζώνη → **Τμήμα**', () => {
    expect(clickDecisionAt(scene(flatColumn()), Y_IN_BURIED)).toBe('part');
  });

  it('κλικ πάνω από τη στάθμη → ΚΟΛΩΝΑ (byte-for-byte η παλιά συμπεριφορά)', () => {
    expect(clickDecisionAt(scene(flatColumn()), Y_IN_EXPOSED)).toBe('entity');
  });

  it('κολώνα ορόφου (καμία έδραση) → ΠΟΤΕ Τμήμα, σε κανένα ύψος', () => {
    // Χωρίς `baseDropMm` δεν υπάρχουν καθόλου `buried:i` groups (ADR-713), οπότε κάθε κλικ
    // πρέπει να δίνει ολόκληρη την κολώνα — μηδέν regression στους ορόφους.
    const group = sceneWithoutFooting(flatColumn());
    for (const y of [0.5, 1.5, 2.5]) expect(clickDecisionAt(group, y)).toBe('entity');
  });

  it('ο host id του hit είναι η ΚΟΛΩΝΑ — το Τμήμα δεν εισάγει νέο id στην επιλογή', () => {
    // ADR-715 §3: το part id είναι UI-only. Ο `Selection3DStore` βλέπει πάντα κανονική κολώνα,
    // άρα ribbon/panel/BOQ/universal bridge δουλεύουν χωρίς να γνωρίζουν το Τμήμα.
    const column = flatColumn();
    const hit = raycastBimGroup(scene(column), cameraAt(Y_IN_BURIED), domStub, 50, 50);
    expect(hit?.bimId).toBe(column.id);
    expect(hit?.bimType).toBe('column');
  });

  it('το κλικ φωτίζει ΟΛΟ το κοντόστυλο περιμετρικά, όχι τη χτυπημένη παρειά', () => {
    // Το σχήμα του φωτισμού είναι το μήνυμα «Τμήμα» (vs «όψη») — βλ. ADR-715 §3.1.
    const column = flatColumn();
    const group = scene(column);
    const hit = raycastBimGroup(group, cameraAt(Y_IN_BURIED), domStub, 50, 50);
    const targets = buriedFaceTargets(column.id, readEntityFaceKeys(group, column.id));
    expect(targets.length).toBe(column.geometry.footprint.vertices.length);
    expect(targets.map((tgt) => tgt.faceKey)).toContain(hit?.faceKey);
  });
});
