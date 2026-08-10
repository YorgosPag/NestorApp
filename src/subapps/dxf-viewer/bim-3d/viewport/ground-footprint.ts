/**
 * «Ποιο κομμάτι του **εδάφους** βλέπει αυτή η κάμερα;» — μία ερώτηση, μία απάντηση.
 *
 * ## Γιατί δεν αρκεί η απόσταση από τον στόχο
 * Κάθε στρώμα που ζωγραφίζει **πεπερασμένο** υλικό στο οριζόντιο επίπεδο (πλακίδια χάρτη,
 * ορθοφωτογραφία, πλέγμα από αρχείο) πρέπει να ξέρει *πόσο* έδαφος χρειάζεται. Η προφανής
 * απάντηση — «όσο το ορατό ύψος στον στόχο» — είναι σωστή **μόνο για κάθετη κάμερα**. Σε λοξή
 * θέαση η ίδια οθόνη πατάει στο έδαφος ένα τραπέζιο που εκτείνεται ως τον ορίζοντα: μετρημένο
 * ζωντανά (ADR-782 §19), κάμερα σε **19,5 m** από τον στόχο με ορατό ύψος **18 m** έβλεπε
 * εκατοντάδες μέτρα εδάφους, ενώ ο καταναλωτής ζητούσε ορθογώνιο **40 × 40 m** — δηλαδή χάρτη
 * που ζωγραφιζόταν σωστά και **δεν φαινόταν**, γιατί ήταν μια κηλίδα γύρω από τον στόχο.
 *
 * ## 🔑 Η γεωμετρία απαντά· η σταθερά μιλά μόνο εκεί που η γεωμετρία λέει «άπειρο»
 * Κάθε δείγμα της οθόνης γίνεται ακτίνα και τέμνεται με το επίπεδο του εδάφους. Όπου η τομή
 * είναι **πεπερασμένη**, αυτή είναι η απάντηση — καμία σταθερά δεν την πειράζει. Όπου η ακτίνα
 * κοιτάζει πάνω από τον ορίζοντα (ή τον συναντά τόσο λοξά που η τομή φεύγει), η απάντηση είναι
 * κυριολεκτικά άπειρη και **κάποιος πρέπει να πει πού σταματάμε**: εκεί —και μόνο εκεί— μπαίνει
 * το {@link HORIZON_RADIUS_FACTOR}. Χωρίς αυτό το ταβάνι το ορθογώνιο γίνεται άπειρο, ο επιλογέας
 * επιπέδου κατεβαίνει στο 0, και ο χρήστης παίρνει **όλη τη Γη σε ένα πλακίδιο** — τεχνικά χάρτη,
 * πρακτικά τίποτα.
 *
 * ## Και οι δύο κάμερες, χωρίς κλάδο
 * Η `Raycaster.setFromCamera` του three.js παράγει τη σωστή ακτίνα για προοπτική **και** για
 * ορθογραφική. Αυτό δεν είναι λεπτομέρεια: το ίδιο αρχείο που γέννησε αυτό το module είχε ήδη
 * πληρώσει έναν χειρόγραφο κλώνο «`instanceof PerspectiveCamera` ⇒ αλλιώς 0», που έσβηνε σιωπηλά
 * το υπόβαθρο σε κάτοψη και όψεις (ADR-782 §17· και πριν από αυτό ADR-363, ίδιο σφάλμα, άλλο
 * θύμα). Ένα σκέλος λιγότερο δεν είναι απλοποίηση — είναι βλάβη που περιμένει.
 */

import * as THREE from 'three';
import { worldToDxfPlan } from './coordinate-transforms';

/**
 * Πόσο μακριά «βλέπουμε» όταν η γεωμετρία απαντά *άπειρο*, ως πολλαπλάσιο της απόστασης
 * κάμερας-στόχου.
 *
 * Πολλαπλάσιο και όχι απόλυτο μήκος, ώστε να ακολουθεί αυτό που κοιτάζει ο χρήστης: σε κάτοψη
 * δωματίου το ταβάνι είναι μέτρα, σε εναέρια θέα οικοπέδου εκατοντάδες μέτρα. Η τιμή **10**
 * καλύπτει με άνεση κάθε ρεαλιστική γωνία θέασης (σε 45°-60° το ορατό έδαφος μπροστά είναι
 * περίπου 5-15 φορές η απόσταση) και δεν χρειάζεται να είναι ακριβής προς τα πάνω: ο καταναλωτής
 * έχει ταβάνι πλήθους που κατεβάζει επίπεδο λεπτομέρειας, οπότε ένα γενναιόδωρο ορθογώνιο κοστίζει
 * ευκρίνεια, ενώ ένα φειδωλό κοστίζει **ορατότητα**.
 */
export const HORIZON_RADIUS_FACTOR = 10;

/**
 * Δείγματα ανά άξονα σε κανονικοποιημένες συντεταγμένες συσκευής.
 *
 * ⚠️ **Τρία, όχι δύο.** Με μόνο τις τέσσερις γωνίες, μια κάμερα που κοιτάζει τον ορίζοντα δίνει
 * δύο κοντινές τομές (κάτω γωνίες) και δύο απείρως μακρινές (πάνω γωνίες) — και το ορθογώνιο
 * που προκύπτει αγνοεί ό,τι υπάρχει στο **κέντρο** της οθόνης, ακριβώς εκεί που κοιτάζει ο
 * χρήστης. Τα ενδιάμεσα δείγματα κοστίζουν πέντε ακτίνες ανά καρέ.
 */
