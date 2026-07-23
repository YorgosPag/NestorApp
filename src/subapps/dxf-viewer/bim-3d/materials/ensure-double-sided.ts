/**
 * ensure-double-sided — η ΜΟΝΑΔΙΚΗ SSoT για «κάνε αυτό το material double-sided χωρίς να μολύνεις
 * την πηγή» (N.18 / ADR-584). Πριν αυτό το module υπήρχαν ΔΥΟ σχεδόν πανομοιότυπα helpers:
 * `doubleSidedVariant` (WeakMap-cached, `MaterialCatalog3D`) και `ensureDoubleSided` (uncached,
 * `bim-three-faced-prism`). Ενοποιήθηκαν εδώ — μηδέν structural clone.
 *
 * ## Γιατί WeakMap-cached (και όχι σκέτο clone)
 *
 * Όταν η πηγή είναι **shared singleton** (per-face painting reuse-άρει το ίδιο catalog material σε
 * N όψεις· ένα εισαγόμενο template μοιράζεται τα materials με όλα τα instances του), το caching δίνει
 * **ΕΝΑ** double-sided clone αντί για N. Όταν η πηγή είναι fresh-per-call, το WeakMap απλώς δεν
 * χτυπά ποτέ cache (η εγγραφή GC-άρεται μαζί με την πηγή) — άρα το cached helper είναι **superset**:
 * πάντα σωστό, συχνά φθηνότερο.
 *
 * ## Ιδιοκτησία (never dispose)
 *
 * Το clone **μοιράζεται** τα texture objects της πηγής (`Material.clone` αντιγράφει map references,
 * ΠΟΤΕ το GPU texture) → **ΠΟΤΕ** dispose per-mesh (θα κατέστρεφε τις υφές της πηγής). WeakMap →
 * auto-invalidate: όταν το preload→resync swap δώσει ΝΕΟ textured instance πηγής, το miss χτίζει νέο
 * clone και το παλιό source+clone γίνονται GC.
 *
 * @see ./MaterialCatalog3D — per-face painted όψεις (ADR-539 Φ4d)
 * @see ../converters/bim-three-faced-prism — hole-wall faces (ADR-539 Φ2)
 * @see ../converters/imported-mesh-material-enhance — imported mesh culling fix (ADR-683 §10.6)
 */

import * as THREE from 'three';

/** source → cached double-sided clone. Keyed by the source material instance (auto-GC). */
const DOUBLE_SIDED_CACHE = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Επιστρέφει την πηγή αν είναι ήδη `DoubleSide`, αλλιώς ένα **cached** double-sided clone (ίδια
 * εμφάνιση + μοιρασμένες υφές, και οι δύο όψεις). Γενικό στον τύπο ώστε ένα `MeshStandardMaterial`
 * input να επιστρέφει `MeshStandardMaterial` — το `Material.clone()` διατηρεί τη συγκεκριμένη κλάση.
 */
export function ensureDoubleSided<T extends THREE.Material>(source: T): T {
  if (source.side === THREE.DoubleSide) return source;
  let clone = DOUBLE_SIDED_CACHE.get(source) as T | undefined;
  if (!clone) {
    clone = source.clone() as T;
    clone.side = THREE.DoubleSide;
    DOUBLE_SIDED_CACHE.set(source, clone);
  }
  return clone;
}
