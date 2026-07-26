/**
 * ADR-714 — «Τι ακριβώς φωτίζεται όταν κλικάρω το κοντόστυλο;»
 *
 * Η ερώτηση του Giorgio ήταν «δεν μπορώ να επιλέξω ξεχωριστά τα κοντόστυλα». Η υποδομή του
 * ADR-713 δίνει στο θαμμένο τμήμα **δικές του** όψεις (`buried:i`), και ο `FaceSelectionHighlighter`
 * δέχεται οποιοδήποτε `faceKey` — άρα *θεωρητικά* η επιλογή δουλεύει ήδη. Αυτό το suite το κάνει
 * **μετρημένο γεγονός** αντί για συλλογισμό: παίρνει ΠΡΑΓΜΑΤΙΚΟ mesh κολώνας από τον
 * `columnToMesh` (όχι synthetic fixture, όπως το `FaceSelectionHighlighter.test.ts`) και μετράει
 * το κατακόρυφο εύρος του overlay που παράγεται.
 *
 * ΓΙΑΤΙ ΜΕ TEST ΚΑΙ ΟΧΙ ΜΕ ΜΑΤΙ: στο browser το overlay είναι ημιδιαφανές πάνω σε γκρι σκυρόδεμα
 * υπό προοπτική — ένα screenshot ΔΕΝ ξεχωρίζει «φωτίστηκε μόνο η θαμμένη ζώνη» από «φωτίστηκε όλη
 * η πλευρά». Εδώ η απάντηση είναι αριθμός.
 *
 * @see ../FaceSelectionHighlighter.ts — `faceGroupRange` → slice του group range
 * @see ../../../converters/bim-three-faced-prism.ts — τα rings/groups καθ' ύψος (ADR-713)
 */

import * as THREE from 'three';
import { FaceSelectionHighlighter } from '../FaceSelectionHighlighter';
import { raycastBimFace } from '../../raycaster/BimEntityRaycaster';
import { columnToMesh } from '../../../converters/BimToThreeConverter';
import {
  buildDefaultColumnParams,
  buildColumnEntity,
} from '../../../../hooks/drawing/column-completion';
import type { ColumnEntity } from '../../../../bim/types/column-types';

/** Πέδιλο 1 m κάτω από τη nominal βάση → θαμμένη ζώνη 1 m (default: έδαφος στο FFL). */
const FOOTING_TOP_ABS_MM = -1000;
const BURIED_HEIGHT_M = 1;

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Ο πυρήνας της κολώνας, εδρασμένος σε πέδιλο (suppressFinishSkin → σκέτο faced mesh). */
function buriedColumnMesh(): THREE.Mesh {
  return columnToMesh(
    flatColumn(), 0, '0', 0, undefined, undefined, undefined, [], [], true,
    FOOTING_TOP_ABS_MM,
  ) as THREE.Mesh;
}

/** Το κατακόρυφο εύρος (local Y) των positions ενός overlay child. */
function overlayYRange(overlay: THREE.Mesh): { min: number; max: number } {
  const pos = overlay.geometry.getAttribute('position');
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  return { min, max };
}

/**
 * Τα overlays του highlighter ανάμεσα στα παιδιά του mesh.
 *
 * ⚠️ Ο πυρήνας της κολώνας ΔΕΝ έχει μόνο overlays για παιδιά: ο `attachEdgesProjection`
 * (ADR-538) κρέμεται ήδη ένα `LineSegments2` πάνω του. Ένα σκέτο `children[0]` έπιανε εκείνο
 * και μετρούσε άσχετο εύρος Y. Ο highlighter σημαδεύει τα δικά του με `renderOrder = 999`.
 */
function overlaysOf(mesh: THREE.Mesh): THREE.Mesh[] {
  return mesh.children.filter(
    (c): c is THREE.Mesh => (c as THREE.Mesh).isMesh === true && c.renderOrder === 999,
  );
}

/** Στήνει highlighter πάνω σε πραγματικό mesh κολώνας και επιστρέφει το μοναδικό overlay. */
function highlightFace(faceKey: string): { mesh: THREE.Mesh; overlay: THREE.Mesh } {
  const group = new THREE.Group();
  const mesh = buriedColumnMesh();
  group.add(mesh);
  new FaceSelectionHighlighter(group).setTarget(mesh.userData['bimId'] as string, faceKey);
  const [overlay] = overlaysOf(mesh);
  if (!overlay) throw new Error(`no overlay built for ${faceKey}`);
  return { mesh, overlay };
}