const NDC_SAMPLES = [-1, 0, 1] as const;

/** Το ορατό έδαφος σε **χιλιοστά κάτοψης** — οι μονάδες που μιλούν όλοι οι καταναλωτές εδάφους. */
export interface GroundFootprintMm {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  /** Το κέντρο του αποτυπώματος σε μονάδες σκηνής — εκεί μετριέται η κλίμακα (δες την επικεφαλίδα). */
  readonly centreWorld: THREE.Vector3;
  /** `true` όταν τουλάχιστον ένα δείγμα χρειάστηκε το ταβάνι ορίζοντα. Διαγνωστικό, όχι σφάλμα. */
  readonly horizonClamped: boolean;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Το σημείο εδάφους προς το οποίο δείχνει μια ακτίνα, με ταβάνι.
 *
 * Επιστρέφει `null` μόνο όταν η ακτίνα δεν έχει **καμία** οριζόντια κατεύθυνση (κοιτάζει ίσια
 * πάνω ή ίσια κάτω) και δεν τέμνει: τότε δεν υπάρχει κατεύθυνση να περιοριστεί.
 */
function groundPointFor(
  ray: THREE.Ray,
  plane: THREE.Plane,
  anchor: THREE.Vector3,
  maxRadius: number,
): { point: THREE.Vector3; clamped: boolean } | null {
  const hit = ray.intersectPlane(plane, _hit);
  if (hit) {
    const dx = hit.x - anchor.x;
    const dz = hit.z - anchor.z;
    const radius = Math.hypot(dx, dz);
    if (radius <= maxRadius) return { point: hit.clone(), clamped: false };
    const k = maxRadius / radius;
    return { point: new THREE.Vector3(anchor.x + dx * k, hit.y, anchor.z + dz * k), clamped: true };
  }
  // Πάνω από τον ορίζοντα: η τομή είναι στο άπειρο, οπότε κρατάμε την **κατεύθυνση** και κόβουμε.
  const horizontal = Math.hypot(ray.direction.x, ray.direction.z);
  if (horizontal < 1e-9) return null;
  const k = maxRadius / horizontal;
  return {
    point: new THREE.Vector3(anchor.x + ray.direction.x * k, anchor.y, anchor.z + ray.direction.z * k),
    clamped: true,
  };
}

/**
 * Το ορατό έδαφος της τρέχουσας κάμερας, σε χιλιοστά κάτοψης.
 *
 * `groundElevationMm` είναι το ύψος του επιπέδου που μας ενδιαφέρει (ο χάρτης κάθεται λίγο κάτω
 * από το επίπεδο εργασίας). Επιστρέφει `null` όταν ο καμβάς δεν έχει ακόμη διαστάσεις ή όταν
 * καμία ακτίνα δεν παρήγαγε σημείο — καταστάσεις όπου κάθε αριθμός θα ήταν επινοημένος.
 */
export function computeGroundFootprintMm(
  camera: THREE.Camera,
  target: THREE.Vector3,
  groundElevationMm: number,
): GroundFootprintMm | null {
  const groundY = groundElevationMm / 1000;
  _plane.setFromNormalAndCoplanarPoint(_up, new THREE.Vector3(0, groundY, 0));

  const anchor = new THREE.Vector3(target.x, groundY, target.z);
  const maxRadius = Math.max(camera.position.distanceTo(target), 1) * HORIZON_RADIUS_FACTOR;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let clamped = false;

  for (const ndcY of NDC_SAMPLES) {
    for (const ndcX of NDC_SAMPLES) {
      _ndc.set(ndcX, ndcY);
      _raycaster.setFromCamera(_ndc, camera);
      const sample = groundPointFor(_raycaster.ray, _plane, anchor, maxRadius);
      if (!sample) continue;
      clamped = clamped || sample.clamped;
      minX = Math.min(minX, sample.point.x);
      maxX = Math.max(maxX, sample.point.x);
      minZ = Math.min(minZ, sample.point.z);
      maxZ = Math.max(maxZ, sample.point.z);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minZ)) return null;

  // Οι δύο αντιδιαμετρικές γωνίες αρκούν για το πλαίσιο: ο άξονας Y της κάτοψης είναι το
  // **αντίθετο** του Z της σκηνής, οπότε η μετατροπή αντιστρέφει τη σειρά — γι' αυτό min/max
  // ξαναϋπολογίζονται μετά τη μετατροπή αντί να μεταφερθούν ονομαστικά.
  const a = worldToDxfPlan(new THREE.Vector3(minX, groundY, minZ));
  const b = worldToDxfPlan(new THREE.Vector3(maxX, groundY, maxZ));

  return {
    minX: Math.min(a.x, b.x),
    maxX: Math.max(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxY: Math.max(a.y, b.y),
    centreWorld: new THREE.Vector3((minX + maxX) / 2, groundY, (minZ + maxZ) / 2),
    horizonClamped: clamped,
  };
}
