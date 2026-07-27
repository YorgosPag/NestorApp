/**
 * ADR-717 Φ Γ — ομογενής προβολή + near-plane clipping ΑΝΑ ΤΜΗΜΑ.
 *
 * Γιατί έχει δικά του anchors: το σφάλμα που καταργεί ήταν **αόρατο σε κάθε υπάρχον test**. Όλα
 * τα marquee tests χρησιμοποιούσαν ορθογραφική κάμερα κάτοψης με συντεταγμένες 0–1000 **mm** —
 * «καθαρό δείγμα» που δεν αγγίζει καθόλου την κλάση του προβλήματος (μεγάλη απόσταση σε προοπτική
 * κάμερα). Δύο χρόνια σωστά tests, ένα ολόκληρο σενάριο χρήσης νεκρό.
 *
 * Τα anchors εδώ κλειδώνουν τη **διάκριση** που έλειπε: «πίσω από την κάμερα» ≠ «μακριά». Και τα
 * δύο έδιναν `ndc.z > 1`· μόνο το πρόσημο/μέγεθος του `w` τα ξεχωρίζει.
 */

import * as THREE from 'three';
import {
  createScreenClipper,
  nearClipMinW,
  ORTHO_MIN_W,
  type ClipPoint,
} from '../screen-projection-clip';

const CANVAS_W = 800;
const CANVAS_H = 600;

function createCanvas(): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H, width: CANVAS_W, height: CANVAS_H, x: 0, y: 0,
    }),
    clientWidth: CANVAS_W,
    clientHeight: CANVAS_H,
  } as unknown as HTMLElement;
}

/** Η ΠΡΑΓΜΑΤΙΚΗ κάμερα του viewport: `CAMERA_NEAR = 0.1`, `CAMERA_FAR = 1000` (viewport-constants). */
function perspectiveCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, CANVAS_W / CANVAS_H, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

