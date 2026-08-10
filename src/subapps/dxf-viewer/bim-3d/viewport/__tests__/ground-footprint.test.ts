/**
 * ADR-782 §19 — «πόσο έδαφος βλέπει αυτή η κάμερα;», κλειδωμένο.
 *
 * 🔴 Η βλάβη που γέννησε το module ήταν **αόρατη σε κάθε υπάρχουσα άγκυρα**: το τρισδιάστατο
 * υπόβαθρο ζητούσε καρέ σωστά (§17, 12 άγκυρες, όλες πράσινες) και ζωγράφιζε — απλώς ζωγράφιζε
 * **40 × 40 m** ενώ η οθόνη έδειχνε εκατοντάδες μέτρα. Ένα «ζητήθηκε καρέ;» δεν μπορεί να πιάσει
 * ένα «ποια έκταση;»· γι' αυτό οι άγκυρες εδώ μιλούν αποκλειστικά για **έκταση**.
 *
 * ## Γιατί τα νούμερα δεν είναι αυθαίρετα
 * Οι δύο βασικές (`Φ1`, `Φ2`) είναι **βαθμονόμηση**, όχι δείγμα: η κάθετη κάμερα έχει αναλυτικά
 * γνωστό αποτύπωμα (`2·tan(fov/2)·ύψος`) και ελέγχεται σε ±10%, ενώ η λοξή έχει επίσης αναλυτικά
 * γνωστό (τομές των ακμών του frustum με το επίπεδο) και ελέγχεται ως **λόγος** προς το ορατό
 * ύψος. Η παλιά υλοποίηση περνούσε την πρώτη και έπεφτε στη δεύτερη κατά έναν παράγοντα ~5.
 */

import * as THREE from 'three';
import { computeGroundFootprintMm, HORIZON_RADIUS_FACTOR } from '../ground-footprint';

const FOV = 50;
const ASPECT = 1.5;
const ORIGIN = new THREE.Vector3(0, 0, 0);

/** Το ορατό ύψος στο επίπεδο του στόχου, σε μέτρα — το μέγεθος που η παλιά υλοποίηση θεωρούσε αρκετό. */
function visibleHeightM(distanceM: number): number {
  return 2 * Math.tan(((FOV / 2) * Math.PI) / 180) * distanceM;
}

/**
 * Κάμερα που κοιτάζει την αρχή από δεδομένη **γωνία ανύψωσης** και απόσταση.
 *
 * ⚠️ Το `updateMatrixWorld` είναι υποχρεωτικό: η `Raycaster.setFromCamera` διαβάζει το
 * `matrixWorld`, που έξω από βρόχο απόδοσης μένει μπαγιάτικο. Χωρίς αυτό κάθε ακτίνα θα έβγαινε
 * από την αρχή των αξόνων και τα tests θα μετρούσαν **άλλη κάμερα** από αυτήν που έστησαν.
 */
function perspectiveAtElevation(elevationDeg: number, distanceM: number): THREE.PerspectiveCamera {
  const rad = (elevationDeg * Math.PI) / 180;
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 5000);
  camera.position.set(0, distanceM * Math.sin(rad), distanceM * Math.cos(rad));
  if (elevationDeg > 89) camera.up.set(0, 0, -1);
  camera.lookAt(ORIGIN);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

function spanM(f: { minX: number; maxX: number; minY: number; maxY: number }) {
  return { x: (f.maxX - f.minX) / 1000, y: (f.maxY - f.minY) / 1000 };
}