describe('ADR-714 — το κοντόστυλο ΕΙΝΑΙ ανεξάρτητα επιλέξιμο (μετρημένο, όχι υποτεθειμένο)', () => {
  it('η θαμμένη όψη υπάρχει ως διακριτό, διευθυνσιοδοτήσιμο group στο πραγματικό mesh', () => {
    const keys = buriedColumnMesh().userData['faceKeyByMaterialIndex'] as string[];
    expect(keys).toContain('buried:0');
    expect(keys).toContain('side:0');
  });

  it('ΤΟ ΚΡΙΣΙΜΟ: το highlight του `buried:0` καλύπτει ΜΟΝΟ τη θαμμένη ζώνη', () => {
    const { overlay } = highlightFace('buried:0');
    const { min, max } = overlayYRange(overlay);
    expect(min).toBeCloseTo(0, 6);                 // κάτω παρειά = άνω παρειά πεδίλου
    expect(max).toBeCloseTo(BURIED_HEIGHT_M, 6);   // πάνω παρειά = στάθμη εδάφους
  });

  it('το highlight του `side:0` ΔΕΝ κατεβαίνει στη θαμμένη ζώνη (καθαρός διαχωρισμός)', () => {
    const { min } = overlayYRange(highlightFace('side:0').overlay);
    expect(min).toBeCloseTo(BURIED_HEIGHT_M, 6);
  });

  it('τα δύο overlays μαζί καλύπτουν όλη την πλευρά — καμία λωρίδα δεν μένει ανεπίλεκτη', () => {
    const buried = overlayYRange(highlightFace('buried:0').overlay);
    const exposed = overlayYRange(highlightFace('side:0').overlay);
    expect(exposed.min).toBeCloseTo(buried.max, 6);
    expect(buried.min).toBeCloseTo(0, 6);
  });

  it('multi-face: ΟΛΕΣ οι θαμμένες όψεις μιας κολώνας φωτίζονται μαζί (μαζική εφαρμογή)', () => {
    // Αυτό είναι το σχήμα της «σημασιολογικής επιλογής»: N targets → N overlays, ΕΝΑ βήμα.
    const group = new THREE.Group();
    const mesh = buriedColumnMesh();
    group.add(mesh);
    const bimId = mesh.userData['bimId'] as string;
    const buriedKeys = (mesh.userData['faceKeyByMaterialIndex'] as string[])
      .filter((k) => k.startsWith('buried:'));
    expect(buriedKeys.length).toBeGreaterThan(1);

    new FaceSelectionHighlighter(group).setTargets(buriedKeys.map((faceKey) => ({ bimId, faceKey })));

    const overlays = overlaysOf(mesh);
    expect(overlays).toHaveLength(buriedKeys.length);
    // Κάθε overlay μένει μέσα στη θαμμένη ζώνη — κανένα δεν «ξεφεύγει» στην ανωδομή.
    for (const child of overlays) {
      const { min, max } = overlayYRange(child);
      expect(min).toBeCloseTo(0, 6);
      expect(max).toBeCloseTo(BURIED_HEIGHT_M, 6);
    }
  });
});

/**
 * ADR-714 §Φ0 — Ο ΠΡΑΓΜΑΤΙΚΟΣ ΔΡΟΜΟΣ ΤΟΥ ΚΛΙΚ: `raycastBimFace` πάνω σε ΠΡΑΓΜΑΤΙΚΟ mesh κολώνας.
 *
 * Το handoff υπέθετε ότι «θεωρητικά ο raycaster επιστρέφει ήδη `buried:i`, ΕΠΑΛΗΘΕΥΣΕ ΤΟ». Εδώ
 * επαληθεύεται: στήνεται κάμερα που κοιτά οριζόντια την κολώνα και ρίχνεται ακτίνα μία φορά
 * **μέσα** στη θαμμένη ζώνη και μία **πάνω** από τη στάθμη. Αν οι δύο ακτίνες γύριζαν το ίδιο
 * κλειδί, ΚΑΘΕ σχέδιο επιλογής κοντόστυλου θα ήταν άκυρο από τη ρίζα του.
 */
describe('ADR-714 Φ0 — ο raycaster ΞΕΧΩΡΙΖΕΙ τη θαμμένη από την εκτεθειμένη ζώνη', () => {
  /** Ελάχιστο dom stub: μόνο το rect χρησιμοποιεί ο `clientToNdc`. Κέντρο = NDC (0,0). */
  const domStub = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLElement;

  /** Το `faceKey` που δίνει μια οριζόντια ακτίνα στο ύψος `worldY` (world μέτρα). */
  function pickFaceKeyAt(worldY: number): string | undefined {
    const group = new THREE.Group();
    group.add(buriedColumnMesh());
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, worldY, 10);
    camera.lookAt(0, worldY, 0);
    camera.updateMatrixWorld(true);
    group.updateMatrixWorld(true);
    return raycastBimFace(group, camera, domStub, 50, 50)?.faceKey;
  }

  // Ο πυρήνας κατεβαίνει κατά 1 m (πέδιλο) → world Y: θαμμένη ζώνη [−1, 0], ανωδομή [0, ύψος].
  it('ακτίνα ΜΕΣΑ στη θαμμένη ζώνη → κλειδί `buried:i` (το κοντόστυλο είναι pickable)', () => {
    expect(pickFaceKeyAt(-0.5)).toMatch(/^buried:\d+$/);
  });

  it('ακτίνα ΠΑΝΩ από τη στάθμη → κλειδί `side:i` (η ανωδομή μένει ανέπαφη)', () => {
    expect(pickFaceKeyAt(0.5)).toMatch(/^side:\d+$/);
  });

  it('οι δύο ζώνες ΔΕΝ επιστρέφουν το ίδιο κλειδί (αλλιώς η επιλογή είναι αδύνατη)', () => {
    expect(pickFaceKeyAt(-0.5)).not.toBe(pickFaceKeyAt(0.5));
  });
});