function orthographicCamera(): THREE.OrthographicCamera {
  const cam = new THREE.OrthographicCamera(-20, 20, 15, -15, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return cam;
}

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

describe('nearClipMinW — ΤΙ κόβεται, ανά είδος κάμερας', () => {
  it('προοπτική ⇒ το κατώφλι ΕΙΝΑΙ το near plane (w = −z_view ⇒ w = near)', () => {
    const cam = perspectiveCamera();
    expect(nearClipMinW(cam)).toBe(cam.near);
  });

  it('ορθογραφική ⇒ αμελητέο ε: δεν υπάρχει σημείο ματιού, άρα δεν υπάρχει «πίσω»', () => {
    expect(nearClipMinW(orthographicCamera())).toBe(ORTHO_MIN_W);
    expect(ORTHO_MIN_W).toBeGreaterThan(0);
  });
});

describe('η ΑΠΟΣΤΑΣΗ δεν είναι ΠΟΤΕ λόγος απόρριψης (το μετρημένο σφάλμα)', () => {
  // Probe προηγούμενης συνεδρίας: τοπογραφικό 3 km ⇒ 4/4 σημεία `null` ⇒ μηδέν επιλογή.
  it.each([200, 999, 1000.1, 3000, 50_000])('σημείο %s m μακριά ΠΡΟΒΑΛΛΕΤΑΙ (far = 1000)', (dist) => {
    const clipper = createScreenClipper(perspectiveCamera(), createCanvas());
    const screen = clipper.worldToScreenPx(v(0, 0, 10 - dist));
    expect(screen).not.toBeNull();
    expect(Number.isFinite(screen?.x)).toBe(true);
    expect(Number.isFinite(screen?.y)).toBe(true);
  });

  it('πάνω στον άξονα βλέμματος ⇒ κέντρο οθόνης, ΟΣΟ μακριά κι αν είναι', () => {
    const clipper = createScreenClipper(perspectiveCamera(), createCanvas());
    const near = clipper.worldToScreenPx(v(0, 0, 0));
    const far = clipper.worldToScreenPx(v(0, 0, -2990));
    expect(near?.x).toBeCloseTo(CANVAS_W / 2, 6);
    expect(far?.x).toBeCloseTo(CANVAS_W / 2, 6);
    expect(far?.y).toBeCloseTo(CANVAS_H / 2, 6);
  });

  it('ορθογραφική: το ίδιο ισχύει — εκεί το παλιό test έκοβε την ΠΡΟΕΠΙΛΕΓΜΕΝΗ κάτοψη', () => {
    const clipper = createScreenClipper(orthographicCamera(), createCanvas());
    expect(clipper.worldToScreenPx(v(0, 0, -5000))).not.toBeNull();
  });
});

describe('ΠΙΣΩ από την κάμερα ⇒ μη ορισμένη προβολή ⇒ null', () => {
  it('σημείο πίσω από το μάτι απορρίπτεται (η διαίρεση με αρνητικό w καθρεφτίζει τα x/y)', () => {
    const clipper = createScreenClipper(perspectiveCamera(), createCanvas());
    expect(clipper.worldToScreenPx(v(0, 0, 20))).toBeNull();
  });

  it('σημείο ΜΕΣΑ στο near plane απορρίπτεται επίσης (δεν ρασταρίζεται ούτε από το GPU)', () => {
    const clipper = createScreenClipper(perspectiveCamera(), createCanvas());
    expect(clipper.worldToScreenPx(v(0, 0, 9.95))).toBeNull(); // 0.05 m < near 0.1
  });

  it('ορθογραφική: ΤΙΠΟΤΑ δεν είναι «πίσω» — w ≡ 1', () => {
    const clipper = createScreenClipper(orthographicCamera(), createCanvas());
    expect(clipper.worldToScreenPx(v(0, 0, 5000))).not.toBeNull();
  });
});

describe('clipPolylineToScreen — clipping ΑΝΑ ΤΜΗΜΑ, όχι απόρριψη οντότητας', () => {
  const clip = (pts: THREE.Vector3[], cam: THREE.Camera = perspectiveCamera()) => {
    const clipper = createScreenClipper(cam, createCanvas());
    const cps: ClipPoint[] = pts.map((p) => clipper.projectToClip(p));
    return { clipper, ...clipper.clipPolylineToScreen(cps) };
  };

  it('ΟΛΟ μπροστά ⇒ μία διαδρομή, τίποτα κομμένο, ίδιο πλήθος σημείων', () => {
    const { runs, clipped } = clip([v(-2, 0, 0), v(0, 1, 0), v(2, 0, 0)]);
    expect(clipped).toBe(false);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(3);
  });

  it('ΟΛΟ μπροστά αλλά ΠΕΡΑ από το far plane ⇒ ΠΑΛΙ ακέραιο (η απόσταση δεν κόβει)', () => {
    const { runs, clipped } = clip([v(-500, 0, -2990), v(500, 0, -2990)]);
    expect(clipped).toBe(false);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2);
  });

  it('ΟΛΟ πίσω ⇒ καμία διαδρομή, clipped', () => {
    const { runs, clipped } = clip([v(0, 0, 20), v(1, 0, 30)]);
    expect(clipped).toBe(true);
    expect(runs).toHaveLength(0);
  });

  it('ΒΓΑΙΝΕΙ πίσω ⇒ κρατά το ορατό κομμάτι, με το ΑΡΧΙΚΟ άκρο ανέπαφο', () => {
    const a = v(2, 0, 0);
    const { clipper, runs, clipped } = clip([a, v(2, 0, 20)]);
    expect(clipped).toBe(true);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(2);
    // Το ορατό άκρο ΔΕΝ μετακινείται — μόνο το κομμένο αντικαθίσταται από την τομή.
    expect(runs[0][0]).toEqual(clipper.worldToScreenPx(a));
    expect(Number.isFinite(runs[0][1].x)).toBe(true);
    expect(Number.isFinite(runs[0][1].y)).toBe(true);
  });

  it('ΜΠΑΙΝΕΙ από πίσω ⇒ νέα διαδρομή που ξεκινά στο επίπεδο και κρατά το μπροστινό άκρο', () => {
    const b = v(2, 0, 0);
    const { clipper, runs, clipped } = clip([v(2, 0, 20), b]);
    expect(clipped).toBe(true);
    expect(runs).toHaveLength(1);
    expect(runs[0][runs[0].length - 1]).toEqual(clipper.worldToScreenPx(b));
  });

  it('ΜΠΑΙΝΟΒΓΑΙΝΕΙ ⇒ ΔΥΟ ξεχωριστές διαδρομές (γι΄ αυτό runs, όχι ένας πίνακας σημείων)', () => {
    // μπροστά → πίσω → πίσω → μπροστά: δύο ορατά κομμάτια, ένα «κενό» ανάμεσα.
    const { runs, clipped } = clip([v(-2, 0, 0), v(-2, 0, 20), v(2, 0, 20), v(2, 0, 0)]);
    expect(clipped).toBe(true);
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.length === 2)).toBe(true);
  });

  it('ένα ΜΟΝΟ σημείο δεν παράγει διαδρομή, αλλά δηλώνει σωστά αν κόπηκε', () => {
    expect(clip([v(0, 0, 0)])).toMatchObject({ runs: [], clipped: false });
    expect(clip([v(0, 0, 20)])).toMatchObject({ runs: [], clipped: true });
  });

  it('κενή είσοδος ⇒ τίποτα, χωρίς clipped (δεν κόπηκε — απλώς δεν υπήρχε)', () => {
    expect(clip([])).toMatchObject({ runs: [], clipped: false });
  });

  it('ορθογραφική: ΠΟΤΕ clipped, όσο μακριά κι αν φτάνει η πολυγραμμή', () => {
    const { runs, clipped } = clip([v(0, 0, 5000), v(0, 0, -5000)], orthographicCamera());
    expect(clipped).toBe(false);
    expect(runs).toHaveLength(1);
  });
});

describe('ο clipper ΠΑΓΩΝΕΙ την πόζα (μία μέτρηση, όχι μία ανά κορυφή)', () => {
  it('rect + view-projection διαβάζονται ΜΙΑ φορά στην κατασκευή', () => {
    const camera = perspectiveCamera();
    let rectReads = 0;
    const canvas = {
      getBoundingClientRect: () => {
        rectReads++;
        return { left: 0, top: 0, right: CANVAS_W, bottom: CANVAS_H, width: CANVAS_W, height: CANVAS_H, x: 0, y: 0 };
      },
    } as unknown as HTMLElement;

    const clipper = createScreenClipper(camera, canvas);
    for (let i = 0; i < 50; i++) clipper.worldToScreenPx(v(i, 0, 0));

    // Ένα `getBoundingClientRect()` ανά κορυφή είναι forced layout flush ανά κορυφή — ο λόγος
    // ύπαρξης της bulk διαδρομής (ADR-692 Φ2, ADR-040).
    expect(rectReads).toBe(1);
  });
});