describe('computeGroundFootprintMm — η έκταση βγαίνει από τη ΓΕΩΜΕΤΡΙΑ (ADR-782 §19)', () => {
  it('🎯 Φ1: λοξή κάμερα βλέπει ΠΟΛΛΑΠΛΑΣΙΟ του ορατού ύψους — εδώ έσπασε το παλιό «×1,1»', () => {
    const distance = 19.5; // η ζωντανά μετρημένη απόσταση της βλάβης
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(30, distance), ORIGIN, -10);

    expect(footprint).not.toBeNull();
    // Αναλυτικά: κάτω ακμή σε 55° ⇒ ~6,8 m· πάνω ακμή σε 5° ⇒ ~111 m ⇒ βάθος ~104 m έναντι
    // ορατού ύψους ~18,2 m. Ο παλιός υπολογισμός έδινε 1,1× — δηλαδή κάτω από το ένα πέμπτο.
    expect(spanM(footprint!).y).toBeGreaterThan(visibleHeightM(distance) * 3);
  });

  it('🎯 Φ2: ΚΑΘΕΤΗ κάμερα ⇒ αποτύπωμα ≈ το αναλυτικό ορατό μέγεθος (καμία αυθαίρετη διόγκωση)', () => {
    const distance = 20;
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(90, distance), ORIGIN, -10);

    expect(footprint).not.toBeNull();
    const expectedH = visibleHeightM(distance);
    expect(spanM(footprint!).y).toBeGreaterThan(expectedH * 0.9);
    expect(spanM(footprint!).y).toBeLessThan(expectedH * 1.1);
    expect(spanM(footprint!).x).toBeGreaterThan(expectedH * ASPECT * 0.9);
  });

  it('🎯 Φ3: ΟΡΘΟΓΡΑΦΙΚΗ κάμερα δίνει πεπερασμένο αποτύπωμα — εκεί έσβηνε σιωπηλά το υπόβαθρο', () => {
    const camera = new THREE.OrthographicCamera(-30, 30, 20, -20, 0.1, 5000);
    camera.position.set(0, 50, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(ORIGIN);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const footprint = computeGroundFootprintMm(camera, ORIGIN, -10);

    expect(footprint).not.toBeNull();
    // Το ορθογραφικό frustum είναι 60 × 40 μονάδες σκηνής ⇒ 60.000 × 40.000 mm, ανεξάρτητα απόστασης.
    expect(spanM(footprint!).x).toBeCloseTo(60, 0);
    expect(spanM(footprint!).y).toBeCloseTo(40, 0);
    expect(footprint!.horizonClamped).toBe(false);
  });

  it('🎯 Φ4: πάνω από τον ΟΡΙΖΟΝΤΑ ⇒ πεπερασμένο αποτύπωμα + δηλωμένο ταβάνι, ποτέ Infinity/NaN', () => {
    // Ανύψωση 20° με μισό άνοιγμα 25°: η πάνω ακμή δείχνει 5° ΠΑΝΩ από το οριζόντιο, δηλαδή δεν
    // τέμνει ποτέ το έδαφος. Χωρίς ταβάνι το ορθογώνιο γίνεται άπειρο και ο επιλογέας επιπέδου
    // κατεβαίνει στο 0 — «όλη η Γη σε ένα πλακίδιο».
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(20, 19.5), ORIGIN, -10);

    expect(footprint).not.toBeNull();
    expect(footprint!.horizonClamped).toBe(true);
    for (const v of [footprint!.minX, footprint!.maxX, footprint!.minY, footprint!.maxY]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    // Το ταβάνι είναι ακτίνα γύρω από τον στόχο ⇒ η διάμετρος δεν μπορεί να το ξεπεράσει.
    expect(spanM(footprint!).y).toBeLessThanOrEqual(2 * 19.5 * HORIZON_RADIUS_FACTOR + 1);
  });

  it('🎯 Φ5: το ταβάνι ΚΛΙΜΑΚΩΝΕΤΑΙ με την απόσταση — σταθερό μήκος θα ήταν λάθος σε δύο κλίμακες', () => {
    const near = computeGroundFootprintMm(perspectiveAtElevation(20, 10), ORIGIN, -10);
    const far = computeGroundFootprintMm(perspectiveAtElevation(20, 200), ORIGIN, -10);

    expect(near!.horizonClamped).toBe(true);
    expect(far!.horizonClamped).toBe(true);
    expect(spanM(far!).y).toBeGreaterThan(spanM(near!).y * 5);
  });

  it('🎯 Φ6: σε λοξή θέαση το κέντρο πέφτει ΜΠΡΟΣΤΑ από τον στόχο — γι΄ αυτό η κλίμακα μετριέται εκεί', () => {
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(30, 19.5), ORIGIN, -10);

    // Η κάμερα κάθεται σε +Z και κοιτάζει προς −Z· το ορατό έδαφος απλώνεται μπροστά της.
    expect(footprint!.centreWorld.z).toBeLessThan(-5);
  });

  it('🎯 Φ7: οι μονάδες είναι ΧΙΛΙΟΣΤΑ κάτοψης — ένα σφάλμα ×1000 θα έδειχνε πάλι κηλίδα', () => {
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(90, 20), ORIGIN, -10);

    expect(footprint!.maxX - footprint!.minX).toBeGreaterThan(10_000);
  });

  it('🎯 Φ8: ο άξονας Y της κάτοψης είναι το ΑΝΤΙΘΕΤΟ του Z της σκηνής (ADR-009)', () => {
    const footprint = computeGroundFootprintMm(perspectiveAtElevation(30, 19.5), ORIGIN, -10);

    // centreWorld.z < 0 ⇒ το κέντρο σε mm κάτοψης πρέπει να έχει y > 0. Αν η μετατροπή μεταφερόταν
    // ονομαστικά (minZ→minY) αντί να ξαναϋπολογιστεί, τα άκρα θα έβγαιναν ανεστραμμένα.
    expect((footprint!.minY + footprint!.maxY) / 2).toBeGreaterThan(0);
    expect(footprint!.maxY).toBeGreaterThan(footprint!.minY);
    expect(footprint!.maxX).toBeGreaterThan(footprint!.minX);
  });
});
