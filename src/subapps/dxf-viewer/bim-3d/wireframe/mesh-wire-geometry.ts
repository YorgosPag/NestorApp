/**
 * mesh-wire-geometry — η γεωμετρία που κουβαλά το `aWireCode`, **μία φορά ανά asset** (ADR-689 Φ3).
 *
 * ## Το πρόβλημα που λύνει το cache
 *
 * Ο `bimMeshCache.getInstance` επιστρέφει `template.clone(true)`, και το three **δεν** κλωνοποιεί
 * γεωμετρίες — τα 40 αντίγραφα μιας καρέκλας δείχνουν στο ΙΔΙΟ buffer. Η Φ2 έσπασε ακριβώς αυτό:
 * το `WireframeGeometry` έχτιζε νέο buffer **ανά instance ανά child mesh**. Εδώ το παράγωγο
 * geometry είναι memoised πάνω στην ΠΗΓΗ (`WeakMap`, το πρότυπο του `ensure-double-sided`), άρα
 * 40 καρέκλες μοιράζονται **ένα** παράγωγο.
 *
 * ## Μηδενική αντιγραφή δεδομένων
 *
 * Το παράγωγο δεν είναι `clone()`: είναι ένα νέο `BufferGeometry` που **μοιράζεται τα ίδια
 * attribute αντικείμενα** (position/normal/uv) με την πηγή και προσθέτει μόνο το δικό του
 * `aWireCode` (4 bytes/κορυφή). Εξαίρεση: indexed πηγή, όπου το `toNonIndexed()` οφείλει να
 * ξεδιπλώσει τις κορυφές — αυτό είναι εγγενές στη βαρυκεντρική τεχνική (κάθε κορυφή πρέπει να
 * ανήκει σε ΕΝΑ τρίγωνο για να έχει σταθερή γωνία) και συμβαίνει επίσης μία φορά ανά asset.
 *
 * ## Ιδιοκτησία / dispose
 *
 * Δεν υπάρχει ρητό teardown, και σκόπιμα: το `WeakMap` αφήνει το παράγωγο να συλλεχθεί μαζί με την
 * πηγή του. Το `BimSceneLayer.clearGroup()` καλεί `geometry.dispose()` σε κάθε mesh του rebuild —
 * αυτό ελευθερώνει μόνο τα GPU buffers, τα CPU attributes μένουν ανέπαφα και το three τα
 * ξανα-ανεβάζει στο επόμενο render. Ισχύει ήδη σήμερα για κάθε shared template geometry των
 * βιβλιοθηκών· το παράγωγο απλώς ακολουθεί τον ίδιο κύκλο.
 *
 * @see ./mesh-wire-encoding — τι ακριβώς περιέχει το `aWireCode`
 * @see ../materials/ensure-double-sided — το ίδιο WeakMap πρότυπο για υλικά
 */

import * as THREE from 'three';
import type { MeshWireMode } from '../../config/bim-visual-style';
import { computeWireCodes, WIRE_CODE_ATTRIBUTE } from './mesh-wire-encoding';

/** πηγή → (mode+κατώφλι) → παράγωγο. Auto-GC μαζί με την πηγή. */
const WIRE_GEOMETRY_CACHE = new WeakMap<THREE.BufferGeometry, Map<string, THREE.BufferGeometry>>();

/** Το κλειδί παραλλαγής — δύο διαφορετικά modes ζουν ταυτόχρονα χωρίς να διώχνει το ένα το άλλο. */
function variantKey(mode: MeshWireMode, thresholdDeg: number): string {
  return `${mode}|${thresholdDeg}`;
}

/**
 * Νέο geometry που μοιράζεται τα attributes της πηγής. Αντιγράφονται και τα προϋπολογισμένα bounds
 * (γλιτώνουν επανυπολογισμό σε raycast / frustum culling). Τα `groups` δεν μεταφέρονται: το
 * wireframe ζωγραφίζεται με ΕΝΑ material, οπότε το three αγνοεί ούτως ή άλλως τα groups.
 */
function shallowGeometryFrom(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  for (const name of Object.keys(source.attributes)) {
    const attribute = source.attributes[name];
    if (attribute) geo.setAttribute(name, attribute);
  }
  if (source.boundingBox) geo.boundingBox = source.boundingBox.clone();
  if (source.boundingSphere) geo.boundingSphere = source.boundingSphere.clone();
  return geo;
}

/** Χτίζει το παράγωγο (χωρίς cache). Επιστρέφει `null` όταν η πηγή δεν έχει θέσεις. */
function buildWireReadyGeometry(
  source: THREE.BufferGeometry,
  mode: MeshWireMode,
  thresholdDeg: number,
): THREE.BufferGeometry | null {
  // Η βαρυκεντρική τεχνική απαιτεί κάθε κορυφή να ανήκει σε ένα μόνο τρίγωνο.
  const expanded = source.getIndex() ? source.toNonIndexed() : source;
  const positions = expanded.getAttribute('position');
  if (!positions || positions.count === 0) return null;

  const codes = computeWireCodes(
    positions.array as ArrayLike<number>,
    mode,
    thresholdDeg,
  );
  // Indexed πηγή: το `toNonIndexed` έδωσε ήδη φρέσκο geometry, το κρατάμε. Non-indexed πηγή: νέο
  // κέλυφος γύρω από τα ΙΔΙΑ attributes, ώστε να μη μολυνθεί το template με το attribute μας.
  const geo = expanded === source ? shallowGeometryFrom(source) : expanded;
  geo.setAttribute(WIRE_CODE_ATTRIBUTE, new THREE.Float32BufferAttribute(codes, 1));
  return geo;
}

/**
 * Η γεωμετρία της `source` εμπλουτισμένη με το `aWireCode`, memoised ανά πηγή + παραλλαγή.
 * Επιστρέφει `null` για κενή/εκφυλισμένη πηγή (ο καλών αφήνει το mesh ως έχει).
 */
export function getWireReadyGeometry(
  source: THREE.BufferGeometry,
  mode: MeshWireMode,
  thresholdDeg: number,
): THREE.BufferGeometry | null {
  let variants = WIRE_GEOMETRY_CACHE.get(source);
  if (!variants) {
    variants = new Map<string, THREE.BufferGeometry>();
    WIRE_GEOMETRY_CACHE.set(source, variants);
  }
  const key = variantKey(mode, thresholdDeg);
  const cached = variants.get(key);
  if (cached) return cached;

  const built = buildWireReadyGeometry(source, mode, thresholdDeg);
  if (built) variants.set(key, built);
  return built;
}

/** True όταν η γεωμετρία κουβαλά ήδη το attribute (idempotency guard για τους callers). */
export function hasWireCodes(geometry: THREE.BufferGeometry): boolean {
  return geometry.getAttribute(WIRE_CODE_ATTRIBUTE) !== undefined;
}
